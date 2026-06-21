# Recent Activity System — Design Spec

**Date:** 2026-06-21
**Branch:** feat/monorepo-mobile
**Scope:** Tab navigator migration + Recent Activity (dashboard section, history screen, workout detail screen, WorkoutActivityCard component)

---

## 1. Goals

1. Implement bottom tab navigation as documented in `docs/mobile/05-mobile-navigation-architecture.md`.
2. Add a "Recent Activity" section to the dashboard showing the last 5 completed workouts.
3. Create an Activity History screen (the Run tab) listing all completed workouts with pagination.
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
- Uses `expo-router` Tabs component from `expo-router`

**Route changes:**
- Old `(protected)/dashboard.tsx` → `(protected)/(tabs)/index.tsx` (content unchanged)
- Old `(protected)/profile.tsx` → `(protected)/(tabs)/profile.tsx` (content unchanged)
- Old `(protected)/_layout.tsx` → keeps auth guard, no tab logic there

---

## 3. Data Layer

### 3a. New service: `recent-activity.ts`

```
apps/mobile/src/features/running/services/recent-activity.ts
```

Exports `getRecentWorkouts(supabase, limit)`. Selects:
```
id, started_at, distance_m, duration_s, avg_pace_s_per_km, xp_awarded, status
```
Filters: `status = 'completed'`, order: `started_at DESC`, limit: caller-supplied.

### 3b. Type: `RecentWorkout`

```ts
export type RecentWorkout = {
  id: string
  started_at: string
  distance_m: number | null
  duration_s: number | null
  avg_pace_s_per_km: number | null
  xp_awarded: number | null
}
```

Defined in `recent-activity.ts`, exported for component use.

### 3c. Dashboard query extension

`(tabs)/index.tsx` extends its `Promise.all` to include `getRecentWorkouts(supabase, 5)`.

### 3d. Activity History pagination

`run/index.tsx` fetches page 0 on mount (`range(0, 19)`). "Load more" appends `range(n, n+19)`. Pull-to-refresh resets to page 0.

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
- Activity icon: running figure (text emoji `🏃` or Ionicons `walk`)
- Title: `"Run • <date>"` using `formatRelativeDate(started_at)`
- Distance: `formatDistance(distance_m)`
- Duration: `formatDuration(duration_s)`
- XP badge: `+{xp_awarded} XP` (emerald badge, hidden if null)
- Pace: `formatPace(avg_pace_s_per_km)` (secondary line)

**Style:** Dark card (`bg-neutral-900`), rounded-2xl, NativeWind only.

**Extension points:** Props interface intentionally narrow. Future additions (`achievementCount?`, `territoryChanges?`, `battleReport?`) added as optional props without breaking existing callers.

**`formatRelativeDate` helper:** defined inline in the component file. Returns "Today", "Yesterday", or locale month-day format (e.g. "Jun 15") using `toLocaleDateString`. Stays under 20 lines.

---

## 5. Screens

### 5a. Dashboard (`(tabs)/index.tsx`)

Extends existing dashboard. New "Recent Activity" section below XP progress card:
- Section header: "Recent Activity" + "See All →" link to `/(protected)/(tabs)/run/`
- Last 5 `WorkoutActivityCard`s, tapping navigates to `/(protected)/(tabs)/run/[id]`
- Empty state inline: "No runs yet — tap Run to get started"
- Loading: show 3 skeleton cards (gray rounded boxes) while data loads

### 5b. Activity History (`(tabs)/run/index.tsx`)

- `FlatList` of `WorkoutActivityCard`s
- Pull-to-refresh resets and refetches
- "Load more" footer button (not infinite scroll — explicit button for MVP)
- Sort (Newest / Distance / XP): UI chips, client-side sort on loaded data (filters removed — workouts table has no activity_type column)
- Empty state: "No runs yet.\nClaim your first territory to begin your journey." + disabled "Start Run" CTA (run recording not yet implemented)

### 5c. Workout Detail (`(tabs)/run/[id].tsx`)

- Reads `id` from route params
- Fetches: `workouts.select('*').eq('id', id).single()`
- Displays: distance, duration, pace, XP awarded, date/time, status
- Route map: **NOT implemented** (placeholder text: "Route map coming soon")
- Splits: **NOT implemented**
- Back button navigates to history list

---

## 6. File Ownership Summary

| File | Action | Owner |
|---|---|---|
| `app/(protected)/_layout.tsx` | Update — remove tab logic if any, keep auth guard only | Protected layout |
| `app/(protected)/(tabs)/_layout.tsx` | Create — tab bar definition | Tab navigator |
| `app/(protected)/(tabs)/index.tsx` | Create — dashboard content moved here + recent activity | Dashboard screen |
| `app/(protected)/(tabs)/profile.tsx` | Create — profile content moved here | Profile screen |
| `app/(protected)/(tabs)/territory.tsx` | Create — placeholder | Territory screen |
| `app/(protected)/(tabs)/run/_layout.tsx` | Create — stack for run flow | Run stack |
| `app/(protected)/(tabs)/run/index.tsx` | Create — activity history | History screen |
| `app/(protected)/(tabs)/run/[id].tsx` | Create — workout detail | Detail screen |
| `src/features/running/components/WorkoutActivityCard.tsx` | Create | Activity card |
| `src/features/running/services/recent-activity.ts` | Create | Recent workouts query |
| `tests/unit/features/running/components/WorkoutActivityCard.test.tsx` | Create | Card tests |

Files to DELETE after migration:
- `app/(protected)/dashboard.tsx`
- `app/(protected)/profile.tsx`

---

## 7. Testing

**`WorkoutActivityCard.test.tsx`** covers:
- Renders distance, duration, XP with valid workout data
- Hides XP badge when `xp_awarded` is null
- Calls `onPress` when tapped
- Formats relative date correctly (today/yesterday/older)

**Existing tests unaffected:**
- `tests/unit/features/running/services/history.test.ts` — no changes to that service
- `tests/unit/features/profiles/components/RecentActivityFeed.test.tsx` — web component, unrelated

---

## 8. Constraints

- No Supabase calls inside `WorkoutActivityCard` or any other feature component
- NativeWind only — no `StyleSheet.create()` unless dynamic values require it
- Files stay under 300 lines
- No recording flow (`record.tsx`) implemented in this task
- `xp_awarded` sourced from `workouts` table directly — no `xp_events` join
- Mobile-only code stays in `apps/mobile/src/` — nothing added to `packages/shared/`

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Tab navigator config conflicts with current stack | Test with `npx expo export -p android` after layout change |
| `(protected)/dashboard.tsx` import paths break after move | Search for any direct imports before deleting |
| `formatRelativeDate` timezone edge cases | Use `Date` comparison in UTC, test with mocked dates |
| Workout detail shows no useful data if `xp_awarded` was never set | Graceful null handling in card and detail screen |
