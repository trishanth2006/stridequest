# StrideQuest Mobile — Route Map & Territory Map

**Date:** 2026-06-22  
**Branch:** feat/monorepo-mobile  
**Status:** Approved — ready for implementation plan

---

## Decision Summary

- **Map SDK:** `@rnmapbox/maps` (Mapbox GL Native for React Native)
- **Build pipeline:** EAS Build (handles native compile; no local Gradle required)
- **Data fetching:** `useState` + `useEffect` (matches existing service pattern; no React Query for v1)
- **Territory scope:** Own cells only (`scope: 'me'`; extensible via options object)
- **Empty route state:** Show "No route recorded" placeholder card (don't hide the card)
- **Mini-map tap:** Push full-screen route viewer

---

## Architecture

### Feature module

```
apps/mobile/src/features/maps/
├── types.ts
├── providers/
│   └── MapboxProvider.tsx
├── components/
│   ├── MapView.tsx
│   ├── RouteLayer.tsx
│   └── TerritoryLayer.tsx
├── services/
│   ├── route.ts
│   └── territory.ts
└── utils/
    └── geojson.ts
```

### Screens touched

```
apps/mobile/app/(protected)/(tabs)/run/[id].tsx      # add route mini-map card
apps/mobile/app/(protected)/(tabs)/run/[id]/map.tsx  # NEW: full-screen route viewer
apps/mobile/app/(protected)/(tabs)/territory.tsx      # full replacement
apps/mobile/app/_layout.tsx                          # add <MapboxProvider>
```

### Config changes

```
apps/mobile/.env             # rename EXPO_NEXT_PUBLIC_MAPBOX_TOKEN → EXPO_PUBLIC_MAPBOX_TOKEN
apps/mobile/.env.example     # already correct; no change needed
apps/mobile/app.json         # add @rnmapbox/maps plugin
apps/mobile/package.json     # add @rnmapbox/maps dependency
packages/shared/package.json # geojson @types/geojson already present; no change needed
```

**No `h3-js` in mobile:** Polygon generation belongs in the shared package. Add `packages/shared/src/territory/polygon.ts` exporting `cellToPolygon()` and `cellsToFeatureCollection()`. Mobile, web, and future dashboards all consume the same conversion logic. Mobile only receives a finished `FeatureCollection<Polygon>` and never touches H3 internals.

---

## Types (`src/features/maps/types.ts`)

```ts
import type { Feature, Polygon, FeatureCollection } from 'geojson'

export type RoutePoint = { lat: number; lng: number }

export type TerritoryPolygon = Feature<Polygon>
export type TerritoryCollection = FeatureCollection<Polygon>

export type TerritoryFetchOptions = { scope: 'me' }
```

All map-feature types live here. Do not scatter them into screen files.

---

## GeoJSON Utilities (`utils/geojson.ts`)

```ts
simplifyRoute(points: RoutePoint[], toleranceM?: number): RoutePoint[]
routePointsToLineString(points: RoutePoint[]): Feature<LineString>
cellsToFeatureCollection(cellIds: string[]): TerritoryCollection
fitBoundsFromCoordinates(coords: [number, number][]): { ne: [number, number]; sw: [number, number] }
```

### Route simplification

Use Douglas-Peucker at 3 m tolerance (default). Pipeline:

```
fetchRoutePoints()
  → simplifyRoute()
  → routePointsToLineString()
  → RouteLayer
```

Rationale: a 10 K run at 1 Hz produces ~5 000 points. After simplification, typically 200–500 remain. Smaller GeoJSON = faster Mapbox rendering and lower memory on older Android devices.

### GeoJSON coordinate order

`h3-js` `cellToBoundary()` returns `[lat, lng]` pairs. GeoJSON requires `[lng, lat]`. Always swap when converting H3 boundaries.

### Polygon conversion

`cellsToFeatureCollection` lives in `packages/shared/src/territory/polygon.ts` and calls `cellToBoundary` from `h3-js` (already a shared dep). It wraps each result in a GeoJSON Polygon Feature, swapping `[lat, lng]` → `[lng, lat]`. The mobile `maps/utils/geojson.ts` re-exports it or calls it directly via `@stridequest/shared/territory`. Mobile never imports from `h3-js` directly.

---

## Provider (`providers/MapboxProvider.tsx`)

```tsx
import MapboxGL from '@rnmapbox/maps'

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN!)
MapboxGL.setTelemetryEnabled(false)

export function MapboxProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

Wrapped in `app/_layout.tsx` around the Stack navigator. If Mapbox initialization changes (offline packs, MapLibre migration, telemetry opt-in), this is the only file to touch.

---

## Map Abstraction Components

### `MapView.tsx`

Thin wrapper around `MapboxGL.MapView`. Props: `style?`, `children`, `interactive?` (default `true`).

```tsx
<MapboxGL.MapView
  style={style ?? { flex: 1 }}
  styleURL={MapboxGL.StyleURL.Dark}
  scrollEnabled={interactive}
  zoomEnabled={interactive}
  pitchEnabled={interactive}
  rotateEnabled={interactive}
>
  {children}
</MapboxGL.MapView>
```

All camera and layer decisions belong to child components.

**Why `interactive` prop:** `MapboxGL.MapView` is a native view that consumes touch events before React Native's `Pressable` can intercept them. The mini-map card uses `<MapView interactive={false}>` so the wrapping `Pressable` receives the tap and navigates to the full-screen viewer. The full-screen viewer uses the default `interactive={true}`.

### `RouteLayer.tsx`

Props: `points: RoutePoint[]`

Behavior:
- Returns `null` if `points.length === 0`
- Calls `simplifyRoute()` → `routePointsToLineString()` → `fitBoundsFromCoordinates()`
- Renders `MapboxGL.Camera` (fitBounds, `animated={false}` so it fits once on mount)
- Renders `MapboxGL.ShapeSource` + `MapboxGL.LineLayer`
  - Color: emerald `#10b981`
  - Width: 3
  - Cap: round, Join: round

Camera note: set bounds **once on mount** via a ref guard. Do not re-call `fitBounds` on every render. Let the user pan and zoom freely after the initial fit.

### `TerritoryLayer.tsx`

Props: `data: TerritoryCollection`

Behavior:
- Returns `null` if `data.features.length === 0`
- Calls `fitBoundsFromCoordinates()` across all polygon coordinates
- Renders `MapboxGL.Camera` (fitBounds, `animated={false}`)
- Renders `MapboxGL.ShapeSource` + `MapboxGL.FillLayer` (fill `#10b981` at 40% opacity) + `MapboxGL.LineLayer` (stroke `#10b981`, width 1)

---

## Services

### `services/route.ts`

```ts
fetchRoutePoints(workoutId: string): Promise<RoutePoint[]>
```

Query:
```sql
SELECT lat, lng
FROM route_points
WHERE workout_id = $1
ORDER BY recorded_at ASC, batch_seq ASC, point_seq ASC
```

Returns `[]` on error or no rows. The DB shape (`recorded_at`, etc.) never leaks out of this service.

### `services/territory.ts`

```ts
fetchTerritory(options: TerritoryFetchOptions): Promise<TerritoryCollection>
```

Query (`scope: 'me'`):
```sql
SELECT cell_id
FROM cell_ownership
WHERE owner_user_id = auth.uid()
LIMIT 5000
```

Select only `cell_id` — no `select *`. The `LIMIT 5000` is a safety cap: at current scale it will never be hit, but prevents a power-user rendering incident six months from now.

After fetching, calls `cellsToFeatureCollection(cellIds)` and returns the `TerritoryCollection` directly.

---

## Screens

### `run/[id].tsx` — workout detail (modified)

- One `useEffect` fetches both `workout` and `routePoints` (no duplicate Supabase queries)
- Route card:
  - Loading: full-screen `ActivityIndicator` (existing behavior)
  - Empty (`routePoints.length === 0`): card with "No route recorded" text
  - Has route: 160 px tall `<MapView interactive={false}>` + `<RouteLayer>` wrapped in `<Pressable>` → `router.push('/run/' + id + '/map')`
  - `interactive={false}` disables scroll/zoom/pitch/rotate so the Pressable receives the tap

### `run/[id]/map.tsx` — full-screen route viewer (new)

- Fetches `routePoints` independently on mount
- Full-screen `<MapView>` + `<RouteLayer>`
- Back button overlay (top-left)

> **MAP-TECH-DEBT-001:** Full-screen map re-fetches `route_points` independently from the detail screen. For v1 this is acceptable (small payload, fast query). Future fix: pass route through navigation params or a lightweight in-memory cache to avoid the duplicate fetch.

### `territory.tsx` — territory map (replacement)

- Fetches `fetchTerritory({ scope: 'me' })` on mount
- Loading: `ActivityIndicator`
- Empty: "No territory captured yet" message
- Full-screen `<MapView>` + `<TerritoryLayer>`

---

## `app.json` plugin entry

```json
["@rnmapbox/maps", { "RNMapboxMapsImpl": "mapbox", "RNMapboxMapsVersion": "11.8.0" }]
```

EAS Build reads this and links the native Mapbox SDK during the Android compile step.

> **Version note:** `11.8.0` is the version at spec time. Verify the current stable release of `@rnmapbox/maps` at install time and update `RNMapboxMapsVersion` to match. The JS package version and native SDK version must align.

## Camera padding

`fitBoundsFromCoordinates` should return bounds with a **50 dp padding** applied, so route polylines and territory polygons don't touch screen edges. Pass `paddingTop/Right/Bottom/Left` to `MapboxGL.Camera`.

---

## Abstraction boundary

Screens and layer components **must not** import directly from `@rnmapbox/maps`. All Mapbox primitives are contained in:

```
MapView.tsx
RouteLayer.tsx
TerritoryLayer.tsx
MapboxProvider.tsx
```

If the team migrates to MapLibre or `react-native-maps`, only these four files change.

---

## Known limitations / explicit non-goals for v1

| Item | Decision |
|---|---|
| React Query / caching | Not in v1. Revisit when leaderboards or friend overlays arrive. |
| Territory cell detail screen (`territory/details/[cellId].tsx`) | Route stub planned; screen not implemented. |
| Elevation profile | Not in scope. `altitude_m` exists in `route_points` but is noisy. |
| Offline maps | Not in scope. |
| Per-workout territory replay | Not in scope. Phase C future work. |
| iOS build | No `ios/` directory. EAS Build for iOS not configured. |

---

## Milestone roadmap

| Milestone | Features |
|---|---|
| **1 (this spec)** | Workout detail route mini-map, full-screen route viewer, territory map |
| **2** | Territory cell detail screen — tap hex → owner / date / XP |
| **3** | Leaderboard map overlays, nearby rivals, territory density heatmap |
| **4** | Friends territory comparison, territory battles, capture history replay |

---

## Verification checklist (after implementation)

```bash
cd apps/mobile
npm install
npm run typecheck
npx expo-doctor
npx expo export -p android   # must complete without error
```

- [ ] `EXPO_PUBLIC_MAPBOX_TOKEN` resolves at runtime (log it in `MapboxProvider` during dev)
- [ ] Route mini-map renders on a completed workout with route data
- [ ] "No route recorded" card renders on a workout without route data
- [ ] Full-screen viewer opens on tap; back button returns to detail
- [ ] Territory screen renders owned cells; empty state shown when zero cells
- [ ] No direct `@rnmapbox/maps` imports in screen files
