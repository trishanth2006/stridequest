# Mobile Route Map & Territory Map â€” Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a live Mapbox route map to the workout detail screen, a full-screen route viewer, and a territory ownership map to the territory tab â€” all behind a `features/maps` abstraction layer so screens never import from `@rnmapbox/maps` directly.

**Architecture:** Install `@rnmapbox/maps`, initialize via a `MapboxProvider`, then build pure-utility layers (geojson.ts, route service, territory service) before wiring up the abstraction components (`MapView`, `RouteLayer`, `TerritoryLayer`). Screens consume finished domain objects â€” no H3 or Mapbox primitives leak into screen files.

**Tech Stack:** `@rnmapbox/maps` ^11.8.0, `h3-js` ^4.4.0 (in shared package only), GeoJSON types via `@types/geojson`, Supabase JS client, Expo Router, NativeWind/Tailwind.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `apps/mobile/.env` | Modify | Rename `EXPO_NEXT_PUBLIC_MAPBOX_TOKEN` â†’ `EXPO_PUBLIC_MAPBOX_TOKEN` |
| `apps/mobile/app.json` | Modify | Add `@rnmapbox/maps` Expo plugin |
| `apps/mobile/package.json` | Modify | Add `@rnmapbox/maps`; add `@types/geojson` to devDeps |
| `packages/shared/package.json` | Modify | Add `@types/geojson` to devDeps |
| `packages/shared/src/territory/polygon.ts` | Create | `cellToPolygon`, `cellsToFeatureCollection` (H3 â†’ GeoJSON) |
| `packages/shared/src/territory/index.ts` | Modify | Re-export from `polygon.ts` |
| `apps/mobile/app/_layout.tsx` | Modify | Wrap with `<MapboxProvider>` |
| `apps/mobile/src/features/maps/providers/MapboxProvider.tsx` | Create | Init Mapbox token + disable telemetry |
| `apps/mobile/src/features/maps/types.ts` | Create | `RoutePoint`, `TerritoryCollection`, `TerritoryFetchOptions` |
| `apps/mobile/src/features/maps/utils/geojson.ts` | Create | `simplifyRoute`, `routePointsToLineString`, `fitBoundsFromCoordinates` |
| `apps/mobile/src/features/maps/services/route.ts` | Create | `fetchRoutePoints(workoutId)` |
| `apps/mobile/src/features/maps/services/territory.ts` | Create | `fetchTerritory({ scope: 'me' })` |
| `apps/mobile/src/features/maps/components/MapView.tsx` | Create | Mapbox wrapper with `interactive` prop |
| `apps/mobile/src/features/maps/components/RouteLayer.tsx` | Create | Camera + LineLayer for route polyline |
| `apps/mobile/src/features/maps/components/TerritoryLayer.tsx` | Create | Camera + FillLayer + LineLayer for owned cells |
| `apps/mobile/app/(protected)/(tabs)/run/[id].tsx` | Modify | Replace placeholder with route mini-map card |
| `apps/mobile/app/(protected)/(tabs)/run/[id]/map.tsx` | Create | Full-screen route viewer screen |
| `apps/mobile/app/(protected)/(tabs)/territory.tsx` | Replace | Full territory map screen |
| `apps/mobile/tests/unit/maps/geojson.test.ts` | Create | Unit tests for geojson utilities |
| `apps/mobile/tests/unit/maps/route-service.test.ts` | Create | Unit tests for route service |
| `apps/mobile/tests/unit/maps/territory-service.test.ts` | Create | Unit tests for territory service |
| `apps/mobile/tests/unit/maps/polygon.test.ts` | Create | Unit tests for shared polygon conversion |

---

## Task 1: Fix Mapbox env variable

**Files:**
- Modify: `apps/mobile/.env`

- [x] **Step 1: Rename the env key**

Open `apps/mobile/.env`. Change line 2 from:
```
EXPO_NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1Ijoic3RyaXNoYW50...
```
to:
```
EXPO_PUBLIC_MAPBOX_TOKEN=pk.eyJ1Ijoic3RyaXNoYW50...
```
(Keep the same token value â€” only the key name changes.)

- [x] **Step 2: Commit**

```bash
cd apps/mobile
git add .env
git commit -m "fix(mobile): rename Mapbox token env key to EXPO_PUBLIC_MAPBOX_TOKEN"
```

---

## Task 2: Install @rnmapbox/maps + update app.json

