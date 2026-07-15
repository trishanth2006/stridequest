# Dashboard Data Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every hardcoded zero and static placeholder on the dashboard with real data from Supabase, wire the leaderboard explore card as a live link, and remove a stale diagnostic console.log.

**Architecture:** Add two new query helpers to `features/running/services/history.ts` (DI pattern, RLS user client), extract all computation into a pure `features/running/utils/dashboard-stats.ts` (fully testable with no I/O), then rewrite the dashboard RSC to call these in parallel and render the results. The `RecentActivityFeed` component from profiles is reused with a trivial inline adapter.

**Tech Stack:** Next.js 15 App Router (RSC), Supabase JS v2, TypeScript strict, Jest/RTL

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `features/running/services/history.ts` | Modify | Add `DashboardActivityRow`, `DashboardTotals` types + `getDashboardActivity()`, `getDashboardTotals()` |
| `features/running/utils/dashboard-stats.ts` | Create | Pure `computeDashboardStats()` — derives today/streak/weekly/recent from query rows |
| `features/running/components/WorkoutControls.tsx` | Modify | Remove diagnostic `console.log` at line 212 |
| `app/(protected)/dashboard/page.tsx` | Modify | Wire 3 parallel queries, call `computeDashboardStats()`, replace hardcoded values, fix leaderboard card |
| `tests/unit/features/running/services/history.test.ts` | Modify | Add tests for `getDashboardActivity` and `getDashboardTotals` |
| `tests/unit/features/running/utils/dashboard-stats.test.ts` | Create | Unit tests for `computeDashboardStats()` |

---

## Task 1: Add `DashboardActivityRow`, `getDashboardActivity` to history.ts

**Files:**
- Modify: `features/running/services/history.ts`
- Modify: `tests/unit/features/running/services/history.test.ts`

- [ ] **Step 1.1: Write the failing tests**

Append to `tests/unit/features/running/services/history.test.ts`:

```ts
// ── getDashboardActivity ───────────────────────────────────────────────────

type DashboardResult = {
  data: Array<{
    id: string
    started_at: string
    distance_m: number | null
    duration_s: number | null
    xp_awarded: number | null
  }> | null
  error: { message: string } | null
}

function mockDashboardActivitySupabase(result: DashboardResult) {
  const order = jest.fn().mockResolvedValue(result)
  const gte = jest.fn().mockReturnValue({ order })
  const eq = jest.fn().mockReturnValue({ gte })
  const select = jest.fn().mockReturnValue({ eq })
  const from = jest.fn().mockReturnValue({ select })
  return { client: { from }, from, select, eq, gte, order }
}

describe('getDashboardActivity', () => {
  it('selects id, started_at, distance_m, duration_s, xp_awarded', async () => {
    const { client, select } = mockDashboardActivitySupabase({ data: [], error: null })
    await getDashboardActivity(client as never)
    expect(select).toHaveBeenCalledWith(
      'id, started_at, distance_m, duration_s, xp_awarded'
    )
  })

  it('filters to completed workouts', async () => {
    const { client, eq } = mockDashboardActivitySupabase({ data: [], error: null })
    await getDashboardActivity(client as never)
    expect(eq).toHaveBeenCalledWith('status', 'completed')
  })

  it('applies a 90-day lower bound on started_at', async () => {
    const { client, gte } = mockDashboardActivitySupabase({ data: [], error: null })
    await getDashboardActivity(client as never)
    expect(gte).toHaveBeenCalledWith('started_at', expect.any(String))
    const cutoffArg = (gte as jest.Mock).mock.calls[0][1] as string
    const cutoffDate = new Date(cutoffArg)
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90)
    expect(cutoffDate.getTime()).toBeCloseTo(ninetyDaysAgo.getTime(), -4)
  })

  it('orders by started_at descending', async () => {
    const { client, order } = mockDashboardActivitySupabase({ data: [], error: null })
    await getDashboardActivity(client as never)
    expect(order).toHaveBeenCalledWith('started_at', { ascending: false })
  })

  it('returns rows on success', async () => {
    const row = { id: 'w1', started_at: '2026-06-21T10:00:00Z', distance_m: 5000, duration_s: 1800, xp_awarded: 50 }
    const { client } = mockDashboardActivitySupabase({ data: [row], error: null })
    const result = await getDashboardActivity(client as never)
    expect(result).toEqual([row])
  })

  it('returns empty array when no rows', async () => {
    const { client } = mockDashboardActivitySupabase({ data: [], error: null })
    const result = await getDashboardActivity(client as never)
    expect(result).toEqual([])
  })

  it('throws on DB error', async () => {
    const { client } = mockDashboardActivitySupabase({ data: null, error: { message: 'timeout' } })
    await expect(getDashboardActivity(client as never)).rejects.toThrow('timeout')
  })
})
```

