-- Phase 02D-05: finalize_rpc_v2
-- Extends finalize_workout to accept the pre-computed canonical cell set and
-- record territory captures + cell ownership in the same atomic transaction.
--
-- Key changes from v1 (20260602184810_finalize_rpc.sql):
--   * Signature: (p_workout_id uuid, p_cell_ids text[], p_user_id uuid)
--     p_user_id replaces auth.uid() -- service-role calls return null for auth.uid().
--     The server action verifies the caller's JWT via getUser() before invoking
--     the RPC and passes the verified uid as p_user_id.
--   * Capture logic: INSERT territory_captures + UPSERT cell_ownership per cell.
--   * Grant change: EXECUTE revoked from authenticated; granted to service_role only.
--     v1 function (uuid) is also dropped so the old grant cannot be exploited.
--
-- Security model:
--   SECURITY DEFINER + set search_path = '' (same as v1).
--   The RPC is no longer PostgREST-reachable by authenticated users.
--   Only a caller with the service-role key can invoke it, which means only the
--   Next.js server action (never the browser bundle) can reach it (ADR sec.4, Option A).
--
-- Rollback: restore v1 function + grants from 20260602184810_finalize_rpc.sql.

-- ---------------------------------------------------------------------------
-- 1. Drop v1 function if it still exists (idempotent -- may already be gone)
-- ---------------------------------------------------------------------------

do $$ begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'finalize_workout'
      and pg_get_function_identity_arguments(p.oid) = 'p_workout_id uuid'
  ) then
    revoke execute on function public.finalize_workout(uuid) from authenticated;
    revoke execute on function public.finalize_workout(uuid) from public;
    revoke execute on function public.finalize_workout(uuid) from anon;
    drop function public.finalize_workout(uuid);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Create v2 function
-- ---------------------------------------------------------------------------

create or replace function public.finalize_workout(
  p_workout_id uuid,
  p_cell_ids   text[],
  p_user_id    uuid
)
returns public.finalize_workout_result
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workout       public.workouts%rowtype;
  v_path          extensions.geography;
  v_point_count   integer;
  v_distance_m    integer;
  v_duration_s    integer;
  v_avg_pace      integer;

  -- Capture counters
  v_claimed       integer := 0;
  v_stolen        integer := 0;
  v_defended      integer := 0;

  -- Per-cell iteration
  v_cell_id       text;
  v_current_owner uuid;
  v_action        text;
