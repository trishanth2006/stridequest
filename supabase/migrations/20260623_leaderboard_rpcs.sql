-- 20260623_leaderboard_rpcs.sql
--
-- Leaderboard RPCs (Sprint 6).
-- Two security-definer functions callable by any authenticated user:
--   * get_leaderboard(p_category, p_limit, p_offset)  — paginated ranked list
--   * get_my_rank(p_category)                         — caller rank + percentile + milestone
--
-- No new tables. Sources: user_xp, workouts, cell_ownership, xp_events, profiles.
-- RANK() is used; with user_id as the final tie-break no actual ties occur.
--
-- TECH-DEBT-LB-001: Replace LIMIT/OFFSET with keyset pagination at ~10k users.
-- TECH-DEBT-LB-002: Materialize into leaderboard_snapshots table at ~50k users.

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_user_xp_leaderboard
  ON public.user_xp (total_xp DESC, updated_at ASC);

CREATE INDEX IF NOT EXISTS idx_workouts_leaderboard
  ON public.workouts (user_id, distance_m, started_at)
  WHERE status = 'completed' AND distance_m IS NOT NULL AND distance_m > 0;

CREATE INDEX IF NOT EXISTS idx_xp_events_leaderboard
  ON public.xp_events (created_at, user_id, xp_awarded);

