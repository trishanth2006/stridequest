# Recent Activity System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement bottom tab navigation and a Recent Activity system — dashboard section, Activity History screen, Workout Detail screen, and WorkoutActivityCard component — for the StrideQuest mobile app.

**Architecture:** Tab navigator lives at `(protected)/(tabs)/` with four tabs; existing dashboard and profile screens move there unchanged. A new `(tabs)/run/` nested stack hosts the Activity History list and Workout Detail screen. Mobile history service at `apps/mobile/src/features/running/services/history.ts` wraps direct Supabase calls (matching existing dashboard pattern). Root `features/running/services/history.ts` gains `getRecentWorkouts` + `RecentWorkout` for web use and tests.

**Tech Stack:** Expo Router v6 (Tabs, Stack), NativeWind v4, React 19, Supabase JS v2, `@stridequest/shared` for formatters/XP helpers, `@expo/vector-icons` (bundled with Expo 54).

---

## File Map

| File | Action |
|---|---|
| `features/running/services/history.ts` | **Extend** — add `RecentWorkout` type + `getRecentWorkouts(supabase, limit)` |
| `tests/unit/features/running/services/history.test.ts` | **Extend** — tests for `getRecentWorkouts` |
| `apps/mobile/src/features/running/utils/formatRelativeDate.ts` | **Create** — pure date formatter |
| `tests/unit/features/running/utils/formatRelativeDate.test.ts` | **Create** — formatter tests |
| `apps/mobile/src/features/running/services/history.ts` | **Create** — mobile history service (singleton supabase, server-side sort + pagination) |
| `apps/mobile/src/features/running/components/WorkoutActivityCard.tsx` | **Create** — presentational card component |
| `apps/mobile/app/(protected)/(tabs)/_layout.tsx` | **Create** — bottom tab bar (4 tabs) |
| `apps/mobile/app/(protected)/(tabs)/territory.tsx` | **Create** — placeholder screen |
| `apps/mobile/app/(protected)/(tabs)/run/_layout.tsx` | **Create** — run stack navigator |
| `apps/mobile/app/(protected)/(tabs)/index.tsx` | **Create** — dashboard + Recent Activity section |
| `apps/mobile/app/(protected)/(tabs)/profile.tsx` | **Create** — profile screen (moved) |
| `apps/mobile/app/(protected)/(tabs)/run/index.tsx` | **Create** — Activity History screen |
| `apps/mobile/app/(protected)/(tabs)/run/[id].tsx` | **Create** — Workout Detail screen |
| `apps/mobile/app/index.tsx` | **Update** — redirect to `/(protected)/(tabs)/` |
| `apps/mobile/src/features/auth/components/LoginForm.tsx` | **Update** — redirect to `/(protected)/(tabs)/` |
| `apps/mobile/src/features/auth/components/SignupForm.tsx` | **Update** — redirect to `/(protected)/(tabs)/` |
| `apps/mobile/app/(protected)/dashboard.tsx` | **Delete** — after verification gates pass |
| `apps/mobile/app/(protected)/profile.tsx` | **Delete** — after verification gates pass |

---

## Task 1: Extend root history service with `getRecentWorkouts`

**Files:**
- Modify: `features/running/services/history.ts`
- Modify: `tests/unit/features/running/services/history.test.ts`

- [ ] **Step 1: Add failing tests for `getRecentWorkouts`**

Append to `tests/unit/features/running/services/history.test.ts`:

