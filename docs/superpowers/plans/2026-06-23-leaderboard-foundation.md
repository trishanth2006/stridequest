# Leaderboard Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the production leaderboard system — shared types, two security-definer RPCs (`get_leaderboard` + `get_my_rank`), web refactor off service-role, and the full mobile leaderboard screen.

**Architecture:** A single parameterized RPC `get_leaderboard(category, limit, offset)` with one isolated CTE block per category returns paginated ranked rows to both web and mobile via the authenticated Supabase client. A companion `get_my_rank(category)` RPC gives the caller their rank and next-rank milestone without loading all rows. Shared output types live in `@stridequest/shared`; ranking logic is fully owned by the database.

**Tech Stack:** PostgreSQL (RANK(), CTEs, security-definer), Supabase MCP, TypeScript (strict), Next.js 15 App Router, Expo (React Native), Jest

**Spec:** `docs/superpowers/specs/2026-06-23-leaderboard-design.md`

---

## File Map

### New files
| Path | Responsibility |
|---|---|
| `packages/shared/src/leaderboards/types.ts` | Shared output types: `LeaderboardCategory`, `LeaderboardEntry`, `LeaderboardSummary`, `TerritoryKing`, `MyRank` |
| `packages/shared/src/leaderboards/formatters.ts` | `formatLeaderboardValue()`, `formatLeaderboardLabel()` |
| `packages/shared/src/leaderboards/index.ts` | Barrel export for leaderboards sub-package |
| `supabase/migrations/20260623_leaderboard_rpcs.sql` | Three new indexes + `get_leaderboard` + `get_my_rank` + grants |
| `apps/mobile/src/features/leaderboards/services/leaderboards.ts` | `fetchLeaderboard()`, `fetchMyRank()` — calls RPCs via mobile Supabase client |
| `tests/unit/features/leaderboards/shared/formatters.test.ts` | Tests for shared formatters |

### Modified files
| Path | Change |
|---|---|
| `packages/shared/src/index.ts` | Add `export * from './leaderboards'` |
| `features/leaderboards/types.ts` | Remove locally-defined output types; re-export from `@stridequest/shared`; keep input shapes until Phase 4 |
| `features/leaderboards/data/load-leaderboards.ts` | Replace 5 service-role table queries with 2 RPC calls |
| `features/leaderboards/services/leaderboards.ts` | Remove `getXpLeaderboard`, `getTerritoryLeaderboard`, `getDistanceLeaderboard`, `getWeeklyLeaderboard`, `aggregate`, `rankScored`, `startOfIsoWeekUtc`; update `getTerritoryKing` + `getLeaderboardSummary` signatures |
| `app/(protected)/leaderboards/page.tsx` | Call new loader; use `loadMyRank` for header rank card |
| `apps/mobile/app/(protected)/leaderboards/index.tsx` | Replace placeholder with full screen |
| `tests/unit/features/leaderboards/data/load-leaderboards.test.ts` | Replace service-role mock tests with RPC mock tests |
| `tests/unit/features/leaderboards/services/leaderboards.test.ts` | Replace per-category ranking tests with simplified service tests |

---

## Task 1: Shared leaderboard types

**Files:**
- Create: `packages/shared/src/leaderboards/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// packages/shared/src/leaderboards/types.ts
export type LeaderboardCategory = 'xp' | 'territory' | 'distance' | 'weekly'

export interface LeaderboardEntry {
  rank: number
  userId: string
  username: string
  value: number
  /** Set client-side: entry.userId === authedUserId. Not returned by the RPC. */
  isCurrentUser: boolean
}

export interface LeaderboardSummary {
  category: LeaderboardCategory
  totalParticipants: number
  currentUserRank?: number
}

export interface TerritoryKing {
  userId: string
  username: string
  territoryCount: number
}

export interface MyRank {
  /** 0 = unranked sentinel (caller has no score in this category); 1-based otherwise. */
  rank: number
  value: number
  totalUsers: number
  /** 0–100.0; 0 = unranked. */
  percentile: number
  /** Score needed to reach the next rank. null = already rank 1. */
  nextRankValue: number | null
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/leaderboards/types.ts
git commit -m "feat(shared): add leaderboard types"
```

---

## Task 2: Shared formatters + tests

**Files:**
- Create: `packages/shared/src/leaderboards/formatters.ts`
- Create: `tests/unit/features/leaderboards/shared/formatters.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/features/leaderboards/shared/formatters.test.ts
/**
 * @jest-environment node
 */
import { formatLeaderboardValue, formatLeaderboardLabel } from '@stridequest/shared/leaderboards'

describe('formatLeaderboardValue', () => {
  it('xp: formats with locale separator and XP suffix', () => {
    expect(formatLeaderboardValue('xp', 1250)).toBe('1,250 XP')
  })

  it('territory: formats as "N cells"', () => {
    expect(formatLeaderboardValue('territory', 47)).toBe('47 cells')
  })

  it('distance: formats as km (1 decimal) when >= 1000m', () => {
    expect(formatLeaderboardValue('distance', 5000)).toBe('5.0 km')
  })

  it('distance: formats as meters when < 1000m', () => {
    expect(formatLeaderboardValue('distance', 800)).toBe('800 m')
  })

  it('distance: exactly 1000m formats as km', () => {
    expect(formatLeaderboardValue('distance', 1000)).toBe('1.0 km')
  })

  it('weekly: formats with locale separator and XP suffix', () => {
    expect(formatLeaderboardValue('weekly', 300)).toBe('300 XP')
  })
})

describe('formatLeaderboardLabel', () => {
  it.each([
    ['xp', 'XP'],
    ['territory', 'Territory'],
    ['distance', 'Distance'],
    ['weekly', 'Weekly'],
  ] as const)('%s → %s', (category, label) => {
    expect(formatLeaderboardLabel(category)).toBe(label)
  })
})
```

