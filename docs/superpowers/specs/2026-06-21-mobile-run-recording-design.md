# Mobile Run Recording — Design Spec

**Date:** 2026-06-21  
**Branch:** feat/monorepo-mobile  
**Status:** Approved

---

## 1. Problem

The StrideQuest web app has a complete run recording system: Start / Pause / Resume / Stop / Discard, GPS capture, route point batching, and server-side finalization (distance, XP, territory capture via `finalize_workout` RPC). The mobile app (`apps/mobile`) has only a workout history list — no recording capability at all.

This spec defines how to replicate run recording in the mobile app while sharing domain logic with the web and keeping all privileged operations server-side.

---

## 2. Security Pre-condition (Priority-0)

`EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` in `apps/mobile/.env` must be removed before any recording feature ships.

- Service-role credentials in a mobile app binary can be extracted from the APK/IPA.
- Elevated DB access must never be reachable from a client device.
- Any existing feature that currently uses this key must be migrated to a user-session client (anon key + RLS) or a server-side endpoint.

This is a hard dependency. Recording must not ship until this key is removed.

---

## 3. Architecture (Option D)

```
Mobile (user session / anon key only)
  │
  ├─ Start workout     → Supabase INSERT workouts (RLS: user owns row)
  ├─ Upload GPS points → Supabase INSERT route_points (RLS: user owns workout)
  ├─ Discard workout   → Supabase UPDATE workouts SET status='discarded' (RLS)
  │
  └─ Stop (finalize)   → Supabase Edge Function: finalize-workout
                              │
                              ├─ Verify JWT → userId
                              ├─ Verify workout ownership (SELECT workouts)
                              ├─ Fetch route_points
                              ├─ captureCells() ← @stridequest/shared
                              └─ finalize_workout RPC (service-role)
                                      │
                                      ├─ distance / duration / pace (from route_points)
                                      ├─ territory capture (from p_cell_ids)
                                      ├─ XP award
                                      └─ returns FinalizeResult
```

**Single source of truth:** All XP, territory capture, ownership, and stat writes happen inside the `finalize_workout` RPC. Neither the Edge Function nor the mobile app duplicates that logic.

**Cell derivation (verified):** The web's `stop.ts` (line 119) calls `captureCells(points)` and passes the resulting cell IDs to the RPC — the RPC itself does not re-derive cells from route_points. The Edge Function uses the identical path: fetch route_points → `captureCells()` (from `@stridequest/shared`) → `finalize_workout(cellIds)`. One implementation of `captureCells`, two callers (web server action + Edge Function), same RPC. No territory divergence.

---

## 4. Shared Package Changes (`packages/shared`)

### 4.1 `sample-filter.ts` (move from `features/running/services/`)

Pure function, no I/O. Accepts a GPS sample, returns `true` if it passes quality gates.

```
packages/shared/src/running/sample-filter.ts
```

Quality gates (unchanged from web):
- accuracy > 30 m → reject
- distance from last accepted point < 5 m → reject
- speed > 12.5 m/s → reject

Both web and mobile import from `@stridequest/shared/running/sample-filter`.

### 4.2 `sample-buffer.ts` — split into engine + transport

The current web implementation mixes buffer state with upload behavior. Extract only the pure engine:

```
packages/shared/src/running/sample-buffer.ts  ← engine only
```

Engine responsibilities:
- Holds pending sample queue
- Monotonic `batchSeq` counter
- Flush rules: flush when `pendingCount >= flushSize` OR interval fires OR `flush()` called
- Exposes `add(sample)`, `flush()`, `stop()`, `pendingCount`, `queuedBatches`

The engine accepts an **injected upload function**:

```typescript
type UploadBatch = (batchSeq: number, samples: GpsSample[]) => Promise<void>
```

Web provides its own `UploadBatch` (fetch to `/api/workouts/[id]/points`).  
Mobile provides its own `UploadBatch` (Supabase INSERT into `route_points`).

The web's existing `sample-buffer.ts` becomes a thin wrapper: imports the shared engine, injects its existing fetch-based uploader.

### 4.3 Route Points RLS (audited)

The INSERT policy on `route_points` (migration `20260601144406`) already enforces ownership:

```sql
WITH CHECK (
  EXISTS (
    SELECT 1 FROM workouts w
    WHERE w.id = route_points.workout_id
      AND w.user_id = auth.uid()
  )
)
```

A user cannot insert points into another user's workout. No migration change needed.

### 4.4 Exports

`packages/shared/src/running/index.ts` exports:
- `sampleFilter` / `SampleFilterConfig`
- `createSampleBuffer` / `SampleBufferConfig` / `UploadBatch`
- `haversineMeters`, `cumulativeDistanceMeters` (already there)
- `formatDistance`, `formatDuration`, `formatPace` (already there)
- `GpsSample`, `LatLng` (already there)

`packages/shared/src/territory/index.ts` exports:
- `captureCells` (already there)

---

## 5. Edge Function: `finalize-workout`

```
supabase/functions/finalize-workout/index.ts
```

### Request

```
POST /functions/v1/finalize-workout
Authorization: Bearer <user JWT>
Content-Type: application/json

{ "workoutId": "<uuid>" }
```

### Flow

1. Extract JWT from Authorization header → call `supabase.auth.getUser()` → `userId`
2. SELECT `workouts` where `id = workoutId AND user_id = userId` → 404 if not found or not owned
3. Verify `status = 'recording'` → 409 if already completed or discarded
4. SELECT `route_points` where `workout_id = workoutId` ordered by `(recorded_at, batch_seq, point_seq)`
5. Call `captureCells(points)` from `@stridequest/shared`
6. Call `finalize_workout(workoutId, cellIds, userId)` using service-role client (credentials in Supabase secrets)
7. Return `200 { workoutId, distanceM, durationS, avgPaceSPerKm, xpAwarded, cellsClaimed, cellsStolen, cellsDefended }`

### Credentials

Service-role key is set via `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...` — never committed, never in client code.

### Error responses

| Condition | Status |
|---|---|
| Missing/invalid JWT | 401 |
| Workout not found or not owned | 404 |
| Already completed/discarded | 409 |
| RPC error | 500 |

---

## 6. Mobile GPS Hook: `useLocation`

```
apps/mobile/src/features/running/hooks/useLocation.ts
```

Wraps `expo-location`'s `watchPositionAsync`. Produces `GpsSample` (same shape as web):

```typescript
type GpsSample = {
  lat: number; lng: number; accuracy: number
  altitude: number | null; speed: number | null; heading: number | null
  recordedAt: string  // ISO-8601
}
```

Responsibilities:
- Request foreground location permission on first call (`Location.requestForegroundPermissionsAsync`)
- Track permission state: `'prompt' | 'granted' | 'denied'`
- Start `watchPositionAsync` with `{ accuracy: Location.Accuracy.BestForNavigation }`
- Convert `LocationObject` → `GpsSample`
- Clean up subscription on unmount
- Expose: `permissionStatus`, `hasFix`, `lastSample`, `startWatch(onSample)`, `stopWatch()`

---

## 7. Mobile Workout Recorder Hook: `useWorkoutRecorder`

```
apps/mobile/src/features/running/hooks/useWorkoutRecorder.ts
```

Mirrors the web's `useWorkoutRecorder` state machine. Uses `useLocation` for GPS.

### State machine

```
idle → recording → paused → recording → stopped
              ↘               ↙
               discarded (from recording or paused)
```

### Methods

| Method | Description |
|---|---|
| `start(workoutId)` | idle → recording; init buffer, start GPS watch |
| `pause()` | recording → paused; stop watch, flush pending samples |
| `resume()` | paused → recording; restart watch, reset anchor (prevents phantom distance) |
| `stop()` | recording\|paused → stopped; flush + drain buffer |
| `discard()` | recording\|paused → discarded; stop watch, discard pending |

### Values

| Value | Type | Description |
|---|---|---|
| `status` | `RecorderStatus` | Current state |
| `distanceMeters` | `number` | Live estimate (non-authoritative; server recomputes) |
| `elapsedSeconds` | `number` | Elapsed wall-clock since start (counts during recording, frozen during pause) |
| `hasFix` | `boolean` | True once GPS produces any fix |
| `permissionStatus` | `'prompt' \| 'granted' \| 'denied'` | Location permission |

### Upload function (injected via constructor)