```ts
// ── getRecentWorkouts ──────────────────────────────────────────────────────

type RecentResult = {
  data: Array<{
    id: string
    started_at: string
    distance_m: number | null
    duration_s: number | null
    avg_pace_s_per_km: number | null
    xp_awarded: number | null
  }> | null
  error: { message: string } | null
}

function mockRecentSupabase(result: RecentResult) {
  const limit = jest.fn().mockResolvedValue(result)
  const order = jest.fn().mockReturnValue({ limit })
  const eq = jest.fn().mockReturnValue({ order })
  const select = jest.fn().mockReturnValue({ eq })
  const from = jest.fn().mockReturnValue({ select })
  return { client: { from }, from, select, eq, order, limit }
}

describe('getRecentWorkouts', () => {
  it('selects the correct columns including xp_awarded', async () => {
    const { client, select } = mockRecentSupabase({ data: [], error: null })
    await getRecentWorkouts(client as never, 5)
    expect(select).toHaveBeenCalledWith(
      'id, started_at, distance_m, duration_s, avg_pace_s_per_km, xp_awarded, status'
    )
  })

  it('filters to completed workouts only', async () => {
    const { client, eq } = mockRecentSupabase({ data: [], error: null })
    await getRecentWorkouts(client as never, 5)
    expect(eq).toHaveBeenCalledWith('status', 'completed')
  })

  it('orders by started_at descending', async () => {
    const { client, order } = mockRecentSupabase({ data: [], error: null })
    await getRecentWorkouts(client as never, 5)
    expect(order).toHaveBeenCalledWith('started_at', { ascending: false })
  })

  it('applies the supplied limit', async () => {
    const { client, limit } = mockRecentSupabase({ data: [], error: null })
    await getRecentWorkouts(client as never, 5)
    expect(limit).toHaveBeenCalledWith(5)
  })

  it('returns data on success', async () => {
    const row = {
      id: 'w1', started_at: '2026-06-20T08:00:00Z',
      distance_m: 5000, duration_s: 1800,
      avg_pace_s_per_km: 360, xp_awarded: 50,
    }
    const { client } = mockRecentSupabase({ data: [row], error: null })
    const result = await getRecentWorkouts(client as never, 5)
    expect(result).toEqual({ data: [row], error: null })
  })

  it('returns the error when the query fails', async () => {
    const { client } = mockRecentSupabase({ data: null, error: { message: 'timeout' } })
    const result = await getRecentWorkouts(client as never, 5)
    expect(result.data).toBeNull()
    expect(result.error).toEqual({ message: 'timeout' })
  })
})
```

- [ ] **Step 2: Run the new tests and confirm they fail**

```bash
npx jest tests/unit/features/running/services/history.test.ts -t "getRecentWorkouts" --no-coverage
```

Expected: FAIL — `getRecentWorkouts is not a function`

- [ ] **Step 3: Add `RecentWorkout` type and `getRecentWorkouts` to history service**

In `features/running/services/history.ts`, append after the existing exports:

```ts
const RECENT_COLUMNS =
  'id, started_at, distance_m, duration_s, avg_pace_s_per_km, xp_awarded, status' as const

export type RecentWorkout = {
  id: string
  started_at: string
  distance_m: number | null
  duration_s: number | null
  avg_pace_s_per_km: number | null
  xp_awarded: number | null
}

export type RecentWorkoutResult = {
  data: RecentWorkout[] | null
  error: { message: string } | null
}

export async function getRecentWorkouts(
  supabase: SupabaseClient<Database>,
  limit: number,
): Promise<RecentWorkoutResult> {
  const { data, error } = await supabase
    .from('workouts')
    .select(RECENT_COLUMNS)
    .eq('status', 'completed')
    .order('started_at', { ascending: false })
    .limit(limit)

  return { data, error }
}
```

- [ ] **Step 4: Run all history tests and confirm they pass**

```bash
npx jest tests/unit/features/running/services/history.test.ts --no-coverage
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add features/running/services/history.ts tests/unit/features/running/services/history.test.ts
git commit -m "feat(running): add getRecentWorkouts to history service"
```

---

## Task 2: Create `formatRelativeDate` utility and tests

**Files:**
- Create: `apps/mobile/src/features/running/utils/formatRelativeDate.ts`
- Create: `tests/unit/features/running/utils/formatRelativeDate.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/features/running/utils/formatRelativeDate.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { formatRelativeDate } from '../../../apps/mobile/src/features/running/utils/formatRelativeDate'

describe('formatRelativeDate', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-06-21T12:00:00Z'))
  })
  afterEach(() => jest.useRealTimers())

  it('returns "Today" for a timestamp from the current day', () => {
    expect(formatRelativeDate('2026-06-21T08:00:00Z')).toBe('Today')
  })

  it('returns "Yesterday" for a timestamp from the previous day', () => {
    expect(formatRelativeDate('2026-06-20T22:00:00Z')).toBe('Yesterday')
  })

  it('returns a short date for older timestamps', () => {
    const result = formatRelativeDate('2026-06-15T10:00:00Z')
    expect(result).toMatch(/Jun\s+15|6\/15/)
  })

  it('handles a 2-day-old timestamp', () => {
    const result = formatRelativeDate('2026-06-19T10:00:00Z')
    expect(result).not.toBe('Today')
    expect(result).not.toBe('Yesterday')
  })
})
```