- [ ] **Step 2: Run tests — expect failure (module not found)**

```bash
npx jest tests/unit/features/leaderboards/shared/formatters.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@stridequest/shared/leaderboards'`

- [ ] **Step 3: Create the formatters**

```typescript
// packages/shared/src/leaderboards/formatters.ts
import type { LeaderboardCategory } from './types'

export function formatLeaderboardValue(category: LeaderboardCategory, value: number): string {
  switch (category) {
    case 'xp':
      return `${value.toLocaleString()} XP`
    case 'territory':
      return `${value.toLocaleString()} cells`
    case 'distance':
      return value >= 1000
        ? `${(value / 1000).toFixed(1)} km`
        : `${value} m`
    case 'weekly':
      return `${value.toLocaleString()} XP`
  }
}

export function formatLeaderboardLabel(category: LeaderboardCategory): string {
  switch (category) {
    case 'xp':       return 'XP'
    case 'territory': return 'Territory'
    case 'distance':  return 'Distance'
    case 'weekly':    return 'Weekly'
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx jest tests/unit/features/leaderboards/shared/formatters.test.ts --no-coverage
```

Expected: PASS — 8 tests

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/leaderboards/formatters.ts tests/unit/features/leaderboards/shared/formatters.test.ts
git commit -m "feat(shared): add leaderboard formatters + tests"
```

---

## Task 3: Shared leaderboard barrel + package re-export

**Files:**
- Create: `packages/shared/src/leaderboards/index.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create the barrel**

```typescript
// packages/shared/src/leaderboards/index.ts
export * from './types'
export * from './formatters'
```

- [ ] **Step 2: Add to package root export**

Open `packages/shared/src/index.ts`. It currently reads:

```typescript
export * from './xp'
export * from './running'
export * from './territory'
```

Add one line:

```typescript
export * from './xp'
export * from './running'
export * from './territory'
export * from './leaderboards'
```

- [ ] **Step 3: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: no new errors

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/leaderboards/index.ts packages/shared/src/index.ts
git commit -m "feat(shared): export leaderboards sub-package"
```

---

## Task 4: Wire shared types into web leaderboards

**Files:**
- Modify: `features/leaderboards/types.ts`

The current file defines `LeaderboardCategory`, `LeaderboardEntry`, `LeaderboardSummary`, `TerritoryKing` locally and also defines input shapes (`LeaderboardUser`, `XpStanding`, `DistanceContribution`, `CellOwnership`, `WeeklyXpEvent`) used by the service-role loader. After this task, the output types come from `@stridequest/shared`; input shapes stay until Phase 4 (Task 9).

- [ ] **Step 1: Rewrite `features/leaderboards/types.ts`**

```typescript
/**
 * Leaderboard domain types.
 *
 * Output types (what the UI renders) are re-exported from @stridequest/shared.
 * Input shapes (mapped from DB rows by the server-only loader) live here until
 * the service-role loader is replaced by RPC calls in the Phase 4 refactor.
 */

// ── Output types (shared; consumed by web + mobile) ──────────────────────────
export type {
  LeaderboardCategory,
  LeaderboardEntry,
  LeaderboardSummary,
  TerritoryKing,
  MyRank,
} from '@stridequest/shared'

// ── Input shapes (server-only; used by load-leaderboards.ts until Phase 4) ───

/** A participant: identity + account age. */
export type LeaderboardUser = {
  userId: string
  username: string
  createdAt: string
}

/** Cumulative XP row from `user_xp`. */
export type XpStanding = {
  userId: string
  totalXp: number
  updatedAt: string
}

/** One completed workout's distance contribution. */
export type DistanceContribution = {
  userId: string
  distanceM: number
  startedAt: string
}

/** One owned cell from `cell_ownership`. */
export type CellOwnership = {
  ownerUserId: string
  updatedAt: string
}