**Files:**
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/app.json`
- Modify: `packages/shared/package.json`

- [x] **Step 1: Add @types/geojson to shared devDependencies**

In `packages/shared/package.json`, add to `devDependencies`:
```json
"@types/geojson": "^7946.0.16"
```

Run from the repo root:
```bash
cd packages/shared
npm install --save-dev @types/geojson
cd ../..
```

- [x] **Step 2: Install @rnmapbox/maps and @types/geojson in mobile**

```bash
cd apps/mobile
npm install @rnmapbox/maps
npm install --save-dev @types/geojson
```

After install, verify `package.json` has `"@rnmapbox/maps"` in `dependencies` and `"@types/geojson"` in `devDependencies`.

> **Version note:** Accept whatever version npm resolves. If the install fails due to peer dep conflicts with React Native 0.81.5, pin to `@rnmapbox/maps@11.8.0` explicitly.

- [x] **Step 3: Add the Expo plugin to app.json**

In `apps/mobile/app.json`, update the `"plugins"` array:

```json
"plugins": [
  "expo-router",
  "expo-asset",
  [
    "expo-location",
    {
      "locationAlwaysAndWhenInUsePermission": "StrideQuest needs your location to track your run."
    }
  ],
  [
    "@rnmapbox/maps",
    {
      "RNMapboxMapsImpl": "mapbox",
      "RNMapboxMapsVersion": "11.8.0"
    }
  ]
]
```

> The `RNMapboxMapsVersion` must match the native SDK bundled with the installed JS package. If it differs, EAS Build will warn â€” update to match.

- [x] **Step 4: Commit**

```bash
cd apps/mobile
git add package.json app.json ../../packages/shared/package.json ../../packages/shared/package-lock.json package-lock.json
git commit -m "feat(mobile): install @rnmapbox/maps + @types/geojson; add Expo plugin"
```

---

## Task 3: Create MapboxProvider + wire into _layout.tsx

**Files:**
- Create: `apps/mobile/src/features/maps/providers/MapboxProvider.tsx`
- Modify: `apps/mobile/app/_layout.tsx`

- [x] **Step 1: Create MapboxProvider.tsx**

Create `apps/mobile/src/features/maps/providers/MapboxProvider.tsx`:

```tsx
import MapboxGL from '@rnmapbox/maps'

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '')
MapboxGL.setTelemetryEnabled(false)

export function MapboxProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

> `setAccessToken` and `setTelemetryEnabled` are called at module load time (once). The provider component itself is a passthrough â€” future initialization (offline packs, telemetry changes) happens here without touching screen files.

- [x] **Step 2: Wrap _layout.tsx with MapboxProvider**

Replace `apps/mobile/app/_layout.tsx` with:

```tsx
import '../global.css'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SessionProvider } from '@/features/auth/providers/SessionProvider'
import { MapboxProvider } from '@/features/maps/providers/MapboxProvider'

export default function RootLayout() {
  return (
    <SessionProvider>
      <MapboxProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }} />
      </MapboxProvider>
    </SessionProvider>
  )
}
```

- [x] **Step 3: Verify typecheck passes**

```bash
cd apps/mobile
npm run typecheck
```

Expected: no new errors.

- [x] **Step 4: Commit**

```bash
git add src/features/maps/providers/MapboxProvider.tsx app/_layout.tsx
git commit -m "feat(mobile): add MapboxProvider, initialize Mapbox token in _layout"
```

---

## Task 4: Add polygon utilities to shared package

**Files:**
- Create: `packages/shared/src/territory/polygon.ts`
- Modify: `packages/shared/src/territory/index.ts`

- [x] **Step 1: Create polygon.ts**

Create `packages/shared/src/territory/polygon.ts`:

```ts
import { cellToBoundary } from 'h3-js'
import type { Feature, Polygon, FeatureCollection } from 'geojson'

/**
 * Convert a single H3 cell ID to a GeoJSON Polygon Feature.
 * h3-js returns [lat, lng] pairs; GeoJSON requires [lng, lat] â€” swap applied here.
 */
export function cellToPolygon(cellId: string): Feature<Polygon> {
  const boundary = cellToBoundary(cellId)
  const coordinates = boundary.map(([lat, lng]) => [lng, lat] as [number, number])
  // Close the ring by repeating the first coordinate
  coordinates.push(coordinates[0])
  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [coordinates],
    },
    properties: { cellId },
  }
}

/**
 * Convert an array of H3 cell IDs to a GeoJSON FeatureCollection of Polygons.
 * Empty input â†’ FeatureCollection with zero features (not an error).
 */
export function cellsToFeatureCollection(cellIds: string[]): FeatureCollection<Polygon> {
  return {
    type: 'FeatureCollection',
    features: cellIds.map(cellToPolygon),
  }
}
```

- [x] **Step 2: Re-export from territory index**

In `packages/shared/src/territory/index.ts`, add the export:

```ts
export * from './types'
export * from './grid'
export * from './capture'
export * from './polygon'
```

- [x] **Step 3: Typecheck shared package**

```bash
cd packages/shared
npm run typecheck
```

Expected: no errors.

- [x] **Step 4: Commit**

```bash
cd ../..
git add packages/shared/src/territory/polygon.ts packages/shared/src/territory/index.ts
git commit -m "feat(shared): add cellToPolygon + cellsToFeatureCollection for GeoJSON rendering"
```

---

## Task 5: Write and pass tests for polygon utilities

**Files:**
- Create: `apps/mobile/tests/unit/maps/polygon.test.ts`

- [x] **Step 1: Write the tests**

Create `apps/mobile/tests/unit/maps/polygon.test.ts`:

