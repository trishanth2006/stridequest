# Leaderboard System Design

**Date:** 2026-06-23  
**Status:** Approved — ready for implementation  
**Sprint:** 6

---

## Overview

A production-grade leaderboard system shared by the Next.js web app and the Expo mobile app.
All ranking is owned by the database; clients call two security-definer RPCs via the standard
authenticated Supabase client. No service-role key is used anywhere in the leaderboard path.

### Goals

- Four leaderboard categories: XP, Territory, Distance, Weekly
- Single paginated RPC (`get_leaderboard`) usable from both platforms
- Companion RPC (`get_my_rank`) for cheap "your rank + next milestone" display
- Shared types in `@stridequest/shared` consumed by web and mobile
- Strict TypeScript throughout

### Non-Goals (V1)

- Cursor-based pagination (documented as tech debt — see TECH-DEBT-LB-001)
- Materialized ranking snapshots (documented as tech debt — see TECH-DEBT-LB-002)
- Avatar URLs (profiles table does not have this column yet)

---

## Architecture

```
Mobile (expo-router)           Web (Next.js server component)
        │                                  │
  supabase.rpc(...)               supabase.rpc(...)
        │                                  │
        └───────────────┬──────────────────┘
                        ▼
          get_leaderboard / get_my_rank
          (SECURITY DEFINER — bypasses RLS internally)
                        │
          user_xp  workouts  cell_ownership  xp_events  profiles
```

Both platforms call the same RPCs. The database is the single source of truth for ranking logic.

---

## Data Sources

No new tables. All four categories use existing tables.

| Category | Source table | Aggregate | Achievement date (tie-break) |
|---|---|---|---|
| `xp` | `user_xp` | `total_xp` | `user_xp.updated_at` |
| `territory` | `cell_ownership` | `COUNT(cell_id)` per owner | `MAX(cell_ownership.updated_at)` |
| `distance` | `workouts` (completed, distance > 0) | `SUM(distance_m)` | `MAX(workouts.started_at)` |
| `weekly` | `xp_events` (since Monday 00:00 UTC) | `SUM(xp_awarded)` | `MAX(xp_events.created_at)` |

---

## Ranking Rules

### Rank function: `RANK()`

`RANK()` is used (not `ROW_NUMBER()`). Equal scores produce equal ranks:

```
User A: 1000 XP → Rank 1
User B: 1000 XP → Rank 1
User C:  900 XP → Rank 3
```

> **Implementation note:** Because `user_id ASC` is the final tie-break in the `ORDER BY`,
> no two rows share all ORDER BY columns (user_id is unique). In practice, `RANK()` and
> `ROW_NUMBER()` produce identical numeric results with these tie-breakers. `RANK()` is used
> for semantic clarity — it expresses the intent (equal scores = equal rank) even though the
> tie-break columns prevent actual collisions with the current data model.

### Exclusion

Users with a value ≤ 0 in a category are excluded from that board entirely.

### Tie-break (display order within equal ranks)

When two users share a rank, their display order in the paginated result is deterministic:

1. Higher value wins (primary sort, drives the RANK)
2. Earlier achievement date ASC (who reached the score first)
3. Earlier `profiles.created_at` ASC (older account wins)
4. `user_id` ASC (final stable sort)

The tie-break order is embedded in the `ORDER BY` of each window function and the final
`ORDER BY` on the outer query.

### Weekly reset

No explicit reset. The weekly board is always a time-windowed query over `xp_events` from
`date_trunc('week', now() AT TIME ZONE 'UTC')` (Monday 00:00:00 UTC) to the current moment.
The board resets naturally as the calendar week flips. The backend owns the week definition —
clients never pass a week start timestamp.

---

## RPC 1: `get_leaderboard`

### Signature

```sql
CREATE OR REPLACE FUNCTION public.get_leaderboard(
  p_category text,
  p_limit    int DEFAULT 50,
  p_offset   int DEFAULT 0
)
RETURNS TABLE (rank bigint, user_id uuid, username text, value bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
```

### Input validation

```sql
IF p_category NOT IN ('xp', 'territory', 'distance', 'weekly') THEN
  RAISE EXCEPTION 'unknown category: %', p_category USING ERRCODE = '22023';
END IF;
IF p_limit < 1 OR p_limit > 100 THEN
  RAISE EXCEPTION 'p_limit must be 1–100' USING ERRCODE = '22023';
END IF;
IF p_offset < 0 THEN
  RAISE EXCEPTION 'p_offset must be >= 0' USING ERRCODE = '22023';
END IF;
```

