# Wear OS Sensor Relay (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stream heart rate + step count from a Wear OS watch to the paired phone over the Wearable Data Layer, and merge it into the existing `MotionEngine`'s sensor snapshot while a run is being recorded.

**Architecture:** Watch-side foreground `Service` reads `PassiveMonitoringClient` data and broadcasts a JSON payload over `MessageClient` once per second. Phone-side local Expo Module (Kotlin, Expo Modules API) receives the message and re-emits it as a JS event. A scoped React hook (`useWearableSensors`) subscribes to that event only while a run is recording, and `useWorkoutRecorder` forwards readings into `MotionEngine.injectWearableSnapshot()`, which the existing `SensorManager` merges — preferring wearable step data over the phone's own pedometer, carrying heart rate through as inert telemetry.

**Tech Stack:** Kotlin (Wear OS app, Expo Modules API), `androidx.health:health-services-client`, `play-services-wearable`, Expo SDK 54 local module, React Native (RN 0.81.5 / React 19.1.0), Jest + `@testing-library/react-native`.

**Spec:** `docs/superpowers/specs/2026-06-30-wearos-sensor-relay-design.md`

**Note on resolved toolchain versions:** the repo's installed Expo SDK is 54.0.35 (React 19.1.0, React Native 0.81.5, `expo-modules-core` 3.0.30) — this differs from the `expo 52.0.49 / react 18.3.1 / react-native 0.76.9` versions recorded as "Verified Working" in `CLAUDE.md`'s monorepo rules. That note appears to predate an SDK upgrade that already happened on this branch (`apps/mobile/package.json` already has uncommitted additions of `expo-sensors`/`expo-speech` at SDK-54-compatible versions). This plan targets the versions actually installed (confirmed via `node -p "require('./node_modules/expo/package.json').version"` etc.), not the stale CLAUDE.md figures.

---

## Task 1: `SensorManager.mergeWearableData` — wearable data fusion

**Files:**
- Modify: `apps/mobile/src/features/running/engine/MotionTypes.ts`
- Modify: `apps/mobile/src/features/running/engine/SensorManager.ts`
- Test: `apps/mobile/tests/unit/engine/SensorManager.test.ts` (new file)

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/tests/unit/engine/SensorManager.test.ts`:

```ts
import { SensorManager } from '../../../src/features/running/engine/SensorManager'