```ts
import { pathToCells, cellToPolygon, cellsToFeatureCollection } from '@stridequest/shared/territory'

// Get a known-valid H3 res-9 cell from a real coordinate
const validCell = pathToCells([
  { lat: 37.7749, lng: -122.4194 },
  { lat: 37.7750, lng: -122.4195 },
])[0]

describe('cellToPolygon', () => {
  it('returns a GeoJSON Feature with Polygon geometry', () => {
    const feature = cellToPolygon(validCell)
    expect(feature.type).toBe('Feature')
    expect(feature.geometry.type).toBe('Polygon')
  })

  it('closes the ring (first and last coordinate equal)', () => {
    const feature = cellToPolygon(validCell)
    const ring = feature.geometry.coordinates[0]
    expect(ring[0]).toEqual(ring[ring.length - 1])
  })

  it('outputs coordinates in [lng, lat] order (GeoJSON convention)', () => {
    const feature = cellToPolygon(validCell)
    const [lng] = feature.geometry.coordinates[0][0]
    // San Francisco area: lng should be around -122, not +37
    expect(lng).toBeLessThan(-100)
  })

  it('stores the cell id in properties', () => {
    const feature = cellToPolygon(validCell)
    expect(feature.properties?.cellId).toBe(validCell)
  })
})

describe('cellsToFeatureCollection', () => {
  it('returns a FeatureCollection with one feature per cell', () => {
    const result = cellsToFeatureCollection([validCell])
    expect(result.type).toBe('FeatureCollection')
    expect(result.features).toHaveLength(1)
  })

  it('returns empty FeatureCollection for empty input', () => {
    const result = cellsToFeatureCollection([])
    expect(result.type).toBe('FeatureCollection')
    expect(result.features).toHaveLength(0)
  })
})
```

- [x] **Step 2: Run and verify tests pass**

```bash
cd apps/mobile
npx jest tests/unit/maps/polygon.test.ts --no-coverage
```

Expected: 6 tests pass. If h3-js resolution fails through the shared transform, check that `@stridequest` is in `transformIgnorePatterns` whitelist in `jest.config.js` (it already is).

- [x] **Step 3: Commit**

```bash
git add tests/unit/maps/polygon.test.ts
git commit -m "test(mobile): add unit tests for shared polygon conversion"
```

---

## Task 6: Create maps/types.ts

**Files:**
- Create: `apps/mobile/src/features/maps/types.ts`

- [x] **Step 1: Create types.ts**

Create `apps/mobile/src/features/maps/types.ts`:

```ts
import type { FeatureCollection, Polygon } from 'geojson'

export type RoutePoint = {
  lat: number
  lng: number
}

export type TerritoryCollection = FeatureCollection<Polygon>

export type TerritoryFetchOptions = { scope: 'me' }
```

- [x] **Step 2: Typecheck**

```bash
cd apps/mobile
npm run typecheck
```

Expected: no errors.

- [x] **Step 3: Commit**

```bash
git add src/features/maps/types.ts
git commit -m "feat(mobile): add maps/types.ts (RoutePoint, TerritoryCollection, TerritoryFetchOptions)"
```

---

## Task 7: Create geojson utilities + tests

**Files:**
- Create: `apps/mobile/src/features/maps/utils/geojson.ts`
- Create: `apps/mobile/tests/unit/maps/geojson.test.ts`

- [x] **Step 1: Write the failing tests**

Create `apps/mobile/tests/unit/maps/geojson.test.ts`:

```ts
import {
  simplifyRoute,
  routePointsToLineString,
  fitBoundsFromCoordinates,
} from '@/features/maps/utils/geojson'
import type { RoutePoint } from '@/features/maps/types'

const STRAIGHT_LINE: RoutePoint[] = [
  { lat: 37.770, lng: -122.420 },
  { lat: 37.771, lng: -122.420 },
  { lat: 37.772, lng: -122.420 },
  { lat: 37.773, lng: -122.420 },
  { lat: 37.774, lng: -122.420 },
]

describe('simplifyRoute', () => {
  it('returns points unchanged when 2 or fewer', () => {
    const two = STRAIGHT_LINE.slice(0, 2)
    expect(simplifyRoute(two)).toEqual(two)
  })

  it('collapses a straight line to 2 points', () => {
    // All intermediate points are collinear so their perpendicular distance = 0
    const result = simplifyRoute(STRAIGHT_LINE)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual(STRAIGHT_LINE[0])
    expect(result[result.length - 1]).toEqual(STRAIGHT_LINE[STRAIGHT_LINE.length - 1])
  })

  it('preserves a sharp bend', () => {
    const bend: RoutePoint[] = [
      { lat: 37.770, lng: -122.420 },
      { lat: 37.775, lng: -122.420 }, // midpoint far off the direct line
      { lat: 37.775, lng: -122.415 },
    ]
    // The middle point is far from the start-end line â†’ must be kept
    const result = simplifyRoute(bend, 1e-5)
    expect(result.length).toBeGreaterThan(2)
  })

  it('returns empty array unchanged', () => {
    expect(simplifyRoute([])).toEqual([])
  })
})

describe('routePointsToLineString', () => {
  it('returns a GeoJSON LineString Feature', () => {
    const feature = routePointsToLineString(STRAIGHT_LINE)
    expect(feature.type).toBe('Feature')
    expect(feature.geometry.type).toBe('LineString')
  })

  it('outputs coordinates in [lng, lat] order', () => {
    const feature = routePointsToLineString([{ lat: 37.77, lng: -122.42 }])
    expect(feature.geometry.coordinates[0]).toEqual([-122.42, 37.77])
  })

  it('has the correct number of coordinate pairs', () => {
    const feature = routePointsToLineString(STRAIGHT_LINE)
    expect(feature.geometry.coordinates).toHaveLength(5)
  })
})

describe('fitBoundsFromCoordinates', () => {
  it('returns ne and sw corners', () => {
    const coords: [number, number][] = [
      [-122.42, 37.77],
      [-122.41, 37.78],
      [-122.43, 37.76],
    ]
    const { ne, sw } = fitBoundsFromCoordinates(coords)
    expect(ne).toEqual([-122.41, 37.78])
    expect(sw).toEqual([-122.43, 37.76])
  })

  it('handles a single coordinate', () => {
    const coords: [number, number][] = [[-122.42, 37.77]]
    const { ne, sw } = fitBoundsFromCoordinates(coords)
    expect(ne).toEqual([-122.42, 37.77])
    expect(sw).toEqual([-122.42, 37.77])
  })
})
```