### XP block

```sql
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
```

### Territory block

```sql
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
        ORDER BY tc.cell_count DESC, tc.latest_capture ASC, p.created_at ASC, tc.user_id ASC
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
```

### Distance block

```sql
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
        ORDER BY ds.total_distance DESC, ds.latest_run ASC, p.created_at ASC, ds.user_id ASC
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
```

### Weekly block

Week start is computed entirely in SQL. Clients never pass a timestamp.

```sql
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
        ORDER BY wk.weekly_xp DESC, wk.latest_event ASC, p.created_at ASC, wk.user_id ASC
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
```

---

## RPC 2: `get_my_rank`

### Signature

```sql
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
```

### `next_rank_value`

The score the caller needs to reach to enter the next rank above them. Enables the UI pattern:

```
Rank #52 · 12,450 XP
Need 230 XP to reach Rank #51
```

Computed by finding the lowest `value` among all users with `rank < my_rank` in the ranked CTE.
Returns `NULL` when the caller is already rank 1 (no higher rank exists).

### Caller identity

`auth.uid()` is called at the start of the function (not inside a CTE). Returns unranked zeros
(`rank=0, value=0, percentile=0, next_rank_value=NULL`) when the caller has no score in the
requested category.

### Structure

Each category gets its own isolated IF/RETURN QUERY block, identical pattern to
`get_leaderboard`. The extra columns (`total_users`, `percentile`, `next_rank_value`) are
computed from CTEs alongside the ranked CTE.

### Percentile formula

```sql
ROUND(100.0 * (total_users - my_rank + 1) / total_users, 1)
```

Top rank = 100th percentile. Unranked = 0.

---

## RLS Review

No new RLS policies needed. Security-definer bypasses all row policies for internal reads.

| Table | Policy | RPC access |
|---|---|---|
| `user_xp` | read-own | Bypassed — internal cross-user read |
| `workouts` | read-own | Bypassed — internal cross-user aggregation |
| `xp_events` | read-own | Bypassed — internal cross-user aggregation |
| `cell_ownership` | world-readable | No bypass needed |
| `profiles` | read-own | Bypassed — internal username lookup |

**What reaches the client:** only `(rank, user_id, username, value)`. No raw workout rows,
no per-event XP history, no private distances.

**Grant boundary:**

```sql
REVOKE EXECUTE ON FUNCTION public.get_leaderboard(text, int, int) FROM public;
REVOKE EXECUTE ON FUNCTION public.get_leaderboard(text, int, int) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_leaderboard(text, int, int) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_my_rank(text) FROM public;
REVOKE EXECUTE ON FUNCTION public.get_my_rank(text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_my_rank(text) TO authenticated;
```

Anonymous users cannot call either RPC.

---

## New Indexes (one migration)

```sql
-- XP board: direct sort
CREATE INDEX IF NOT EXISTS idx_user_xp_leaderboard
  ON public.user_xp (total_xp DESC, updated_at ASC);

-- Distance board: partial index — completed workouts with distance only
CREATE INDEX IF NOT EXISTS idx_workouts_leaderboard
  ON public.workouts (user_id, distance_m, started_at)
  WHERE status = 'completed' AND distance_m IS NOT NULL AND distance_m > 0;

-- Weekly board: cross-user filter by created_at
CREATE INDEX IF NOT EXISTS idx_xp_events_leaderboard
  ON public.xp_events (created_at, user_id, xp_awarded);
```

The existing `idx_cell_ownership_owner_user_id` already supports the territory GROUP BY.

---

## Scalability

| Category | Bottleneck | V1 mitigation |
|---|---|---|
| XP | Full scan of `user_xp` | `idx_user_xp_leaderboard` |
| Territory | GROUP BY over `cell_ownership` | Existing index |
| Distance | SUM over `workouts` | Partial index on completed workouts |
| Weekly | Scan `xp_events` since Monday | `idx_xp_events_leaderboard`; fresh-week scans are small |

`get_my_rank` ranks all users to find the caller's position. Cost is the same as one
`get_leaderboard` call. Acceptable at V1 scale.

### TECH-DEBT-LB-001 — Cursor pagination

Replace `LIMIT/OFFSET` with keyset cursor pagination once leaderboard users exceed ~10k.
`OFFSET N` forces Postgres to scan and discard N rows before returning results.
The RPC signature can be extended: add `p_after_rank bigint DEFAULT NULL` and
`p_after_user_id uuid DEFAULT NULL`, replacing `p_offset`. No client interface change is
needed until then.