- [ ] **Step 2: Run tests and confirm they fail**

```bash
npx jest tests/unit/features/running/utils/formatRelativeDate.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module`

- [ ] **Step 3: Create the utility**

Create `apps/mobile/src/features/running/utils/formatRelativeDate.ts`:

```ts
export function formatRelativeDate(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
npx jest tests/unit/features/running/utils/formatRelativeDate.test.ts --no-coverage
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/running/utils/formatRelativeDate.ts tests/unit/features/running/utils/formatRelativeDate.test.ts
git commit -m "feat(mobile/running): add formatRelativeDate utility"
```

---

## Task 3: Create mobile history service

**Files:**
- Create: `apps/mobile/src/features/running/services/history.ts`

No separate tests — the service is a thin wrapper over the supabase singleton; the query logic is already covered by root service tests (Task 1).

- [ ] **Step 1: Create the mobile history service**

Create `apps/mobile/src/features/running/services/history.ts`:

```ts
import { supabase } from '@/lib/supabase'

const WORKOUT_COLUMNS =
  'id, started_at, distance_m, duration_s, avg_pace_s_per_km, xp_awarded, status'

export type RecentWorkout = {
  id: string
  started_at: string
  distance_m: number | null
  duration_s: number | null
  avg_pace_s_per_km: number | null
  xp_awarded: number | null
}

export type SortField = 'started_at' | 'distance_m' | 'xp_awarded'

export async function getRecentWorkouts(limit: number): Promise<RecentWorkout[]> {
  const { data } = await supabase
    .from('workouts')
    .select(WORKOUT_COLUMNS)
    .eq('status', 'completed')
    .order('started_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

export async function getWorkoutsPage(
  page: number,
  sort: SortField,
): Promise<RecentWorkout[]> {
  const from = page * 20
  const to = from + 19
  const { data } = await supabase
    .from('workouts')
    .select(WORKOUT_COLUMNS)
    .eq('status', 'completed')
    .order(sort, { ascending: false, nullsFirst: false })
    .range(from, to)
  return data ?? []
}
```

- [ ] **Step 2: Typecheck mobile**

```bash
cd apps/mobile && npm run typecheck
```

Expected: no errors. If `nullsFirst` causes a type error, remove it — the option may not be present in this supabase-js build; the default descending behavior (nulls last) is acceptable.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/features/running/services/history.ts
git commit -m "feat(mobile/running): add mobile history service"
```

---

## Task 4: Create `WorkoutActivityCard` component

**Files:**
- Create: `apps/mobile/src/features/running/components/WorkoutActivityCard.tsx`

- [ ] **Step 1: Create the component**

Create `apps/mobile/src/features/running/components/WorkoutActivityCard.tsx`:

```tsx
import { Pressable, View, Text } from 'react-native'
import { formatDistance, formatDuration, formatPace } from '@stridequest/shared/running'
import { formatRelativeDate } from '@/features/running/utils/formatRelativeDate'
import type { RecentWorkout } from '@/features/running/services/history'

interface WorkoutActivityCardProps {
  workout: RecentWorkout
  onPress: () => void
}

export function WorkoutActivityCard({ workout, onPress }: WorkoutActivityCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-2xl bg-neutral-900 p-4 gap-3"
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <Text className="text-2xl">🏃</Text>
          <View>
            <Text className="text-sm font-semibold text-white">
              Run • {formatRelativeDate(workout.started_at)}
            </Text>
            <Text className="text-xs text-neutral-400">
              {formatPace(workout.avg_pace_s_per_km)}
            </Text>
          </View>
        </View>
        {workout.xp_awarded ? (
          <View className="rounded-full bg-emerald-500/20 px-2 py-1">
            <Text className="text-xs font-bold text-emerald-400">
              +{workout.xp_awarded} XP
            </Text>
          </View>
        ) : null}
      </View>
      <View className="flex-row gap-6">
        <View>
          <Text className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
            Distance
          </Text>
          <Text className="text-sm font-semibold text-white">
            {formatDistance(workout.distance_m)}
          </Text>
        </View>
        <View>
          <Text className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
            Duration
          </Text>
          <Text className="text-sm font-semibold text-white">
            {formatDuration(workout.duration_s)}
          </Text>
        </View>
      </View>
    </Pressable>
  )
}
```

- [ ] **Step 2: Typecheck mobile**

```bash
cd apps/mobile && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/features/running/components/WorkoutActivityCard.tsx
git commit -m "feat(mobile/running): add WorkoutActivityCard component"
```

---

## Task 5: Create tab navigator structure

**Files:**
- Create: `apps/mobile/app/(protected)/(tabs)/_layout.tsx`
- Create: `apps/mobile/app/(protected)/(tabs)/run/_layout.tsx`
- Create: `apps/mobile/app/(protected)/(tabs)/territory.tsx`

- [ ] **Step 1: Create the tab bar layout**

Create `apps/mobile/app/(protected)/(tabs)/_layout.tsx`:

```tsx
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