- [ ] **Step 1.2: Run to confirm failure**

```
npx jest tests/unit/features/running/services/history.test.ts --no-coverage
```

Expected: `getDashboardActivity is not a function` or similar — tests fail.

- [ ] **Step 1.3: Add `DashboardActivityRow` type and `getDashboardActivity` to history.ts**

Append to the end of `features/running/services/history.ts` (before the final newline):

```ts
/** Shape of one row returned by the dashboard activity query. */
export type DashboardActivityRow = {
  id: string
  started_at: string
  distance_m: number | null
  duration_s: number | null
  xp_awarded: number | null
}

/**
 * Returns the caller's completed workouts from the last 90 days, newest
 * first — used by the dashboard to compute today/streak/weekly/recent stats
 * without an unbounded all-time scan.
 */
export async function getDashboardActivity(
  supabase: SupabaseClient<Database>,
): Promise<DashboardActivityRow[]> {
  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - 90)

  const { data, error } = await supabase
    .from('workouts')
    .select('id, started_at, distance_m, duration_s, xp_awarded')
    .eq('status', 'completed')
    .gte('started_at', cutoff.toISOString())
    .order('started_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}
```

Also add `getDashboardActivity` to the import line in the test file:

```ts
import { getWorkoutHistory, getRecentWorkouts, getDashboardActivity } from '@/features/running/services/history'
```

- [ ] **Step 1.4: Run to confirm pass**

```
npx jest tests/unit/features/running/services/history.test.ts --no-coverage
```

Expected: All `getDashboardActivity` tests pass. All pre-existing tests still pass.

- [ ] **Step 1.5: Commit**

```bash
git add features/running/services/history.ts tests/unit/features/running/services/history.test.ts
git commit -m "feat(dashboard): add getDashboardActivity to history service"
```

---

## Task 2: Add `DashboardTotals` and `getDashboardTotals` to history.ts

**Files:**
- Modify: `features/running/services/history.ts`
- Modify: `tests/unit/features/running/services/history.test.ts`

- [ ] **Step 2.1: Write the failing tests**

Append to `tests/unit/features/running/services/history.test.ts`:

```ts
// ── getDashboardTotals ─────────────────────────────────────────────────────

type TotalsResult = {
  data: Array<{ distance_m: number | null }> | null
  error: { message: string } | null
}

function mockTotalsSupabase(result: TotalsResult) {
  const eq = jest.fn().mockResolvedValue(result)
  const select = jest.fn().mockReturnValue({ eq })
  const from = jest.fn().mockReturnValue({ select })
  return { client: { from }, from, select, eq }
}

describe('getDashboardTotals', () => {
  it('selects distance_m from workouts', async () => {
    const { client, select } = mockTotalsSupabase({ data: [], error: null })
    await getDashboardTotals(client as never)
    expect(select).toHaveBeenCalledWith('distance_m')
  })

  it('filters to completed workouts', async () => {
    const { client, eq } = mockTotalsSupabase({ data: [], error: null })
    await getDashboardTotals(client as never)
    expect(eq).toHaveBeenCalledWith('status', 'completed')
  })

  it('sums distance_m across all rows', async () => {
    const { client } = mockTotalsSupabase({
      data: [{ distance_m: 5000 }, { distance_m: 3000 }],
      error: null,
    })
    const result = await getDashboardTotals(client as never)
    expect(result.totalDistanceM).toBe(8000)
  })

  it('counts total completed runs', async () => {
    const { client } = mockTotalsSupabase({
      data: [{ distance_m: 5000 }, { distance_m: 3000 }],
      error: null,
    })
    const result = await getDashboardTotals(client as never)
    expect(result.totalRunCount).toBe(2)
  })

  it('treats null distance_m as 0 in the sum', async () => {
    const { client } = mockTotalsSupabase({
      data: [{ distance_m: null }, { distance_m: 3000 }],
      error: null,
    })
    const result = await getDashboardTotals(client as never)
    expect(result.totalDistanceM).toBe(3000)
  })

  it('returns zeros when no workouts', async () => {
    const { client } = mockTotalsSupabase({ data: [], error: null })
    const result = await getDashboardTotals(client as never)
    expect(result.totalDistanceM).toBe(0)
    expect(result.totalRunCount).toBe(0)
  })

  it('throws on DB error', async () => {
    const { client } = mockTotalsSupabase({ data: null, error: { message: 'connection lost' } })
    await expect(getDashboardTotals(client as never)).rejects.toThrow('connection lost')
  })
})
```