-- ─── get_leaderboard ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_leaderboard(
  p_category text,
  p_limit    int DEFAULT 50,
  p_offset   int DEFAULT 0
)
RETURNS TABLE (rank bigint, user_id uuid, username text, value bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_category NOT IN ('xp', 'territory', 'distance', 'weekly') THEN
    RAISE EXCEPTION 'get_leaderboard: unknown category ''%''', p_category
      USING ERRCODE = '22023';
  END IF;
  IF p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'get_leaderboard: p_limit must be 1-100'
      USING ERRCODE = '22023';
  END IF;
  IF p_offset < 0 THEN
    RAISE EXCEPTION 'get_leaderboard: p_offset must be >= 0'
      USING ERRCODE = '22023';
  END IF;

  -- XP: cumulative total from user_xp
  IF p_category = 'xp' THEN
    RETURN QUERY
    WITH ranked AS (
      SELECT
        RANK() OVER (
          ORDER BY ux.total_xp DESC, ux.updated_at ASC, p.created_at ASC, ux.user_id ASC
        ) AS rank,
        ux.user_id,
        p.username,
        ux.total_xp::bigint AS value
      FROM public.user_xp ux
      JOIN public.profiles p ON p.id = ux.user_id
      WHERE ux.total_xp > 0
    )
    SELECT r.rank, r.user_id, r.username, r.value
    FROM ranked r
    ORDER BY r.rank ASC, r.user_id ASC
    LIMIT p_limit OFFSET p_offset;
    RETURN;
  END IF;

  -- Territory: owned cell count from cell_ownership
  IF p_category = 'territory' THEN
    RETURN QUERY
    WITH territory_counts AS (
      SELECT
        co.owner_user_id AS user_id,
        COUNT(co.cell_id)::bigint AS cell_count,
        MAX(co.updated_at) AS latest_capture
      FROM public.cell_ownership co
      GROUP BY co.owner_user_id
    ),
    ranked AS (
      SELECT
        RANK() OVER (
          ORDER BY tc.cell_count DESC, tc.latest_capture ASC,
                   p.created_at ASC, tc.user_id ASC
        ) AS rank,
        tc.user_id,
        p.username,
        tc.cell_count AS value
      FROM territory_counts tc
      JOIN public.profiles p ON p.id = tc.user_id
      WHERE tc.cell_count > 0
    )
    SELECT r.rank, r.user_id, r.username, r.value
    FROM ranked r
    ORDER BY r.rank ASC, r.user_id ASC
    LIMIT p_limit OFFSET p_offset;
    RETURN;
  END IF;

  -- Distance: sum of completed workout distances
  IF p_category = 'distance' THEN
    RETURN QUERY
    WITH distance_sums AS (
      SELECT
        w.user_id,
        SUM(w.distance_m)::bigint AS total_distance,
        MAX(w.started_at) AS latest_run
      FROM public.workouts w
      WHERE w.status = 'completed'
        AND w.distance_m IS NOT NULL
        AND w.distance_m > 0
      GROUP BY w.user_id
    ),
    ranked AS (
      SELECT
        RANK() OVER (
          ORDER BY ds.total_distance DESC, ds.latest_run ASC,
                   p.created_at ASC, ds.user_id ASC
        ) AS rank,
        ds.user_id,
        p.username,
        ds.total_distance AS value
      FROM distance_sums ds
      JOIN public.profiles p ON p.id = ds.user_id
      WHERE ds.total_distance > 0
    )
    SELECT r.rank, r.user_id, r.username, r.value
    FROM ranked r
    ORDER BY r.rank ASC, r.user_id ASC
    LIMIT p_limit OFFSET p_offset;
    RETURN;
  END IF;

  -- Weekly: XP earned since Monday 00:00:00 UTC (backend owns week definition)
  IF p_category = 'weekly' THEN
    RETURN QUERY
    WITH weekly_sums AS (
      SELECT
        xe.user_id,
        SUM(xe.xp_awarded)::bigint AS weekly_xp,
        MAX(xe.created_at) AS latest_event
      FROM public.xp_events xe
      WHERE xe.created_at >= date_trunc('week', now() AT TIME ZONE 'UTC')
      GROUP BY xe.user_id
    ),
    ranked AS (
      SELECT
        RANK() OVER (
          ORDER BY wk.weekly_xp DESC, wk.latest_event ASC,
                   p.created_at ASC, wk.user_id ASC
        ) AS rank,
        wk.user_id,
        p.username,
        wk.weekly_xp AS value
      FROM weekly_sums wk
      JOIN public.profiles p ON p.id = wk.user_id
      WHERE wk.weekly_xp > 0
    )
    SELECT r.rank, r.user_id, r.username, r.value
    FROM ranked r
    ORDER BY r.rank ASC, r.user_id ASC
    LIMIT p_limit OFFSET p_offset;
    RETURN;
  END IF;
END;
$$;

-- ─── get_my_rank ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_my_rank(p_category text)
RETURNS TABLE (
  rank             bigint,
  value            bigint,
  total_users      bigint,
  percentile       numeric,
  next_rank_value  bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'get_my_rank: not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_category NOT IN ('xp', 'territory', 'distance', 'weekly') THEN
    RAISE EXCEPTION 'get_my_rank: unknown category ''%''', p_category
      USING ERRCODE = '22023';
  END IF;

  -- XP rank
  IF p_category = 'xp' THEN
    RETURN QUERY
    WITH all_scored AS (
      SELECT ux.user_id, ux.total_xp::bigint AS val, ux.updated_at AS ts
      FROM public.user_xp ux WHERE ux.total_xp > 0
    ),
    ranked AS (
      SELECT ROW_NUMBER() OVER (ORDER BY val DESC, ts ASC, user_id ASC) AS rn,
             user_id, val
      FROM all_scored
    ),
    my_row AS (SELECT rn, val FROM ranked WHERE user_id = v_user_id),
    total   AS (SELECT COUNT(*) AS n FROM all_scored)
    SELECT
      COALESCE((SELECT rn FROM my_row), 0)::bigint,
      COALESCE((SELECT val FROM my_row), 0)::bigint,
      (SELECT n FROM total)::bigint,
      CASE
        WHEN (SELECT rn FROM my_row) IS NULL THEN 0::numeric
        ELSE ROUND(
          100.0 * ((SELECT n FROM total) - (SELECT rn FROM my_row) + 1)
                / NULLIF((SELECT n FROM total), 0), 1)
      END,
      (SELECT val FROM ranked WHERE rn = (SELECT rn FROM my_row) - 1);
    RETURN;
  END IF;

  -- Territory rank
  IF p_category = 'territory' THEN
    RETURN QUERY
    WITH all_scored AS (
      SELECT co.owner_user_id AS user_id,
             COUNT(co.cell_id)::bigint AS val,
             MAX(co.updated_at) AS ts
      FROM public.cell_ownership co
      GROUP BY co.owner_user_id
      HAVING COUNT(co.cell_id) > 0
    ),
    ranked AS (
      SELECT ROW_NUMBER() OVER (ORDER BY val DESC, ts ASC, user_id ASC) AS rn,
             user_id, val
      FROM all_scored
    ),
    my_row AS (SELECT rn, val FROM ranked WHERE user_id = v_user_id),
    total   AS (SELECT COUNT(*) AS n FROM all_scored)
    SELECT
      COALESCE((SELECT rn FROM my_row), 0)::bigint,
      COALESCE((SELECT val FROM my_row), 0)::bigint,
      (SELECT n FROM total)::bigint,
      CASE
        WHEN (SELECT rn FROM my_row) IS NULL THEN 0::numeric
        ELSE ROUND(
          100.0 * ((SELECT n FROM total) - (SELECT rn FROM my_row) + 1)
                / NULLIF((SELECT n FROM total), 0), 1)
      END,
      (SELECT val FROM ranked WHERE rn = (SELECT rn FROM my_row) - 1);
    RETURN;
  END IF;

  -- Distance rank
  IF p_category = 'distance' THEN
    RETURN QUERY
    WITH all_scored AS (
      SELECT w.user_id,
             SUM(w.distance_m)::bigint AS val,
             MAX(w.started_at) AS ts
      FROM public.workouts w
      WHERE w.status = 'completed' AND w.distance_m IS NOT NULL AND w.distance_m > 0
      GROUP BY w.user_id
      HAVING SUM(w.distance_m) > 0
    ),
    ranked AS (
      SELECT ROW_NUMBER() OVER (ORDER BY val DESC, ts ASC, user_id ASC) AS rn,
             user_id, val
      FROM all_scored
    ),
    my_row AS (SELECT rn, val FROM ranked WHERE user_id = v_user_id),
    total   AS (SELECT COUNT(*) AS n FROM all_scored)
    SELECT
      COALESCE((SELECT rn FROM my_row), 0)::bigint,
      COALESCE((SELECT val FROM my_row), 0)::bigint,
      (SELECT n FROM total)::bigint,
      CASE
        WHEN (SELECT rn FROM my_row) IS NULL THEN 0::numeric
        ELSE ROUND(
          100.0 * ((SELECT n FROM total) - (SELECT rn FROM my_row) + 1)
                / NULLIF((SELECT n FROM total), 0), 1)
      END,
      (SELECT val FROM ranked WHERE rn = (SELECT rn FROM my_row) - 1);
    RETURN;
  END IF;

  -- Weekly rank
  IF p_category = 'weekly' THEN
    RETURN QUERY
    WITH all_scored AS (
      SELECT xe.user_id,
             SUM(xe.xp_awarded)::bigint AS val,
             MAX(xe.created_at) AS ts
      FROM public.xp_events xe
      WHERE xe.created_at >= date_trunc('week', now() AT TIME ZONE 'UTC')
      GROUP BY xe.user_id
      HAVING SUM(xe.xp_awarded) > 0
    ),
    ranked AS (
      SELECT ROW_NUMBER() OVER (ORDER BY val DESC, ts ASC, user_id ASC) AS rn,
             user_id, val
      FROM all_scored
    ),
    my_row AS (SELECT rn, val FROM ranked WHERE user_id = v_user_id),
    total   AS (SELECT COUNT(*) AS n FROM all_scored)
    SELECT
      COALESCE((SELECT rn FROM my_row), 0)::bigint,
      COALESCE((SELECT val FROM my_row), 0)::bigint,
      (SELECT n FROM total)::bigint,
      CASE
        WHEN (SELECT rn FROM my_row) IS NULL THEN 0::numeric
        ELSE ROUND(
          100.0 * ((SELECT n FROM total) - (SELECT rn FROM my_row) + 1)
                / NULLIF((SELECT n FROM total), 0), 1)
      END,
      (SELECT val FROM ranked WHERE rn = (SELECT rn FROM my_row) - 1);
    RETURN;
  END IF;
END;
$$;

-- ─── Grants ───────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.get_leaderboard(text, int, int) FROM public;
REVOKE EXECUTE ON FUNCTION public.get_leaderboard(text, int, int) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_leaderboard(text, int, int) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_my_rank(text) FROM public;
REVOKE EXECUTE ON FUNCTION public.get_my_rank(text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_my_rank(text) TO authenticated;