/** One XP award from `xp_events`. */
export type WeeklyXpEvent = {
  userId: string
  xpAwarded: number
  createdAt: string
}
```

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors. The web feature code still compiles because the re-exported types are identical in shape.

- [ ] **Step 3: Run existing leaderboard tests**

```bash
npx jest tests/unit/features/leaderboards --no-coverage
```

Expected: PASS — no regressions (names and shapes are the same)

- [ ] **Step 4: Commit**

```bash
git add features/leaderboards/types.ts
git commit -m "refactor(leaderboards): re-export output types from shared package"
```

---

## Task 5: Database migration — indexes + RPCs

**Files:**
- Create: `supabase/migrations/20260623_leaderboard_rpcs.sql`

- [ ] **Step 1: Write the migration file**

```sql
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
```

- [ ] **Step 2: Apply the migration via MCP**

```
mcp__supabase__apply_migration({ name: "20260623_leaderboard_rpcs", query: "<file contents>" })
```

- [ ] **Step 3: Verify migration applied**

```
mcp__supabase__list_migrations({})
```

Expected: `20260623_leaderboard_rpcs` appears in the list.

- [ ] **Step 4: Commit migration file**

```bash
git add supabase/migrations/20260623_leaderboard_rpcs.sql
git commit -m "feat(db): add leaderboard RPCs and indexes"
```

---

## Task 6: Verify RPCs manually

No code changes. Use MCP to confirm the RPCs work and grants are correct.

- [ ] **Step 1: Test get_leaderboard for each category**

```
mcp__supabase__execute_sql({
  query: "SELECT * FROM public.get_leaderboard('xp', 10, 0);"
})
```

Expected: result set (may be empty rows if no data) — no error.

Repeat for `'territory'`, `'distance'`, `'weekly'`.

- [ ] **Step 2: Test input validation**

```
mcp__supabase__execute_sql({
  query: "SELECT * FROM public.get_leaderboard('invalid', 10, 0);"
})
```

Expected: error `get_leaderboard: unknown category 'invalid'`

- [ ] **Step 3: Confirm the three indexes exist**

```
mcp__supabase__execute_sql({
  query: "SELECT indexname FROM pg_indexes WHERE tablename IN ('user_xp','workouts','xp_events') AND indexname LIKE 'idx_%leaderboard';"
})
```

Expected: `idx_user_xp_leaderboard`, `idx_workouts_leaderboard`, `idx_xp_events_leaderboard`

- [ ] **Step 4: Confirm anon cannot call get_leaderboard**

```
mcp__supabase__execute_sql({
  query: "SET ROLE anon; SELECT * FROM public.get_leaderboard('xp', 10, 0); RESET ROLE;"
})
```

Expected: permission denied error.

---

## Task 7: Replace data loader tests (TDD for Phase 4)

**Files:**
- Modify: `tests/unit/features/leaderboards/data/load-leaderboards.test.ts`

- [ ] **Step 1: Replace the test file with RPC-based tests**

```typescript
/**
 * @jest-environment node
 *
 * Tests for the leaderboard data loader after the Phase 4 refactor.
 * Mocks `createClient` from the server Supabase module (not service-role).
 * Verifies DB-row → LeaderboardEntry / MyRank mapping and error propagation.
 */
import { loadLeaderboardEntries, loadMyRank } from '@/features/leaderboards/data/load-leaderboards'
import { createClient } from '@/infrastructure/supabase/server'

jest.mock('@/infrastructure/supabase/server', () => ({
  createClient: jest.fn(),
}))

const mockedCreateClient = createClient as jest.Mock

function mockSupabase(rpcResults: Record<string, { data: unknown; error: { message: string } | null }>) {
  return {
    rpc: jest.fn((fn: string) =>
      Promise.resolve(rpcResults[fn] ?? { data: [], error: null }),
    ),
  }
}

afterEach(() => jest.clearAllMocks())

describe('loadLeaderboardEntries', () => {
  it('maps RPC rows to LeaderboardEntry and sets isCurrentUser', async () => {
    mockedCreateClient.mockResolvedValue(
      mockSupabase({
        get_leaderboard: {
          data: [
            { rank: 1, user_id: 'u-alice', username: 'alice', value: 500 },
            { rank: 2, user_id: 'u-bob',   username: 'bob',   value: 250 },
          ],
          error: null,
        },
      }),
    )

    const entries = await loadLeaderboardEntries('xp', 'u-alice')
    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual({
      rank: 1, userId: 'u-alice', username: 'alice', value: 500, isCurrentUser: true,
    })
    expect(entries[1]).toEqual({
      rank: 2, userId: 'u-bob', username: 'bob', value: 250, isCurrentUser: false,
    })
  })

  it('passes p_category, p_limit, p_offset to the RPC', async () => {
    const mockRpc = jest.fn().mockResolvedValue({ data: [], error: null })
    mockedCreateClient.mockResolvedValue({ rpc: mockRpc })

    await loadLeaderboardEntries('territory', 'u1', 20, 40)
    expect(mockRpc).toHaveBeenCalledWith('get_leaderboard', {
      p_category: 'territory',
      p_limit: 20,
      p_offset: 40,
    })
  })

  it('throws when the RPC returns an error', async () => {
    mockedCreateClient.mockResolvedValue(
      mockSupabase({ get_leaderboard: { data: null, error: { message: 'rpc exploded' } } }),
    )
    await expect(loadLeaderboardEntries('xp', 'u1')).rejects.toThrow('rpc exploded')
  })

  it('returns empty array when RPC returns null data', async () => {
    mockedCreateClient.mockResolvedValue(
      mockSupabase({ get_leaderboard: { data: null, error: null } }),
    )
    expect(await loadLeaderboardEntries('xp', 'u1')).toEqual([])
  })
})