- [ ] **Step 2.2: Run to confirm failure**

```
npx jest tests/unit/features/running/services/history.test.ts --no-coverage
```

Expected: `getDashboardTotals is not a function`.

- [ ] **Step 2.3: Add `DashboardTotals` and `getDashboardTotals` to history.ts**

Append after `getDashboardActivity` in `features/running/services/history.ts`:

```ts
/** Lifetime aggregate stats for the dashboard. */
export type DashboardTotals = {
  totalDistanceM: number
  totalRunCount: number
}

/**
 * Lifetime totals for all the caller's completed workouts. Fetches only the
 * `distance_m` column so the payload is minimal even for active users.
 */
export async function getDashboardTotals(
  supabase: SupabaseClient<Database>,
): Promise<DashboardTotals> {
  const { data, error } = await supabase
    .from('workouts')
    .select('distance_m')
    .eq('status', 'completed')

  if (error) throw new Error(error.message)
  const rows = data ?? []
  return {
    totalDistanceM: rows.reduce((sum, w) => sum + (w.distance_m ?? 0), 0),
    totalRunCount: rows.length,
  }
}
```

Also update the import in the test file:

```ts
import {
  getWorkoutHistory,
  getRecentWorkouts,
  getDashboardActivity,
  getDashboardTotals,
} from '@/features/running/services/history'
```

- [ ] **Step 2.4: Run to confirm pass**

```
npx jest tests/unit/features/running/services/history.test.ts --no-coverage
```

Expected: All tests pass (including the pre-existing `getWorkoutHistory` and `getRecentWorkouts` suites).

- [ ] **Step 2.5: Commit**

```bash
git add features/running/services/history.ts tests/unit/features/running/services/history.test.ts
git commit -m "feat(dashboard): add getDashboardTotals to history service"
```

---

## Task 3: Create `dashboard-stats.ts` utility (pure computation)

**Files:**
- Create: `features/running/utils/dashboard-stats.ts`
- Create: `tests/unit/features/running/utils/dashboard-stats.test.ts`

- [ ] **Step 3.1: Write the failing tests**

