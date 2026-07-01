# Quests Cache & Territory Clustering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add stale-while-revalidate caching + entrance animation to the Daily Quests dashboard, and split the territory map into a clustered low-zoom view and the existing high-zoom polygon view, using Mapbox's native clustering engine.

**Architecture:** Two independent, non-overlapping changes. (1) `useQuests` reads/writes the existing in-memory `queryCache` (`apps/mobile/src/lib/queryCache.ts`) keyed by `quests:<userId>`; `QuestDashboard` wraps each rendered `QuestCard` in a small local Reanimated entrance component. (2) `TerritoryLayer` gains a new `computeCentroid` geometry helper and a second `ShapeSource` (clustered points) rendered alongside the existing polygon `ShapeSource`, with Mapbox's `minZoomLevel`/`maxZoomLevel` layer props doing the zoom-based switching natively — no new JS-thread logic per frame.

**Tech Stack:** React Native (Expo 52, React 18.3), `@rnmapbox/maps`, `react-native-reanimated`, Jest + `@testing-library/react-native`, TypeScript (strict).

Spec: [docs/superpowers/specs/2026-06-30-quests-cache-and-territory-clustering-design.md](../specs/2026-06-30-quests-cache-and-territory-clustering-design.md)

---

### Task 1: `computeCentroid` geometry helper

