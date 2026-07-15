-- 20260628_finalize_workout_v4.sql
-- v4 changes vs v3:
--   1. p_active_duration_s: client supplies active (non-paused) duration so stored
--      duration_s and avg_pace_s_per_km reflect real running time, not wall-clock.
--   2. Serial FOREACH territory loop replaced with a single set-based CTE:
--      locks all existing cells at once (FOR UPDATE) then resolves claim/steal/defend
--      and batch-inserts territory_captures + batch-upserts cell_ownership in two
--      statements instead of 3×N individual statements.

CREATE OR REPLACE FUNCTION public.finalize_workout(
  p_workout_id        uuid,
  p_cell_ids          text[],
  p_user_id           uuid,
  p_active_duration_s integer DEFAULT NULL   -- nullable; falls back to wall-clock
)
RETURNS public.finalize_workout_result
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_workout       public.workouts%ROWTYPE;
  v_path          extensions.geography;
  v_point_count   integer;
  v_distance_m    integer;
  v_duration_s    integer;
  v_avg_pace      integer;

  v_claimed       integer := 0;
  v_stolen        integer := 0;
  v_defended      integer := 0;

  v_workout_xp    integer := 0;
  v_capture_xp    integer := 0;
  v_steal_xp      integer := 0;
  v_total_xp      integer := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'finalize_workout: p_user_id is required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_workout FROM public.workouts WHERE id = p_workout_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'finalize_workout: workout not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_workout.user_id <> p_user_id THEN
    RAISE EXCEPTION 'finalize_workout: not authorized' USING ERRCODE = '42501';
  END IF;

  -- Idempotent path (already completed).
  IF v_workout.status = 'completed' THEN
    SELECT
      count(*) FILTER (WHERE action = 'claim'),
      count(*) FILTER (WHERE action = 'steal'),
      count(*) FILTER (WHERE action = 'defend')
    INTO v_claimed, v_stolen, v_defended
    FROM public.territory_captures
    WHERE workout_id = p_workout_id;

    RETURN ROW(
      v_workout.id, v_workout.status, v_workout.distance_m, v_workout.duration_s,
      v_workout.avg_pace_s_per_km, v_workout.xp_awarded,
      v_claimed, v_stolen, v_defended
    )::public.finalize_workout_result;
  END IF;

  IF v_workout.status <> 'recording' THEN
    RAISE EXCEPTION 'finalize_workout: workout is not active (status=%)', v_workout.status
      USING ERRCODE = 'P0001';
  END IF;

  -- Build route geometry.
  SELECT
    extensions.st_setsrid(
      extensions.st_makeline(
        extensions.st_makepoint(rp.lng, rp.lat)
        ORDER BY rp.recorded_at, rp.batch_seq, rp.point_seq
      ),
      4326
    )::extensions.geography,
    count(*)
  INTO v_path, v_point_count
  FROM public.route_points rp
  WHERE rp.workout_id = p_workout_id;

  IF v_point_count >= 2 THEN
    v_distance_m := round(extensions.st_length(v_path))::integer;
  ELSE
    v_path := NULL;
    v_distance_m := 0;
  END IF;

  -- Duration: prefer client-supplied active time (excludes pauses); fall back to wall-clock.
  v_duration_s := COALESCE(
    p_active_duration_s,
    greatest(0, floor(extract(epoch FROM (now() - v_workout.started_at)))::integer)
  );

  IF v_distance_m > 0 THEN
    v_avg_pace := round(v_duration_s::numeric * 1000 / v_distance_m)::integer;
  ELSE
    v_avg_pace := NULL;
  END IF;

  UPDATE public.workouts
  SET status            = 'completed',
      ended_at          = now(),
      path              = v_path,
      distance_m        = v_distance_m,
      duration_s        = v_duration_s,
      avg_pace_s_per_km = v_avg_pace
  WHERE id = p_workout_id;

  -- Set-based territory CTE: lock all existing cell_ownership rows in one shot,
  -- resolve actions, then batch-insert captures and batch-upsert ownership.
  WITH
  input AS (
    SELECT unnest(coalesce(p_cell_ids, ARRAY[]::text[])) AS cell_id
  ),
  locked_owners AS (
    SELECT co.cell_id, co.owner_user_id
    FROM public.cell_ownership co
    WHERE co.cell_id = ANY(coalesce(p_cell_ids, ARRAY[]::text[]))
    FOR UPDATE
  ),
  resolved AS (
    SELECT
      i.cell_id,
      CASE
        WHEN lo.owner_user_id IS NULL     THEN 'claim'
        WHEN lo.owner_user_id = p_user_id THEN 'defend'
        ELSE                                   'steal'
      END AS action
    FROM input i
    LEFT JOIN locked_owners lo ON lo.cell_id = i.cell_id
  ),
  capture_insert AS (
    INSERT INTO public.territory_captures (workout_id, user_id, cell_id, action)
    SELECT p_workout_id, p_user_id, cell_id, action FROM resolved
    RETURNING cell_id
  ),
  ownership_upsert AS (
    INSERT INTO public.cell_ownership (cell_id, owner_user_id, owned_since_workout_id, updated_at)
    SELECT cell_id, p_user_id, p_workout_id, now()
    FROM resolved
    WHERE action IN ('claim', 'steal')
    ON CONFLICT (cell_id) DO UPDATE
      SET owner_user_id          = excluded.owner_user_id,
          owned_since_workout_id = excluded.owned_since_workout_id,
          updated_at             = excluded.updated_at
  )
  SELECT
    count(*) FILTER (WHERE action = 'claim'),
    count(*) FILTER (WHERE action = 'steal'),
    count(*) FILTER (WHERE action = 'defend')
  INTO v_claimed, v_stolen, v_defended
  FROM resolved;

  v_workout_xp := 25 + (floor(greatest(v_distance_m, 0)::numeric / 1000) * 5)::integer;
  v_capture_xp := v_claimed * 10;
  v_steal_xp   := v_stolen  * 25;
  v_total_xp   := v_workout_xp + v_capture_xp + v_steal_xp;

  UPDATE public.workouts SET xp_awarded = v_total_xp WHERE id = p_workout_id;

  IF v_workout_xp > 0 THEN
    INSERT INTO public.xp_events (user_id, workout_id, event_type, xp_awarded)
    VALUES (p_user_id, p_workout_id, 'workout', v_workout_xp);
  END IF;

  IF v_capture_xp > 0 THEN
    INSERT INTO public.xp_events (user_id, workout_id, event_type, xp_awarded)
    VALUES (p_user_id, p_workout_id, 'capture', v_capture_xp);
  END IF;

  IF v_steal_xp > 0 THEN
    INSERT INTO public.xp_events (user_id, workout_id, event_type, xp_awarded)
    VALUES (p_user_id, p_workout_id, 'steal', v_steal_xp);
  END IF;

  INSERT INTO public.user_xp (user_id, total_xp, level, updated_at)
  VALUES (p_user_id, v_total_xp, public.xp_level(v_total_xp), now())
  ON CONFLICT (user_id) DO UPDATE
    SET total_xp   = public.user_xp.total_xp + excluded.total_xp,
        level      = public.xp_level(public.user_xp.total_xp + excluded.total_xp),
        updated_at = excluded.updated_at;

  RETURN ROW(
    p_workout_id, 'completed', v_distance_m, v_duration_s, v_avg_pace,
    v_total_xp, v_claimed, v_stolen, v_defended
  )::public.finalize_workout_result;
END;
$$;

-- Permissions unchanged: service_role only.
REVOKE EXECUTE ON FUNCTION public.finalize_workout(uuid, text[], uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finalize_workout(uuid, text[], uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.finalize_workout(uuid, text[], uuid, integer) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.finalize_workout(uuid, text[], uuid, integer) TO service_role;