describe('loadMyRank', () => {
  it('maps RPC row to MyRank', async () => {
    mockedCreateClient.mockResolvedValue(
      mockSupabase({
        get_my_rank: {
          data: [{
            rank: 5, value: 300, total_users: 100,
            percentile: '96.0', next_rank_value: 350,
          }],
          error: null,
        },
      }),
    )

    const result = await loadMyRank('xp')
    expect(result).toEqual({
      rank: 5, value: 300, totalUsers: 100, percentile: 96, nextRankValue: 350,
    })
  })

  it('maps null next_rank_value to null (caller is rank 1)', async () => {
    mockedCreateClient.mockResolvedValue(
      mockSupabase({
        get_my_rank: {
          data: [{ rank: 1, value: 999, total_users: 50, percentile: '100.0', next_rank_value: null }],
          error: null,
        },
      }),
    )
    expect((await loadMyRank('xp')).nextRankValue).toBeNull()
  })

  it('returns zeroed unranked shape when RPC returns empty array', async () => {
    mockedCreateClient.mockResolvedValue(
      mockSupabase({ get_my_rank: { data: [], error: null } }),
    )
    expect(await loadMyRank('xp')).toEqual({
      rank: 0, value: 0, totalUsers: 0, percentile: 0, nextRankValue: null,
    })
  })

  it('throws when RPC returns an error', async () => {
    mockedCreateClient.mockResolvedValue(
      mockSupabase({ get_my_rank: { data: null, error: { message: 'auth failed' } } }),
    )
    await expect(loadMyRank('xp')).rejects.toThrow('auth failed')
  })
})
```

- [ ] **Step 2: Run — expect failure (old loader still uses service-role)**

```bash
npx jest tests/unit/features/leaderboards/data/load-leaderboards.test.ts --no-coverage
```

Expected: FAIL — `loadLeaderboardEntries is not a function` (old exports differ)

---

## Task 8: Replace leaderboard service tests (TDD for Phase 4)

**Files:**
- Modify: `tests/unit/features/leaderboards/services/leaderboards.test.ts`

- [ ] **Step 1: Replace the test file with simplified service tests**

```typescript
/**
 * @jest-environment node
 *
 * Tests for the simplified leaderboard service after Phase 4.
 * The DB owns ranking; these test only the two helper functions
 * that derive UI summary data from an already-ranked entry list.
 */
import { getLeaderboardSummary, getTerritoryKing } from '@/features/leaderboards/services/leaderboards'
import type { LeaderboardEntry } from '@stridequest/shared'

function entry(overrides: {
  rank: number
  userId: string
  username: string
  value: number
  isCurrentUser?: boolean
}): LeaderboardEntry {
  return { isCurrentUser: false, ...overrides }
}

describe('getLeaderboardSummary', () => {
  it('counts all entries as total participants', () => {
    const entries = [
      entry({ rank: 1, userId: 'u1', username: 'alice', value: 500 }),
      entry({ rank: 2, userId: 'u2', username: 'bob',   value: 250 }),
    ]
    const summary = getLeaderboardSummary('xp', entries)
    expect(summary.totalParticipants).toBe(2)
    expect(summary.category).toBe('xp')
  })

  it('sets currentUserRank from the isCurrentUser entry', () => {
    const entries = [
      entry({ rank: 1, userId: 'u1', username: 'alice', value: 500 }),
      entry({ rank: 2, userId: 'u2', username: 'bob',   value: 250, isCurrentUser: true }),
    ]
    expect(getLeaderboardSummary('xp', entries).currentUserRank).toBe(2)
  })

  it('returns undefined currentUserRank when current user is not on this page', () => {
    const entries = [entry({ rank: 1, userId: 'u1', username: 'alice', value: 500 })]
    expect(getLeaderboardSummary('xp', entries).currentUserRank).toBeUndefined()
  })

  it('handles empty board', () => {
    const s = getLeaderboardSummary('weekly', [])
    expect(s.totalParticipants).toBe(0)
    expect(s.currentUserRank).toBeUndefined()
  })
})

describe('getTerritoryKing', () => {
  it('returns rank-1 entry as TerritoryKing', () => {
    const entries = [
      entry({ rank: 1, userId: 'u1', username: 'alice', value: 42 }),
      entry({ rank: 2, userId: 'u2', username: 'bob',   value: 20 }),
    ]
    expect(getTerritoryKing(entries)).toEqual({
      userId: 'u1', username: 'alice', territoryCount: 42,
    })
  })

  it('returns null for empty entry list', () => {
    expect(getTerritoryKing([])).toBeNull()
  })
})
```

- [ ] **Step 2: Run — expect failure (old service has different function signatures)**

```bash
npx jest tests/unit/features/leaderboards/services/leaderboards.test.ts --no-coverage
```

Expected: FAIL — `getTerritoryKing` called with wrong args / `getLeaderboardSummary` type mismatch

---

## Task 9: Refactor web data loader (remove service-role)

**Files:**
- Modify: `features/leaderboards/data/load-leaderboards.ts`

- [ ] **Step 1: Replace the entire file**

```typescript
/**
 * Server-only leaderboard data loader.
 *
 * Calls the security-definer RPCs via the standard authenticated Supabase
 * server client. No service-role key needed — the RPCs bypass RLS internally
 * and return only the minimal ranked data (rank / user_id / username / value).
 */
import { createClient } from '@/infrastructure/supabase/server'
import type { LeaderboardEntry, LeaderboardCategory, MyRank } from '@stridequest/shared'

type RpcLeaderboardRow = {
  rank: number
  user_id: string
  username: string
  value: number
}

type RpcMyRankRow = {
  rank: number
  value: number
  total_users: number
  percentile: string | number
  next_rank_value: number | null
}

/**
 * Fetches one page of ranked entries for the given category.
 * Sets `isCurrentUser` based on `currentUserId` (the caller's auth.uid).
 */
export async function loadLeaderboardEntries(
  category: LeaderboardCategory,
  currentUserId: string,
  limit = 50,
  offset = 0,
): Promise<LeaderboardEntry[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_leaderboard', {
    p_category: category,
    p_limit: limit,
    p_offset: offset,
  })
  if (error) throw new Error(error.message)
  return (data as RpcLeaderboardRow[] | null ?? []).map((row) => ({
    rank: row.rank,
    userId: row.user_id,
    username: row.username,
    value: row.value,
    isCurrentUser: row.user_id === currentUserId,
  }))
}

