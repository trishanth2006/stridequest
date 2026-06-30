# Daily Quests Cache & Territory Clustering — Design Spec
_Date: 2026-06-30_

## Overview

Phase 3 (Gamification Scaling & Map Performance) closes the remaining gaps in the
Daily Quests Engine UI and adds native Mapbox clustering to the territory map so
the viewport stays legible as captured-cell counts grow into the thousands.

The Quests **backend** (schema, RPCs, edge-function integration) was already
built in [20260624_quests_engine.sql](../../../supabase/migrations/20260624_quests_engine.sql)
and the `finalize-workout` edge function. This spec does not add new quest SQL —
the lazy `ensure_active_quests` top-up (triggered on app open) is kept in place
of a midnight `pg_cron` job, since proactive assignment isn't needed without a
"quests ready" push notification to justify it.

## Scope

1. **Operational** — apply pending quest migrations to remote Supabase, regenerate `database.types.ts`.
2. **Quest UI** — wire `queryCache` into `useQuests`; add staggered entrance animation to `QuestDashboard`.
3. **Map** — split `TerritoryLayer` into a clustered point view (low zoom) and the existing polygon view (high zoom), switching natively via Mapbox zoom-gated layers.

Out of scope: pg_cron midnight assignment, push-notification-on-assignment, any change to `ensure_active_quests` / `apply_quest_progress` / quest evaluator logic.

## Section 1 — Backend (operational only)

No new migrations. Work items:
- `supabase db push` (or MCP `apply_migration`) to land `20260624_quests_engine.sql` and dependents on remote.
- Regenerate `infrastructure/supabase/database.types.ts` from the live schema.
- Verify: `quests`, `user_quests`, `quest_progress`, `quest_contributions` tables exist remotely; RLS read-own policies present; `ensure_active_quests` / `apply_quest_progress` are `service_role`/`authenticated`-gated per the migration header.

## Section 2 — Quest UI

### `useQuests` — queryCache integration

File: [apps/mobile/src/features/quests/hooks/useQuests.ts](../../../apps/mobile/src/features/quests/hooks/useQuests.ts)

Stale-while-revalidate against the existing `src/lib/queryCache.ts` (`queryGet`/`querySet`/`queryInvalidate`):

- Cache key: `` `quests:${userId}` ``, stale window: 30s (consistent with the dashboard's "instant load" requirement — quests change infrequently relative to a session).
- On mount: `queryGet` first. If a fresh entry exists, seed state synchronously (`loading` starts `false`) and skip the network call. If stale/absent, fetch in the background.
- Every successful fetch (cache hit or miss) writes through `querySet`.
- `refresh()` calls `queryInvalidate` then re-fetches unconditionally — used by the dashboard's "Try again" button and pull-to-refresh.

No change to `fetchActiveQuests` (services/quests.ts) or the `ActiveQuest` shape.

### `QuestDashboard` — entrance animation

File: [apps/mobile/src/features/quests/components/QuestDashboard.tsx](../../../apps/mobile/src/features/quests/components/QuestDashboard.tsx)

When the loaded card list first renders (transition from `loading=true`/skeleton to populated list), each `QuestCard` is wrapped in an `Animated.View`:
- `translateY`: `16 → 0`
- `opacity`: `0 → 1`
- `withDelay(index * 80, withTiming(..., { duration: 320 }))` — same stagger cadence already used by `QuestCard`'s internal progress-bar fill, so the two animations read as one coordinated motion.

This wrapping lives in `QuestDashboard`, not inside `QuestCard` — `QuestCard` keeps its existing `index` prop (already used for the progress-bar delay) and gains no new props. Re-renders from cache hits (instant `loading=false` on mount) still animate once; switching the daily/weekly segmented control re-triggers the entrance for the newly visible list (keyed by `duration` so React remounts the wrapped cards).

## Section 3 — Mapbox Territory Clustering

File: [apps/mobile/src/features/maps/components/TerritoryLayer.tsx](../../../apps/mobile/src/features/maps/components/TerritoryLayer.tsx)

### New utility: `computeCentroid`

Added to [apps/mobile/src/features/maps/utils/geojson.ts](../../../apps/mobile/src/features/maps/utils/geojson.ts):
`computeCentroid(ring: [number, number][]): [number, number]` — arithmetic mean of a polygon's outer ring coordinates. Cell polygons are small near-square grid cells, so a coordinate-average centroid is accurate enough for cluster placement (no need for a true polygon-area centroid).

### Two ShapeSources, zoom-gated

**Cluster source (visible zoom < 12):**
- Built once per `data` change: `FeatureCollection<Point>` from `computeCentroid(f.geometry.coordinates[0])` for every territory feature.
- `MapboxGL.ShapeSource` props: `cluster={true}`, `clusterRadius={50}`, `clusterMaxZoomLevel={11}`.
- `CircleLayer` (clustered bubbles): `filter={['has', 'point_count']}`, `maxZoomLevel={12}`, radius interpolated by `point_count` (18px at 1, 28px at 20, 38px at 100+), `circleColor: colors.primary`, `circleOpacity: 0.85`.
- `SymbolLayer` (count label): same filter/maxZoomLevel, `textField: ['get', 'point_count_abbreviated']`, `textColor: colors.background`, `textSize: 13`.
- `CircleLayer` (unclustered singleton): `filter={['!', ['has', 'point_count']]}`, `maxZoomLevel={12}`, radius 6, same primary color family.

**Polygon source (visible zoom ≥ 12):** unchanged `FillLayer` + `LineLayer`, each gains `minZoomLevel={12}`.

The `Camera` bounds-fit logic is untouched. All clustering/visibility switching is native Mapbox engine work — no JS-thread computation per frame, matching the Phase 3 performance goal. `computeCentroid` only re-runs when `data` (the territory collection) changes, same as the existing `bounds` `useMemo`.

### Zoom boundary choice

12 is chosen to match typical "neighborhood" zoom where individual ~quarter-block grid cells become visually distinguishable as polygons; below that, cells overlap into unreadable clutter, which is exactly where clustering should take over.

## Testing

- `computeCentroid`: unit test in `apps/mobile/tests/unit/maps/` — verify centroid of a known square ring.
- `useQuests` cache: unit test verifying `queryGet` short-circuits the fetch on a fresh cache hit, and `refresh()` invalidates before refetching.
- No new tests for `TerritoryLayer`/`QuestDashboard` JSX — Mapbox native layers and Reanimated entrance timing aren't meaningfully unit-testable; covered by manual verification (see Verification below).

## Verification

1. `npx jest tests/unit` — new tests pass, no regressions.
2. `npm run typecheck` (root + `apps/mobile`).
3. Manual: run the migration apply + type regen, confirm `list_tables`/`get_advisors` show no new RLS gaps.
4. Manual (device/emulator): open Quests tab twice in a session — second open should show instant (no skeleton) load; zoom the territory map across the 12 boundary and confirm bubbles ↔ polygons swap cleanly.

## Risks

- **Centroid clustering at very high cell density**: if a user owns thousands of adjacent cells, `point_count_abbreviated` labels (e.g. "1.2k") could collide visually at extreme zoom-outs — acceptable for MVP scope, Mapbox's `clusterRadius` already mitigates overlap.
- **queryCache has no cross-session persistence** (in-memory `Map`, per existing `queryCache.ts` design) — cache resets on app restart, which is consistent with how it's already used elsewhere in the app.