Mobile's buffer upload fn: direct Supabase INSERT into `route_points` using user-session client. RLS ensures the user can only insert into their own workout.

---

## 8. Workout Service: `workout.ts`

```
apps/mobile/src/features/running/services/workout.ts
```

```typescript
startWorkout(): Promise<{ workoutId: string }>
// INSERT workouts (status='recording', source='mobile', user_id from session)
// Throws on duplicate active workout (Postgres 23505 from partial unique index)

discardWorkout(workoutId: string): Promise<void>
// UPDATE workouts SET status='discarded' WHERE id AND user_id
// RLS enforced

finalizeWorkout(workoutId: string): Promise<FinalizeResult>
// POST to Edge Function finalize-workout
// Passes user JWT from Supabase session
// Returns FinalizeResult

getActiveWorkout(): Promise<ActiveWorkout | null>
// SELECT * FROM workouts WHERE status='recording' AND user_id=current_user LIMIT 1
// Used for recovery on app launch
```

---

## 9. Recording Screen

```
apps/mobile/app/(protected)/record.tsx
```

Presented as a **full-screen modal** (Expo Router `presentation: "modal"`).

### Navigation entry point

A "Start Run" button (FAB or prominent button) is added to the existing run history screen:
`apps/mobile/app/(protected)/(tabs)/run/index.tsx`

Tapping it navigates to `/record`.

### Screen phases

| Phase | UI |
|---|---|
| `idle` | GPS status chip, "Start Run" button (disabled until `hasFix`), permission prompt if denied |
| `recording` | Live distance / elapsed time / current pace; Pause button, Discard button |
| `paused` | Metrics frozen; Resume button, "End Run" button, Discard button |
| `stopped` | Loading indicator ("Saving your run...") while Edge Function call completes |
| `completed` | Summary card: distance / duration / pace / XP earned / cells claimed; "Done" button closes modal |
| `discarded` | Confirmation message; "Start Again" button, "Back to History" button |

### Discard confirmation

Tapping Discard shows an in-screen confirmation (not a native alert) before calling `discardWorkout()`.

---

## 10. Workout Recovery Flow

On app launch (inside the auth-protected layout), call `getActiveWorkout()`.

If a `status='recording'` workout is found:
- Navigate to `/record`
- Restore recorder into `paused` state (GPS is off; user decides to resume or end)
- Display a "You have an unfinished run" banner with Resume / End / Discard options

This covers: app crash, phone restart, background kill.

Recovery is not attempted for `completed` or `discarded` workouts.

---

## 11. Local Recorder State (AsyncStorage Recovery)

When the recorder transitions into `recording` state, persist minimal state to AsyncStorage:

```typescript
type PersistedRecorderState = {
  workoutId: string
  startedAt: string       // ISO-8601
  elapsedBeforePauseMs: number  // accumulates across pause/resume cycles
}
```

**Write:** On every `start()`, `pause()`, `resume()`, update AsyncStorage key `@stridequest/active-recorder`.

**Clear:** On `stop()` or `discard()`, delete the key.

**Read:** On recovery (app launch with active workout), read this key to restore:
- `workoutId` → passed to recorder for buffer uploads and finalize
- `startedAt` → used to display correct elapsed time (not reset to 0)
- `elapsedBeforePauseMs` → accumulated pause-period offset so the timer is continuous

Without this, a user whose app restarts mid-run would see their timer reset to zero even though the workout row still exists in the database with the original `started_at`.

**Key:** `@stridequest/active-recorder`  
**Library:** `@react-native-async-storage/async-storage` (already a common Expo dependency; confirm if already installed before adding)

---

## 12. Existing Web Changes

- Update web imports of `sample-filter.ts` → `@stridequest/shared`
- Refactor `sample-buffer.ts` to use shared engine with injected fetch-based uploader
- No behavioral change to web recording flow

---

## 13. Required Permissions (app.json)

```json
{
  "ios": {
    "infoPlist": {
      "NSLocationWhenInUseUsageDescription": "StrideQuest needs your location to track your run."
    }
  },
  "android": {
    "permissions": ["ACCESS_FINE_LOCATION"]
  }
}
```

---

## 14. New Dependencies

```bash
cd apps/mobile
npx expo install expo-location
```