- [x] **Step 2: Run to verify failure**

```bash
cd apps/mobile
npx jest tests/unit/maps/geojson.test.ts --no-coverage
```

Expected: FAIL â€” `Cannot find module '@/features/maps/utils/geojson'`

- [x] **Step 3: Create geojson.ts**

Create `apps/mobile/src/features/maps/utils/geojson.ts`:

```ts
import type { Feature, LineString } from 'geojson'
import type { RoutePoint } from '../types'

// 3 m converted to approximate degrees (1Â° â‰ˆ 111 000 m)
const DEFAULT_TOLERANCE_DEG = 3 / 111_000

function perpendicularDistance(
  point: RoutePoint,
  lineStart: RoutePoint,
  lineEnd: RoutePoint,
): number {
  const dx = lineEnd.lng - lineStart.lng
  const dy = lineEnd.lat - lineStart.lat
  const mag = Math.sqrt(dx * dx + dy * dy)
  if (mag === 0) {
    return Math.sqrt(
      Math.pow(point.lng - lineStart.lng, 2) + Math.pow(point.lat - lineStart.lat, 2),
    )
  }
  return (
    Math.abs(dx * (lineStart.lat - point.lat) - (lineStart.lng - point.lng) * dy) / mag
  )
}

function douglasPeucker(points: RoutePoint[], tolerance: number): RoutePoint[] {
  if (points.length <= 2) return points
  let maxDist = 0
  let maxIdx = 0
  const last = points.length - 1
  for (let i = 1; i < last; i++) {
    const d = perpendicularDistance(points[i], points[0], points[last])
    if (d > maxDist) {
      maxDist = d
      maxIdx = i
    }
  }
  if (maxDist > tolerance) {
    const left = douglasPeucker(points.slice(0, maxIdx + 1), tolerance)
    const right = douglasPeucker(points.slice(maxIdx), tolerance)
    return [...left.slice(0, -1), ...right]
  }
  return [points[0], points[last]]
}

export function simplifyRoute(
  points: RoutePoint[],
  toleranceDeg = DEFAULT_TOLERANCE_DEG,
): RoutePoint[] {
  if (points.length <= 2) return points
  return douglasPeucker(points, toleranceDeg)
}

export function routePointsToLineString(points: RoutePoint[]): Feature<LineString> {
  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: points.map((p) => [p.lng, p.lat]),
    },
    properties: null,
  }
}

export function fitBoundsFromCoordinates(
  coords: [number, number][],
): { ne: [number, number]; sw: [number, number] } {
  if (coords.length === 0) return { ne: [0, 0], sw: [0, 0] }
  let minLng = coords[0][0]
  let maxLng = coords[0][0]
  let minLat = coords[0][1]
  let maxLat = coords[0][1]
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }
  return { ne: [maxLng, maxLat], sw: [minLng, minLat] }
}
```

- [x] **Step 4: Run tests and verify pass**

```bash
npx jest tests/unit/maps/geojson.test.ts --no-coverage
```

Expected: all tests pass.

- [x] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [x] **Step 6: Commit**

```bash
git add src/features/maps/utils/geojson.ts tests/unit/maps/geojson.test.ts
git commit -m "feat(mobile): add geojson utilities â€” simplifyRoute, routePointsToLineString, fitBoundsFromCoordinates"
```

---

## Task 8: Create route service + tests

**Files:**
- Create: `apps/mobile/src/features/maps/services/route.ts`
- Create: `apps/mobile/tests/unit/maps/route-service.test.ts`

- [x] **Step 1: Write the failing tests**

Create `apps/mobile/tests/unit/maps/route-service.test.ts`:

```ts
import { fetchRoutePoints } from '@/features/maps/services/route'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}))

import { supabase } from '@/lib/supabase'
const mockFrom = supabase.from as jest.Mock

function makeChain(result: unknown) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue(result),
  }
  mockFrom.mockReturnValue(chain)
  return chain
}

describe('fetchRoutePoints', () => {
  it('returns lat/lng pairs for a workout with route data', async () => {
    makeChain({
      data: [
        { lat: 37.77, lng: -122.42 },
        { lat: 37.78, lng: -122.41 },
      ],
      error: null,
    })
    const result = await fetchRoutePoints('workout-123')
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ lat: 37.77, lng: -122.42 })
  })

  it('returns empty array when no route data exists', async () => {
    makeChain({ data: [], error: null })
    const result = await fetchRoutePoints('workout-no-gps')
    expect(result).toEqual([])
  })

  it('returns empty array on Supabase error', async () => {
    makeChain({ data: null, error: { message: 'permission denied' } })
    const result = await fetchRoutePoints('workout-err')
    expect(result).toEqual([])
  })
})
```

