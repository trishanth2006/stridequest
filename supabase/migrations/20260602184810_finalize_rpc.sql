-- Phase 02C-01: finalize_workout RPC v1 (geometry + derived metrics only).
-- The single atomic transition recording -> completed. Composes the canonical
-- LINESTRING from raw route_points, derives distance/duration/avg pace, and writes
-- them onto the workout. Capture (02D) and XP + profile rollup (02E) are NOT in
-- this version. Architecture: arch 3.3 (finalize trust boundary), 8.5 (one txn).
--
-- Decisions (02C-01):
--   * Duration  = elapsed wall-clock started_at -> finalize-time now() (decision 1).
--   * Distance  = PostGIS ST_Length over the geography path; DB is canonical (decision 2).
--   * Return    = a forward-compatible composite type declaring the full finalize
--                 contract now (decision 3). 02D/02E populate xp/cell fields via
--                 CREATE OR REPLACE without DROP/CREATE or signature churn.
--
-- Security: SECURITY DEFINER + locked search_path = '' (Phase 01 pattern); auth.uid()
-- ownership check inside the body; EXECUTE revoked from PUBLIC and anon, granted only
-- to authenticated. PostGIS lives in `extensions`, so PostGIS symbols are schema-qualified.
--
-- Rollback: drop function -> drop type. Stored workout data is unaffected.

create type public.finalize_workout_result as (
  workout_id        uuid,
  status            text,
  distance_m        integer,
  duration_s        integer,
  avg_pace_s_per_km integer,
  xp_awarded        integer,
  cells_claimed     integer,
  cells_stolen      integer,
  cells_defended    integer
);

create or replace function public.finalize_workout(p_workout_id uuid)
returns public.finalize_workout_result
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid         uuid := (select auth.uid());
  v_workout     public.workouts%rowtype;
  v_path        extensions.geography;
  v_point_count integer;
  v_distance_m  integer;
  v_duration_s  integer;
  v_avg_pace    integer;
begin
  if v_uid is null then
    raise exception 'finalize_workout: not authenticated' using errcode = '42501';
  end if;

  -- Lock the workout row for the transaction (arch 8.5).
  select * into v_workout from public.workouts where id = p_workout_id for update;

  if not found then
    raise exception 'finalize_workout: workout not found' using errcode = 'P0002';
  end if;

  -- Owner-scoped: caller must own the workout (FR-RP-3 / finalize trust boundary).
  if v_workout.user_id <> v_uid then
    raise exception 'finalize_workout: not authorized' using errcode = '42501';
  end if;

  -- Idempotent (FR-RP-4): re-finalizing a completed workout returns the stored
  -- record with no recompute and no side effects.
  if v_workout.status = 'completed' then
    return row(
      v_workout.id, v_workout.status, v_workout.distance_m, v_workout.duration_s,
      v_workout.avg_pace_s_per_km, v_workout.xp_awarded, null, null, null
    )::public.finalize_workout_result;
  end if;

  if v_workout.status <> 'recording' then
    raise exception 'finalize_workout: workout is not active (status=%)', v_workout.status
      using errcode = 'P0001';
  end if;

  -- Compose the canonical LINESTRING from raw points, ordered by the client clock
  -- with (batch_seq, point_seq) as a stable tiebreak. Points are already
  -- accuracy/dedupe-filtered client-side (arch 3.2).
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

  -- Duration is elapsed wall-clock from start to finalize (decision 1).
  v_duration_s := greatest(0, floor(extract(epoch from (now() - v_workout.started_at)))::integer);

  -- Average pace (s/km) only when distance is positive.
  if v_distance_m > 0 then
    v_avg_pace := round(v_duration_s::numeric * 1000 / v_distance_m)::integer;
  else
    v_avg_pace := null;
  end if;

  update public.workouts
  set status            = 'completed',
      ended_at          = now(),
      path              = v_path,
      distance_m        = v_distance_m,
      duration_s        = v_duration_s,
      avg_pace_s_per_km = v_avg_pace
  where id = p_workout_id;

  return row(
    p_workout_id, 'completed', v_distance_m, v_duration_s, v_avg_pace,
    null, null, null, null
  )::public.finalize_workout_result;
end;
$$;

revoke execute on function public.finalize_workout(uuid) from public;
revoke execute on function public.finalize_workout(uuid) from anon;
grant  execute on function public.finalize_workout(uuid) to authenticated;