### TECH-DEBT-LB-002 — Materialized ranking snapshots

Add a `leaderboard_snapshots` table refreshed every 5 min by `pg_cron`. The RPCs read from
the snapshot instead of aggregating live. The external RPC interface stays identical —
this is a drop-in internal optimization with no API change.

---

## Shared Package Layout

```
packages/shared/src/leaderboards/
  types.ts        ← LeaderboardCategory, LeaderboardEntry, LeaderboardSummary,
                     TerritoryKing, MyRank
  formatters.ts   ← formatLeaderboardValue(category: LeaderboardCategory, value: number): string
  index.ts        ← export * from './types'; export * from './formatters'

packages/shared/src/index.ts  ← add: export * from './leaderboards'
```

### Types

```typescript
export type LeaderboardCategory = 'xp' | 'territory' | 'distance' | 'weekly'

export interface LeaderboardEntry {
  rank: number
  userId: string
  username: string
  value: number
  isCurrentUser: boolean  // Set client-side: entry.userId === authedUserId; not returned by RPC
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
  rank: number          // 0 = unranked sentinel (no score in this category); 1-based otherwise
  value: number
  totalUsers: number
  percentile: number    // 0–100.0; 0 = unranked
  nextRankValue: number | null  // null = already rank 1; undefined from DB mapped to null
}
```

---

## File Tree

```
packages/shared/src/
  leaderboards/
    types.ts
    formatters.ts
    index.ts
  index.ts                              ← add export

features/leaderboards/
  types.ts                              ← Simplify: remove input shapes; import from shared
  services/
    leaderboards.ts                     ← Remove ranking/aggregation; keep getLeaderboardSummary,
                                           getTerritoryKing (derived from entries list)
  data/
    load-leaderboards.ts                ← Replace 5 service-role queries with RPC calls
  components/                           ← Unchanged

apps/mobile/src/features/leaderboards/
  services/
    leaderboards.ts                     ← fetchLeaderboard(), fetchMyRank()

apps/mobile/app/(protected)/leaderboards/
  index.tsx                             ← Replace placeholder with full implementation

supabase/migrations/
  20260623_leaderboard_rpcs.sql         ← Indexes + both RPCs + grants
```

---

## Implementation Phases

### Phase 1 — Shared package

- Create `packages/shared/src/leaderboards/types.ts`
- Create `packages/shared/src/leaderboards/formatters.ts`
- Create `packages/shared/src/leaderboards/index.ts`
- Export from `packages/shared/src/index.ts`
- Update `features/leaderboards/types.ts` to import from shared (remove local duplicates)
- Verify: `npm run typecheck` passes on both web and mobile

### Phase 2 — Database migration

- Write migration: `supabase/migrations/20260623_leaderboard_rpcs.sql`
  - Three new indexes
  - `get_leaderboard` function
  - `get_my_rank` function
  - Revoke + grant statements
- Apply via MCP
- Verify via MCP

### Phase 3 — RPC verification

Manually confirm each category returns expected data (or empty set):

```sql
SELECT * FROM public.get_leaderboard('xp', 10, 0);
SELECT * FROM public.get_leaderboard('territory', 10, 0);
SELECT * FROM public.get_leaderboard('distance', 10, 0);
SELECT * FROM public.get_leaderboard('weekly', 10, 0);
SELECT * FROM public.get_my_rank('xp');
```

Confirm `anon` role is denied.

### Phase 4 — Web refactor

- Replace `features/leaderboards/data/load-leaderboards.ts` service-role loader with RPC calls
- Simplify `features/leaderboards/services/leaderboards.ts` (remove aggregation logic, DB owns it)
- Verify existing web UI renders identically
- Run `npm run typecheck` and `npx jest tests/unit`

### Phase 5 — Mobile implementation

- Create `apps/mobile/src/features/leaderboards/services/leaderboards.ts`
- Implement `apps/mobile/app/(protected)/leaderboards/index.tsx`
  - Tab bar: XP / Territory / Distance / Weekly
  - Top 10 initial load, load-more pagination
  - "My Rank" card: rank + percentile + next milestone
- Run mobile typecheck

### Phase 6 — Full verification

- `npm run typecheck` (web)
- `cd apps/mobile && npm run typecheck`
- `npx jest tests/unit`
- Manual RLS validation: confirm `anon` cannot call either RPC
- Confirm web leaderboard page renders with no service-role dependency