describe('SensorManager — mergeWearableData', () => {
  it('defaults heartRateBpm to null before any wearable data arrives', () => {
    const sm = new SensorManager()
    expect(sm.getSnapshot().heartRateBpm).toBeNull()
  })

  it('overrides stepCount and stepFrequencyHz when wearable sends non-null values', () => {
    const sm = new SensorManager()
    sm.mergeWearableData({ heartRateBpm: 142, stepCount: 50, stepFrequencyHz: 2.5 })
    const snapshot = sm.getSnapshot()
    expect(snapshot.stepCount).toBe(50)
    expect(snapshot.stepFrequencyHz).toBe(2.5)
    expect(snapshot.heartRateBpm).toBe(142)
  })

  it('leaves existing wearable stepCount untouched when a later wearable update sends null', () => {
    const sm = new SensorManager()
    sm.mergeWearableData({ heartRateBpm: 142, stepCount: 50, stepFrequencyHz: 2.5 })
    sm.mergeWearableData({ heartRateBpm: 140, stepCount: null, stepFrequencyHz: null })
    const snapshot = sm.getSnapshot()
    expect(snapshot.stepCount).toBe(50)
    expect(snapshot.stepFrequencyHz).toBe(2.5)
    expect(snapshot.heartRateBpm).toBe(140)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/mobile && npx jest tests/unit/engine/SensorManager.test.ts`
Expected: FAIL — `sm.mergeWearableData is not a function` (and/or `heartRateBpm` is `undefined`, not `null`).

- [ ] **Step 3: Add `heartRateBpm` to `SensorSnapshot`**

In `apps/mobile/src/features/running/engine/MotionTypes.ts`, modify the `SensorSnapshot` type:

```ts
export type SensorSnapshot = {
  accelerometer: AccelerometerReading | null
  gyroscope: GyroscopeReading | null
  stepCount: number | null
  stepFrequencyHz: number | null
  heartRateBpm: number | null
}
```

- [ ] **Step 4: Implement `mergeWearableData` in `SensorManager`**

In `apps/mobile/src/features/running/engine/SensorManager.ts`:

1. Add `heartRateBpm: null` to the initial `snapshot` object (around line 16-21):

```ts
  private snapshot: SensorSnapshot = {
    accelerometer: null,
    gyroscope: null,
    stepCount: null,
    stepFrequencyHz: null,
    heartRateBpm: null,
  }
```

2. Add a private flag right below `private powerMode: 'HIGH' | 'LOW' = 'HIGH'`:

```ts
  private wearableStepsActive = false
```

3. Guard the phone pedometer's step update inside `start()` so it stops overwriting step fields once the wearable takes over — change the `Pedometer.watchStepCount` callback body from directly assigning to:

```ts
      const sub = Pedometer.watchStepCount((result) => {
        if (this.wearableStepsActive) return
        const elapsedSecs = (Date.now() - this.stepWatchStartTs) / 1000
        const avgFreqHz = elapsedSecs > 0 ? result.steps / elapsedSecs : 0
        this.snapshot = {
          ...this.snapshot,
          stepCount: result.steps,
          stepFrequencyHz: avgFreqHz,
        }
        onUpdate(this.snapshot)
      })
```

4. Add the new public method, right after `getSnapshot()`:

```ts
  mergeWearableData(data: {
    heartRateBpm: number | null
    stepCount: number | null
    stepFrequencyHz: number | null
  }): void {
    if (data.stepCount !== null) {
      this.wearableStepsActive = true
      this.snapshot = {
        ...this.snapshot,
        stepCount: data.stepCount,
        stepFrequencyHz: data.stepFrequencyHz,
        heartRateBpm: data.heartRateBpm,
      }
      return
    }
    this.snapshot = { ...this.snapshot, heartRateBpm: data.heartRateBpm }
  }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd apps/mobile && npx jest tests/unit/engine/SensorManager.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Typecheck**

Run: `cd apps/mobile && npm run typecheck`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/features/running/engine/MotionTypes.ts apps/mobile/src/features/running/engine/SensorManager.ts apps/mobile/tests/unit/engine/SensorManager.test.ts
git commit -m "feat(mobile): merge wearable HR/step data into SensorManager snapshot"
```

---

## Task 2: `MotionEngine.injectWearableSnapshot`

**Files:**
- Modify: `apps/mobile/src/features/running/engine/MotionEngine.ts`
- Test: `apps/mobile/tests/unit/engine/MotionEngine.test.ts` (new file)

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/tests/unit/engine/MotionEngine.test.ts`:

```ts
import { MotionEngine } from '../../../src/features/running/engine/MotionEngine'

describe('MotionEngine — injectWearableSnapshot', () => {
  it('forwards wearable data into the sensor snapshot', () => {
    const engine = new MotionEngine()
    engine.injectWearableSnapshot({ heartRateBpm: 150, stepCount: 80, stepFrequencyHz: 2.8 })
    const snapshot = engine.getSensorSnapshot()
    expect(snapshot.heartRateBpm).toBe(150)
    expect(snapshot.stepCount).toBe(80)
    expect(snapshot.stepFrequencyHz).toBe(2.8)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/mobile && npx jest tests/unit/engine/MotionEngine.test.ts`
Expected: FAIL — `engine.injectWearableSnapshot is not a function`.

- [ ] **Step 3: Implement**

In `apps/mobile/src/features/running/engine/MotionEngine.ts`:

1. Add `SensorSnapshot` to the type import from `./MotionTypes` (line 3-9):

```ts
import type {
  GPSQuality,
  MotionConfig,
  MotionDiagnostics,
  SampleDecision,
  SensorCapabilities,
  SensorSnapshot,
} from './MotionTypes'
```

2. Add the two new public methods, right after `setPowerMode`:

```ts
  injectWearableSnapshot(data: {
    heartRateBpm: number | null
    stepCount: number | null
    stepFrequencyHz: number | null
  }): void {
    this.sensorManager.mergeWearableData(data)
  }

  getSensorSnapshot(): SensorSnapshot {
    return this.sensorManager.getSnapshot()
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/mobile && npx jest tests/unit/engine/MotionEngine.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full engine test suite + typecheck**

Run: `cd apps/mobile && npx jest tests/unit/engine && npm run typecheck`
Expected: all PASS, no new type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/features/running/engine/MotionEngine.ts apps/mobile/tests/unit/engine/MotionEngine.test.ts
git commit -m "feat(mobile): add MotionEngine.injectWearableSnapshot"
```

---

## Task 3: Wear OS Gradle dependencies

**Files:**
- Modify: `apps/wearos/gradle/libs.versions.toml`
- Modify: `apps/wearos/app/build.gradle.kts`

- [ ] **Step 1: Add version + library entries**

In `apps/wearos/gradle/libs.versions.toml`, add to `[versions]` (after `coreSplashscreen`):

```toml
healthServicesClient = "1.1.0-rc01"
junit = "4.13.2"
```

Add to `[libraries]` (after `core-splashscreen`):

```toml
health-services-client = { group = "androidx.health", name = "health-services-client", version.ref = "healthServicesClient" }
junit = { group = "junit", name = "junit", version.ref = "junit" }
```

- [ ] **Step 2: Add dependencies in `build.gradle.kts`**

In `apps/wearos/app/build.gradle.kts`, add to the `dependencies { }` block:

```kotlin
    implementation(libs.health.services.client)
    testImplementation(libs.junit)
```

- [ ] **Step 3: Verify Gradle sync**

Run: `cd apps/wearos && ./gradlew :app:dependencies --configuration debugRuntimeClasspath 2>&1 | grep -i "health-services-client\|junit:junit"`
Expected: both artifacts listed and resolved (no `FAILED` next to either line). If `health-services-client:1.1.0-rc01` fails to resolve, check `https://developer.android.com/jetpack/androidx/releases/health` for the current stable/rc version and update the `healthServicesClient` version string accordingly.

- [ ] **Step 4: Commit**

```bash
git add apps/wearos/gradle/libs.versions.toml apps/wearos/app/build.gradle.kts
git commit -m "build(wearos): add health-services-client and junit dependencies"
```

---

## Task 4: Wear OS sensor payload codec

**Files:**
- Create: `apps/wearos/app/src/main/java/com/stridequest/wearos/service/SensorPayload.kt`
- Test: `apps/wearos/app/src/test/java/com/stridequest/wearos/service/SensorPayloadTest.kt`

- [ ] **Step 1: Write the failing test**

Create `apps/wearos/app/src/test/java/com/stridequest/wearos/service/SensorPayloadTest.kt`:

```kotlin
package com.stridequest.wearos.service

import org.junit.Assert.assertEquals
import org.junit.Test

class SensorPayloadTest {
    @Test
    fun `builds full payload with both fields present`() {
        val json = buildSensorPayload(heartRateBpm = 142, stepCount = 50, timestampMs = 1700000000000L)
        assertEquals("""{"hr":142,"steps":50,"ts":1700000000000}""", json)
    }

    @Test
    fun `builds payload with null fields when sensors are unavailable`() {
        val json = buildSensorPayload(heartRateBpm = null, stepCount = null, timestampMs = 1700000000000L)
        assertEquals("""{"hr":null,"steps":null,"ts":1700000000000}""", json)
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/wearos && ./gradlew :app:testDebugUnitTest --tests "com.stridequest.wearos.service.SensorPayloadTest"`
Expected: FAIL — compile error, `buildSensorPayload` is unresolved.

- [ ] **Step 3: Implement**

Create `apps/wearos/app/src/main/java/com/stridequest/wearos/service/SensorPayload.kt`:

```kotlin
package com.stridequest.wearos.service

import org.json.JSONObject

const val SENSOR_RELAY_PATH = "/stridequest/sensors"

fun buildSensorPayload(heartRateBpm: Int?, stepCount: Int?, timestampMs: Long): String {
    val obj = JSONObject()
    obj.put("hr", heartRateBpm ?: JSONObject.NULL)
    obj.put("steps", stepCount ?: JSONObject.NULL)
    obj.put("ts", timestampMs)
    return obj.toString()
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/wearos && ./gradlew :app:testDebugUnitTest --tests "com.stridequest.wearos.service.SensorPayloadTest"`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/wearos/app/src/main/java/com/stridequest/wearos/service/SensorPayload.kt apps/wearos/app/src/test/java/com/stridequest/wearos/service/SensorPayloadTest.kt
git commit -m "feat(wearos): add sensor relay payload codec"
```

---

## Task 5: Wear OS `SensorRelayService`

**Files:**
- Create: `apps/wearos/app/src/main/java/com/stridequest/wearos/service/SensorRelayService.kt`

This task has no unit test — it's a thin orchestration layer over `PassiveMonitoringClient` and `MessageClient`, both of which require a real device/emulator and Play Services to exercise. It's covered by the manual verification in Task 7.

- [ ] **Step 1: Implement the service**

Create `apps/wearos/app/src/main/java/com/stridequest/wearos/service/SensorRelayService.kt`:

```kotlin
package com.stridequest.wearos.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.health.services.client.HealthServices
import androidx.health.services.client.PassiveListenerCallback
import androidx.health.services.client.data.DataPointContainer
import androidx.health.services.client.data.DataType
import androidx.health.services.client.data.IntervalDataPoint
import androidx.health.services.client.data.PassiveListenerConfig
import androidx.health.services.client.data.SampleDataPoint
import com.google.android.gms.wearable.Wearable

private const val NOTIFICATION_CHANNEL_ID = "sensor_relay"
private const val NOTIFICATION_ID = 1
private const val BROADCAST_INTERVAL_MS = 1000L

class SensorRelayService : Service() {
    private val passiveMonitoringClient by lazy { HealthServices.getClient(this).passiveMonitoringClient }
    private val messageClient by lazy { Wearable.getMessageClient(this) }
    private val nodeClient by lazy { Wearable.getNodeClient(this) }
    private val handler = Handler(Looper.getMainLooper())

    @Volatile private var latestHeartRateBpm: Int? = null
    @Volatile private var latestStepCount: Int? = null
    private var sessionStartSteps: Long? = null

    private val passiveListenerCallback = object : PassiveListenerCallback {
        override fun onNewDataPointsReceived(dataPoints: DataPointContainer) {
            val heartRate: List<SampleDataPoint<Double>> = dataPoints.getData(DataType.HEART_RATE_BPM)
            heartRate.lastOrNull()?.let { latestHeartRateBpm = it.value.toInt() }

            val steps: List<IntervalDataPoint<Long>> = dataPoints.getData(DataType.STEPS_DAILY)
            steps.lastOrNull()?.let { point ->
                val baseline = sessionStartSteps ?: point.value.also { sessionStartSteps = it }
                latestStepCount = (point.value - baseline).toInt()
            }
        }
    }

    private val broadcastTick = object : Runnable {
        override fun run() {
            broadcastLatestSnapshot()
            handler.postDelayed(this, BROADCAST_INTERVAL_MS)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        startForeground(NOTIFICATION_ID, buildNotification())
        passiveMonitoringClient.setPassiveListenerCallback(
            PassiveListenerConfig.builder()
                .setDataTypes(setOf(DataType.HEART_RATE_BPM, DataType.STEPS_DAILY))
                .build(),
            passiveListenerCallback,
        )
        handler.post(broadcastTick)
    }

    override fun onDestroy() {
        handler.removeCallbacks(broadcastTick)
        passiveMonitoringClient.clearPassiveListenerCallbackAsync()
        super.onDestroy()
    }

    private fun broadcastLatestSnapshot() {
        val payload = buildSensorPayload(latestHeartRateBpm, latestStepCount, System.currentTimeMillis())
        val payloadBytes = payload.toByteArray(Charsets.UTF_8)
        nodeClient.connectedNodes.addOnSuccessListener { nodes ->
            nodes.forEach { node -> messageClient.sendMessage(node.id, SENSOR_RELAY_PATH, payloadBytes) }
        }
    }

    private fun buildNotification(): Notification {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "Sensor Relay",
                NotificationManager.IMPORTANCE_LOW,
            )
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
        return NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("StrideQuest relay active")
            .setContentText("Streaming heart rate and steps to your phone")
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setOngoing(true)
            .build()
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/wearos/app/src/main/java/com/stridequest/wearos/service/SensorRelayService.kt
git commit -m "feat(wearos): add SensorRelayService streaming HR/steps over MessageClient"
```

---

## Task 6: Wear OS manifest — permissions + service registration

**Files:**
- Modify: `apps/wearos/app/src/main/AndroidManifest.xml`

- [ ] **Step 1: Add permissions and the service declaration**

In `apps/wearos/app/src/main/AndroidManifest.xml`, replace:

```xml
    <uses-permission android:name="android.permission.WAKE_LOCK" />

    <uses-feature android:name="android.hardware.type.watch" />
```

with:

```xml
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.BODY_SENSORS" />
    <uses-permission android:name="android.permission.ACTIVITY_RECOGNITION" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_HEALTH" />
    <uses-permission android:name="android.permission.HIGH_SAMPLING_RATE_SENSORS" />

    <uses-feature android:name="android.hardware.type.watch" />
```

Then, inside `<application>`, add the service declaration right after the closing `</activity>` tag and before `</application>`:

```xml
        <service
            android:name=".service.SensorRelayService"
            android:exported="false"
            android:foregroundServiceType="health" />
```

- [ ] **Step 2: Verify the manifest merges cleanly**

Run: `cd apps/wearos && ./gradlew :app:processDebugManifest`
Expected: BUILD SUCCESSFUL, no manifest merger errors.

- [ ] **Step 3: Commit**

```bash
git add apps/wearos/app/src/main/AndroidManifest.xml
git commit -m "feat(wearos): declare sensor relay permissions and foreground service"
```

---

## Task 7: Wear OS `MainActivity` — permission request + start/stop wiring

**Files:**
- Modify: `apps/wearos/app/src/main/java/com/stridequest/wearos/presentation/MainActivity.kt`

- [ ] **Step 1: Replace the file**

Replace the full contents of `apps/wearos/app/src/main/java/com/stridequest/wearos/presentation/MainActivity.kt`:

```kotlin
package com.stridequest.wearos.presentation

import android.Manifest
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.wear.compose.material.*
import com.stridequest.wearos.service.SensorRelayService

class MainActivity : ComponentActivity() {
    private var relayActive = mutableStateOf(false)

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { results ->
        if (results.values.any { it }) startRelay()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            StrideQuestWearTheme {
                RunScreen(
                    relayActive = relayActive.value,
                    onToggleRelay = { if (relayActive.value) stopRelay() else requestPermissionsAndStart() },
                )
            }
        }
    }

    private fun requestPermissionsAndStart() {
        val needed = listOf(Manifest.permission.BODY_SENSORS, Manifest.permission.ACTIVITY_RECOGNITION)
            .filter { ContextCompat.checkSelfPermission(this, it) != android.content.pm.PackageManager.PERMISSION_GRANTED }

        if (needed.isEmpty()) {
            startRelay()
        } else {
            permissionLauncher.launch(needed.toTypedArray())
        }
    }

    private fun startRelay() {
        ContextCompat.startForegroundService(this, Intent(this, SensorRelayService::class.java))
        relayActive.value = true
    }

    private fun stopRelay() {
        stopService(Intent(this, SensorRelayService::class.java))
        relayActive.value = false
    }
}

@Composable
fun StrideQuestWearTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colors = Colors(
            primary = Color(0xFF00FF00), // Neon Green
            background = Color.Black,
            onBackground = Color.White
        ),
        content = content
    )
}

@Composable
fun RunScreen(relayActive: Boolean, onToggleRelay: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colors.background),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = if (relayActive) "RELAY: ACTIVE" else "RELAY: IDLE",
                color = Color.Gray,
                fontSize = 10.sp
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "0.00",
                color = Color.White,
                fontSize = 32.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "KILOMETERS",
                color = MaterialTheme.colors.primary,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(12.dp))

            Button(
                onClick = onToggleRelay,
                modifier = Modifier.size(ButtonDefaults.LargeButtonSize),
                colors = ButtonDefaults.primaryButtonColors(
                    backgroundColor = MaterialTheme.colors.primary
                )
            ) {
                Text(text = if (relayActive) "STOP" else "GO", color = Color.Black, fontWeight = FontWeight.Bold)
            }
        }
    }
}
```

This replaces the `/* TODO: Start Tracking Service */` placeholder on the existing "GO" button with the actual permission-request + service start/stop flow, and changes its label to "STOP" while the relay is active.

- [ ] **Step 2: Build**

Run: `cd apps/wearos && ./gradlew :app:compileDebugKotlin`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Manual verification**

Install on a Wear OS emulator/device (`./gradlew :app:installDebug`), launch the app, tap "GO". Confirm: (a) a permission dialog appears for body sensors/activity recognition, (b) after granting, the button changes to "STOP" and the persistent "StrideQuest relay active" notification appears, (c) `adb logcat | grep MessageClient` or a `Wearable.getMessageClient` listener on a connected paired device receives messages at `/stridequest/sensors` roughly once per second.

- [ ] **Step 4: Commit**

```bash
git add apps/wearos/app/src/main/java/com/stridequest/wearos/presentation/MainActivity.kt
git commit -m "feat(wearos): wire GO button to sensor relay permission request and service lifecycle"
```

---

## Task 8: Phone bridge — local Expo Module scaffold

**Files:**
- Create: `apps/mobile/modules/wearable-bridge/package.json`
- Create: `apps/mobile/modules/wearable-bridge/expo-module.config.json`
- Create: `apps/mobile/modules/wearable-bridge/android/build.gradle`
- Create: `apps/mobile/modules/wearable-bridge/android/src/main/AndroidManifest.xml`

- [ ] **Step 1: Create `package.json`**

Create `apps/mobile/modules/wearable-bridge/package.json`:

```json
{
  "name": "wearable-bridge",
  "version": "0.1.0",
  "description": "Receives Wear OS sensor relay messages and emits them as JS events",
  "main": "src/index.ts",
  "license": "UNLICENSED",
  "private": true
}
```

- [ ] **Step 2: Create `expo-module.config.json`**

Create `apps/mobile/modules/wearable-bridge/expo-module.config.json`:

```json
{
  "platforms": ["android"],
  "android": {
    "modules": ["com.stridequest.wearable.WearableBridgeModule"]
  }
}
```

- [ ] **Step 3: Create `android/build.gradle`**

Create `apps/mobile/modules/wearable-bridge/android/build.gradle`:

```gradle
apply plugin: 'com.android.library'
apply plugin: 'kotlin-android'

