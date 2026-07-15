# Dashboard Data Wiring — Design Spec

**Date:** 2026-06-21
**Branch:** feat/monorepo-mobile
**Sub-project:** A — Dashboard live data (first of four web-completion sub-projects)
**Scope:** Replace all hardcoded zeros and static placeholders on the dashboard with real user data.

---

## 1. Problem Statement

`app/(protected)/dashboard/page.tsx` currently:
- Reads `profiles.total_xp` and `profiles.total_distance_m` — both are stale denormalized fields that are NOT maintained by any trigger or RPC. Authoritative sources are `user_xp.total_xp` and `sum(workouts.distance_m)`.
- Hardcodes all "Today's Activity" cards to `0`.
- Hardcodes streak to `0 days`.
- Hardcodes the weekly progress bar to show only Monday lit.
- Shows a static placeholder for "Recent Activity" despite all the data existing in other services.
- Shows the Leaderboards explore card as "Soon" even though `/leaderboards` is live.

---

## 2. Goals

1. Show real total XP (from `user_xp`) and real total distance (from `sum(workouts)`).
2. Wire Today's Activity: distance, active time, runs this week, and XP earned today.
3. Wire the streak counter with real consecutive-day logic.
4. Wire the weekly bar (Mon–Sun) to highlight days with a completed run.
5. Replace the static "Recent Activity" placeholder with the last 5 runs.
6. Fix the Leaderboards explore card (make it a live link).

**Out of scope:** timezone-aware "today" (UTC is acceptable for MVP), push notifications, settings page, admin features.

---

## 3. Architecture

### 3.1 Queries (3 parallel fetches)

```
1. getUserXP(supabase, user.id)
   ↳ features/xp/services/profile.ts (already exists)
   ↳ Returns: { totalXp, level }

2. getDashboardActivity(supabase)
   ↳ features/running/services/history.ts (new export)
   ↳ SELECT id, started_at, distance_m, duration_s, xp_awarded
     FROM workouts
     WHERE status='completed' AND started_at >= NOW() - INTERVAL '90 days'
     ORDER BY started_at DESC
   ↳ Returns: DashboardActivityRow[]

3. getDashboardTotals(supabase)
   ↳ features/running/services/history.ts (new export)
   ↳ SELECT COALESCE(SUM(distance_m), 0), COUNT(*)
     FROM workouts
     WHERE status='completed'
   ↳ Returns: { totalDistanceM, totalRunCount }
```

Rationale for a 90-day window on query 2: streak never meaningfully exceeds 90 days; returning all workouts would grow unboundedly as users accumulate history.

### 3.2 Pure computation layer

A new pure utility (`features/running/utils/dashboard-stats.ts`) derives all display values from the query results with no I/O. Pure functions are trivially testable and keep the page RSC thin.

```ts
export type DashboardActivityRow = {
  id: string
  started_at: string     // ISO string (UTC)
  distance_m: number | null
  duration_s: number | null
  xp_awarded: number | null
}

export type DashboardComputedStats = {
  today: {
    distanceM: number
    durationS: number
    runCount: number
    xpAwarded: number
  }
  thisWeekRunCount: number          // Mon–today, ISO week
  thisWeekActiveDays: boolean[]     // [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
  streakDays: number                // consecutive calendar days ending at most today, UTC
  recentWorkouts: DashboardActivityRow[]  // first 5 from sorted input
}

export function computeDashboardStats(
  rows: DashboardActivityRow[],
  now: Date,                        // injected for testability
): DashboardComputedStats
```