/**
 * Returns the authenticated caller's rank, percentile, and next-rank milestone.
 * Returns the zeroed unranked shape when the caller has no score in this category.
 */
export async function loadMyRank(category: LeaderboardCategory): Promise<MyRank> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_my_rank', {
    p_category: category,
  })
  if (error) throw new Error(error.message)
  const rows = data as RpcMyRankRow[] | null
  const row = rows?.[0]
  if (!row) {
    return { rank: 0, value: 0, totalUsers: 0, percentile: 0, nextRankValue: null }
  }
  return {
    rank: row.rank,
    value: row.value,
    totalUsers: row.total_users,
    percentile: Number(row.percentile),
    nextRankValue: row.next_rank_value ?? null,
  }
}
```

- [ ] **Step 2: Run Task 7 tests — expect pass**

```bash
npx jest tests/unit/features/leaderboards/data/load-leaderboards.test.ts --no-coverage
```

Expected: PASS — all 7 tests green

- [ ] **Step 3: Commit**

```bash
git add features/leaderboards/data/load-leaderboards.ts
git commit -m "refactor(leaderboards): replace service-role loader with RPC calls"
```

---

## Task 10: Simplify web leaderboard service

**Files:**
- Modify: `features/leaderboards/services/leaderboards.ts`

Remove all ranking/aggregation logic (database owns it now). Keep only two helpers.

- [ ] **Step 1: Replace the entire file**

```typescript
/**
 * Pure leaderboard helpers. Ranking is owned by the DB (get_leaderboard RPC).
 * These derive UI summary data from an already-ranked entry list.
 */
import type { LeaderboardCategory, LeaderboardEntry, LeaderboardSummary, TerritoryKing } from '@stridequest/shared'

/** Header summary for a ranked board: participant count + current user rank. */
export function getLeaderboardSummary(
  category: LeaderboardCategory,
  entries: LeaderboardEntry[],
): LeaderboardSummary {
  const currentUser = entries.find((e) => e.isCurrentUser)
  return {
    category,
    totalParticipants: entries.length,
    currentUserRank: currentUser?.rank,
  }
}

/** Top territory owner from a ranked territory entry list, or null if empty. */
export function getTerritoryKing(entries: LeaderboardEntry[]): TerritoryKing | null {
  const top = entries[0]
  if (!top) return null
  return {
    userId: top.userId,
    username: top.username,
    territoryCount: top.value,
  }
}
```

- [ ] **Step 2: Remove obsolete input types from `features/leaderboards/types.ts`**

The input shapes (`LeaderboardUser`, `XpStanding`, `DistanceContribution`, `CellOwnership`, `WeeklyXpEvent`) are no longer used. Remove them.

Open `features/leaderboards/types.ts` and replace with:

```typescript
/**
 * Leaderboard domain types.
 * Output types are re-exported from @stridequest/shared.
 */
export type {
  LeaderboardCategory,
  LeaderboardEntry,
  LeaderboardSummary,
  TerritoryKing,
  MyRank,
} from '@stridequest/shared'
```

- [ ] **Step 3: Run Task 8 tests — expect pass**

```bash
npx jest tests/unit/features/leaderboards/services/leaderboards.test.ts --no-coverage
```

Expected: PASS — all 6 tests green

- [ ] **Step 4: Run full leaderboard test suite**

```bash
npx jest tests/unit/features/leaderboards --no-coverage
```

Expected: PASS — formatters + data loader + services all green

- [ ] **Step 5: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add features/leaderboards/services/leaderboards.ts features/leaderboards/types.ts
git commit -m "refactor(leaderboards): simplify service — DB owns ranking"
```

---

## Task 11: Update the web leaderboards page

**Files:**
- Modify: `app/(protected)/leaderboards/page.tsx`

The page currently calls `loadLeaderboardData` + four `get*Leaderboard` functions. After this task it calls the new loader functions directly and uses `loadMyRank` for the header rank card (important: the header must show the correct rank even when the user is outside the top-50 page).

- [ ] **Step 1: Replace the page's data fetching section**

Open `app/(protected)/leaderboards/page.tsx`. Replace the entire `LeaderboardsPage` function body (keep all imports intact; add the two new import names):

Change the import line:
```typescript
import { loadLeaderboardData } from '@/features/leaderboards/data/load-leaderboards'
```
to:
```typescript
import { loadLeaderboardEntries, loadMyRank } from '@/features/leaderboards/data/load-leaderboards'
```

Change the import line:
```typescript
import {
  getXpLeaderboard,
  getTerritoryLeaderboard,
  getDistanceLeaderboard,
  getWeeklyLeaderboard,
  getLeaderboardSummary,
  getTerritoryKing,
} from '@/features/leaderboards/services/leaderboards'
```
to:
```typescript
import {
  getLeaderboardSummary,
  getTerritoryKing,
} from '@/features/leaderboards/services/leaderboards'
```

Replace the data-fetch block inside `LeaderboardsPage`:

```typescript
  const [xpEntries, territoryEntries, distanceEntries, weeklyEntries, xpMyRank] =
    await Promise.all([
      loadLeaderboardEntries('xp', user.id),
      loadLeaderboardEntries('territory', user.id),
      loadLeaderboardEntries('distance', user.id),
      loadLeaderboardEntries('weekly', user.id),
      loadMyRank('xp'),
    ])

  const king = getTerritoryKing(territoryEntries)
  const xpSummary    = getLeaderboardSummary('xp',        xpEntries)
  const terrSummary  = getLeaderboardSummary('territory',  territoryEntries)
  const distSummary  = getLeaderboardSummary('distance',   distanceEntries)
  const weeklySummary = getLeaderboardSummary('weekly',   weeklyEntries)
```

Replace the two header stat cards JSX — the "Your Global Rank" card currently uses `xpSummary.currentUserRank` (which only works if the user is in the first 50 rows). Change it to use `xpMyRank`:

```tsx
  <CardContent>
    <div
      className="text-3xl font-bold tracking-tight text-foreground tabular-nums"
      data-testid="header-current-user-rank"
    >
      {xpMyRank.rank > 0 ? `#${xpMyRank.rank}` : 'Unranked'}
    </div>
    <p className="text-xs text-muted-foreground">by total XP earned</p>
  </CardContent>
```

Replace the "Total Participants" card to use `xpMyRank.totalUsers` instead of `xpSummary.totalParticipants` (which counted only the first page):

```tsx
  <CardContent>
    <div
      className="text-3xl font-bold tracking-tight text-foreground tabular-nums"
      data-testid="header-total-participants"
    >
      {xpMyRank.totalUsers}
    </div>
    <p className="text-xs text-muted-foreground">athletes with XP</p>
  </CardContent>
```

Update the `boards` array to use the new summary variables:

```typescript
  const boards: LeaderboardBoard[] = [
    { category: 'xp',        label: 'XP',        summary: xpSummary,     entries: xpEntries },
    { category: 'territory', label: 'Territory',  summary: terrSummary,   entries: territoryEntries },
    { category: 'distance',  label: 'Distance',   summary: distSummary,   entries: distanceEntries },
    { category: 'weekly',    label: 'Weekly',     summary: weeklySummary, entries: weeklyEntries },
  ]
```

Remove the unused `now` variable (no longer passed to `getWeeklyLeaderboard`).

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Run full unit test suite**

```bash
npx jest tests/unit --no-coverage
```

Expected: PASS — no regressions

- [ ] **Step 4: Commit**

```bash
git add app/(protected)/leaderboards/page.tsx
git commit -m "refactor(web): wire leaderboard page to RPC loader"
```

---

## Task 12: Mobile leaderboard service + tests

**Files:**
- Create: `apps/mobile/src/features/leaderboards/services/leaderboards.ts`
- Create: `apps/mobile/tests/unit/leaderboards/leaderboards-service.test.ts`

- [ ] **Step 1: Write failing tests first**

```typescript
// apps/mobile/tests/unit/leaderboards/leaderboards-service.test.ts
/**
 * @jest-environment node
 */
import { fetchLeaderboard, fetchMyRank } from '../../../src/features/leaderboards/services/leaderboards'
import { supabase } from '../../../src/lib/supabase'

jest.mock('../../../src/lib/supabase', () => ({
  supabase: { rpc: jest.fn() },
}))

const mockedRpc = supabase.rpc as jest.Mock
afterEach(() => jest.clearAllMocks())

describe('fetchLeaderboard', () => {
  it('maps RPC rows to LeaderboardEntry with isCurrentUser set', async () => {
    mockedRpc.mockResolvedValue({
      data: [
        { rank: 1, user_id: 'u-alice', username: 'alice', value: 500 },
        { rank: 2, user_id: 'u-bob',   username: 'bob',   value: 250 },
      ],
      error: null,
    })

    const entries = await fetchLeaderboard('xp', 'u-alice')
    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual({
      rank: 1, userId: 'u-alice', username: 'alice', value: 500, isCurrentUser: true,
    })
    expect(entries[1].isCurrentUser).toBe(false)
  })

  it('passes p_category / p_limit / p_offset to the RPC', async () => {
    mockedRpc.mockResolvedValue({ data: [], error: null })

    await fetchLeaderboard('distance', 'u1', 20, 20)
    expect(mockedRpc).toHaveBeenCalledWith('get_leaderboard', {
      p_category: 'distance',
      p_limit: 20,
      p_offset: 20,
    })
  })

  it('throws on RPC error', async () => {
    mockedRpc.mockResolvedValue({ data: null, error: { message: 'connection refused' } })
    await expect(fetchLeaderboard('xp', 'u1')).rejects.toThrow('connection refused')
  })

  it('returns empty array when data is null', async () => {
    mockedRpc.mockResolvedValue({ data: null, error: null })
    expect(await fetchLeaderboard('xp', 'u1')).toEqual([])
  })
})

