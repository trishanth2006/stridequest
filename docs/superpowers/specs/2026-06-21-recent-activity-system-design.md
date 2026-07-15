# Recent Activity System — Design Spec

**Date:** 2026-06-21
**Branch:** feat/monorepo-mobile
**Scope:** Tab navigator migration + Recent Activity (dashboard section, history screen, workout detail screen, WorkoutActivityCard component)

---

## 1. Goals

1. Implement bottom tab navigation as documented in `docs/mobile/05-mobile-navigation-architecture.md`.
2. Add a "Recent Activity" section to the dashboard showing the last 5 completed workouts.
3. Create an Activity History screen (the Run tab) listing all completed workouts with server-side sort and pagination.
4. Create a Workout Detail screen showing per-workout metrics.
5. Create a reusable `WorkoutActivityCard` mobile component.

**Out of scope:** Recording flow (`record.tsx`, `summary.tsx`), territory map, leaderboards, route map in detail screen.

---

## 2. Navigation Structure

```
apps/mobile/app/(protected)/
├── _layout.tsx              # Auth guard only (no change to guard logic)
└── (tabs)/
    ├── _layout.tsx          # Bottom tab navigator (4 tabs)
    ├── index.tsx            # Home tab → Dashboard (content moved from dashboard.tsx)
    ├── profile.tsx          # Profile tab (content moved from profile.tsx)
    ├── territory.tsx        # Territory tab (placeholder)
    └── run/
        ├── _layout.tsx      # Stack navigator for run flow
        ├── index.tsx        # Run tab → Activity History screen
        └── [id].tsx         # Workout Detail screen
```

**Tab bar spec:**
- Tabs: Home (`home`), Run (`play-circle`), Territory (`map`), Profile (`person`)
- Background: `#0b0b0f`, active tint: `#10b981` (emerald), inactive: `#71717a` (zinc-500)
- Uses `expo-router` Tabs component

**Route changes:**
- Old `(protected)/dashboard.tsx` → `(protected)/(tabs)/index.tsx` (content unchanged)
- Old `(protected)/profile.tsx` → `(protected)/(tabs)/profile.tsx` (content unchanged)
- Old `(protected)/_layout.tsx` → keeps auth guard, no tab logic there

---

## 3. Data Layer

### 3a. Extend `features/running/services/history.ts` (no new service file)

**Do NOT create a new `recent-activity.ts` file.** Add two exports to the existing web service:

```ts
// New columns constant for recent-workout queries (adds xp_awarded)
const RECENT_COLUMNS =
  'id, started_at, distance_m, duration_s, avg_pace_s_per_km, xp_awarded, status' as const

// New type
export type RecentWorkout = {
  id: string
  started_at: string
  distance_m: number | null
  duration_s: number | null
  avg_pace_s_per_km: number | null
  xp_awarded: number | null
}

// New export
export async function getRecentWorkouts(
  supabase: SupabaseClient<Database>,
  limit: number,
): Promise<{ data: RecentWorkout[] | null; error: { message: string } | null }>
```

`getWorkoutHistory` is unchanged. `getRecentWorkouts` is the limit-aware variant.

**Why extend rather than duplicate:** mobile will call the same function via `@/features/running/services/history` (aliased in the mobile tsconfig). Both web and mobile share the query logic without the mobile-specific `recent-activity.ts` divergence.

### 3b. Activity History sort — server-side

Sort options send different `order()` calls to Supabase, not client-side array sorts. Changing sort resets pagination to page 0 and re-fetches.

| Sort option | Supabase call |
|---|---|
| Newest | `.order('started_at', { ascending: false })` |
| Distance | `.order('distance_m', { ascending: false, nullsFirst: false })` |
| XP | `.order('xp_awarded', { ascending: false, nullsFirst: false })` |

**Why server-side matters:** client-side sort only applies to loaded rows. A 15 km run on page 2 would appear below all 3 km runs on page 1 if sorted in-memory after pagination.

### 3c. Dashboard query extension

`(tabs)/index.tsx` extends its `Promise.all` to include `getRecentWorkouts(supabase, 5)` — already ordered `started_at DESC` (no sort option needed for dashboard).

### 3d. Activity History pagination

`run/index.tsx` fetches page 0 on mount (`range(0, 19)`). "Load more" footer button appends `range(n, n+19)`. Pull-to-refresh resets to page 0. Sort change resets to page 0.

---

## 4. Component: WorkoutActivityCard

**File:** `apps/mobile/src/features/running/components/WorkoutActivityCard.tsx`

**Props:**
```ts
interface WorkoutActivityCardProps {
  workout: RecentWorkout
  onPress: () => void
}
```

**Displays:**
- Activity icon: Ionicons `walk` (or `fitness-outline`)
- Title: `"Run • <date>"` using `formatRelativeDate(started_at)`
- Distance: `formatDistance(distance_m)`
- Duration: `formatDuration(duration_s)`
- XP badge: `+{xp_awarded} XP` (emerald badge, hidden if null or 0)
- Pace: `formatPace(avg_pace_s_per_km)` (secondary line)

**Style:** Dark card (`bg-neutral-900`), rounded-2xl, NativeWind only.

