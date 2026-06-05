-- Phase 02E-01: finalize_workout RPC v3 (XP awards).
-- Extends v2 territory finalization to award XP atomically in the same
-- transaction, while preserving the existing trust boundary:
--   * SECURITY DEFINER
--   * set search_path = ''
--   * EXECUTE granted only to service_role
--   * p_user_id ownership check (service-role callers have null auth.uid())
--
-- XP rules (mirrors features/xp/services/xp.ts):
--   * workout completion: +25 XP
--   * distance: +5 XP per whole km (floor)
--   * neutral capture: +10 XP per claimed cell
--   * steal: +25 XP per stolen cell
--
-- Writes:
--   * workouts.xp_awarded
--   * xp_events (append-only audit; one row per non-zero award type)
--   * user_xp (cumulative total + derived level via xp_level())
--
-- Idempotency is preserved: re-finalizing a completed workout returns the
-- stored workout row and recounts existing territory captures only. No new
-- xp_events rows are inserted and user_xp is not incremented again.

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

  -- Territory counters
  v_claimed       integer := 0;
  v_stolen        integer := 0;
  v_defended      integer := 0;

  -- Per-cell iteration
  v_cell_id       text;
  v_current_owner uuid;
  v_action        text;

  -- XP breakdown
  v_workout_xp    integer := 0;
  v_capture_xp    integer := 0;
  v_steal_xp      integer := 0;
  v_total_xp      integer := 0;
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
  -- Uses p_user_id instead of auth.uid() since the RPC is service-role-only.
  if v_workout.user_id <> p_user_id then
    raise exception 'finalize_workout: not authorized' using errcode = '42501';
  end if;

  -- Idempotent (FR-RP-4): re-finalizing a completed workout returns the stored
  -- record with no recompute and no side effects (no double-counting of cells
  -- or XP). Territory counts are re-read from the immutable audit log.
  if v_workout.status = 'completed' then
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

  -- Compose the canonical LINESTRING from raw points (identical to v2).
  -- Ordered by (recorded_at, batch_seq, point_seq) to match the TypeScript
  -- captureCells sort order so the LINESTRING and cell set agree.
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

  -- Duration is elapsed wall-clock from start to finalize.
  v_duration_s := greatest(0, floor(extract(epoch from (now() - v_workout.started_at)))::integer);

  -- Average pace (s/km) only when distance is positive.
  if v_distance_m > 0 then
    v_avg_pace := round(v_duration_s::numeric * 1000 / v_distance_m)::integer;
  else
    v_avg_pace := null;
  end if;

  -- Persist the finalized workout metrics before territory/XP side effects.
  update public.workouts
  set status            = 'completed',
      ended_at          = now(),
      path              = v_path,
      distance_m        = v_distance_m,
      duration_s        = v_duration_s,
      avg_pace_s_per_km = v_avg_pace
  where id = p_workout_id;

  -- Territory capture loop (identical to v2).
  foreach v_cell_id in array coalesce(p_cell_ids, array[]::text[]) loop
    select owner_user_id
    into v_current_owner
    from public.cell_ownership
    where cell_id = v_cell_id
    for update;

    if not found then
      v_action := 'claim';
      v_claimed := v_claimed + 1;
    elsif v_current_owner = p_user_id then
      v_action := 'defend';
      v_defended := v_defended + 1;
    else
      v_action := 'steal';
      v_stolen := v_stolen + 1;
    end if;

    insert into public.territory_captures (workout_id, user_id, cell_id, action)
    values (p_workout_id, p_user_id, v_cell_id, v_action);

    insert into public.cell_ownership (cell_id, owner_user_id, owned_since_workout_id, updated_at)
    values (v_cell_id, p_user_id, p_workout_id, now())
    on conflict (cell_id) do update
      set owner_user_id          = excluded.owner_user_id,
          owned_since_workout_id = excluded.owned_since_workout_id,
          updated_at             = excluded.updated_at;
  end loop;

  -- XP formula mirrored from features/xp/services/xp.ts.
  v_workout_xp := 25 + (floor(greatest(v_distance_m, 0)::numeric / 1000) * 5)::integer;
  v_capture_xp := v_claimed * 10;
  v_steal_xp := v_stolen * 25;
  v_total_xp := v_workout_xp + v_capture_xp + v_steal_xp;

  update public.workouts
  set xp_awarded = v_total_xp
  where id = p_workout_id;

  -- Append-only XP audit (only non-zero categories produce rows).
  if v_workout_xp > 0 then
    insert into public.xp_events (user_id, workout_id, event_type, xp_awarded)
    values (p_user_id, p_workout_id, 'workout', v_workout_xp);
  end if;

  if v_capture_xp > 0 then
    insert into public.xp_events (user_id, workout_id, event_type, xp_awarded)
    values (p_user_id, p_workout_id, 'capture', v_capture_xp);
  end if;

  if v_steal_xp > 0 then
    insert into public.xp_events (user_id, workout_id, event_type, xp_awarded)
    values (p_user_id, p_workout_id, 'steal', v_steal_xp);
  end if;

  insert into public.user_xp (user_id, total_xp, level, updated_at)
  values (p_user_id, v_total_xp, public.xp_level(v_total_xp), now())
  on conflict (user_id) do update
    set total_xp = public.user_xp.total_xp + excluded.total_xp,
        level = public.xp_level(public.user_xp.total_xp + excluded.total_xp),
        updated_at = excluded.updated_at;

  return row(
    p_workout_id, 'completed', v_distance_m, v_duration_s, v_avg_pace,
    v_total_xp, v_claimed, v_stolen, v_defended
  )::public.finalize_workout_result;
end;
$$;

revoke execute on function public.finalize_workout(uuid, text[], uuid) from public;
revoke execute on function public.finalize_workout(uuid, text[], uuid) from anon;
revoke execute on function public.finalize_workout(uuid, text[], uuid) from authenticated;
grant  execute on function public.finalize_workout(uuid, text[], uuid) to service_role;
