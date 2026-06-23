# Mobile Feature Roadmap

## Overview

Four phases from current scaffold to full web parity. Each phase builds on the previous and produces a testable, shippable increment.

**Current baseline:** Expo SDK 54, auth complete, basic dashboard + profile scaffolds.

---

## Phase 1 — Foundation Hardening (Sprint 1–2)

**Goal:** Fix data correctness in existing screens, add bottom tab navigation, and lay the navigation architecture before building features on top.

**Deliverables:**

### 1.1 — Fix Dashboard Data

- Replace `profiles.total_xp` with live query from `user_xp` table
- Replace `profiles.total_distance_m` with `SUM(workouts.distance_m WHERE status='completed')`
- Add recent activity feed (last 5 workouts from `workouts` table)
- Add weekly XP stat (7-day `xp_events` sum)

**Verification:** Dashboard shows correct, live XP and distance.

### 1.2 — Fix Profile Data

- Replace stale profile stats with same live queries as dashboard
- Show workout count from `workouts` table
- Show territory cell count from `cell_ownership` table

**Verification:** Profile stats match web dashboard.

### 1.3 — Bottom Tab Navigation

Introduce `expo-router` tab layout with four tabs:

- **Home** (dashboard)
- **Run** (recording entry point)
- **Territory** (map entry point — placeholder screen initially)
- **Profile** (existing profile screen)

**Verification:** Tab bar renders; all tabs navigate correctly; protected guard still works.

### 1.4 — XP Screen

Create `/(protected)/xp.tsx`:
- Current level + level badge
- XP progress bar
- Recent XP events list from `xp_events` table
- XP breakdown by type (workout/capture/steal)

**Verification:** Screen loads and displays accurate data.

### 1.5 — Run History Screen

Create `/(protected)/run/index.tsx` (or `/(protected)/history.tsx`):
- List of completed workouts ordered by date
- Each row: date, distance, duration, pace
- Tap → navigate to run detail (placeholder initially)

**Verification:** List loads; matches web `/run/history`.

---

## Phase 2 — Run Recording (Sprint 3–5)

**Goal:** Core run recording with GPS, route capture, and finalize flow. This is the primary mobile-native feature.

**Prerequisites:**
- Dev build (EAS or `npx expo prebuild`) — Expo Go cannot run `expo-location`
- Edge Function proxy for `finalize_workout` (see Phase 2.5)

### 2.1 — expo-location Setup

- Install `expo-location`
- Add location permission strings to `app.json`
- Create `src/features/running/hooks/useLocation.ts`
  - Wraps `Location.watchPositionAsync()` (foreground only)
  - Applies accuracy filter (30m gate, mirrors web `sample-filter.ts`)
  - Exposes: `position`, `permissionStatus`, `error`

**Verification:** Location permission prompts correctly; coordinates stream in real-time.

### 2.2 — GPS Sample Buffer

- Create `src/features/running/services/sampleBuffer.ts`
  - Buffers GPS samples
  - Periodic flush (every 10 samples or 10 seconds)
  - Writes directly to `route_points` table via Supabase (not via POST API — mobile writes directly)
- Create `src/features/running/utils/distanceTracker.ts`
  - Running Haversine sum for live distance display

**Verification:** Route points accumulate in Supabase during a test run.

### 2.3 — Workout Lifecycle (Start / Stop / Discard)

- Create `src/features/running/services/workout.ts`:
  - `startWorkout(userId)` → INSERT into `workouts` (status='recording')
  - `discardWorkout(workoutId)` → UPDATE status='discarded'
  - `finalizeWorkout(workoutId)` → call Edge Function proxy (see 2.5)
- Create `src/features/running/hooks/useWorkoutRecorder.ts`
  - State machine: idle → recording → stopped
  - Composes useLocation + sampleBuffer + workout service

**Verification:** State transitions work; workouts appear in Supabase.

### 2.4 — Run Recording Screen

Create `/(protected)/run/record.tsx`:
- "Start Run" button → transitions to recording state
- Live metrics: distance, duration (timer), GPS quality
- "Stop" button → finalizes workout
- "Discard" button → cancels

**Verification:** Full run flow completes; workout saved in Supabase.

### 2.5 — finalize_workout Edge Function Proxy

**This is a blocker for stopping runs.**

Create Supabase Edge Function `finalize-workout`:
- Accepts: `{ workoutId: string, userId: string }`
- Verifies JWT (auth.uid() === userId)
- Derives `cell_ids` from `route_points` using shared `captureCells()` logic (or reimplements in Deno)
- Calls `finalize_workout(workoutId, cellIds, userId)` RPC with service-role client
- Returns: `{ xpAwarded, cellsClaimed, cellsStolen, cellsDefended, newLevel }`

**Verification:** Edge Function deployed; calling it from mobile produces correct workout finalization.

### 2.6 — Post-Run Summary Screen

Create `/(protected)/run/summary.tsx`:
- XP earned (total + breakdown)
- Territory impact (claimed / stolen / defended)
- Level-up modal if level increased
- Actions: "View Detail", "Run Again", "Dashboard"

**Verification:** Summary shows correct data after a completed run.

---

## Phase 3 — Maps & Territory (Sprint 6–8)