**Extension points:** Props interface intentionally narrow. Future additions (`achievementCount?`, `territoryChanges?`, `battleReport?`) added as optional props without breaking existing callers.

**`formatRelativeDate` helper:** defined inline in the component file. Returns "Today", "Yesterday", or locale month-day format (e.g. "Jun 15") using `toLocaleDateString`. Stays under 20 lines.

---

## 5. Screens

### 5a. Dashboard (`(tabs)/index.tsx`)

Extends existing dashboard. New "Recent Activity" section below XP progress card:
- Section header: "Recent Activity" + "See All →" link navigates to the Run tab
- Last 5 `WorkoutActivityCard`s, tapping navigates to `/(protected)/(tabs)/run/[id]`
- Empty state inline: "No runs yet — tap Run to get started"
- Loading: show 3 skeleton cards (gray rounded boxes) while data loads

### 5b. Activity History (`(tabs)/run/index.tsx`)

- `FlatList` of `WorkoutActivityCard`s
- Pull-to-refresh resets and refetches
- "Load more" footer button (explicit button, not infinite scroll — MVP)
- Sort chips (Newest / Distance / XP): changing sort triggers server-side re-fetch from page 0
- Empty state: "No runs yet.\nClaim your first territory to begin your journey." + disabled "Start Run" CTA

### 5c. Workout Detail (`(tabs)/run/[id].tsx`)

- Reads `id` from route params
- Fetches: `workouts.select('*').eq('id', id).single()`
- Displays: distance, duration, pace, XP awarded, date/time
- Route map: **NOT implemented** (placeholder: "Route map coming soon")
- Splits: **NOT implemented**
- Back navigates to history list

---

## 6. File Ownership Summary

| File | Action | Owner |
|---|---|---|
| `app/(protected)/_layout.tsx` | Verify — no tab logic present, auth guard only | Protected layout |
| `app/(protected)/(tabs)/_layout.tsx` | Create — tab bar definition | Tab navigator |
| `app/(protected)/(tabs)/index.tsx` | Create — dashboard content moved here + recent activity section | Dashboard screen |
| `app/(protected)/(tabs)/profile.tsx` | Create — profile content moved here | Profile screen |
| `app/(protected)/(tabs)/territory.tsx` | Create — placeholder | Territory screen |
| `app/(protected)/(tabs)/run/_layout.tsx` | Create — stack for run flow | Run stack |
| `app/(protected)/(tabs)/run/index.tsx` | Create — activity history | History screen |
| `app/(protected)/(tabs)/run/[id].tsx` | Create — workout detail | Detail screen |
| `src/features/running/components/WorkoutActivityCard.tsx` | Create | Activity card |
| `features/running/services/history.ts` | Extend — add `getRecentWorkouts` + `RecentWorkout` type | Shared service |
| `tests/unit/features/running/components/WorkoutActivityCard.test.tsx` | Create | Card tests |
| `tests/unit/features/running/services/history.test.ts` | Extend — add tests for `getRecentWorkouts` | Service tests |

### Staged deletion of migrated screens

Old screens are deleted **only after** all of the following are verified:

1. Tab navigator renders and all 4 tabs are navigable
2. Auth redirect (`/` → login or dashboard) works correctly
3. `useFocusEffect` refresh works on the new dashboard route
4. `npx expo export -p android` completes without errors
5. No other file imports `(protected)/dashboard` or `(protected)/profile` directly

Then delete:
- `app/(protected)/dashboard.tsx`
- `app/(protected)/profile.tsx`

---

## 7. Testing

**`WorkoutActivityCard.test.tsx`** covers:
- Renders distance, duration, XP with valid workout data
- Hides XP badge when `xp_awarded` is null
- Calls `onPress` when tapped
- Formats relative date correctly (today/yesterday/older)

**`history.test.ts` extensions** cover:
- `getRecentWorkouts` queries with correct columns (includes `xp_awarded`)
- `getRecentWorkouts` applies limit
- `getRecentWorkouts` orders by `started_at DESC`

**Existing tests unaffected:**
- `tests/unit/features/profiles/components/RecentActivityFeed.test.tsx` — web component, unrelated

---

## 8. Constraints

- No Supabase calls inside `WorkoutActivityCard` or any other feature component
- NativeWind only — no `StyleSheet.create()` unless dynamic values require it
- Files stay under 300 lines
- No recording flow (`record.tsx`) implemented in this task
- `xp_awarded` sourced from `workouts` table directly — no `xp_events` join
- Mobile-only code stays in `apps/mobile/src/` — nothing added to `packages/shared/`
- Extend `features/running/services/history.ts`, do not create a parallel service

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Tab navigator config conflicts with current stack | Run `npx expo export -p android` after layout change; verify before deleting old screens |
| `(protected)/dashboard.tsx` import paths break after move | Search all files for direct imports before deleting |
| Sort + pagination interaction: sort change must reset page | Assert in tests that sort change resets `rangeStart` to 0 |
| `formatRelativeDate` timezone edge cases | Use UTC date comparison, test with mocked `Date.now()` |
| Workout detail shows no useful data if `xp_awarded` was never set | Graceful null handling in card and detail screen |
| `nullsFirst: false` not supported in all Supabase JS versions | Check Supabase JS client version; fall back to filtering nulls if needed |