**Streak algorithm:** Walk backward from today (UTC). For each calendar day, check if at least one workout `started_at` falls on that day. Count consecutive days until a gap. If today has no workout, the streak still counts yesterday as the most recent day (so a user who ran yesterday doesn't see their streak reset mid-day).

**Weekly bar:** Current ISO week is Mon–Sun. For each of the 7 days, return `true` if any row's `started_at` falls on that calendar day.

### 3.3 Dashboard page

```ts
const [profile, xp, activity, totals] = await Promise.all([
  supabase.from('profiles').select('username').eq('id', user.id).single(),
  getUserXP(supabase, user.id),
  getDashboardActivity(supabase),
  getDashboardTotals(supabase),
])
const stats = computeDashboardStats(activity, new Date())
```

All hardcoded values are replaced with `stats.*`, `xp.*`, and `totals.*`.

### 3.4 Recent Activity section

Reuse `RecentActivityFeed` from `features/profiles/components/RecentActivityFeed.tsx`. It already handles: empty state, icons by type, relative timestamps.

Adapter (inline in page, ~10 lines):

```ts
const recentActivities: RecentActivity[] = stats.recentWorkouts.map(w => ({
  id: `workout-${w.id}`,
  type: 'workout' as const,
  title: `🏃 Completed ${((w.distance_m ?? 0) / 1000).toFixed(1)} km run`,
  createdAt: w.started_at,
}))
```

### 3.5 Leaderboard card fix

Change the static `<div className="... opacity-70 cursor-not-allowed">` to `<Link href="/leaderboards">` with hover styles matching the Territory and History cards.

---

## 4. File Inventory

| File | Change |
|---|---|
| `features/running/services/history.ts` | Add `getDashboardActivity()` and `getDashboardTotals()` exports (~40 lines added; total stays under 300) |
| `features/running/utils/dashboard-stats.ts` | **New** — pure `computeDashboardStats()` (~80 lines) |
| `app/(protected)/dashboard/page.tsx` | Wire 3 parallel queries, call `computeDashboardStats()`, replace all hardcoded values, adapter for recent feed, fix leaderboard card (~rewrite of data layer + render) |
| `tests/unit/features/running/utils/dashboard-stats.test.ts` | **New** — unit tests for `computeDashboardStats()` covering: today boundary, streak on active day, streak on rest day, zero workouts, weekly day mapping |
| `features/running/components/WorkoutControls.tsx` | Remove `console.log` at line 212 |

---

## 5. Types

`DashboardActivityRow` is defined in `features/running/services/history.ts` (data layer) and imported by `features/running/utils/dashboard-stats.ts` (computation layer). `DashboardComputedStats` is defined in and exported from `dashboard-stats.ts`.

`RecentActivity` (from `features/profiles/types.ts`) is already typed; the adapter converts `DashboardActivityRow[]` to `RecentActivity[]` inline in the dashboard page.

---

## 6. Security

- All three new queries use the **RLS user client** (`createClient()`), not service-role. The dashboard only reads the current user's own data; RLS enforces this automatically.
- No cross-user reads. No service-role client required here (unlike leaderboards/profiles).

---

## 7. Error Handling

- `getDashboardActivity` and `getDashboardTotals` throw on DB error (same pattern as `getOwnedCells`, `getUserXP`). The page will surface a Next.js error boundary.
- `computeDashboardStats` is pure; it degrades gracefully on an empty array (returns all zeros, empty weekly bar, 0 streak, empty recents).

---

## 8. Testing

### Unit (new file)

`tests/unit/features/running/utils/dashboard-stats.test.ts`:

- `today boundary` — workout at 00:00 UTC today counts; workout at 23:59 UTC yesterday does not
- `streak on active day` — run today + run yesterday = 2-day streak
- `streak on rest day` — run yesterday + run day-before = 2-day streak (today's gap doesn't reset)
- `zero workouts` — all stats are 0
- `weekly bar` — workout on Tuesday marks `[false, true, false, false, false, false, false]`
- `recent workouts` — only first 5 returned from a 10-row input

### Existing tests unchanged

All 541 passing unit tests must continue to pass. The changes to `history.ts` are additive. The `dashboard.page.tsx` rewrite has no dedicated unit test (it's a thin RSC; the logic is in `computeDashboardStats`).

---

## 9. Verification Gates

Before marking complete:
1. `npx jest tests/unit --passWithNoTests` — all pass
2. `npx tsc --noEmit` — no type errors
3. `npx eslint features/running app/(protected)/dashboard` — no errors
4. Manual: open `/dashboard` with a user who has completed runs — see real data
5. Manual: open `/dashboard` with a brand-new user — see all zeros (not an error state)

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| UTC "today" differs from user's local date (e.g., run at 23:50 local = tomorrow UTC) | Accepted for MVP; timezone-aware stats require either user TZ preference or browser JS, both out of scope |
| 90-day window misses workouts older than 90 days for streak display | A streak > 90 days is effectively "at least 90 days" — acceptable, document in code |
| `getDashboardTotals` aggregates all-time workouts; grows with the user | It's a single aggregate query (SUM + COUNT), O(1) in Postgres, not a concern |

---

## 11. Recommended Next Step (after this sub-project)

Sub-project B: Code quality pass — audit remaining `any` types, run full lint, remove TerritoryBoard debug panel, ensure all verification gates pass at the repo level.
