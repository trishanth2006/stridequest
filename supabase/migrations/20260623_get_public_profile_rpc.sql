-- Public profile RPC: returns aggregated stats for any user by username.
-- SECURITY DEFINER so it bypasses RLS (same approach as leaderboard RPCs).
CREATE OR REPLACE FUNCTION get_public_profile(p_username text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_result  jsonb;
BEGIN
  -- Resolve username to user_id
  SELECT id INTO v_user_id
    FROM profiles
   WHERE username = p_username
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'userId',             v_user_id,
    'username',           p.username,
    'level',              COALESCE(x.level, 1),
    'totalXp',            COALESCE(x.total_xp, 0),
    'totalDistanceM',     COALESCE(agg.total_distance_m, 0),
    'totalWorkouts',      COALESCE(agg.total_workouts, 0),
    'territoriesOwned',   COALESCE(own.territories_owned, 0),
    'territoriesCaptured', COALESCE(cap.territories_captured, 0),
    'territoriesStolen',  COALESCE(cap.territories_stolen, 0),
    'fastest1K',          pr.fastest_1k,
    'fastest5K',          pr.fastest_5k,
    'fastest10K',         pr.fastest_10k,
    'longestRunM',        pr.longest_run_m
  )
  INTO v_result
  FROM profiles p
  LEFT JOIN user_xp x ON x.user_id = v_user_id
  LEFT JOIN (
    SELECT
      SUM(distance_m)   AS total_distance_m,
      COUNT(*)          AS total_workouts
    FROM workouts
    WHERE user_id = v_user_id
      AND status = 'completed'
  ) agg ON true
  LEFT JOIN (
    SELECT COUNT(*) AS territories_owned
    FROM cell_ownership
    WHERE owner_user_id = v_user_id
  ) own ON true
  LEFT JOIN (
    SELECT
      COUNT(*) FILTER (WHERE action = 'claim') AS territories_captured,
      COUNT(*) FILTER (WHERE action = 'steal') AS territories_stolen
    FROM territory_captures
    WHERE user_id = v_user_id
  ) cap ON true
  LEFT JOIN LATERAL (
    SELECT
      MIN(avg_pace_s_per_km * 1)  FILTER (WHERE distance_m >= 1000)  AS fastest_1k,
      MIN(avg_pace_s_per_km * 5)  FILTER (WHERE distance_m >= 5000)  AS fastest_5k,
      MIN(avg_pace_s_per_km * 10) FILTER (WHERE distance_m >= 10000) AS fastest_10k,
      MAX(distance_m)                                                  AS longest_run_m
    FROM workouts
    WHERE user_id = v_user_id
      AND status = 'completed'
      AND avg_pace_s_per_km IS NOT NULL
  ) pr ON true
  WHERE p.id = v_user_id;

  RETURN v_result;
END;
$$;

-- Allow authenticated users to call this function
GRANT EXECUTE ON FUNCTION get_public_profile(text) TO authenticated;