Create `tests/unit/features/running/utils/dashboard-stats.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { computeDashboardStats } from '@/features/running/utils/dashboard-stats'
import type { DashboardActivityRow } from '@/features/running/services/history'

// 2026-06-21 (Sunday). Week: Mon 2026-06-15 → Sun 2026-06-21.
const NOW = new Date('2026-06-21T12:00:00Z')

let _id = 0
function row(started_at: string, overrides: Partial<DashboardActivityRow> = {}): DashboardActivityRow {
  return {
    id: `w${++_id}`,
    started_at,
    distance_m: 5000,
    duration_s: 1800,
    xp_awarded: 50,
    ...overrides,
  }
}

describe('computeDashboardStats — today stats', () => {
  it('sums distance and duration only for workouts on the current UTC date', () => {
    const rows = [
      row('2026-06-21T09:00:00Z', { distance_m: 3000, duration_s: 900, xp_awarded: 30 }),
      row('2026-06-21T17:00:00Z', { distance_m: 2000, duration_s: 600, xp_awarded: 20 }),
      row('2026-06-20T23:59:00Z', { distance_m: 9999, duration_s: 9999, xp_awarded: 999 }),
    ]
    const stats = computeDashboardStats(rows, NOW)
    expect(stats.today.distanceM).toBe(5000)
    expect(stats.today.durationS).toBe(1500)
    expect(stats.today.runCount).toBe(2)
    expect(stats.today.xpAwarded).toBe(50)
  })

  it('returns zeros when no workouts today', () => {
    const stats = computeDashboardStats([row('2026-06-20T10:00:00Z')], NOW)
    expect(stats.today.distanceM).toBe(0)
    expect(stats.today.durationS).toBe(0)
    expect(stats.today.runCount).toBe(0)
    expect(stats.today.xpAwarded).toBe(0)
  })

  it('treats null distance_m and xp_awarded as 0', () => {
    const stats = computeDashboardStats(
      [row('2026-06-21T10:00:00Z', { distance_m: null, xp_awarded: null })],
      NOW,
    )
    expect(stats.today.distanceM).toBe(0)
    expect(stats.today.xpAwarded).toBe(0)
  })
})

describe('computeDashboardStats — streak', () => {
  it('counts consecutive days ending today when today has a workout', () => {
    const rows = [
      row('2026-06-21T10:00:00Z'), // today (Sun)
      row('2026-06-20T10:00:00Z'), // yesterday
      row('2026-06-19T10:00:00Z'), // day before
    ]
    expect(computeDashboardStats(rows, NOW).streakDays).toBe(3)
  })

  it('counts from yesterday when today has no workout yet', () => {
    const rows = [
      row('2026-06-20T10:00:00Z'), // yesterday
      row('2026-06-19T10:00:00Z'), // day before
    ]
    expect(computeDashboardStats(rows, NOW).streakDays).toBe(2)
  })

  it('returns 0 when no workouts exist', () => {
    expect(computeDashboardStats([], NOW).streakDays).toBe(0)
  })

  it('returns 0 when last workout was two days ago (gap breaks streak)', () => {
    const rows = [row('2026-06-19T10:00:00Z')] // two days ago, no yesterday
    expect(computeDashboardStats(rows, NOW).streakDays).toBe(0)
  })

  it('returns 1 when only yesterday had a workout', () => {
    const rows = [row('2026-06-20T10:00:00Z')]
    expect(computeDashboardStats(rows, NOW).streakDays).toBe(1)
  })
})

describe('computeDashboardStats — weekly bar', () => {
  it('returns 7 booleans, all false for empty input', () => {
    const stats = computeDashboardStats([], NOW)
    expect(stats.thisWeekActiveDays).toHaveLength(7)
    expect(stats.thisWeekActiveDays.every(d => d === false)).toBe(true)
  })

  it('marks index 6 (Sunday) active for a Sunday workout', () => {
    const stats = computeDashboardStats([row('2026-06-21T10:00:00Z')], NOW)
    expect(stats.thisWeekActiveDays[6]).toBe(true) // Sunday
    expect(stats.thisWeekActiveDays[0]).toBe(false) // Monday
  })

  it('marks index 0 (Monday) active for a Monday workout', () => {
    const stats = computeDashboardStats([row('2026-06-15T10:00:00Z')], NOW)
    expect(stats.thisWeekActiveDays[0]).toBe(true)
    expect(stats.thisWeekActiveDays[6]).toBe(false)
  })

  it('does not mark days from the previous week', () => {
    const stats = computeDashboardStats([row('2026-06-14T10:00:00Z')], NOW) // previous Sunday
    expect(stats.thisWeekActiveDays.every(d => d === false)).toBe(true)
  })
})

describe('computeDashboardStats — thisWeekRunCount', () => {
  it('counts runs from Monday through today', () => {
    const rows = [
      row('2026-06-15T10:00:00Z'), // Mon
      row('2026-06-17T10:00:00Z'), // Wed
      row('2026-06-21T10:00:00Z'), // Sun
      row('2026-06-14T10:00:00Z'), // previous Sun — not counted
    ]
    expect(computeDashboardStats(rows, NOW).thisWeekRunCount).toBe(3)
  })
})

describe('computeDashboardStats — recentWorkouts', () => {
  it('returns first 5 rows of input (input must already be newest-first)', () => {
    const rows = Array.from({ length: 8 }, (_, i) =>
      row(`2026-06-${String(21 - i).padStart(2, '0')}T10:00:00Z`)
    )
    const stats = computeDashboardStats(rows, NOW)
    expect(stats.recentWorkouts).toHaveLength(5)
    expect(stats.recentWorkouts[0].started_at).toBe('2026-06-21T10:00:00Z')
  })

  it('returns all rows when fewer than 5', () => {
    const rows = [row('2026-06-21T10:00:00Z'), row('2026-06-20T10:00:00Z')]
    expect(computeDashboardStats(rows, NOW).recentWorkouts).toHaveLength(2)
  })

  it('returns empty array for empty input', () => {
    expect(computeDashboardStats([], NOW).recentWorkouts).toEqual([])
  })
})
```