**Files:**
- Modify: `apps/mobile/src/features/maps/utils/geojson.ts`
- Test: `apps/mobile/tests/unit/maps/geojson.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `apps/mobile/tests/unit/maps/geojson.test.ts` (after the existing `fitBoundsFromCoordinates` describe block, before end of file):

```ts
describe('computeCentroid', () => {
  it('returns the average of an open ring', () => {
    const ring: [number, number][] = [
      [0, 0],
      [0, 2],
      [2, 2],
      [2, 0],
    ]
    expect(computeCentroid(ring)).toEqual([1, 1])
  })

  it('ignores a duplicated closing point', () => {
    const ring: [number, number][] = [
      [0, 0],
      [0, 2],
      [2, 2],
      [2, 0],
      [0, 0], // closing point, same as first
    ]
    expect(computeCentroid(ring)).toEqual([1, 1])
  })

  it('handles a single point', () => {
    expect(computeCentroid([[5, 5]])).toEqual([5, 5])
  })
})
```

Update the import at the top of the file to include `computeCentroid`:

```ts
import {
  simplifyRoute,
  routePointsToLineString,
  fitBoundsFromCoordinates,
  computeCentroid,
} from '@/features/maps/utils/geojson'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/mobile && npx jest tests/unit/maps/geojson.test.ts -t computeCentroid`
Expected: FAIL with `computeCentroid is not a function` (or `undefined`, since it isn't exported yet).

- [ ] **Step 3: Implement `computeCentroid`**

Append to `apps/mobile/src/features/maps/utils/geojson.ts`:

```ts
export function computeCentroid(ring: [number, number][]): [number, number] {
  if (ring.length === 0) return [0, 0]
  const first = ring[0]
  const last = ring[ring.length - 1]
  const isClosed = ring.length > 1 && first[0] === last[0] && first[1] === last[1]
  const pts = isClosed ? ring.slice(0, -1) : ring

  let sumLng = 0
  let sumLat = 0
  for (const [lng, lat] of pts) {
    sumLng += lng
    sumLat += lat
  }
  return [sumLng / pts.length, sumLat / pts.length]
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/mobile && npx jest tests/unit/maps/geojson.test.ts`
Expected: PASS (all `computeCentroid` + existing tests green).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/maps/utils/geojson.ts apps/mobile/tests/unit/maps/geojson.test.ts
git commit -m "feat(maps): add computeCentroid geometry helper"
```

---

### Task 2: Mapbox native clustering for `TerritoryLayer`

**Files:**
- Modify: `apps/mobile/src/features/maps/components/TerritoryLayer.tsx`

No new test file — `@rnmapbox/maps` is a native module not exercised by the existing Jest setup (no test in the repo renders `TerritoryLayer` or `MapView`; verified by `Glob` finding zero matches). This task is covered by manual on-device verification in Task 5.

- [ ] **Step 1: Replace the full contents of `TerritoryLayer.tsx`**

```tsx
import { useMemo } from 'react'
import { fitBoundsFromCoordinates, computeCentroid } from '../utils/geojson'
import type { TerritoryCollection } from '../types'
import { colors } from '@/theme'

type MapboxGLType = typeof import('@rnmapbox/maps')['default']
let MapboxGL: MapboxGLType | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  MapboxGL = (require('@rnmapbox/maps') as { default: MapboxGLType }).default
} catch {
  // native build required
}

const PADDING = 50
// Below this zoom, individual cell polygons overlap into unreadable clutter;
// at and above it, polygons are visually distinguishable.
const CLUSTER_ZOOM_BOUNDARY = 12

type Props = {
  data: TerritoryCollection
}

export function TerritoryLayer({ data }: Props) {
  const bounds = useMemo(() => {
    const coords: [number, number][] = data.features.flatMap((f) =>
      f.geometry.coordinates[0].map(([lng, lat]) => [lng, lat] as [number, number]),
    )
    return fitBoundsFromCoordinates(coords)
  }, [data])

  const centroids = useMemo((): GeoJSON.FeatureCollection<GeoJSON.Point> => ({
    type: 'FeatureCollection',
    features: data.features.map((f) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: computeCentroid(f.geometry.coordinates[0]) },
      properties: { cellId: f.properties.cellId },
    })),
  }), [data])

  if (data.features.length === 0 || !MapboxGL) return null

  return (
    <>
      <MapboxGL.Camera
        bounds={{
          ne: bounds.ne,
          sw: bounds.sw,
          paddingTop: PADDING,
          paddingRight: PADDING,
          paddingBottom: PADDING,
          paddingLeft: PADDING,
        }}
        animationDuration={0}
      />

      {/* Low zoom: native clustered bubbles over territory centroids. */}
      <MapboxGL.ShapeSource
        id="territory-cluster-source"
        shape={centroids}
        cluster
        clusterRadius={50}
        clusterMaxZoomLevel={CLUSTER_ZOOM_BOUNDARY - 1}
      >
        <MapboxGL.CircleLayer
          id="territory-cluster-circle"
          maxZoomLevel={CLUSTER_ZOOM_BOUNDARY}
          filter={['has', 'point_count']}
          style={{
            circleColor: colors.primary,
            circleOpacity: 0.85,
            circleRadius: [
              'interpolate', ['linear'], ['get', 'point_count'],
              1, 18,
              20, 28,
              100, 38,
            ],
          }}
        />
        <MapboxGL.SymbolLayer
          id="territory-cluster-count"
          maxZoomLevel={CLUSTER_ZOOM_BOUNDARY}
          filter={['has', 'point_count']}
          style={{
            textField: ['get', 'point_count_abbreviated'],
            textColor: colors.background,
            textSize: 13,
            textAllowOverlap: true,
          }}
        />
        <MapboxGL.CircleLayer
          id="territory-unclustered-point"
          maxZoomLevel={CLUSTER_ZOOM_BOUNDARY}
          filter={['!', ['has', 'point_count']]}
          style={{
            circleColor: colors.primary,
            circleOpacity: 0.7,
            circleRadius: 6,
          }}
        />
      </MapboxGL.ShapeSource>

      {/* High zoom: existing polygon fill/border. */}
      <MapboxGL.ShapeSource id="territory-source" shape={data as unknown as GeoJSON.FeatureCollection}>
        <MapboxGL.FillLayer
          id="territory-fill"
          minZoomLevel={CLUSTER_ZOOM_BOUNDARY}
          style={{ fillColor: colors.primary, fillOpacity: 0.4 }}
        />
        <MapboxGL.LineLayer
          id="territory-border"
          minZoomLevel={CLUSTER_ZOOM_BOUNDARY}
          style={{ lineColor: colors.primary, lineWidth: 1 }}
        />
      </MapboxGL.ShapeSource>
    </>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npm run typecheck`
Expected: no new errors from `TerritoryLayer.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/features/maps/components/TerritoryLayer.tsx
git commit -m "feat(maps): native Mapbox clustering for territory layer at low zoom"
```

---

### Task 3: `queryCache` integration in `useQuests`

**Files:**
- Modify: `apps/mobile/src/features/quests/hooks/useQuests.ts`
- Test: Create `apps/mobile/tests/unit/quests/useQuests.test.tsx`

- [ ] **Step 1: Write the failing test file**

Create `apps/mobile/tests/unit/quests/useQuests.test.tsx`:

```tsx
import React from 'react'
import { render, waitFor, act } from '@testing-library/react-native'
import { Text, View, Pressable } from 'react-native'
import { useQuests } from '@/features/quests/hooks/useQuests'
import { queryInvalidate, querySet } from '@/lib/queryCache'
import type { ActiveQuest } from '@stridequest/shared'

jest.mock('@/features/quests/services/quests', () => ({
  fetchActiveQuests: jest.fn(),
}))

import { fetchActiveQuests } from '@/features/quests/services/quests'
const mockFetch = fetchActiveQuests as jest.MockedFunction<typeof fetchActiveQuests>

const USER_ID = 'user-1'
const CACHE_KEY = `quests:${USER_ID}`

const QUEST: ActiveQuest = {
  userQuestId: 'uq-1',
  questId: 'q-1',
  slug: 'daily-run-3k',
  title: 'Daily 3K',
  description: 'Run 3 km today.',
  type: 'distance_total',
  targetValue: 3000,
  rewardXp: 50,
  durationType: 'daily',
  rewardBadgeIcon: '🏃',
  rewardBadgeLabel: 'Mover',
  windowEndHour: null,
  status: 'active',
  currentValue: 0,
  expiresAt: '2026-07-01T00:00:00Z',
}

function TestComponent({ userId }: { userId: string }) {
  const { quests, loading, refresh } = useQuests(userId)
  return (
    <View>
      <Text testID="loading">{String(loading)}</Text>
      <Text testID="count">{quests.length}</Text>
      <Pressable testID="refresh" onPress={refresh} />
    </View>
  )
}

describe('useQuests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    queryInvalidate(CACHE_KEY)
  })

  it('fetches and caches quests on first load', async () => {
    mockFetch.mockResolvedValue([QUEST])
    const { getByTestId } = render(<TestComponent userId={USER_ID} />)

    expect(getByTestId('loading').props.children).toBe('true')

    await waitFor(() => {
      expect(getByTestId('loading').props.children).toBe('false')
    })
    expect(getByTestId('count').props.children).toBe(1)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('skips the network call when a fresh cache entry exists', () => {
    querySet(CACHE_KEY, [QUEST])
    const { getByTestId } = render(<TestComponent userId={USER_ID} />)

    expect(getByTestId('loading').props.children).toBe('false')
    expect(getByTestId('count').props.children).toBe(1)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('refresh invalidates the cache and refetches', async () => {
    querySet(CACHE_KEY, [QUEST])
    mockFetch.mockResolvedValue([])
    const { getByTestId } = render(<TestComponent userId={USER_ID} />)

    expect(getByTestId('count').props.children).toBe(1)

    act(() => {
      getByTestId('refresh').props.onPress()
    })

    await waitFor(() => {
      expect(getByTestId('count').props.children).toBe(0)
    })
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/mobile && npx jest tests/unit/quests/useQuests.test.tsx`
Expected: FAIL on the "skips the network call" test — `mockFetch` IS called because the current hook has no cache check (the "first load" test will likely pass already since current behavior already fetches).

- [ ] **Step 3: Implement caching in `useQuests.ts`**

Replace the full contents of `apps/mobile/src/features/quests/hooks/useQuests.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import { fetchActiveQuests } from '../services/quests'
import { queryGet, querySet, queryInvalidate } from '@/lib/queryCache'
import type { ActiveQuest } from '@stridequest/shared'

const STALE_MS = 30_000
const cacheKey = (userId: string) => `quests:${userId}`

export function useQuests(userId: string) {
  const [quests, setQuests] = useState<ActiveQuest[]>(
    () => (userId ? queryGet<ActiveQuest[]>(cacheKey(userId), STALE_MS) : undefined) ?? [],
  )
  const [loading, setLoading] = useState<boolean>(
    () => !(userId && queryGet<ActiveQuest[]>(cacheKey(userId), STALE_MS)),
  )
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!userId) { setLoading(false); return }

    const fresh = queryGet<ActiveQuest[]>(cacheKey(userId), STALE_MS)
    if (fresh) {
      setQuests(fresh)
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    void (async () => {
      try {
        const data = await fetchActiveQuests(userId)
        querySet(cacheKey(userId), data)
        setQuests(data)
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load quests')
      } finally {
        setLoading(false)
      }
    })()
  }, [userId])

  const refresh = useCallback(() => {
    if (!userId) return
    queryInvalidate(cacheKey(userId))
    load()
  }, [userId, load])

  useEffect(() => { load() }, [load])

  return { quests, loading, error, refresh }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/mobile && npx jest tests/unit/quests/useQuests.test.tsx`
Expected: PASS (all 3 tests green).

- [ ] **Step 5: Run the full unit suite to check for regressions**

Run: `cd apps/mobile && npx jest tests/unit`
Expected: PASS, no regressions in other suites.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/features/quests/hooks/useQuests.ts apps/mobile/tests/unit/quests/useQuests.test.tsx
git commit -m "feat(quests): stale-while-revalidate cache in useQuests"
```

---

### Task 4: `QuestDashboard` entrance animation

**Files:**
- Modify: `apps/mobile/src/features/quests/components/QuestDashboard.tsx`

No new test — this is a pure Reanimated visual affordance; the existing `QuestCard`/`QuestSegmentedControl` components have no animation-timing tests either (Reanimated's worklet thread isn't observable from `@testing-library/react-native`'s JS-side assertions). Covered by manual on-device verification in Task 5.

- [ ] **Step 1: Add the entrance wrapper component and use it in the list render**

In `apps/mobile/src/features/quests/components/QuestDashboard.tsx`, update the imports at the top:

```tsx
import { useEffect, useState } from 'react'
import { View, Text, ScrollView, Pressable } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { useQuests } from '../hooks/useQuests'
import { QuestSegmentedControl } from './QuestSegmentedControl'
import { QuestCard } from './QuestCard'
import { QuestCardSkeleton } from './QuestCardSkeleton'
import { colors, withAlpha } from '@/theme'
```

Add this local component directly below the imports, above `QuestDashboardProps`:

```tsx
function QuestCardEntrance({ index, children }: { index: number; children: React.ReactNode }) {
  const translateY = useSharedValue(16)
  const opacity = useSharedValue(0)

  useEffect(() => {
    translateY.value = withDelay(index * 80, withTiming(0, { duration: 320 }))
    opacity.value = withDelay(index * 80, withTiming(1, { duration: 320 }))
  }, [index, translateY, opacity])

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }))

  return <Animated.View style={style}>{children}</Animated.View>
}
```

Replace the list-rendering line:

```tsx
          visible.map((q, i) => <QuestCard key={q.userQuestId} quest={q} index={i} />)