**Goal:** Map-based features — run routes, territory visualization, H3 cell ownership.

**Prerequisites:**
- `@rnmapbox/maps` installed with Mapbox token (already in `.env`)
- Dev build with Mapbox native module

### 3.1 — Base Map Component

Create `src/components/map/BaseMap.tsx`:
- Wraps `@rnmapbox/maps` `MapView`
- Exposes: `style`, `center`, `zoom`, `children`
- Dark/satellite style selector

**Verification:** Map renders in a test screen.

### 3.2 — Route Layer

Create `src/components/map/RouteLayer.tsx`:
- Accepts `routePoints: LatLng[]`
- Renders `LineLayer` on `ShapeSource`
- Color: emerald (#10b981)

**Verification:** Polyline renders on map for a test route.

### 3.3 — Run Detail Screen (Basic)

Create `/(protected)/run/[id].tsx`:
- Summary stats header (distance, duration, pace, elevation gain)
- Route map with polyline
- Territory captures as markers
- Splits table

**Verification:** Workout detail loads; map shows route.

### 3.4 — Territory Cell Layer

Create `src/components/map/TerritoryLayer.tsx`:
- Fetches owned cells from `cell_ownership`
- Converts H3 cells → GeoJSON polygons using `h3-js`
- Renders `FillLayer` with ownership colors (owned = emerald, others = gray)

**Verification:** Owned cells render as hexagon polygons on the territory map.

### 3.5 — Territory Screen

Create `/(protected)/territory.tsx`:
- Full-screen map
- Owned cells layer
- Stats overlay card (cells owned, total captures)
- Center-on-user button

**Verification:** Territory map shows all owned cells.

### 3.6 — Live Map During Run (Optional in Phase 3)

Add map to the run recording screen showing:
- Current location marker
- Route drawn so far (live update)
- H3 cells being traversed (highlight)

**Verification:** Map updates in real-time during a run.

---

## Phase 4 — Full Feature Parity (Sprint 9–12)

**Goal:** Complete remaining web features and polish for public release.

### 4.1 — Achievements Screen

Create `/(protected)/achievements.tsx`:
- Achievement badges grid (locked/unlocked)
- Personal records section
- Mirror web logic using shared achievement computation

### 4.2 — Leaderboards Screen

Create `/(protected)/leaderboards.tsx`:
- Tab bar: XP / Territory / Distance / Weekly
- Each tab shows ranked list
- Cross-user data via Edge Function proxy (or SECURITY DEFINER view)
- Tap username → public profile

**Prerequisite:** Edge Function for leaderboard data (cross-user RLS bypass).

### 4.3 — Public Profile Screen

Create `/(protected)/profile/[username].tsx`:
- Username lookup via Edge Function or SECURITY DEFINER view
- Shows stats, records, recent activity
- Non-editable

### 4.4 — Run Detail — Charts & Advanced

- Pace/speed chart (using react-native-skia or victory-native)
- Elevation profile chart
- Workout insights cards
- Comparison vs previous run

### 4.5 — Notifications

- Push notification setup (Expo Notifications)
- Level-up notification
- Territory steal notification ("Someone stole your cell!")
- Weekly summary notification

### 4.6 — Settings Screen

Create `/(protected)/settings.tsx`:
- Dark/light theme toggle
- Account info display
- Delete account option
- Notification preferences

### 4.7 — Share Feature

- Use `react-native-view-shot` or Skia to export workout cards as images
- Share via native share sheet (`expo-sharing`)
- Card templates: Workout, Level-up, Achievement, PR

### 4.8 — Offline Resilience

- Queue GPS batches in SQLite/MMKV if network unavailable
- Retry on reconnect
- Graceful error messages for offline states

---

## Implementation Order Summary

```
Phase 1: Foundation (no GPS, no maps, no new dependencies)
  1.1 Fix dashboard data
  1.2 Fix profile data
  1.3 Tab navigation
  1.4 XP screen
  1.5 Run history list

Phase 2: Run Recording (requires dev build)
  2.1 expo-location setup
  2.2 GPS sample buffer
  2.3 Workout lifecycle
  2.4 Run recording screen
  2.5 Edge Function proxy ← BLOCKER
  2.6 Post-run summary

Phase 3: Maps & Territory (requires Mapbox dev build)
  3.1 Base map component
  3.2 Route layer
  3.3 Run detail (basic)
  3.4 Territory cell layer
  3.5 Territory screen
  3.6 Live map during run

Phase 4: Full Parity (polish + advanced features)
  4.1 Achievements
  4.2 Leaderboards
  4.3 Public profiles
  4.4 Run detail charts
  4.5 Push notifications
  4.6 Settings
  4.7 Share
  4.8 Offline resilience
```

---

## Estimated Timeline

| Phase | Sprint | Scope | Gate |
|---|---|---|---|
| 1 | 1–2 | Data fixes, tabs, XP screen, history list | All typecheck + jest unit tests pass |
| 2 | 3–5 | GPS recording, finalize Edge Function, post-run summary | End-to-end run flow works on dev build |
| 3 | 6–8 | Mapbox maps, run detail, territory screen | Territory and route maps render correctly |
| 4 | 9–12 | Achievements, leaderboards, notifications, share, polish | Feature parity checklist passes |