describe('fetchMyRank', () => {
  it('maps RPC row to MyRank', async () => {
    mockedRpc.mockResolvedValue({
      data: [{
        rank: 3, value: 400, total_users: 50, percentile: '96.0', next_rank_value: 450,
      }],
      error: null,
    })
    expect(await fetchMyRank('xp')).toEqual({
      rank: 3, value: 400, totalUsers: 50, percentile: 96, nextRankValue: 450,
    })
  })

  it('maps null next_rank_value for rank-1 user', async () => {
    mockedRpc.mockResolvedValue({
      data: [{ rank: 1, value: 999, total_users: 50, percentile: '100.0', next_rank_value: null }],
      error: null,
    })
    expect((await fetchMyRank('territory')).nextRankValue).toBeNull()
  })

  it('returns zeroed unranked shape for empty data', async () => {
    mockedRpc.mockResolvedValue({ data: [], error: null })
    expect(await fetchMyRank('weekly')).toEqual({
      rank: 0, value: 0, totalUsers: 0, percentile: 0, nextRankValue: null,
    })
  })

  it('throws on RPC error', async () => {
    mockedRpc.mockResolvedValue({ data: null, error: { message: 'not auth' } })
    await expect(fetchMyRank('xp')).rejects.toThrow('not auth')
  })
})
```

- [ ] **Step 2: Run — expect failure (file does not exist)**

```bash
cd apps/mobile && npx jest tests/unit/leaderboards/leaderboards-service.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module`

- [ ] **Step 3: Create the mobile leaderboard service**

```typescript
// apps/mobile/src/features/leaderboards/services/leaderboards.ts
import { supabase } from '@/lib/supabase'
import type { LeaderboardEntry, LeaderboardCategory, MyRank } from '@stridequest/shared'

type RpcLeaderboardRow = {
  rank: number
  user_id: string
  username: string
  value: number
}

type RpcMyRankRow = {
  rank: number
  value: number
  total_users: number
  percentile: string | number
  next_rank_value: number | null
}

export async function fetchLeaderboard(
  category: LeaderboardCategory,
  currentUserId: string,
  limit = 10,
  offset = 0,
): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('get_leaderboard', {
    p_category: category,
    p_limit: limit,
    p_offset: offset,
  })
  if (error) throw new Error(error.message)
  return (data as RpcLeaderboardRow[] | null ?? []).map((row) => ({
    rank: row.rank,
    userId: row.user_id,
    username: row.username,
    value: row.value,
    isCurrentUser: row.user_id === currentUserId,
  }))
}

export async function fetchMyRank(category: LeaderboardCategory): Promise<MyRank> {
  const { data, error } = await supabase.rpc('get_my_rank', {
    p_category: category,
  })
  if (error) throw new Error(error.message)
  const rows = data as RpcMyRankRow[] | null
  const row = rows?.[0]
  if (!row) {
    return { rank: 0, value: 0, totalUsers: 0, percentile: 0, nextRankValue: null }
  }
  return {
    rank: row.rank,
    value: row.value,
    totalUsers: row.total_users,
    percentile: Number(row.percentile),
    nextRankValue: row.next_rank_value ?? null,
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd apps/mobile && npx jest tests/unit/leaderboards/leaderboards-service.test.ts --no-coverage
```

Expected: PASS — 8 tests green

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/leaderboards/services/leaderboards.ts apps/mobile/tests/unit/leaderboards/leaderboards-service.test.ts
git commit -m "feat(mobile): add leaderboard service with fetchLeaderboard + fetchMyRank"
```

---

## Task 13: Mobile leaderboard screen

**Files:**
- Modify: `apps/mobile/app/(protected)/leaderboards/index.tsx`

Replaces the placeholder. Features: 4-category tab bar, "My Rank" card, ranked entry list (top 10 initial, load-more pagination). Must stay under 300 lines.

- [ ] **Step 1: Replace the placeholder with the full screen**

`offset` is not tracked in state — it is derived from `entries.length` to avoid stale-closure bugs with `useCallback`.

```typescript
// apps/mobile/app/(protected)/leaderboards/index.tsx
import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, FlatList, Pressable, ActivityIndicator,
  ListRenderItemInfo,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSession } from '@/features/auth/providers/SessionProvider'
import { fetchLeaderboard, fetchMyRank } from '@/features/leaderboards/services/leaderboards'
import { formatLeaderboardValue, formatLeaderboardLabel } from '@stridequest/shared/leaderboards'
import type { LeaderboardCategory, LeaderboardEntry, MyRank } from '@stridequest/shared'

const CATEGORIES: LeaderboardCategory[] = ['xp', 'territory', 'distance', 'weekly']
const PAGE_SIZE = 10

export default function LeaderboardsScreen() {
  const { session } = useSession()
  const router = useRouter()
  const userId = session?.user.id ?? ''

  const [activeTab, setActiveTab] = useState<LeaderboardCategory>('xp')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [myRank, setMyRank] = useState<MyRank | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  // Initial load for a category — always starts at offset 0.
  const load = useCallback((category: LeaderboardCategory) => {
    setLoading(true)
    setHasMore(true)
    void (async () => {
      try {
        const [page, rank] = await Promise.all([
          fetchLeaderboard(category, userId, PAGE_SIZE, 0),
          fetchMyRank(category),
        ])
        setEntries(page)
        setMyRank(rank)
        setHasMore(page.length === PAGE_SIZE)
      } catch {
        // keep existing state on error
      } finally {
        setLoading(false)
      }
    })()
  }, [userId])

  useEffect(() => { load(activeTab) }, [activeTab, load])

  // Load-more uses entries.length as the offset — avoids stale closure on offset state.
  const handleLoadMore = (currentEntries: LeaderboardEntry[]) => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    void (async () => {
      try {
        const page = await fetchLeaderboard(activeTab, userId, PAGE_SIZE, currentEntries.length)
        setEntries((prev) => [...prev, ...page])
        setHasMore(page.length === PAGE_SIZE)
      } catch {
        // keep existing state on error
      } finally {
        setLoadingMore(false)
      }
    })()
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0b0b0f' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, gap: 12 }}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#10b981" />
        </Pressable>
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff' }}>Leaderboards</Text>
      </View>

      {/* Category tabs */}
      <View style={{ flexDirection: 'row', marginHorizontal: 20, marginBottom: 16, backgroundColor: '#171717', borderRadius: 12, padding: 4 }}>
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat}
            onPress={() => setActiveTab(cat)}
            style={{
              flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center',
              backgroundColor: activeTab === cat ? 'rgba(16,185,129,0.15)' : 'transparent',
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: activeTab === cat ? '#10b981' : '#71717a' }}>
              {formatLeaderboardLabel(cat)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* My Rank card */}
      {myRank && <MyRankCard rank={myRank} category={activeTab} />}

      {/* Ranked list */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#10b981" />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => `${e.userId}-${e.rank}`}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
          renderItem={({ item }: ListRenderItemInfo<LeaderboardEntry>) => (
            <EntryRow entry={item} category={activeTab} />
          )}
          ListEmptyComponent={
            <Text style={{ color: '#52525b', textAlign: 'center', marginTop: 32, fontSize: 14 }}>
              No athletes ranked yet in {formatLeaderboardLabel(activeTab)}.
            </Text>
          }
          ListFooterComponent={
            hasMore ? (
              <Pressable onPress={() => handleLoadMore(entries)} style={{ alignItems: 'center', paddingVertical: 16 }}>
                {loadingMore
                  ? <ActivityIndicator color="#10b981" size="small" />
                  : <Text style={{ color: '#10b981', fontSize: 13, fontWeight: '600' }}>Load more</Text>
                }
              </Pressable>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  )
}

function MyRankCard({ rank, category }: { rank: MyRank; category: LeaderboardCategory }) {
  const isUnranked = rank.rank === 0
  const topPercent = 100 - rank.percentile
  const topDisplay = topPercent < 1 ? '<1' : `${Math.round(topPercent)}`

  return (
    <View style={{ marginHorizontal: 20, marginBottom: 12, backgroundColor: '#171717', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={{ fontSize: 11, color: '#71717a', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Your Rank</Text>
          <Text style={{ fontSize: 26, fontWeight: '800', color: '#fff', marginTop: 2 }}>
            {isUnranked ? 'Unranked' : `#${rank.rank}`}
          </Text>
        </View>
        {!isUnranked && (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 11, color: '#71717a' }}>Top</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#10b981' }}>{topDisplay}%</Text>
          </View>
        )}
      </View>
      {!isUnranked && rank.nextRankValue !== null && (
        <Text style={{ fontSize: 11, color: '#52525b', marginTop: 8 }}>
          Need {formatLeaderboardValue(category, rank.nextRankValue - rank.value)} more to reach #{rank.rank - 1}
        </Text>
      )}
    </View>
  )
}