```

with:

```tsx
          visible.map((q, i) => (
            <QuestCardEntrance key={q.userQuestId} index={i}>
              <QuestCard quest={q} index={i} />
            </QuestCardEntrance>
          ))
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npm run typecheck`
Expected: no new errors from `QuestDashboard.tsx`.

- [ ] **Step 3: Run the full unit suite to check for regressions**

Run: `cd apps/mobile && npx jest tests/unit`
Expected: PASS, no regressions.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/features/quests/components/QuestDashboard.tsx
git commit -m "feat(quests): staggered entrance animation for quest cards"
```

---

### Task 5: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full unit test suite**

Run: `cd apps/mobile && npx jest tests/unit`
Expected: all suites PASS.

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Scoped lint on changed files**

Run:
```bash
cd apps/mobile && npx eslint src/features/maps/utils/geojson.ts src/features/maps/components/TerritoryLayer.tsx src/features/quests/hooks/useQuests.ts src/features/quests/components/QuestDashboard.tsx
```
Expected: no errors (warnings only if pre-existing).

- [ ] **Step 4: expo-doctor + export sanity check (per repo mobile rules)**

Run:
```bash
cd apps/mobile && npx expo-doctor
```
Expected: no new failures introduced by this change (`@rnmapbox/maps` prop additions don't touch native config).

- [ ] **Step 5: Manual on-device verification**

On a device/emulator with a native dev build (`expo run:android` per repo rules — Expo Go cannot load `@rnmapbox/maps`):
1. Open the Quests tab, navigate away, return — second visit should show quest cards immediately with no skeleton flash.
2. Pull-to-refresh or tap "Try again" on an error state — cards should re-fetch (network call observable in Metro logs).
3. Open the territory map; zoom from a wide city-level view down past zoom 12 — cluster bubbles (with counts) should give way to individual polygon fills with no flicker or gap.

- [ ] **Step 6: Final commit (if any fixups were needed)**

```bash
git add -A
git commit -m "chore: fix lint/typecheck fallout from quests cache + clustering work"
```

(Skip this commit if Steps 1-5 needed no fixes.)