Also confirm `@react-native-async-storage/async-storage` is installed (needed for recorder state persistence). If not:

```bash
cd apps/mobile
npx expo install @react-native-async-storage/async-storage
```

Deno environment for Edge Function — no additional npm dependencies (imports from `@stridequest/shared` via npm specifier in the function).

---

## 15. Verification Gates (mandatory before feature complete)

### Automated

```bash
npm run lint
npm run typecheck
npx jest tests/unit
```

These must all pass before any PR is opened.

### Manual gameplay-loop verification (on device/simulator)

The entire run → reward → territory loop must be validated end-to-end, not just the recording mechanics:

| Step | Expected |
|---|---|
| 1. Tap "Start Run" | Permission prompt (first time); GPS chip appears; "Start Run" button activates on fix |
| 2. Start run, walk 50–100 m | Live distance and elapsed time update; GPS accuracy shown |
| 3. Pause run | Metrics freeze; Resume and "End Run" buttons appear |
| 4. Resume run | Metrics resume from where they stopped; timer continuity confirmed |
| 5. Stop run | "Saving your run..." loading state |
| 6. Finalization complete | Summary screen: distance / duration / pace populated correctly |
| 7. XP awarded | XP amount shown on summary screen; verified in user_xp table |
| 8. Territory captured | Cell counts shown (claimed / stolen / defended) |
| 9. Navigate to history | New workout appears at top of list |
| 10. Tap workout detail | Correct distance / duration / pace / XP displayed |
| 11. Check leaderboard | User's XP ranking updated |
| 12. Kill app mid-run, reopen | "You have an unfinished run" recovery banner; timer shows correct elapsed time |
| 13. Discard run | Confirmation shown; workout not in history |
| 14. GPS denied | Idle phase shows permission prompt; Start button disabled |

Steps 6–11 validate the complete gameplay loop. Recording alone is not sufficient.

---

## 16. Test Coverage (mandatory)

| Test | File |
|---|---|
| Start workout — success | `tests/unit/running/workout-service.test.ts` |
| Start workout — duplicate active (23505) | same |
| Discard workout | same |
| `getActiveWorkout` — none found | same |
| `getActiveWorkout` — found | same |
| Sample filter — rejects inaccurate | `tests/unit/running/sample-filter.test.ts` |
| Sample filter — rejects micro-distance | same |
| Sample filter — rejects overspeed | same |
| Sample filter — passes valid sample | same |
| Sample buffer — flushes on size | `tests/unit/running/sample-buffer.test.ts` |
| Sample buffer — flushes on interval | same |
| Sample buffer — manual flush | same |
| Sample buffer — stop drains queue | same |
| Recorder state machine — idle → recording | `tests/unit/running/use-workout-recorder.test.ts` |
| Recorder — pause / resume | same |
| Recorder — stop drains buffer | same |
| Recorder — discard | same |
| Recorder — reset anchor on resume | same |
| Edge Function — rejects missing JWT | `tests/integration/finalize-workout.test.ts` |
| Edge Function — rejects wrong owner | same |
| Edge Function — rejects non-recording status | same |
| Edge Function — happy path returns FinalizeResult | same |
| Edge Function — idempotent re-call | same |
| GPS permission denied → idle phase shows prompt | `tests/unit/running/use-location.test.ts` |
| GPS permission granted → watch starts | same |
| Recovery — no active workout → no redirect | `tests/unit/running/recovery.test.ts` |
| Recovery — active workout → navigate to /record in paused state | same |

---

## 17. Out of Scope (this spec)

- Mapbox route polyline on workout detail (follow-on spec)
- Territory map / cell ownership overlay (follow-on spec)
- Background GPS tracking (GPS stops if app backgrounds — acceptable for MVP)
- Offline queue / persistence (route points lost if app crashes mid-batch — acceptable for MVP)

---

## 18. Pre-conditions

Before implementation begins:

1. Remove `EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` from `apps/mobile/.env` and audit all usages
2. Confirm `finalize_workout` RPC is production-ready (it is, per existing web usage)
3. Confirm iOS/Android location permissions are not already in `app.json` (avoid duplicate entries)
4. Confirm `expo-location` is not already installed in `apps/mobile/package.json`