type IconName = React.ComponentProps<typeof Ionicons>['name']

function TabIcon({ name, color }: { name: IconName; color: string }) {
  return <Ionicons name={name} size={24} color={color} />
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#0b0b0f', borderTopColor: '#27272a' },
        tabBarActiveTintColor: '#10b981',
        tabBarInactiveTintColor: '#71717a',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="run"
        options={{
          title: 'Run',
          tabBarIcon: ({ color }) => <TabIcon name="play-circle" color={color} />,
        }}
      />
      <Tabs.Screen
        name="territory"
        options={{
          title: 'Territory',
          tabBarIcon: ({ color }) => <TabIcon name="map" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <TabIcon name="person" color={color} />,
        }}
      />
    </Tabs>
  )
}
```

- [ ] **Step 2: Create the run stack layout**

Create `apps/mobile/app/(protected)/(tabs)/run/_layout.tsx`:

```tsx
import { Stack } from 'expo-router'

export default function RunLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0b0b0f' },
      }}
    />
  )
}
```

- [ ] **Step 3: Create the territory placeholder**

Create `apps/mobile/app/(protected)/(tabs)/territory.tsx`:

```tsx
import { View, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function TerritoryScreen() {
  return (
    <SafeAreaView className="flex-1 bg-[#0b0b0f]">
      <View className="flex-1 items-center justify-center gap-3">
        <Text className="text-4xl">🗺️</Text>
        <Text className="text-xl font-bold text-white">Territory</Text>
        <Text className="text-sm text-neutral-400">Coming soon</Text>
      </View>
    </SafeAreaView>
  )
}
```

- [ ] **Step 4: Typecheck mobile**

```bash
cd apps/mobile && npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "apps/mobile/app/(protected)/(tabs)/_layout.tsx" "apps/mobile/app/(protected)/(tabs)/run/_layout.tsx" "apps/mobile/app/(protected)/(tabs)/territory.tsx"
git commit -m "feat(mobile/nav): add tab navigator and run stack layout"
```

---

## Task 6: Create dashboard screen at `(tabs)/index.tsx` with Recent Activity section

**Files:**
- Create: `apps/mobile/app/(protected)/(tabs)/index.tsx`

- [ ] **Step 1: Create the new dashboard with Recent Activity**

Create `apps/mobile/app/(protected)/(tabs)/index.tsx`:

```tsx
import { useCallback, useState } from 'react'
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { useSession } from '@/features/auth/providers/SessionProvider'
import { supabase } from '@/lib/supabase'
import { getXpProgress } from '@stridequest/shared/xp'
import { formatDistance } from '@stridequest/shared/running'
import { getRecentWorkouts, type RecentWorkout } from '@/features/running/services/history'
import { WorkoutActivityCard } from '@/features/running/components/WorkoutActivityCard'

type DashboardData = {
  username: string
  totalXp: number
  totalDistanceM: number
  workoutCount: number
  recentWorkouts: RecentWorkout[]
}

export default function DashboardScreen() {
  const { session } = useSession()
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)

  const loadData = useCallback(() => {
    const userId = session?.user.id
    if (!userId) return

    void (async () => {
      const [profileResult, xpResult, workoutsResult, recentResult] = await Promise.all([
        supabase.from('profiles').select('username').eq('id', userId).single(),
        supabase.from('user_xp').select('total_xp').eq('user_id', userId).single(),
        supabase
          .from('workouts')
          .select('distance_m')
          .eq('user_id', userId)
          .eq('status', 'completed'),
        getRecentWorkouts(5),
      ])

      const workouts = workoutsResult.data ?? []
      const totalDistanceM = workouts.reduce((sum, w) => sum + (w.distance_m ?? 0), 0)

      setData({
        username: profileResult.data?.username ?? session?.user.email ?? 'Runner',
        totalXp: xpResult.data?.total_xp ?? 0,
        totalDistanceM,
        workoutCount: workouts.length,
        recentWorkouts: recentResult,
      })
    })()
  }, [session?.user.id, session?.user.email])

  useFocusEffect(loadData)

  const progress = getXpProgress(data?.totalXp ?? 0)

  return (
    <SafeAreaView className="flex-1 bg-[#0b0b0f]">
      <ScrollView className="flex-1 px-5 pt-6" contentContainerClassName="gap-6 pb-12">

        {/* Header */}
        <View className="gap-1">
          <Text className="text-xs font-semibold uppercase tracking-widest text-emerald-500">
            Ready to conquer today?
          </Text>
          <Text className="text-4xl font-extrabold tracking-tight text-white">
            {data?.username ?? session?.user.email ?? 'Runner'}
          </Text>
        </View>

        {/* Stats row */}
        <View className="flex-row gap-3">
          <StatCard label="Total XP" value={(data?.totalXp ?? 0).toLocaleString()} unit="xp" />
          <StatCard label="Distance" value={formatDistance(data?.totalDistanceM ?? 0)} unit="" />
          <StatCard label="Runs" value={String(data?.workoutCount ?? 0)} unit="" />
        </View>

        {/* XP Progress */}
        <View className="rounded-2xl bg-neutral-900 p-5 gap-3">
          <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
            Level {progress.currentLevel}
          </Text>
          <View className="h-2 w-full rounded-full bg-white/10">
            <View
              className="h-2 rounded-full bg-emerald-500"
              style={{ width: `${progress.progressPercent}%` }}
            />
          </View>
          <Text className="text-sm text-neutral-400">
            {progress.xpNeededToNextLevel > 0
              ? `${progress.xpNeededToNextLevel} XP to level ${progress.currentLevel + 1}`
              : 'Max level reached'}
          </Text>
        </View>

        {/* Recent Activity */}
        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-bold text-white">Recent Activity</Text>
            <Pressable onPress={() => router.navigate('/(protected)/(tabs)/run')}>
              <Text className="text-sm font-semibold text-emerald-500">See All →</Text>
            </Pressable>
          </View>
          {data === null ? (
            <View className="gap-3">
              {[0, 1, 2].map((i) => (
                <View key={i} className="h-20 rounded-2xl bg-neutral-900" />
              ))}
            </View>
          ) : data.recentWorkouts.length === 0 ? (
            <View className="rounded-2xl bg-neutral-900 p-6 items-center">
              <Text className="text-sm text-neutral-400">No runs yet — tap Run to get started</Text>
            </View>
          ) : (
            <View className="gap-3">
              {data.recentWorkouts.map((w) => (
                <WorkoutActivityCard
                  key={w.id}
                  workout={w}
                  onPress={() => router.push(`/(protected)/(tabs)/run/${w.id}`)}
                />
              ))}
            </View>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

function StatCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View className="flex-1 rounded-2xl bg-neutral-900 p-4 gap-1">
      <Text className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
        {label}
      </Text>
      <Text className="text-2xl font-bold text-white">
        {value}
        {unit ? <Text className="text-sm text-neutral-400"> {unit}</Text> : null}
      </Text>
    </View>
  )
}
```

- [ ] **Step 2: Typecheck mobile**

```bash
cd apps/mobile && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "apps/mobile/app/(protected)/(tabs)/index.tsx"
git commit -m "feat(mobile/dashboard): add Recent Activity section to dashboard"
```

---

## Task 7: Move profile screen to `(tabs)/profile.tsx`

**Files:**
- Create: `apps/mobile/app/(protected)/(tabs)/profile.tsx`

- [ ] **Step 1: Create the file**

Copy the exact content of `apps/mobile/app/(protected)/profile.tsx` to `apps/mobile/app/(protected)/(tabs)/profile.tsx`. No content changes.

```bash
cp "apps/mobile/app/(protected)/profile.tsx" "apps/mobile/app/(protected)/(tabs)/profile.tsx"
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/mobile && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "apps/mobile/app/(protected)/(tabs)/profile.tsx"
git commit -m "feat(mobile/nav): add profile to tab structure"
```

---

## Task 8: Create Activity History screen

**Files:**
- Create: `apps/mobile/app/(protected)/(tabs)/run/index.tsx`

- [ ] **Step 1: Create the Activity History screen**

Create `apps/mobile/app/(protected)/(tabs)/run/index.tsx`:

```tsx
import { useCallback, useState } from 'react'
import {
  View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { getWorkoutsPage, type RecentWorkout, type SortField } from '@/features/running/services/history'
import { WorkoutActivityCard } from '@/features/running/components/WorkoutActivityCard'

const SORT_OPTIONS: { label: string; value: SortField }[] = [
  { label: 'Newest', value: 'started_at' },
  { label: 'Distance', value: 'distance_m' },
  { label: 'XP', value: 'xp_awarded' },
]

export default function ActivityHistoryScreen() {
  const router = useRouter()
  const [workouts, setWorkouts] = useState<RecentWorkout[]>([])
  const [sort, setSort] = useState<SortField>('started_at')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchPage = useCallback(async (pageNum: number, sortField: SortField) => {
    const rows = await getWorkoutsPage(pageNum, sortField)
    return rows
  }, [])

  const loadFirst = useCallback(
    async (sortField: SortField) => {
      setLoading(true)
      setPage(0)
      const rows = await fetchPage(0, sortField)
      setWorkouts(rows)
      setHasMore(rows.length === 20)
      setLoading(false)
    },
    [fetchPage],
  )

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    const rows = await fetchPage(0, sort)
    setWorkouts(rows)
    setPage(0)
    setHasMore(rows.length === 20)
    setRefreshing(false)
  }, [fetchPage, sort])

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const nextPage = page + 1
    const rows = await fetchPage(nextPage, sort)
    setWorkouts((prev) => [...prev, ...rows])
    setPage(nextPage)
    setHasMore(rows.length === 20)
    setLoadingMore(false)
  }, [fetchPage, hasMore, loadingMore, page, sort])

  const handleSortChange = useCallback(
    async (newSort: SortField) => {
      if (newSort === sort) return
      setSort(newSort)
      await loadFirst(newSort)
    },
    [loadFirst, sort],
  )

  // initial load
  useState(() => { void loadFirst('started_at') })

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-[#0b0b0f] items-center justify-center">
        <ActivityIndicator color="#10b981" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0b0b0f]">
      <View className="px-5 pt-6 pb-3 gap-4">
        <Text className="text-3xl font-extrabold tracking-tight text-white">Activity</Text>
        {/* Sort chips */}
        <View className="flex-row gap-2">
          {SORT_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => void handleSortChange(opt.value)}
              className={`rounded-full px-3 py-1.5 ${
                sort === opt.value ? 'bg-emerald-500' : 'bg-neutral-800'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  sort === opt.value ? 'text-white' : 'text-neutral-400'
                }`}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        data={workouts}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-5 gap-3 pb-12"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#10b981"
          />
        }
        renderItem={({ item }) => (
          <WorkoutActivityCard
            workout={item}
            onPress={() => router.push(`/(protected)/(tabs)/run/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center pt-20 gap-3">
            <Text className="text-4xl">🏃</Text>
            <Text className="text-base font-semibold text-white text-center">No runs yet.</Text>
            <Text className="text-sm text-neutral-400 text-center">
              Claim your first territory to begin your journey.
            </Text>
          </View>
        }
        ListFooterComponent={
          workouts.length > 0 && hasMore ? (
            <Pressable
              onPress={handleLoadMore}
              disabled={loadingMore}
              className="mt-4 items-center rounded-2xl border border-neutral-800 py-4"
            >
              {loadingMore ? (
                <ActivityIndicator color="#10b981" />
              ) : (
                <Text className="text-sm font-semibold text-emerald-500">Load more</Text>
              )}
            </Pressable>
          ) : null
        }
      />
    </SafeAreaView>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/mobile && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "apps/mobile/app/(protected)/(tabs)/run/index.tsx"
git commit -m "feat(mobile/running): add Activity History screen"
```

---

## Task 9: Create Workout Detail screen

**Files:**
- Create: `apps/mobile/app/(protected)/(tabs)/run/[id].tsx`

- [ ] **Step 1: Create the Workout Detail screen**

Create `apps/mobile/app/(protected)/(tabs)/run/[id].tsx`:

```tsx
import { useEffect, useState } from 'react'
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { formatDistance, formatDuration, formatPace } from '@stridequest/shared/running'

type WorkoutDetail = {
  id: string
  started_at: string
  ended_at: string | null
  distance_m: number | null
  duration_s: number | null
  avg_pace_s_per_km: number | null
  xp_awarded: number | null
  status: string
}

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [workout, setWorkout] = useState<WorkoutDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    void (async () => {
      const { data, error: err } = await supabase
        .from('workouts')
        .select('id, started_at, ended_at, distance_m, duration_s, avg_pace_s_per_km, xp_awarded, status')
        .eq('id', id)
        .single()

      if (err) {
        setError('Failed to load workout')
      } else {
        setWorkout(data)
      }
      setLoading(false)
    })()
  }, [id])

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-[#0b0b0f] items-center justify-center">
        <ActivityIndicator color="#10b981" />
      </SafeAreaView>
    )
  }

  if (error || !workout) {
    return (
      <SafeAreaView className="flex-1 bg-[#0b0b0f] items-center justify-center gap-4 px-5">
        <Text className="text-base text-neutral-400">{error ?? 'Workout not found'}</Text>
        <Pressable onPress={() => router.back()} className="rounded-2xl bg-neutral-800 px-6 py-3">
          <Text className="text-sm font-semibold text-white">Go back</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  const date = new Date(workout.started_at)
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  return (
    <SafeAreaView className="flex-1 bg-[#0b0b0f]">
      <ScrollView className="flex-1 px-5 pt-4" contentContainerClassName="gap-5 pb-12">
        {/* Back */}
        <Pressable onPress={() => router.back()} className="flex-row items-center gap-2">
          <Text className="text-base text-emerald-500">← Back</Text>
        </Pressable>

        {/* Date */}
        <View className="gap-1">
          <Text className="text-2xl font-extrabold tracking-tight text-white">Run</Text>
          <Text className="text-sm text-neutral-400">{dateStr}</Text>
          <Text className="text-sm text-neutral-400">{timeStr}</Text>
        </View>

        {/* Metrics */}
        <View className="rounded-2xl bg-neutral-900 p-5 gap-4">
          <DetailRow label="Distance" value={formatDistance(workout.distance_m)} />
          <DetailRow label="Duration" value={formatDuration(workout.duration_s)} />
          <DetailRow label="Avg Pace" value={formatPace(workout.avg_pace_s_per_km)} />
          {workout.xp_awarded ? (
            <DetailRow label="XP Earned" value={`+${workout.xp_awarded} XP`} highlight />
          ) : null}
        </View>

        {/* Route map placeholder */}
        <View className="rounded-2xl bg-neutral-900 p-5 items-center gap-2">
          <Text className="text-3xl">🗺️</Text>
          <Text className="text-sm text-neutral-400">Route map coming soon</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function DetailRow({
  label, value, highlight = false,
}: {
  label: string; value: string; highlight?: boolean
}) {
  return (
    <View className="flex-row justify-between">
      <Text className="text-sm text-neutral-400">{label}</Text>
      <Text className={`text-sm font-semibold ${highlight ? 'text-emerald-400' : 'text-white'}`}>
        {value}
      </Text>
    </View>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/mobile && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "apps/mobile/app/(protected)/(tabs)/run/[id].tsx"
git commit -m "feat(mobile/running): add Workout Detail screen"
```

---

## Task 10: Update redirect paths

**Files:**
- Modify: `apps/mobile/app/index.tsx`
- Modify: `apps/mobile/src/features/auth/components/LoginForm.tsx`
- Modify: `apps/mobile/src/features/auth/components/SignupForm.tsx`

The old redirect `/(protected)/dashboard` must point to the new tab entry `/(protected)/(tabs)/`.

- [ ] **Step 1: Update `app/index.tsx`**

In `apps/mobile/app/index.tsx`, change line 10:

```tsx
// Before
if (session) return <Redirect href="/(protected)/dashboard" />
// After
if (session) return <Redirect href="/(protected)/(tabs)/" />
```

- [ ] **Step 2: Update `LoginForm.tsx`**

In `apps/mobile/src/features/auth/components/LoginForm.tsx`, change the `router.replace` call:

```tsx
// Before
router.replace('/(protected)/dashboard')
// After
router.replace('/(protected)/(tabs)/')
```

- [ ] **Step 3: Update `SignupForm.tsx`**

In `apps/mobile/src/features/auth/components/SignupForm.tsx`, change the `router.replace` call:

```tsx
// Before
router.replace('/(protected)/dashboard')
// After
router.replace('/(protected)/(tabs)/')
```

- [ ] **Step 4: Typecheck**

```bash
cd apps/mobile && npm run typecheck
```

Expected: no errors. If Expo Router's typed routes flag a wrong path, adjust the string to exactly match the generated types (e.g. `'/(protected)/(tabs)'` without trailing slash).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/index.tsx apps/mobile/src/features/auth/components/LoginForm.tsx apps/mobile/src/features/auth/components/SignupForm.tsx
git commit -m "feat(mobile/nav): redirect to tab navigator after auth"
```

---

## Task 11: Verification gates and staged deletion

**Files:**
- Delete: `apps/mobile/app/(protected)/dashboard.tsx`
- Delete: `apps/mobile/app/(protected)/profile.tsx`

Do NOT delete until all gates below pass.

- [ ] **Gate 1: Typecheck passes**

```bash
cd apps/mobile && npm run typecheck
```

Expected: exit 0, no errors.

- [ ] **Gate 2: No stray imports of old routes**

```bash
grep -r "protected)/dashboard" apps/mobile/app apps/mobile/src
grep -r "protected)/profile" apps/mobile/app apps/mobile/src
```

Expected: zero matches. If any files still import old routes, update them first.

- [ ] **Gate 3: Expo export succeeds (verifies bundle compilation and route generation)**

```bash
cd apps/mobile && npx expo export -p android
```

Expected: exits 0. The export bundle compiles all screens; any import or type error will fail here. If this fails, investigate the error before proceeding.

- [ ] **Gate 4: Root unit tests still pass**

```bash
cd .. && npx jest tests/unit --no-coverage
```

Expected: the test suite passes (or any pre-existing failures match the known baseline from `project_verification_gate` memory entry).

- [ ] **Gate 5: Delete old screens**

Once all four gates above pass:

```bash
rm "apps/mobile/app/(protected)/dashboard.tsx"
rm "apps/mobile/app/(protected)/profile.tsx"
```

- [ ] **Gate 6: Final typecheck after deletion**

```bash
cd apps/mobile && npm run typecheck
```

Expected: still passes. If not, a file imported the old route — find it with `grep` and update.

- [ ] **Step: Final commit**

```bash
git add -A
git commit -m "feat(mobile): complete Recent Activity system + tab navigation

- Tab navigator with Home / Run / Territory / Profile tabs
- WorkoutActivityCard component
- Dashboard: Recent Activity section (last 5 workouts)
- Activity History screen with server-side sort + pagination
- Workout Detail screen
- Removed stale dashboard.tsx and profile.tsx"
```

---

## Self-Review

**Spec coverage check:**
- ✅ §1 Goal 1: Tab navigator — Tasks 5, 6, 7
- ✅ §1 Goal 2: Dashboard Recent Activity — Task 6
- ✅ §1 Goal 3: Activity History with server-side sort + pagination — Task 8
- ✅ §1 Goal 4: Workout Detail — Task 9
- ✅ §1 Goal 5: WorkoutActivityCard — Task 4
- ✅ §3a: `getRecentWorkouts` in root history service — Task 1
- ✅ §3b: `RecentWorkout` type defined in mobile service — Task 3
- ✅ §3c: Dashboard extends Promise.all — Task 6
- ✅ §3d: Paginated history — Task 8
- ✅ §4: WorkoutActivityCard displays distance/duration/XP/pace/date — Task 4
- ✅ §5a: Dashboard skeleton loading + empty state — Task 6
- ✅ §5b: Activity History sort chips + load-more + empty state — Task 8
- ✅ §5c: Workout Detail with back button + placeholder map — Task 9
- ✅ §6: Staged deletion with verification gates — Task 11
- ✅ §7: `getRecentWorkouts` tests — Task 1; `formatRelativeDate` tests — Task 2
- ✅ §8 Constraints: NativeWind only, no Supabase in components, files under 300 lines

**Type consistency check:**
- `RecentWorkout` defined in `apps/mobile/src/features/running/services/history.ts` (Task 3)
- `WorkoutActivityCard` imports `RecentWorkout` from `@/features/running/services/history` ✅
- Dashboard imports `RecentWorkout` from same path ✅
- Activity History screen imports `getWorkoutsPage`, `RecentWorkout`, `SortField` from same path ✅
- `SortField` used in `getWorkoutsPage` (Task 3) and `handleSortChange` (Task 8) — both use `SortField` type ✅

**Placeholder scan:** No TBD, TODO, or incomplete code blocks found.