- [x] **Step 2: Run to verify failure**

```bash
npx jest tests/unit/maps/route-service.test.ts --no-coverage
```

Expected: FAIL â€” `Cannot find module '@/features/maps/services/route'`

- [x] **Step 3: Create route.ts**

Create `apps/mobile/src/features/maps/services/route.ts`:

```ts
import { supabase } from '@/lib/supabase'
import type { RoutePoint } from '../types'

export async function fetchRoutePoints(workoutId: string): Promise<RoutePoint[]> {
  const { data, error } = await supabase
    .from('route_points')
    .select('lat, lng')
    .eq('workout_id', workoutId)
    .order('recorded_at', { ascending: true })
    .order('batch_seq', { ascending: true })
    .order('point_seq', { ascending: true })

  if (error || !data) return []
  return data as RoutePoint[]
}
```

- [x] **Step 4: Run tests and verify pass**

```bash
npx jest tests/unit/maps/route-service.test.ts --no-coverage
```

Expected: 3 tests pass.

- [x] **Step 5: Commit**

```bash
git add src/features/maps/services/route.ts tests/unit/maps/route-service.test.ts
git commit -m "feat(mobile): add route service â€” fetchRoutePoints with ordered batch/point seq"
```

---

## Task 9: Create territory service + tests

**Files:**
- Create: `apps/mobile/src/features/maps/services/territory.ts`
- Create: `apps/mobile/tests/unit/maps/territory-service.test.ts`

- [x] **Step 1: Write the failing tests**

Create `apps/mobile/tests/unit/maps/territory-service.test.ts`:

```ts
import { fetchTerritory } from '@/features/maps/services/territory'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: { getUser: jest.fn() },
  },
}))

jest.mock('@stridequest/shared/territory', () => ({
  cellsToFeatureCollection: jest.fn((ids: string[]) => ({
    type: 'FeatureCollection',
    features: ids.map((id: string) => ({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[]] },
      properties: { cellId: id },
    })),
  })),
}))

import { supabase } from '@/lib/supabase'
const mockFrom = supabase.from as jest.Mock

function makeChain(result: unknown) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(result),
  }
  mockFrom.mockReturnValue(chain)
  return chain
}

describe('fetchTerritory', () => {
  it('returns a FeatureCollection with one feature per owned cell', async () => {
    makeChain({
      data: [{ cell_id: 'cell-aaa' }, { cell_id: 'cell-bbb' }],
      error: null,
    })
    const result = await fetchTerritory({ scope: 'me' })
    expect(result.type).toBe('FeatureCollection')
    expect(result.features).toHaveLength(2)
  })

  it('returns empty FeatureCollection when user owns no cells', async () => {
    makeChain({ data: [], error: null })
    const result = await fetchTerritory({ scope: 'me' })
    expect(result.type).toBe('FeatureCollection')
    expect(result.features).toHaveLength(0)
  })

  it('returns empty FeatureCollection on Supabase error', async () => {
    makeChain({ data: null, error: { message: 'rls violation' } })
    const result = await fetchTerritory({ scope: 'me' })
    expect(result.features).toHaveLength(0)
  })
})
```

- [x] **Step 2: Run to verify failure**

```bash
npx jest tests/unit/maps/territory-service.test.ts --no-coverage
```

Expected: FAIL â€” `Cannot find module '@/features/maps/services/territory'`

- [x] **Step 3: Create territory.ts**

Create `apps/mobile/src/features/maps/services/territory.ts`:

```ts
import { supabase } from '@/lib/supabase'
import { cellsToFeatureCollection } from '@stridequest/shared/territory'
import type { TerritoryCollection, TerritoryFetchOptions } from '../types'

export async function fetchTerritory(options: TerritoryFetchOptions): Promise<TerritoryCollection> {
  const empty: TerritoryCollection = { type: 'FeatureCollection', features: [] }

  if (options.scope === 'me') {
    const { data, error } = await supabase
      .from('cell_ownership')
      .select('cell_id')
      .limit(5000)

    if (error || !data) return empty
    const cellIds = data.map((row: { cell_id: string }) => row.cell_id)
    return cellsToFeatureCollection(cellIds) as TerritoryCollection
  }

  return empty
}
```

> Note: RLS on `cell_ownership` scopes results to the authenticated user's session automatically. No explicit `.eq('owner_user_id', ...)` needed â€” Supabase handles it via RLS.

- [x] **Step 4: Run tests and verify pass**

```bash
npx jest tests/unit/maps/territory-service.test.ts --no-coverage
```

Expected: 3 tests pass.

- [x] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [x] **Step 6: Commit**