begin
  -- p_user_id replaces auth.uid() for service-role callers (auth.uid() is null
  -- for a service-role call). The server action already verified the JWT.
  if p_user_id is null then
    raise exception 'finalize_workout: p_user_id is required' using errcode = '42501';
  end if;

  -- Lock the workout row for the transaction (arch 8.5).
  select * into v_workout from public.workouts where id = p_workout_id for update;

  if not found then
    raise exception 'finalize_workout: workout not found' using errcode = 'P0002';
  end if;

  -- Owner-scoped: caller must own the workout (FR-RP-3 / finalize trust boundary).
  -- Uses p_user_id instead of auth.uid() since the RPC is now service-role-only.
  if v_workout.user_id <> p_user_id then
    raise exception 'finalize_workout: not authorized' using errcode = '42501';
  end if;

  -- Idempotent (FR-RP-4): re-finalizing a completed workout returns the stored
  -- record with no recompute and no side effects (no double-counting of cells).
  if v_workout.status = 'completed' then
    -- Recount from the audit log so the return value is consistent with reality.
    select
      count(*) filter (where action = 'claim'),
      count(*) filter (where action = 'steal'),
      count(*) filter (where action = 'defend')
    into v_claimed, v_stolen, v_defended
    from public.territory_captures
    where workout_id = p_workout_id;

    return row(
      v_workout.id, v_workout.status, v_workout.distance_m, v_workout.duration_s,
      v_workout.avg_pace_s_per_km, v_workout.xp_awarded,
      v_claimed, v_stolen, v_defended
    )::public.finalize_workout_result;
  end if;

  if v_workout.status <> 'recording' then
    raise exception 'finalize_workout: workout is not active (status=%)', v_workout.status
      using errcode = 'P0001';
  end if;

  -- ---------------------------------------------------------------------------
  -- Compose the canonical LINESTRING from raw points (identical to v1).
  -- Ordered by (recorded_at, batch_seq, point_seq) -- mirrors the TypeScript
  -- captureCells sort order so the LINESTRING and cell set agree (arch sec.4.1 / R-03).
  -- ---------------------------------------------------------------------------
  select
    extensions.st_setsrid(
      extensions.st_makeline(
        extensions.st_makepoint(rp.lng, rp.lat)
        order by rp.recorded_at, rp.batch_seq, rp.point_seq
      ),
      4326
    )::extensions.geography,
    count(*)
  into v_path, v_point_count
  from public.route_points rp
  where rp.workout_id = p_workout_id;

  -- A LINESTRING needs >= 2 vertices; fewer points => no path, zero distance.
  if v_point_count >= 2 then
    v_distance_m := round(extensions.st_length(v_path))::integer;
  else
    v_path := null;
    v_distance_m := 0;
  end if;

  -- Duration is elapsed wall-clock from start to finalize (decision 1, v1).
  v_duration_s := greatest(0, floor(extract(epoch from (now() - v_workout.started_at)))::integer);

  -- Average pace (s/km) only when distance is positive.
  if v_distance_m > 0 then
    v_avg_pace := round(v_duration_s::numeric * 1000 / v_distance_m)::integer;
  else
    v_avg_pace := null;
  end if;

  -- Update the workout record (same fields as v1).
  update public.workouts
  set status            = 'completed',
      ended_at          = now(),
      path              = v_path,
      distance_m        = v_distance_m,
      duration_s        = v_duration_s,
      avg_pace_s_per_km = v_avg_pace
  where id = p_workout_id;

  -- ---------------------------------------------------------------------------
  -- Territory capture loop
  --
  -- For each cell in p_cell_ids:
  --   1. Lock the cell_ownership row (if it exists) FOR UPDATE to prevent
  --      concurrent finalizations from racing on the same cell.
  --   2. Classify: claim (no owner), steal (different owner), defend (same owner).
  --   3. INSERT an audit entry into territory_captures.
  --   4. UPSERT cell_ownership (last-writer-wins).
  -- ---------------------------------------------------------------------------
  foreach v_cell_id in array coalesce(p_cell_ids, array[]::text[]) loop
    -- Try to read + lock an existing ownership row.
    select owner_user_id
    into v_current_owner
    from public.cell_ownership
    where cell_id = v_cell_id
    for update;

    if not found then
      -- Cell is unclaimed.
      v_action := 'claim';
      v_claimed := v_claimed + 1;
    elsif v_current_owner = p_user_id then
      -- Cell already owned by this user -- defending.
      v_action := 'defend';
      v_defended := v_defended + 1;
    else
      -- Cell owned by another user -- stealing.
      v_action := 'steal';
      v_stolen := v_stolen + 1;
    end if;

    -- Audit entry (immutable log -- no UPDATE policy by design).
    insert into public.territory_captures (workout_id, user_id, cell_id, action)
    values (p_workout_id, p_user_id, v_cell_id, v_action);

    -- Live game board: last-writer-wins upsert.
    insert into public.cell_ownership (cell_id, owner_user_id, owned_since_workout_id, updated_at)
    values (v_cell_id, p_user_id, p_workout_id, now())
    on conflict (cell_id) do update
      set owner_user_id          = excluded.owner_user_id,
          owned_since_workout_id = excluded.owned_since_workout_id,
          updated_at             = excluded.updated_at;
  end loop;

  return row(
    p_workout_id, 'completed', v_distance_m, v_duration_s, v_avg_pace,
    null, v_claimed, v_stolen, v_defended
  )::public.finalize_workout_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Grant management
--    v2: EXECUTE granted only to service_role.
--    authenticated and public/anon cannot reach this function via PostgREST.
-- ---------------------------------------------------------------------------

revoke execute on function public.finalize_workout(uuid, text[], uuid) from public;
revoke execute on function public.finalize_workout(uuid, text[], uuid) from anon;
revoke execute on function public.finalize_workout(uuid, text[], uuid) from authenticated;
grant  execute on function public.finalize_workout(uuid, text[], uuid) to service_role;