def expoModulesCorePlugin = new File(project(":expo-modules-core").projectDir.absolutePath, "ExpoModulesCorePlugin.gradle")
apply from: expoModulesCorePlugin
applyKotlinExpoModulesCorePlugin()

android {
  namespace "com.stridequest.wearable"
  defaultConfig {
    versionCode 1
    versionName "0.1.0"
  }
  lintOptions {
    abortOnError false
  }
}

dependencies {
  implementation "com.google.android.gms:play-services-wearable:18.1.0"
  testImplementation "junit:junit:4.13.2"
}
```

If `expo prebuild` fails to resolve `project(":expo-modules-core")` (this only exists once `expo-modules-autolinking` has wired it into `apps/mobile/android/settings.gradle` during prebuild — see Task 13 verification), run `npx create-expo-module@latest --local wearable-bridge-tmp` in a scratch directory and diff its generated `android/build.gradle` against this file to reconcile any template differences for the installed Expo SDK, then delete the scratch module.

- [ ] **Step 4: Create the module's `AndroidManifest.xml`**

Create `apps/mobile/modules/wearable-bridge/android/src/main/AndroidManifest.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android" />
```

No permissions are required on the phone side — receiving `MessageClient` callbacks needs no special Android permission.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/modules/wearable-bridge/package.json apps/mobile/modules/wearable-bridge/expo-module.config.json apps/mobile/modules/wearable-bridge/android/build.gradle apps/mobile/modules/wearable-bridge/android/src/main/AndroidManifest.xml
git commit -m "feat(mobile): scaffold wearable-bridge local Expo module"
```