```bash
git add src/features/maps/services/territory.ts tests/unit/maps/territory-service.test.ts
git commit -m "feat(mobile): add territory service â€” fetchTerritory with scope pattern and 5000-cell cap"
```

---

## Task 10: Create MapView abstraction component

**Files:**
- Create: `apps/mobile/src/features/maps/components/MapView.tsx`

- [x] **Step 1: Create MapView.tsx**

Create `apps/mobile/src/features/maps/components/MapView.tsx`:

```tsx
import { StyleSheet } from 'react-native'
import MapboxGL from '@rnmapbox/maps'

type Props = {
  style?: object
  children?: React.ReactNode
  interactive?: boolean
}

export function MapView({ style, children, interactive = true }: Props) {
  return (
    <MapboxGL.MapView
      style={style ?? styles.fill}
      styleURL={MapboxGL.StyleURL.Dark}
      scrollEnabled={interactive}
      zoomEnabled={interactive}
      pitchEnabled={interactive}
      rotateEnabled={interactive}
    >
      {children}
    </MapboxGL.MapView>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
})
```

- [x] **Step 2: Typecheck**

```bash
cd apps/mobile
npm run typecheck
```

Expected: no errors.

- [x] **Step 3: Commit**

```bash
git add src/features/maps/components/MapView.tsx
git commit -m "feat(mobile): add MapView abstraction component with interactive prop"
```

---

## Task 11: Create RouteLayer component

**Files:**
- Create: `apps/mobile/src/features/maps/components/RouteLayer.tsx`

- [x] **Step 1: Create RouteLayer.tsx**

Create `apps/mobile/src/features/maps/components/RouteLayer.tsx`:

```tsx
import { useMemo } from 'react'
import MapboxGL from '@rnmapbox/maps'
import { simplifyRoute, routePointsToLineString, fitBoundsFromCoordinates } from '../utils/geojson'
import type { RoutePoint } from '../types'

const PADDING = 50

type Props = {
  points: RoutePoint[]
}

export function RouteLayer({ points }: Props) {
  const simplified = useMemo(() => simplifyRoute(points), [points])

  const lineString = useMemo(() => routePointsToLineString(simplified), [simplified])

  const bounds = useMemo(() => {
    const coords = simplified.map((p): [number, number] => [p.lng, p.lat])
    return fitBoundsFromCoordinates(coords)
  }, [simplified])

  if (points.length === 0) return null

  return (
    <>
      <MapboxGL.Camera
        defaultSettings={{
          bounds: {
            ne: bounds.ne,
            sw: bounds.sw,
            paddingTop: PADDING,
            paddingRight: PADDING,
            paddingBottom: PADDING,
            paddingLeft: PADDING,
          },
        }}
      />
      <MapboxGL.ShapeSource id="route-source" shape={lineString}>
        <MapboxGL.LineLayer
          id="route-line"
          style={{
            lineColor: '#10b981',
            lineWidth: 3,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      </MapboxGL.ShapeSource>
    </>
  )
}
```

> `defaultSettings` on `MapboxGL.Camera` applies only on initial mount â€” the user can freely pan and zoom afterwards. `useMemo` ensures the bounds are computed once from the stable `points` prop.

- [x] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [x] **Step 3: Commit**

```bash
git add src/features/maps/components/RouteLayer.tsx
git commit -m "feat(mobile): add RouteLayer â€” Camera + LineLayer, fits bounds once on mount"
```

---

## Task 12: Create TerritoryLayer component

**Files:**
- Create: `apps/mobile/src/features/maps/components/TerritoryLayer.tsx`

- [x] **Step 1: Create TerritoryLayer.tsx**

Create `apps/mobile/src/features/maps/components/TerritoryLayer.tsx`:

```tsx
import { useMemo } from 'react'
import MapboxGL from '@rnmapbox/maps'
import { fitBoundsFromCoordinates } from '../utils/geojson'
import type { TerritoryCollection } from '../types'

const PADDING = 50

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

  if (data.features.length === 0) return null

  return (
    <>
      <MapboxGL.Camera
        defaultSettings={{
          bounds: {
            ne: bounds.ne,
            sw: bounds.sw,
            paddingTop: PADDING,
            paddingRight: PADDING,
            paddingBottom: PADDING,
            paddingLeft: PADDING,
          },
        }}
      />
      <MapboxGL.ShapeSource id="territory-source" shape={data}>
        <MapboxGL.FillLayer
          id="territory-fill"
          style={{
            fillColor: '#10b981',
            fillOpacity: 0.4,
          }}
        />
        <MapboxGL.LineLayer
          id="territory-border"
          style={{
            lineColor: '#10b981',
            lineWidth: 1,
          }}
        />
      </MapboxGL.ShapeSource>
    </>
  )
}
```

- [x] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [x] **Step 3: Commit**

```bash
git add src/features/maps/components/TerritoryLayer.tsx
git commit -m "feat(mobile): add TerritoryLayer â€” FillLayer + LineLayer for territory cells"
```

---

## Task 13: Workout detail â€” add route mini-map card

**Files:**
- Modify: `apps/mobile/app/(protected)/(tabs)/run/[id].tsx`

Current file: fetches workout data, shows metrics, has a "Route map coming soon" placeholder at lines 98â€“104.

- [x] **Step 1: Replace the screen**