- [ ] **Step 3.2: Run to confirm failure**

```
npx jest tests/unit/features/running/utils/dashboard-stats.test.ts --no-coverage
```

Expected: `Cannot find module '@/features/running/utils/dashboard-stats'`.

- [ ] **Step 3.3: Create `features/running/utils/dashboard-stats.ts`**

```ts
import type { DashboardActivityRow } from '../services/history'

export type DashboardComputedStats = {
  today: {
    distanceM: number
    durationS: number
    runCount: number
    xpAwarded: number
  }
  thisWeekRunCount: number
  thisWeekActiveDays: boolean[] // index 0=Mon, 1=Tue, ..., 6=Sun
  streakDays: number
  recentWorkouts: DashboardActivityRow[]
}

function toUtcDateStr(iso: string): string {
  return iso.slice(0, 10)
}

function getUtcDateStr(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function getMondayUtc(date: Date): Date {
  const d = new Date(date)
  const day = d.getUTCDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/**
 * Derives all dashboard display values from a sorted (newest-first) array of
 * recent workout rows. No I/O — injecting `now` keeps it testable.
 *
 * "Today" and all date boundaries use UTC. A run at 23:50 local time may fall
 * on the next UTC day; this is an accepted MVP tradeoff.
 */
export function computeDashboardStats(
  rows: DashboardActivityRow[],
  now: Date,
): DashboardComputedStats {
  const todayStr = getUtcDateStr(now)
  const mondayStr = getUtcDateStr(getMondayUtc(now))

  // ── Today ──
  const todayRows = rows.filter((r) => toUtcDateStr(r.started_at) === todayStr)
  const today = {
    distanceM: todayRows.reduce((s, r) => s + (r.distance_m ?? 0), 0),
    durationS: todayRows.reduce((s, r) => s + (r.duration_s ?? 0), 0),
    runCount: todayRows.length,
    xpAwarded: todayRows.reduce((s, r) => s + (r.xp_awarded ?? 0), 0),
  }

  // ── This week (Mon–Sun) ──
  const weekRows = rows.filter((r) => toUtcDateStr(r.started_at) >= mondayStr)
  const thisWeekRunCount = weekRows.length

  const thisWeekActiveDays: boolean[] = [false, false, false, false, false, false, false]
  for (const r of weekRows) {
    const dayOfWeek = new Date(r.started_at).getUTCDay() // 0=Sun
    const idx = dayOfWeek === 0 ? 6 : dayOfWeek - 1     // 0=Mon ... 6=Sun
    thisWeekActiveDays[idx] = true
  }

  // ── Streak ──
  // Build a set of unique UTC date strings from the input window.
  const activeDateSet = new Set(rows.map((r) => toUtcDateStr(r.started_at)))

  const cursor = new Date(now)
  cursor.setUTCHours(0, 0, 0, 0)

  // If the user hasn't run today, start counting from yesterday so an
  // in-progress streak doesn't reset at midnight.
  if (!activeDateSet.has(getUtcDateStr(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }

  let streakDays = 0
  while (activeDateSet.has(getUtcDateStr(cursor))) {
    streakDays++
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }

  // ── Recent (first 5 of already-sorted input) ──
  const recentWorkouts = rows.slice(0, 5)

  return { today, thisWeekRunCount, thisWeekActiveDays, streakDays, recentWorkouts }
}
```

- [ ] **Step 3.4: Run to confirm pass**

```
npx jest tests/unit/features/running/utils/dashboard-stats.test.ts --no-coverage
```