---

## Task 9: Phone bridge — sensor payload decode

**Files:**
- Create: `apps/mobile/modules/wearable-bridge/android/src/main/java/com/stridequest/wearable/SensorPayload.kt`
- Test: `apps/mobile/modules/wearable-bridge/android/src/test/java/com/stridequest/wearable/SensorPayloadTest.kt`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/modules/wearable-bridge/android/src/test/java/com/stridequest/wearable/SensorPayloadTest.kt`:

```kotlin
package com.stridequest.wearable

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SensorPayloadTest {
    @Test
    fun `parses a full payload`() {
        val payload = parseSensorPayload("""{"hr":142,"steps":50,"ts":1700000000000}""")
        assertEquals(142, payload?.heartRateBpm)
        assertEquals(50, payload?.stepCount)
        assertEquals(1700000000000L, payload?.timestampMs)
    }

    @Test
    fun `parses null fields as null`() {
        val payload = parseSensorPayload("""{"hr":null,"steps":null,"ts":1700000000000}""")
        assertNull(payload?.heartRateBpm)
        assertNull(payload?.stepCount)
    }

    @Test
    fun `returns null for malformed json`() {
        val payload = parseSensorPayload("not json")
        assertNull(payload)
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/mobile && npx expo prebuild -p android --no-install` (only needed once, to materialize the gradle project graph if not already prebuilt — skip if `apps/mobile/android` already exists from prior work), then:
`cd apps/mobile/android && ./gradlew :wearable-bridge:testDebugUnitTest --tests "com.stridequest.wearable.SensorPayloadTest"`
Expected: FAIL — compile error, `parseSensorPayload`/`SensorPayload` unresolved.

- [ ] **Step 3: Implement**

Create `apps/mobile/modules/wearable-bridge/android/src/main/java/com/stridequest/wearable/SensorPayload.kt`:

```kotlin
package com.stridequest.wearable

import org.json.JSONObject

data class SensorPayload(
    val heartRateBpm: Int?,
    val stepCount: Int?,
    val timestampMs: Long,
)

fun parseSensorPayload(json: String): SensorPayload? {
    return try {
        val obj = JSONObject(json)
        SensorPayload(
            heartRateBpm = if (obj.isNull("hr")) null else obj.getInt("hr"),
            stepCount = if (obj.isNull("steps")) null else obj.getInt("steps"),
            timestampMs = obj.getLong("ts"),
        )
    } catch (e: Exception) {
        null
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/mobile/android && ./gradlew :wearable-bridge:testDebugUnitTest --tests "com.stridequest.wearable.SensorPayloadTest"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/modules/wearable-bridge/android/src/main/java/com/stridequest/wearable/SensorPayload.kt apps/mobile/modules/wearable-bridge/android/src/test/java/com/stridequest/wearable/SensorPayloadTest.kt
git commit -m "feat(mobile): add wearable-bridge sensor payload decoder"
```

---

## Task 10: Phone bridge — `WearableBridgeModule`

**Files:**
- Create: `apps/mobile/modules/wearable-bridge/android/src/main/java/com/stridequest/wearable/WearableBridgeModule.kt`

- [ ] **Step 1: Implement**

Create `apps/mobile/modules/wearable-bridge/android/src/main/java/com/stridequest/wearable/WearableBridgeModule.kt`:

```kotlin
package com.stridequest.wearable

import com.google.android.gms.wearable.MessageClient
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.Wearable
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val SENSOR_RELAY_PATH = "/stridequest/sensors"

class WearableBridgeModule : Module(), MessageClient.OnMessageReceivedListener {
    override fun definition() = ModuleDefinition {
        Name("WearableBridge")

        Events("onWearableDataReceived")

        OnCreate {
            appContext.reactContext?.let { Wearable.getMessageClient(it).addListener(this@WearableBridgeModule) }
        }

        OnDestroy {
            appContext.reactContext?.let { Wearable.getMessageClient(it).removeListener(this@WearableBridgeModule) }
        }
    }

    override fun onMessageReceived(event: MessageEvent) {
        if (event.path != SENSOR_RELAY_PATH) return
        val payload = parseSensorPayload(String(event.data, Charsets.UTF_8)) ?: return
        sendEvent(
            "onWearableDataReceived",
            mapOf(
                "hr" to payload.heartRateBpm,
                "steps" to payload.stepCount,
                "ts" to payload.timestampMs,
            ),
        )
    }
}
```

- [ ] **Step 2: Compile**

Run: `cd apps/mobile/android && ./gradlew :wearable-bridge:compileDebugKotlin`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/modules/wearable-bridge/android/src/main/java/com/stridequest/wearable/WearableBridgeModule.kt
git commit -m "feat(mobile): add WearableBridgeModule MessageClient listener"
```

---

## Task 11: Phone bridge — TypeScript wrapper

**Files:**
- Create: `apps/mobile/modules/wearable-bridge/src/index.ts`

- [ ] **Step 1: Implement**

Create `apps/mobile/modules/wearable-bridge/src/index.ts`:

```ts
import { NativeModule, requireNativeModule } from 'expo-modules-core'

export type WearableSensorEvent = {
  hr: number | null
  steps: number | null
  ts: number
}

type WearableBridgeModuleEvents = {
  onWearableDataReceived: (event: WearableSensorEvent) => void
}

declare class WearableBridgeModule extends NativeModule<WearableBridgeModuleEvents> {}

export default requireNativeModule<WearableBridgeModule>('WearableBridge')
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/modules/wearable-bridge/src/index.ts
git commit -m "feat(mobile): add wearable-bridge TypeScript wrapper"
```

---

## Task 12: Wire the module into the mobile app (package.json, app.json, jest config)

**Files:**
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/app.json`
- Modify: `apps/mobile/jest.config.js`
- Create: `apps/mobile/modules/wearable-bridge/app.plugin.js`

- [ ] **Step 1: Add the local module as a `file:` dependency**

In `apps/mobile/package.json`, add to `dependencies` (alphabetically last, after `"react-native-worklets": "0.5.1"`):

```json
    "react-native-worklets": "0.5.1",
    "wearable-bridge": "file:./modules/wearable-bridge"
```

This mirrors the existing `"@stridequest/shared": "file:../../packages/shared"` pattern already used in this file, and guarantees Expo's autolinking finds the module via its normal `node_modules` scan (in addition to the `app.json` plugin entry below).

- [ ] **Step 2: Add a no-op config plugin**

Create `apps/mobile/modules/wearable-bridge/app.plugin.js`:

```js
module.exports = function withWearableBridge(config) {
  return config
}
```

This module needs no config-time manifest/gradle patching (no phone-side permissions, and native linking happens via autolinking, not via a config plugin) — this is a harmless identity plugin so the explicit `app.json` listing below resolves to a valid plugin function rather than erroring during prebuild.

- [ ] **Step 3: Register the plugin in `app.json`**

In `apps/mobile/app.json`, inside the `"plugins"` array, change:

```json
    "plugins": [
      "expo-router",
      "expo-asset",
      "./plugins/withNotifee",
```

to:

```json
    "plugins": [
      "expo-router",
      "expo-asset",
      "./plugins/withNotifee",
      "./modules/wearable-bridge",
```

- [ ] **Step 4: Make the local module resolvable by Jest**

In `apps/mobile/jest.config.js`, add to `moduleNameMapper` (the transform pipeline skips most of `node_modules` per `transformIgnorePatterns`, and this module's `main` points straight at TypeScript source, so it needs the same direct-to-source mapping already used for `@stridequest/shared`):

```js
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@stridequest/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@stridequest/shared/(.*)$': '<rootDir>/../../packages/shared/src/$1/index.ts',
    '^wearable-bridge$': '<rootDir>/modules/wearable-bridge/src/index.ts',
  },
```

- [ ] **Step 5: Install to symlink the local module**

Run: `cd apps/mobile && npm install`
Expected: completes without error; `apps/mobile/node_modules/wearable-bridge` exists and resolves to `apps/mobile/modules/wearable-bridge`.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/package.json apps/mobile/package-lock.json apps/mobile/app.json apps/mobile/jest.config.js apps/mobile/modules/wearable-bridge/app.plugin.js
git commit -m "feat(mobile): register wearable-bridge as a local module dependency and config plugin"
```

---

## Task 13: `useWearableSensors` hook

**Files:**
- Create: `apps/mobile/src/features/running/hooks/useWearableSensors.ts`
- Test: `apps/mobile/tests/unit/running/use-wearable-sensors.test.ts` (new file, matching the existing `use-workout-recorder.test.ts` naming convention)

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/tests/unit/running/use-wearable-sensors.test.ts`:

```ts
import { renderHook, act } from '@testing-library/react-native'
import { useWearableSensors } from '@/features/running/hooks/useWearableSensors'
import type { WearableSensorEvent } from 'wearable-bridge'

const mockAddListener = jest.fn()
const mockRemove = jest.fn()

jest.mock('wearable-bridge', () => ({
  __esModule: true,
  default: {
    addListener: (...args: unknown[]) => mockAddListener(...args),
  },
}))

describe('useWearableSensors', () => {
  beforeEach(() => {
    mockAddListener.mockReset()
    mockRemove.mockReset()
    mockAddListener.mockImplementation(() => ({ remove: mockRemove }))
  })

  it('does not subscribe when disabled', () => {
    renderHook(() => useWearableSensors({ enabled: false }))
    expect(mockAddListener).not.toHaveBeenCalled()
  })

  it('subscribes when enabled and unsubscribes when disabled', () => {
    const { rerender } = renderHook(
      ({ enabled }) => useWearableSensors({ enabled }),
      { initialProps: { enabled: true } },
    )
    expect(mockAddListener).toHaveBeenCalledTimes(1)
    rerender({ enabled: false })
    expect(mockRemove).toHaveBeenCalledTimes(1)
  })

  it('updates the reading when an event arrives', () => {
    let emit: (event: WearableSensorEvent) => void = () => {}
    mockAddListener.mockImplementation((_eventName: string, listener: typeof emit) => {
      emit = listener
      return { remove: mockRemove }
    })

    const { result } = renderHook(() => useWearableSensors({ enabled: true }))
    expect(result.current).toBeNull()

    act(() => {
      emit({ hr: 142, steps: 50, ts: 1700000000000 })
    })

    expect(result.current).toEqual({ heartRateBpm: 142, stepCount: 50, ts: 1700000000000 })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/mobile && npx jest tests/unit/running/use-wearable-sensors.test.ts`
Expected: FAIL — cannot find module `@/features/running/hooks/useWearableSensors`.

- [ ] **Step 3: Implement**

Create `apps/mobile/src/features/running/hooks/useWearableSensors.ts`:

```ts
import { useEffect, useState } from 'react'
import WearableBridge from 'wearable-bridge'
import type { WearableSensorEvent } from 'wearable-bridge'

export type WearableReading = {
  heartRateBpm: number | null
  stepCount: number | null
  ts: number
}

export type UseWearableSensorsOptions = {
  enabled: boolean
}

export function useWearableSensors({ enabled }: UseWearableSensorsOptions): WearableReading | null {
  const [reading, setReading] = useState<WearableReading | null>(null)

  useEffect(() => {
    if (!enabled) {
      setReading(null)
      return
    }

    const subscription = WearableBridge.addListener(
      'onWearableDataReceived',
      (event: WearableSensorEvent) => {
        setReading({ heartRateBpm: event.hr, stepCount: event.steps, ts: event.ts })
      },
    )

    return () => subscription.remove()
  }, [enabled])

  return reading
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/mobile && npx jest tests/unit/running/use-wearable-sensors.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck**

Run: `cd apps/mobile && npm run typecheck`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/features/running/hooks/useWearableSensors.ts apps/mobile/tests/unit/running/use-wearable-sensors.test.ts
git commit -m "feat(mobile): add useWearableSensors hook"
```

---

## Task 14: Wire `useWearableSensors` into `useWorkoutRecorder`

**Files:**
- Modify: `apps/mobile/src/features/running/hooks/useWorkoutRecorder.ts`

- [ ] **Step 1: Import the hook**

In `apps/mobile/src/features/running/hooks/useWorkoutRecorder.ts`, add the import after the existing `AudioCoach` import (line 18):

```ts
import { useWearableSensors } from './useWearableSensors'
```

- [ ] **Step 2: Subscribe and forward into the engine**

Inside `useWorkoutRecorder`, right after the `status` state is declared (after line 75, `const [status, setStatus] = useState<RecorderStatus>('idle')`), add:

```ts
  const wearableReading = useWearableSensors({ enabled: status === 'recording' })
```

Then, right after the existing `useEffect` that calls `startWatch` on permission grant (after the block ending at line 146 — `}, [permissionStatus, startWatch, handleSample])`), add a new effect that forwards readings into the engine:

```ts
  useEffect(() => {
    if (!wearableReading || !engineRef.current) return
    engineRef.current.injectWearableSnapshot({
      heartRateBpm: wearableReading.heartRateBpm,
      stepCount: wearableReading.stepCount,
      stepFrequencyHz: null,
    })
  }, [wearableReading])
```

`stepFrequencyHz` is sent as `null` here because the watch payload only carries a cumulative step count, not a frequency. Per the Task 1 implementation, `mergeWearableData` only skips the *entire* update when `stepCount` is `null` — since `stepCount` is always non-null whenever `wearableReading` exists, this call writes `stepFrequencyHz` through as `null` every time, overwriting whatever the phone's own pedometer had computed. That's acceptable for Phase 1: deriving a step-frequency from the watch's cumulative count was never a goal here (only `heartRateBpm` and `stepCount` are read from the watch). Revisit if `MotionFeatures.stepFrequencyHz` needs the wearable's cadence later.

- [ ] **Step 3: Typecheck**

Run: `cd apps/mobile && npm run typecheck`
Expected: no new errors.

- [ ] **Step 4: Run the existing recorder test suite**

Run: `cd apps/mobile && npx jest tests/unit/running/use-workout-recorder.test.ts`
Expected: PASS — unaffected, since `wearableReading` is `null` whenever no `onWearableDataReceived` event fires (which it never does in this mocked test, as `wearable-bridge`'s `addListener` is not mocked there — confirm this still passes; if it fails because the real `wearable-bridge` native module isn't available in the Jest/jsdom environment, add the same `jest.mock('wearable-bridge', ...)` stub from Task 13 to the top of `use-workout-recorder.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/running/hooks/useWorkoutRecorder.ts
git commit -m "feat(mobile): forward wearable sensor readings into MotionEngine while recording"
```

---

## Task 15: Full verification (per CLAUDE.md mobile rules)

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit test suite**

Run: `cd apps/mobile && npx jest tests/unit`
Expected: all tests PASS, including the new `SensorManager`, `MotionEngine`, and `useWearableSensors` tests.

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Expo doctor**

Run: `cd apps/mobile && npx expo-doctor`
Expected: no new failures attributable to the `wearable-bridge` module (pre-existing unrelated warnings in this repo are out of scope).

- [ ] **Step 4: Expo export (Android)**

Run: `cd apps/mobile && npx expo export -p android`
Expected: succeeds; confirms Metro can resolve the `wearable-bridge` module and bundle the app.

- [ ] **Step 5: Confirm autolinking picked up the module**

Run: `cd apps/mobile && npx expo prebuild -p android --clean` then inspect `apps/mobile/android/settings.gradle`:
Run: `grep -i wearable-bridge apps/mobile/android/settings.gradle`
Expected: an `include` entry for the `wearable-bridge` module is present, and `apps/mobile/android/app/build.gradle` includes a corresponding `implementation project(':wearable-bridge')` (or autolinking-generated equivalent) line — confirm with:
Run: `grep -i wearable-bridge apps/mobile/android/app/build.gradle`

- [ ] **Step 6: Wear OS Gradle tests**

Run: `cd apps/wearos && ./gradlew test`
Expected: BUILD SUCCESSFUL, all `SensorPayloadTest` cases pass.

- [ ] **Step 7: Bridge module Gradle tests**

Run: `cd apps/mobile/android && ./gradlew :wearable-bridge:test`
Expected: BUILD SUCCESSFUL, all `SensorPayloadTest` cases pass.

- [ ] **Step 8: Manual end-to-end check**

With a Wear OS device/emulator paired to a phone running the dev build: start a run on the phone (so `useWorkoutRecorder` status becomes `'recording'`), tap "GO" on the watch, and confirm heart rate / step readings begin appearing (e.g. via a temporary `console.log` in the `useWearableSensors` consumer, or a debugger breakpoint) within a few seconds. Stop the run and confirm the relay-disabled state doesn't error.

- [ ] **Step 9: Final commit (if any verification step required fixes)**

```bash
git add -A
git commit -m "chore(mobile+wearos): fix verification issues found in wearable sensor relay"
```

(Skip this step if Steps 1-8 all passed without requiring changes.)