Replace the entire content of `apps/mobile/app/(protected)/(tabs)/run/[id].tsx`:

```tsx
import { useEffect, useState } from 'react'
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { formatDistance, formatDuration, formatPace } from '@stridequest/shared/running'
import { fetchRoutePoints } from '@/features/maps/services/route'
import { MapView } from '@/features/maps/components/MapView'
import { RouteLayer } from '@/features/maps/components/RouteLayer'
import type { RoutePoint } from '@/features/maps/types'

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
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    void (async () => {
      const [workoutResult, points] = await Promise.all([
        supabase
          .from('workouts')
          .select('id, started_at, ended_at, distance_m, duration_s, avg_pace_s_per_km, xp_awarded, status')
          .eq('id', id)
          .single(),
        fetchRoutePoints(id),
      ])

      if (workoutResult.error || !workoutResult.data) {
        setError('Could not load workout.')
      } else {
        setWorkout(workoutResult.data as WorkoutDetail)
        setRoutePoints(points)
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
      <SafeAreaView className="flex-1 bg-[#0b0b0f] items-center justify-center gap-4">
        <Text className="text-base text-neutral-400">{error ?? 'Workout not found.'}</Text>
        <Pressable onPress={() => router.back()}>
          <Text className="text-sm font-semibold text-emerald-400">Go back</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  const date = new Date(workout.started_at)
  const dateStr = date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

  return (
    <SafeAreaView className="flex-1 bg-[#0b0b0f]">
      <ScrollView className="flex-1 px-5 pt-4" contentContainerClassName="gap-6 pb-12">

        {/* Back */}
        <Pressable onPress={() => router.back()} className="flex-row items-center gap-1">
          <Text className="text-sm font-semibold text-emerald-400">â† Back</Text>
        </Pressable>

        {/* Header */}
        <View className="gap-1">
          <Text className="text-2xl font-extrabold text-white">Run</Text>
          <Text className="text-sm text-neutral-400">{dateStr}</Text>
          <Text className="text-xs text-neutral-500">{timeStr}</Text>
        </View>

        {/* Key metrics */}
        <View className="rounded-2xl bg-neutral-900 p-5 gap-4">
          <MetricRow label="Distance" value={formatDistance(workout.distance_m ?? 0)} />
          <MetricRow label="Duration" value={formatDuration(workout.duration_s ?? 0)} />
          <MetricRow label="Avg Pace" value={formatPace(workout.avg_pace_s_per_km ?? 0)} />
          {workout.xp_awarded !== null && workout.xp_awarded > 0 && (
            <MetricRow label="XP Earned" value={`+${workout.xp_awarded} XP`} highlight />
          )}
        </View>

        {/* Route map card */}
        <View className="rounded-2xl bg-neutral-900 overflow-hidden gap-0">
          <View className="px-5 pt-5 pb-3">
            <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
              Route Map
            </Text>
          </View>
          {routePoints.length === 0 ? (
            <View className="px-5 pb-5 items-center">
              <Text className="text-sm text-neutral-500">No route recorded</Text>
            </View>
          ) : (
            <Pressable
              onPress={() => router.push(`/run/${id}/map` as never)}
              style={{ height: 160 }}
            >
              <MapView interactive={false} style={{ flex: 1 }}>
                <RouteLayer points={routePoints} />
              </MapView>
            </Pressable>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

function MetricRow({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <View className="flex-row justify-between items-center">
      <Text className="text-sm text-neutral-400">{label}</Text>
      <Text className={`text-sm font-semibold ${highlight ? 'text-emerald-400' : 'text-white'}`}>
        {value}
      </Text>
    </View>
  )
}
```

- [x] **Step 2: Typecheck**

```bash
cd apps/mobile
npm run typecheck
```

Expected: no errors.

- [x] **Step 3: Commit**

```bash
git add app/'(protected)'/'(tabs)'/run/'[id]'.tsx
git commit -m "feat(mobile): add route mini-map card to workout detail screen"
```

---

## Task 14: Create full-screen route viewer

**Files:**
- Create: `apps/mobile/app/(protected)/(tabs)/run/[id]/map.tsx`

- [x] **Step 1: Create the file**

Create `apps/mobile/app/(protected)/(tabs)/run/[id]/map.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { View, Pressable, Text, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { fetchRoutePoints } from '@/features/maps/services/route'
import { MapView } from '@/features/maps/components/MapView'
import { RouteLayer } from '@/features/maps/components/RouteLayer'
import type { RoutePoint } from '@/features/maps/types'

// MAP-TECH-DEBT-001: Re-fetches route_points independently from the detail screen.
// Future: pass route via navigation params or in-memory cache.

export default function RouteMapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [points, setPoints] = useState<RoutePoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    void fetchRoutePoints(id).then((pts) => {
      setPoints(pts)
      setLoading(false)
    })
  }, [id])

  return (
    <View style={{ flex: 1, backgroundColor: '#0b0b0f' }}>
      {loading ? (
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#10b981" />
        </SafeAreaView>
      ) : (
        <MapView style={{ flex: 1 }}>
          <RouteLayer points={points} />
        </MapView>
      )}

      {/* Back button overlay */}
      <SafeAreaView
        style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={() => router.back()}
          style={{ margin: 16, alignSelf: 'flex-start' }}
          className="bg-neutral-900/80 rounded-full px-4 py-2"
        >
          <Text className="text-sm font-semibold text-emerald-400">â† Back</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  )
}
```