Expected: All tests green.

- [ ] **Step 3.5: Commit**

```bash
git add features/running/utils/dashboard-stats.ts tests/unit/features/running/utils/dashboard-stats.test.ts
git commit -m "feat(dashboard): add computeDashboardStats pure utility"
```

---

## Task 4: Remove diagnostic `console.log` from WorkoutControls

**Files:**
- Modify: `features/running/components/WorkoutControls.tsx`

- [ ] **Step 4.1: Delete the log statement**

In `features/running/components/WorkoutControls.tsx`, find and delete lines 212–218 (the GPS diagnostic block):

```ts
  console.log('[GPS-DIAG:controls] render:', {
    phase,
    recorderStatus,
    hasFix,
    permission,
    gpsError: gpsError?.code ?? null,
    distanceMeters,
  })
```

Remove those 7 lines entirely. The line immediately before it is `handleDiscard`'s closing brace `}`, and the line immediately after is `const gpsStatus = gpsStatusMessage(...)`.

- [ ] **Step 4.2: Verify tests still pass**

```
npx jest tests/unit/features/running/components/WorkoutControls.test.tsx --no-coverage
```

Expected: All tests pass (the log removal changes no logic).

- [ ] **Step 4.3: Commit**

```bash
git add features/running/components/WorkoutControls.tsx
git commit -m "fix: remove GPS diagnostic console.log from WorkoutControls"
```

---

## Task 5: Rewrite the dashboard page

**Files:**
- Modify: `app/(protected)/dashboard/page.tsx`

- [ ] **Step 5.1: Replace the entire file**

Replace `app/(protected)/dashboard/page.tsx` with:

```tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/infrastructure/supabase/server'
import { getUserXP } from '@/features/xp/services/profile'
import {
  getDashboardActivity,
  getDashboardTotals,
} from '@/features/running/services/history'
import { computeDashboardStats } from '@/features/running/utils/dashboard-stats'
import { RecentActivityFeed } from '@/features/profiles/components/RecentActivityFeed'
import type { RecentActivity } from '@/features/profiles/types'
import {
  Zap, Map, Flame, Play, MapPin, History, Crown,
  Timer, TrendingUp, Footprints,
} from 'lucide-react'

export const metadata = { title: 'Dashboard — StrideQuest' }

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [profile, xp, activity, totals] = await Promise.all([
    supabase.from('profiles').select('username').eq('id', user.id).single(),
    getUserXP(supabase, user.id),
    getDashboardActivity(supabase),
    getDashboardTotals(supabase),
  ])

  const username = profile.data?.username ?? 'Runner'
  const stats = computeDashboardStats(activity, new Date())
  const totalDistanceKm = (totals.totalDistanceM / 1000).toFixed(1)
  const isNewUser = xp.totalXp === 0 && totals.totalDistanceM === 0

  const recentActivities: RecentActivity[] = stats.recentWorkouts.map((w) => ({
    id: `workout-${w.id}`,
    type: 'workout' as const,
    title: `🏃 Completed ${((w.distance_m ?? 0) / 1000).toFixed(1)} km run`,
    createdAt: w.started_at,
  }))

  return (
    <div className="relative flex flex-col gap-6 pb-12 pt-24">

      {/* ── Header row: greeting + CTA ── */}
      <section className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-widest text-primary uppercase flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            {isNewUser ? 'Welcome to StrideQuest' : 'Ready to conquer today?'}
          </p>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-foreground">
            {username}
          </h1>
        </div>
        <Link
          href="/run"
          id="start-run-cta"
          className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-primary px-6 py-3.5 text-base font-bold text-primary-foreground transition-all duration-300 ease-out hover:scale-102 hover:-translate-y-0.5 shadow-[0_0_20px_rgba(16,185,129,0.12)] hover:shadow-[0_0_30px_rgba(16,185,129,0.25)] shrink-0"
        >
          <Play fill="currentColor" className="w-5 h-5" />
          Start Run
        </Link>
      </section>

      {/* ── Today's Activity ── */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <TodayCard
          icon={<Footprints className="w-4 h-4" />}
          label="Distance Today"
          value={`${Math.round(stats.today.distanceM)}`}
          unit="m"
        />
        <TodayCard
          icon={<Timer className="w-4 h-4" />}
          label="Active Time"
          value={`${Math.round(stats.today.durationS / 60)}`}
          unit="min"
        />
        <TodayCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Runs This Week"
          value={`${stats.thisWeekRunCount}`}
          unit=""
        />
        <TodayCard
          icon={<Zap className="w-4 h-4" />}
          label="XP Today"
          value={`${stats.today.xpAwarded}`}
          unit="xp"
        />
      </section>

      {/* ── Lifetime Stats (Bento) ── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* XP */}
        <div className="bg-card rounded-2xl p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] border border-white/[0.04] flex flex-col justify-between min-h-[140px] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/10 group">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Total XP</span>
            <Zap className="w-4 h-4 text-muted-foreground/60 group-hover:text-primary transition-colors duration-300" />
          </div>
          <div className="mt-auto pt-3">
            <span className="text-3xl md:text-4xl font-mono font-bold tracking-tight text-foreground tabular-nums">
              {xp.totalXp.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Distance */}
        <div className="bg-card rounded-2xl p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] border border-white/[0.04] flex flex-col justify-between min-h-[140px] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/10 group">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Distance</span>
            <Map className="w-4 h-4 text-muted-foreground/60 group-hover:text-primary transition-colors duration-300" />
          </div>
          <div className="mt-auto pt-3 flex items-baseline gap-1.5">
            <span className="text-3xl md:text-4xl font-mono font-bold tracking-tight text-foreground tabular-nums">
              {totals.totalDistanceM === 0 ? '0' : totalDistanceKm}
            </span>
            <span className="text-sm text-muted-foreground font-medium">
              {totals.totalDistanceM === 0 ? 'm' : 'km'}
            </span>
          </div>
        </div>

        {/* Streak + Weekly */}
        <div className="bg-card rounded-2xl p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] border border-white/[0.04] flex flex-col justify-between min-h-[140px] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/10 group">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Streak</span>
            <Flame className="w-4 h-4 text-muted-foreground/60 group-hover:text-primary transition-colors duration-300" />
          </div>
          <div className="mt-auto pt-3">
            <div className="flex items-baseline gap-1.5 mb-3">
              <span className="text-3xl md:text-4xl font-mono font-bold tracking-tight text-foreground tabular-nums">
                {stats.streakDays}
              </span>
              <span className="text-sm text-muted-foreground font-medium">days</span>
            </div>
            <div className="flex gap-1">
              {DAY_LABELS.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={`w-full h-1.5 rounded-full ${
                      stats.thisWeekActiveDays[i] ? 'bg-primary/60' : 'bg-white/[0.06]'
                    }`}
                  />
                  <span className="text-[9px] font-medium text-muted-foreground/60">{day}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </section>

      {/* ── Recent Activity ── */}
      <section>
        <h2 className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase mb-3 px-1">
          Recent Activity
        </h2>
        <RecentActivityFeed activities={recentActivities} />
      </section>

      {/* ── Explore ── */}
      <section>
        <h2 className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase mb-3 px-1">
          Explore
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

          {/* Territory */}
          <Link
            href="/territory"
            className="bg-card rounded-2xl p-5 border border-white/[0.04] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/10 group/terr"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-white/[0.04] flex items-center justify-center group-hover/terr:bg-primary/10 transition-colors">
                <MapPin className="w-4 h-4 text-muted-foreground/60 group-hover/terr:text-primary transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground">Territories</h3>
                <p className="text-[11px] text-muted-foreground/60">View your captured cells</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1 p-2 bg-black/20 rounded-lg">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div
                  key={i}
                  className={`aspect-square rounded-sm ${
                    i === 4 ? 'bg-primary/30 border border-primary/40' : 'bg-white/[0.04]'
                  }`}
                />
              ))}
            </div>
          </Link>

          {/* History */}
          <Link
            href="/run/history"
            className="bg-card rounded-2xl p-5 border border-white/[0.04] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/10 group/hist"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/[0.04] flex items-center justify-center group-hover/hist:bg-primary/10 transition-colors">
                <History className="w-4 h-4 text-muted-foreground/60 group-hover/hist:text-primary transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground">Run History</h3>
                <p className="text-[11px] text-muted-foreground/60">View past sessions</p>
              </div>
            </div>
          </Link>

          {/* Leaderboard */}
          <Link
            href="/leaderboards"
            className="bg-card rounded-2xl p-5 border border-white/[0.04] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/10 group/lead"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/[0.04] flex items-center justify-center group-hover/lead:bg-primary/10 transition-colors">
                <Crown className="w-4 h-4 text-muted-foreground/60 group-hover/lead:text-primary transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground">Leaderboard</h3>
                <p className="text-[11px] text-muted-foreground/60">See top runners</p>
              </div>
            </div>
          </Link>

        </div>
      </section>

    </div>
  )
}

function TodayCard({
  icon,
  label,
  value,
  unit,
}: {
  icon: React.ReactNode
  label: string
  value: string
  unit: string
}) {
  return (
    <div className="bg-card rounded-xl p-4 border border-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] flex flex-col gap-2 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/10">
      <div className="flex items-center gap-2 text-muted-foreground/60">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-widest">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-mono font-bold text-foreground tabular-nums">{value}</span>
        {unit && <span className="text-xs text-muted-foreground font-medium">{unit}</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 5.2: Typecheck**

```
npx tsc --noEmit
```

Expected: Zero errors. If `profile.data` is typed as nullable, adjust `profile.data?.username ?? 'Runner'` — this pattern is already used in the original page.

- [ ] **Step 5.3: Run all unit tests**

```
npx jest tests/unit --passWithNoTests --no-coverage
```

Expected: All 541+ tests pass (no regressions). The new tests from Tasks 1-3 also pass.

- [ ] **Step 5.4: Lint**

```
npx eslint app/\(protected\)/dashboard/page.tsx features/running/services/history.ts features/running/utils/dashboard-stats.ts features/running/components/WorkoutControls.tsx --max-warnings 0
```

Expected: No errors or warnings.

- [ ] **Step 5.5: Commit**

```bash
git add "app/(protected)/dashboard/page.tsx"
git commit -m "feat(dashboard): wire real data — XP, distance, today stats, streak, weekly bar, recent activity, leaderboard card"
```

---

## Task 6: Final verification gate

- [ ] **Step 6.1: Run full unit test suite**

```
npx jest tests/unit --passWithNoTests
```

Expected output (last 3 lines similar to):
```
Test Suites: 79 passed, 79 total
Tests:       XXX passed, XXX total
```

- [ ] **Step 6.2: Typecheck**

```
npx tsc --noEmit
```

Expected: `Process exited with code 0`.

- [ ] **Step 6.3: Lint**

```
npx eslint features/running app/\(protected\)/dashboard --max-warnings 0
```

Expected: No issues.

- [ ] **Step 6.4: Confirm final commit state**

```
git log --oneline -5
```

Expected — four new commits visible:
```
feat(dashboard): wire real data — ...
fix: remove GPS diagnostic console.log from WorkoutControls
feat(dashboard): add computeDashboardStats pure utility
feat(dashboard): add getDashboardTotals to history service
feat(dashboard): add getDashboardActivity to history service
```

---

## Self-Review Checklist (already completed inline)

**Spec coverage:**
- §2 Goal 1 (XP from user_xp, distance from sum) → Task 5 (dashboard page, getUserXP + getDashboardTotals) ✅
- §2 Goal 2 (today stats) → Tasks 1, 3, 5 ✅
- §2 Goal 3 (streak) → Tasks 3, 5 ✅
- §2 Goal 4 (weekly bar) → Tasks 3, 5 ✅
- §2 Goal 5 (recent activity) → Task 5 (RecentActivityFeed adapter) ✅
- §2 Goal 6 (leaderboard card fix) → Task 5 (Link instead of div) ✅
- §4 console.log removal → Task 4 ✅
- §8 Tests (today boundary, streak, weekly, zeros, recents) → Task 3 ✅

**Type consistency:** `DashboardActivityRow` defined in `history.ts` (Task 1), imported by `dashboard-stats.ts` (Task 3), used in dashboard page (Task 5). `DashboardComputedStats` defined in `dashboard-stats.ts`, consumed only in Task 5. All names consistent throughout.

**Placeholders:** None found.
