# Wear OS Sensor Relay — Phase 1 Design

## Context

StrideQuest is adding a Wear OS companion app. Phase 1 scope: the watch acts purely as a
Bluetooth sensor relay — it reads heart rate and step count via Google Health Services and
streams them to the paired phone, where the existing `MotionEngine` (in
`apps/mobile/src/features/running/engine/`) can consume them. The watch does not own any part
of the run lifecycle; the phone's `MotionEngine` / `StateMachine` remain the single authority
for run state. Phase 2 (HR-zone HUD, watch-side standalone tracking, etc.) is out of scope.

## Goals

- Watch reads HR + cumulative steps from Health Services and broadcasts them ~1×/sec.
- Phone receives the broadcast and surfaces it as a typed event.
- A React hook turns that event stream into data `MotionEngine` can merge into its existing
  sensor snapshot, scoped to the lifetime of an active recording session only.
- Survive `expo prebuild` / EAS builds (the existing `apps/mobile/android/` tree is gitignored
  and regenerated — see CLAUDE.md's monorepo rules and "Known Resolved Issues").

## Non-goals

- No watch-side exercise/workout session (no `ExerciseClient`, no Health Connect writes).
- No use of heart rate in the confidence/state-machine pipeline yet — stored as inert telemetry.
- No iOS / watchOS equivalent in this phase.
- No always-on background relay — listening is scoped to an active run.

## Architecture

```
Wear OS watch                                    Phone (apps/mobile)
┌──────────────────────────┐                      ┌─────────────────────────────────────┐
│ SensorRelayService.kt     │  /stridequest/sensors │ modules/wearable-bridge (Expo Module)│
│ PassiveMonitoringClient   │ ──MessageClient─────▶ │  WearableBridgeModule.kt              │
│ (HR + cumulative steps)   │   JSON payload, ~1Hz   │   → emits 'onWearableDataReceived'    │
└──────────────────────────┘                        └──────────────────┬────────────────────┘
                                                                         ▼
                                              useWearableSensors({ enabled }) hook
                                                                         ▼
                                              MotionEngine.injectWearableSnapshot()
                                                                         ▼
                                                          SensorManager (merges, prefers
                                                          wearable step count when present)
```

## Components

### 1. Wear OS — `apps/wearos/app/src/main/java/com/stridequest/wearos/service/SensorRelayService.kt`

- **API choice: `PassiveMonitoringClient`, not `ExerciseClient`.** `ExerciseClient` owns a full
  Health Services exercise session (its own lifecycle, Health Connect writes, activity-type
  state). The phone's `MotionEngine`/`StateMachine` is the authoritative run state machine —
  starting a second, redundant exercise session on the watch would create two competing sources
  of truth. `PassiveMonitoringClient.setPassiveListenerCallback` delivers HR + cumulative daily
  step deltas in the background without claiming an active "workout" on the OS.
- Runs as a foreground `Service` (required for sustained sensor access and to satisfy Android
  14's health-data foreground-service-type rules) with a visible "Relay active" notification.
- Buffers the latest HR (`DataType.HEART_RATE_BPM`) and steps (`DataType.STEPS_DAILY`, delta
  against a session-start offset, mirroring the same start-offset pattern `SensorManager.ts`
  already uses for the phone's own pedometer) from the passive callback.
- On a 1-second ticker, sends the buffered snapshot via
  `Wearable.getMessageClient(this).sendMessage(nodeId, "/stridequest/sensors", jsonBytes)` to
  all connected nodes.
- Payload: JSON string `{ "hr": number|null, "steps": number|null, "ts": number }`. `null` for
  any field whose sensor is unsupported or whose permission was denied — the relay degrades
  gracefully rather than failing entirely.
- `MainActivity` requests `BODY_SENSORS` + `ACTIVITY_RECOGNITION` runtime permissions before
  starting the service; service does not start without at least one granted.
- New Gradle dependency: `androidx.health:health-services-client` in
  `apps/wearos/app/build.gradle.kts` (`play-services-wearable` is already present).

### 2. Phone bridge — `apps/mobile/modules/wearable-bridge/` (local Expo Module)

Authored with the **Expo Modules API**, not the legacy RN bridge — this supersedes the literal
`ReactContextBaseJavaModule` / `DeviceEventManagerModule.RCTDeviceEventEmitter` /
`NativeEventEmitter` pattern from the original task brief, because a module living outside the
gitignored `apps/mobile/android/` tree only survives `expo prebuild` if it's a proper
autolinked Expo Module.

- `expo-module.config.json` — declares `{ "platforms": ["android"] }` and the module name.
- `android/build.gradle` — module-level Gradle file, adds
  `com.google.android.gms:play-services-wearable`.
- `android/src/main/java/com/stridequest/wearable/WearableBridgeModule.kt` — extends
  `expo.modules.kotlin.modules.Module`, implements `MessageClient.OnMessageReceivedListener`.
  Registers the listener in the module's `OnCreate` lifecycle hook, unregisters in `OnDestroy`.
  Declares `Events("onWearableDataReceived")`. On message receipt at path
  `/stridequest/sensors`, decodes the JSON payload and calls
  `sendEvent("onWearableDataReceived", mapOf("hr" to ..., "steps" to ..., "ts" to ...))`.
- `src/index.ts` — thin typed wrapper using `requireNativeModule('WearableBridge')` and Expo's
  `EventEmitter` (from `expo-modules-core`), not `NativeEventEmitter`.
- `apps/mobile/app.json` — add `"./modules/wearable-bridge"` to the `plugins` array. (Per your
  direction: explicit listing over relying purely on directory-scan autolinking, for
  reliability.)

### 3. `apps/mobile/src/features/running/hooks/useWearableSensors.ts`

- Signature: `useWearableSensors({ enabled }: { enabled: boolean })`.
- Subscribes to the bridge's `onWearableDataReceived` event only while `enabled` is `true`;
  unsubscribes when `enabled` flips to `false` or on unmount. `enabled` is driven by
  `useWorkoutRecorder`'s active-recording state — no listening happens outside an active run.
- Parses each event into `{ heartRateBpm: number | null, stepCount: number | null, ts: number }`
  and exposes the latest reading.
- Returns the latest reading; does not call into `MotionEngine` itself — the caller
  (`useWorkoutRecorder`) owns wiring it into the engine, keeping this hook a pure data source.

### 4. `MotionEngine` integration

- `MotionTypes.ts` — add `heartRateBpm: number | null` to `SensorSnapshot`.
- `SensorManager.ts` — add `mergeWearableData(data: { heartRateBpm: number | null; stepCount:
  number | null; stepFrequencyHz: number | null }): void`. Overlays onto the snapshot returned
  by `getSnapshot()`: wearable `stepCount` / `stepFrequencyHz` wins over the phone's own
  `expo-sensors` `Pedometer` reading when the wearable value is non-null; `heartRateBpm` is
  always carried through (no existing consumer reads it from `MotionFeatures`/confidence calc —
  it's inert telemetry, laying groundwork for a future HR-zone HUD without touching the FSM).
- `MotionEngine.ts` — new public method `injectWearableSnapshot(data)` that forwards to
  `sensorManager.mergeWearableData(data)`. `useWorkoutRecorder` calls this from an effect
  watching `useWearableSensors`'s latest reading while recording.

## Data flow / payload contract

```
Watch → Phone: { "hr": number | null, "steps": number | null, "ts": number }  (path: /stridequest/sensors, ~1 Hz)
Bridge → JS:   onWearableDataReceived({ hr, steps, ts })
Hook → caller: { heartRateBpm: number | null, stepCount: number | null, ts: number }
```

## Error handling / edge cases

- Watch sensor unsupported or permission denied → that field sent as `null`; relay continues
  for the other field.
- No paired/connected node → `MessageClient.sendMessage` fails silently per-tick; service keeps
  running and retries on the next tick (no exponential backoff needed at 1 Hz).
- Phone-side bridge module not present (e.g. iOS, or Android build without the module) →
  `useWearableSensors` no-ops; `MotionEngine` behaves exactly as it does today with no wearable
  connected.
- Stale data: if no message arrives for N seconds while `enabled`, the hook's last reading is
  left as-is (Phase 1 has no staleness/timeout handling — out of scope, phone's own sensors
  remain authoritative regardless).

## Testing

- `tests/unit/engine/` (existing convention): unit tests for `SensorManager.mergeWearableData`
  merge precedence (wearable overrides phone pedometer when non-null; phone value used when
  wearable is null).
- Unit test for the bridge payload JSON decode/encode shape.
- No e2e coverage — cross-device BLE relay between a watch and phone isn't testable in CI;
  manual verification on physical/emulated devices is required before merge.

## Required verification (per CLAUDE.md mobile rules)

```
cd apps/mobile
npm install
npm run typecheck
npx expo-doctor
npx expo export -p android
```

Plus a manual check that `expo prebuild` actually picks up `modules/wearable-bridge` and wires
the `play-services-wearable` dependency into the generated `android/app/build.gradle`.

## Open items for the implementation plan

- Exact `STEPS_DAILY` → interval-delta math on the watch (offset-at-relay-start, matching the
  pattern in `SensorManager.ts`'s `stepWatchStartTs`).
- Whether `WearableBridgeModule` should expose a method to query "is a watch currently
  connected" (capability check) for `useWearableSensors` to expose a `connected: boolean`, or
  whether that's deferred to Phase 2.