- [x] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [x] **Step 3: Commit**

```bash
git add app/'(protected)'/'(tabs)'/run/'[id]'/map.tsx
git commit -m "feat(mobile): add full-screen route viewer screen at run/[id]/map"
```

---

## Task 15: Replace territory screen with live map

**Files:**
- Modify: `apps/mobile/app/(protected)/(tabs)/territory.tsx`

- [x] **Step 1: Replace the screen**

Replace the entire content of `apps/mobile/app/(protected)/(tabs)/territory.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { View, Text, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { fetchTerritory } from '@/features/maps/services/territory'
import { MapView } from '@/features/maps/components/MapView'
import { TerritoryLayer } from '@/features/maps/components/TerritoryLayer'
import type { TerritoryCollection } from '@/features/maps/types'

const EMPTY: TerritoryCollection = { type: 'FeatureCollection', features: [] }

export default function TerritoryScreen() {
  const [polygons, setPolygons] = useState<TerritoryCollection>(EMPTY)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void fetchTerritory({ scope: 'me' }).then((data) => {
      setPolygons(data)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-[#0b0b0f] items-center justify-center">
        <ActivityIndicator color="#10b981" />
      </SafeAreaView>
    )
  }

  if (polygons.features.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-[#0b0b0f] items-center justify-center gap-3">
        <Text className="text-2xl font-bold text-white">Territory</Text>
        <Text className="text-sm text-neutral-400">No territory captured yet</Text>
        <Text className="text-xs text-neutral-500">Complete a run to claim your first cells</Text>
      </SafeAreaView>
    )
  }

  return (
    <View style={{ flex: 1 }}>
      <MapView style={{ flex: 1 }}>
        <TerritoryLayer data={polygons} />
      </MapView>

      {/* Header overlay */}
      <SafeAreaView
        style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
        pointerEvents="none"
      >
        <View className="px-5 pt-2">
          <Text className="text-lg font-bold text-white">My Territory</Text>
          <Text className="text-xs text-neutral-400">
            {polygons.features.length} cell{polygons.features.length !== 1 ? 's' : ''} owned
          </Text>
        </View>
      </SafeAreaView>
    </View>
  )
}
```

- [x] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [x] **Step 3: Commit**

```bash
git add app/'(protected)'/'(tabs)'/territory.tsx
git commit -m "feat(mobile): replace territory stub with live territory map"
```

---

## Task 16: Run all tests + full verification

- [x] **Step 1: Run the full mobile test suite**

```bash
cd apps/mobile
npx jest tests/unit --no-coverage
```

Expected: all tests pass, including the 4 new test files in `tests/unit/maps/`.

- [x] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: zero errors.

- [x] **Step 3: Run expo-doctor**

```bash
npx expo-doctor
```

Expected: no critical errors. If `@rnmapbox/maps` peer dep warnings appear, they are informational.

- [x] **Step 4: Verify abstraction boundary**

```bash
grep -r "from '@rnmapbox/maps'" src/features/running src/features/auth app/ --include="*.tsx" --include="*.ts"
```

Expected: **no matches**. All `@rnmapbox/maps` imports must be confined to `src/features/maps/`.

- [x] **Step 5: Commit final state if clean**

```bash
git add .
git status  # confirm no untracked files remain
git commit -m "chore(mobile): verified â€” all unit tests pass, typecheck clean, abstraction boundary enforced"
```

---

## Checklist Against Spec

| Spec requirement | Task |
|---|---|
| Rename `EXPO_NEXT_PUBLIC_MAPBOX_TOKEN` | Task 1 |
| `@rnmapbox/maps` plugin in app.json | Task 2 |
| MapboxProvider isolates Mapbox init | Task 3 |
| `cellsToFeatureCollection` in shared | Task 4, 5 |
| `RoutePoint`, `TerritoryCollection`, `TerritoryFetchOptions` types | Task 6 |
| `simplifyRoute` (Douglas-Peucker, 3 m) | Task 7 |
| `routePointsToLineString` (correct [lng, lat] order) | Task 7 |
| `fitBoundsFromCoordinates` (with 50 dp padding) | Task 7, Tasks 11â€“12 |
| `fetchRoutePoints` ordered by `recorded_at, batch_seq, point_seq` | Task 8 |
| `fetchTerritory({ scope: 'me' })` with `LIMIT 5000` | Task 9 |
| `MapView` with `interactive` prop | Task 10 |
| `RouteLayer` fits bounds once, doesn't fight user | Task 11 |
| `TerritoryLayer` FillLayer + LineLayer | Task 12 |
| Mini-map card in workout detail, `interactive={false}` | Task 13 |
| "No route recorded" placeholder | Task 13 |
| Full-screen route viewer at `run/[id]/map` | Task 14 |
| `MAP-TECH-DEBT-001` documented | Task 14 |
| Territory screen with empty state | Task 15 |
| No `@rnmapbox/maps` imports in screen files | Task 16 |