function EntryRow({ entry, category }: { entry: LeaderboardEntry; category: LeaderboardCategory }) {
  const isTop3 = entry.rank <= 3
  const medalColor = entry.rank === 1 ? '#f59e0b' : entry.rank === 2 ? '#9ca3af' : '#cd7c3a'

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
      backgroundColor: entry.isCurrentUser ? 'rgba(16,185,129,0.06)' : 'transparent',
      borderRadius: entry.isCurrentUser ? 8 : 0,
      paddingHorizontal: entry.isCurrentUser ? 8 : 0,
    }}>
      <Text style={{ width: 32, fontSize: 13, fontWeight: '700', color: isTop3 ? medalColor : '#52525b', textAlign: 'center' }}>
        {entry.rank}
      </Text>
      <Text style={{ flex: 1, fontSize: 14, fontWeight: entry.isCurrentUser ? '700' : '500', color: entry.isCurrentUser ? '#10b981' : '#e5e5e5', marginLeft: 8 }}>
        {entry.username}{entry.isCurrentUser ? ' (you)' : ''}
      </Text>
      <Text style={{ fontSize: 13, fontWeight: '600', color: '#a3a3a3' }}>
        {formatLeaderboardValue(category, entry.value)}
      </Text>
    </View>
  )
}
```

- [ ] **Step 2: Run mobile typecheck**

```bash
cd apps/mobile && npm run typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/(protected)/leaderboards/index.tsx
git commit -m "feat(mobile): implement leaderboard screen with tabs, my-rank card, and pagination"
```

---

## Task 14: Full verification

- [ ] **Step 1: Run web unit tests**

```bash
npx jest tests/unit --no-coverage
```

Expected: PASS — all tests green

- [ ] **Step 2: Run web typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Run mobile typecheck**

```bash
cd apps/mobile && npm run typecheck
```

Expected: no errors

- [ ] **Step 4: Run mobile unit tests**

```bash
cd apps/mobile && npx jest tests/unit --no-coverage
```

Expected: PASS

- [ ] **Step 5: Confirm no service-role in leaderboard path**

```bash
grep -r "createServiceRoleClient\|service-role" features/leaderboards/ app/\(protected\)/leaderboards/
```

Expected: no output (zero matches)

- [ ] **Step 6: Commit verification**

```bash
git add -A
git commit -m "feat(leaderboards): complete leaderboard foundation — shared types, RPCs, web refactor, mobile screen"
```

---

## Tech Debt Register

| ID | Description | Trigger |
|---|---|---|
| TECH-DEBT-LB-001 | Replace `LIMIT/OFFSET` in `get_leaderboard` with keyset cursor pagination | ~10k leaderboard users |
| TECH-DEBT-LB-002 | Materialize rankings into `leaderboard_snapshots` table via `pg_cron` | ~50k users or p99 RPC > 500ms |
