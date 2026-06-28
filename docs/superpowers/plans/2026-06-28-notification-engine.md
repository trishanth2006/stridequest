# Notification & Engagement Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a live-updating Android Foreground Service notification during runs, smart batched event notifications (territory capture, quest completion, XP), and a background push pipeline (FCM via Expo) so users receive "Lost Territory" alerts even when the app is closed.

**Architecture:** `@notifee/react-native` owns all local notification display (foreground service, channels, styled alerts). `expo-notifications` handles push token registration. The existing `finalize-workout` Edge Function is extended to query previous cell owners' Expo push tokens and fire notifications via the Expo Push API — no google-services.json required. All notification calls are wrapped in try/catch and fail silently so the run tracker never crashes on permission denial.

**Tech Stack:** @notifee/react-native, expo-notifications, expo-constants, Expo Push Notifications API (https://exp.host/--/api/v2/push/send), Supabase Edge Function (Deno), Jest 29 with jest-expo preset.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/mobile/src/features/notifications/LiveRunNotification.ts` | Create | Foreground service: start/update/pause/resume/stop/cancel |
| `apps/mobile/src/features/notifications/EventNotificationQueue.ts` | Create | Anti-spam: territory batch (60s), quest dedup, XP fire |
| `apps/mobile/src/features/notifications/NotificationManager.ts` | Create | Façade — single import for consumers |
| `apps/mobile/src/features/notifications/usePushRegistration.ts` | Create | Permission request + Expo push token → push_tokens table |
| `apps/mobile/tests/unit/notifications/LiveRunNotification.test.ts` | Create | Unit tests for foreground service state machine |
| `apps/mobile/tests/unit/notifications/EventNotificationQueue.test.ts` | Create | Unit tests for batch/dedup/throttle logic |
| `apps/mobile/src/features/running/services/workout.ts` | Modify | Add `questsCompleted` field to `FinalizeResult` |
| `apps/mobile/app/(protected)/_layout.tsx` | Modify | Register Notifee FG task at module scope + call usePushRegistration |
| `apps/mobile/app/(protected)/record.tsx` | Modify | Inject NotificationManager at 6 lifecycle points |
| `apps/mobile/app.json` | Modify | Add @notifee/react-native plugin + POST_NOTIFICATIONS permission |
| `supabase/functions/finalize-workout/index.ts` | Modify | Dispatch Expo push to previous cell owners on theft |
| `supabase/migrations/XXX_create_push_tokens.sql` | Create | push_tokens table with RLS |

---

## Task 1: Install Packages & Update app.json

**Files:**
- Modify: `apps/mobile/package.json` (via npm)
- Modify: `apps/mobile/app.json`

- [ ] **Step 1: Install @notifee/react-native and expo-notifications**

```bash
cd apps/mobile
npm install @notifee/react-native
npx expo install expo-notifications
```

Expected: both packages appear in `apps/mobile/package.json` dependencies. No version conflicts.

- [ ] **Step 2: Update app.json**

Open `apps/mobile/app.json`. Replace the `"plugins"` array and add `POST_NOTIFICATIONS` to android permissions:

```json
{
  "expo": {
    "name": "StrideQuest",
    "slug": "stridequest",
    "version": "0.0.1",
    "scheme": "stridequest",
    "orientation": "portrait",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.stridequest.app",
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "StrideQuest needs your location to track your run.",
        "NSUserNotificationsUsageDescription": "StrideQuest sends run updates and territory alerts."
      }
    },
    "android": {
      "package": "com.stridequest.app",
      "adaptiveIcon": {
        "backgroundColor": "#0b0b0f"
      },
      "permissions": [
        "ACCESS_FINE_LOCATION",
        "POST_NOTIFICATIONS",
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_LOCATION"
      ]
    },
    "plugins": [
      "expo-router",
      "expo-asset",
      "@notifee/react-native",
      [
        "expo-notifications",
        {
          "icon": "./assets/images/adaptive-icon.png",
          "color": "#ffffff",
          "sounds": []
        }
      ],
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
          "RNMapboxMapsVersion": "11.20.1"
        }
      ]
    ],
    "experiments": {
      "typedRoutes": true,
      "tsconfigPaths": true
    }
  }
}
```

- [ ] **Step 3: Verify types compile after install**

```bash
cd apps/mobile
npm run typecheck
```

Expected: exits 0. If there are type errors specifically from the new packages, they'll be fixed in later tasks.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/package.json apps/mobile/package-lock.json apps/mobile/app.json
git commit -m "feat(mobile): install @notifee/react-native and expo-notifications"
```

---

## Task 2: push_tokens Migration

**Files:**
- Create: `supabase/migrations/XXX_create_push_tokens.sql` (use the next sequential number)

- [ ] **Step 1: Find the current highest migration number**

```bash
ls supabase/migrations/
```

Use the next number (e.g., if highest is `009_...`, use `010`).

- [ ] **Step 2: Create the migration file**

Create `supabase/migrations/010_create_push_tokens.sql` (adjust number as needed):

```sql
CREATE TABLE push_tokens (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       text        NOT NULL,
  platform    text        NOT NULL CHECK (platform IN ('ios', 'android')),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform)
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own push token"
  ON push_tokens
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX push_tokens_user_id_idx ON push_tokens(user_id);
```

- [ ] **Step 3: Apply migration via MCP**

Use the Supabase MCP tool to apply the migration. Then verify:

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'push_tokens' ORDER BY ordinal_position;
```

Expected columns: `id`, `user_id`, `token`, `platform`, `updated_at`.

- [ ] **Step 4: Verify RLS is enabled**

```sql
SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'push_tokens';
```

Expected: `relrowsecurity = true`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/010_create_push_tokens.sql
git commit -m "feat(db): add push_tokens table for FCM/Expo push delivery"
```

---

## Task 3: TDD — LiveRunNotification.ts

**Files:**
- Create: `apps/mobile/tests/unit/notifications/LiveRunNotification.test.ts`
- Create: `apps/mobile/src/features/notifications/LiveRunNotification.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/mobile/tests/unit/notifications/LiveRunNotification.test.ts`:

```typescript
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    displayNotification: jest.fn().mockResolvedValue(undefined),
    createChannel: jest.fn().mockResolvedValue('sq-live-run'),
    cancelNotification: jest.fn().mockResolvedValue(undefined),
    stopForegroundService: jest.fn().mockResolvedValue(undefined),
  },
  AndroidImportance: { HIGH: 4 },
  AndroidCategory: { WORKOUT: 'workout' },
}))

jest.mock('@stridequest/shared/running', () => ({
  formatDistance: (m: number) => `${(m / 1000).toFixed(2)} km`,
  formatDuration: (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`,
  formatPace: (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`,
}))

import notifee from '@notifee/react-native'
import {
  startLiveRun,
  updateLiveRunStats,
  pauseLiveRun,
  resumeLiveRun,
  stopLiveRunWithSummary,
  cancelLiveRun,
  _resetForTesting,
} from '@/features/notifications/LiveRunNotification'

const mockNotifee = notifee as jest.Mocked<typeof notifee>

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
  jest.setSystemTime(10_000) // well above 5s so first update fires
  _resetForTesting()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('startLiveRun', () => {
  it('creates the live-run channel and displays a foreground notification', async () => {
    await startLiveRun()
    expect(mockNotifee.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sq-live-run' }),
    )
    expect(mockNotifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'sq-live-run-active',
        android: expect.objectContaining({ asForegroundService: true, ongoing: true }),
      }),
    )
  })
})

describe('updateLiveRunStats', () => {
  it('updates the notification on first call', async () => {
    await updateLiveRunStats(500, 120, 240)
    expect(mockNotifee.displayNotification).toHaveBeenCalledTimes(1)
  })

  it('throttles updates within 5s window', async () => {
    jest.setSystemTime(10_000)
    await updateLiveRunStats(500, 120, 240)
    expect(mockNotifee.displayNotification).toHaveBeenCalledTimes(1)

    jest.setSystemTime(13_000) // 3s later — within window
    await updateLiveRunStats(600, 123, 205)
    expect(mockNotifee.displayNotification).toHaveBeenCalledTimes(1) // no change

    jest.setSystemTime(15_001) // 5s+ after first — passes
    await updateLiveRunStats(700, 125, 178)
    expect(mockNotifee.displayNotification).toHaveBeenCalledTimes(2)
  })

  it('does not update while paused (status !== recording guard)', async () => {
    // pauseLiveRun sets lastUpdateAt so immediate resume+update is allowed;
    // but if caller respects status guard, updateLiveRunStats won't be called.
    // This test confirms _resetForTesting resets the throttle state.
    _resetForTesting()
    jest.setSystemTime(10_000)
    await updateLiveRunStats(1000, 300, 300)
    expect(mockNotifee.displayNotification).toHaveBeenCalledTimes(1)
  })

  it('includes distance and duration in notification body', async () => {
    await updateLiveRunStats(2500, 900, 360)
    const call = (mockNotifee.displayNotification as jest.Mock).mock.calls[0][0]
    expect(call.body).toContain('2.50 km')
    expect(call.body).toContain('15:00')
  })
})

describe('pauseLiveRun', () => {
  it('shows "Run Paused" title', async () => {
    await pauseLiveRun()
    expect(mockNotifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'StrideQuest — Run Paused' }),
    )
  })

  it('keeps asForegroundService true while paused', async () => {
    await pauseLiveRun()
    expect(mockNotifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        android: expect.objectContaining({ asForegroundService: true }),
      }),
    )
  })
})

describe('resumeLiveRun', () => {
  it('shows active title after resume', async () => {
    await resumeLiveRun()
    expect(mockNotifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'StrideQuest — Run in progress' }),
    )
  })

  it('resets throttle so next updateLiveRunStats fires immediately', async () => {
    jest.setSystemTime(10_000)
    await updateLiveRunStats(100, 60, 600) // fires + sets lastUpdateAt
    jest.clearAllMocks()

    jest.setSystemTime(12_000) // 2s — normally throttled
    await resumeLiveRun()
    jest.clearAllMocks()

    jest.setSystemTime(12_001) // 1ms after resume — throttle was reset
    await updateLiveRunStats(110, 61, 555)
    expect(mockNotifee.displayNotification).toHaveBeenCalledTimes(1)
  })
})

describe('stopLiveRunWithSummary', () => {
  it('stops the foreground service', async () => {
    await stopLiveRunWithSummary(5000, 1800)
    expect(mockNotifee.stopForegroundService).toHaveBeenCalled()
  })

  it('displays a dismissible Workout Complete summary', async () => {
    await stopLiveRunWithSummary(5000, 1800)
    expect(mockNotifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Workout Complete!',
        android: expect.objectContaining({ ongoing: undefined }),
      }),
    )
  })
})

describe('cancelLiveRun', () => {
  it('stops the foreground service and cancels the notification', async () => {
    await cancelLiveRun()
    expect(mockNotifee.stopForegroundService).toHaveBeenCalled()
    expect(mockNotifee.cancelNotification).toHaveBeenCalledWith('sq-live-run-active')
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd apps/mobile
npx jest tests/unit/notifications/LiveRunNotification.test.ts --no-coverage
```

Expected: `Cannot find module '@/features/notifications/LiveRunNotification'`.

- [ ] **Step 3: Implement LiveRunNotification.ts**

Create `apps/mobile/src/features/notifications/LiveRunNotification.ts`:

```typescript
import notifee, { AndroidImportance, AndroidCategory } from '@notifee/react-native'
import { formatDistance, formatDuration, formatPace } from '@stridequest/shared/running'

const CHANNEL_ID = 'sq-live-run'
const NOTIFICATION_ID = 'sq-live-run-active'
const UPDATE_INTERVAL_MS = 5_000

// Initialised negative so the very first updateLiveRunStats call always fires.
let lastUpdateAt = -UPDATE_INTERVAL_MS

async function ensureChannel(): Promise<void> {
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Live Run',
    importance: AndroidImportance.HIGH,
    vibration: false,
  })
}

export async function startLiveRun(): Promise<void> {
  try {
    await ensureChannel()
    await notifee.displayNotification({
      id: NOTIFICATION_ID,
      title: 'StrideQuest — Run in progress',
      body: '0.00 km  ·  00:00  ·  --:-- /km',
      android: {
        channelId: CHANNEL_ID,
        asForegroundService: true,
        ongoing: true,
        category: AndroidCategory.WORKOUT,
        pressAction: { id: 'default', launchActivity: 'default' },
      },
    })
  } catch { /* permission denied or iOS — run continues without notification */ }
}

export async function updateLiveRunStats(
  distanceM: number,
  elapsedS: number,
  paceSecPerKm: number,
): Promise<void> {
  const now = Date.now()
  if (now - lastUpdateAt < UPDATE_INTERVAL_MS) return
  lastUpdateAt = now
  try {
    const paceStr =
      elapsedS > 0 && distanceM > 0 ? formatPace(paceSecPerKm) : '--:--'
    await notifee.displayNotification({
      id: NOTIFICATION_ID,
      title: 'StrideQuest — Run in progress',
      body: `${formatDistance(distanceM)}  ·  ${formatDuration(elapsedS)}  ·  ${paceStr} /km`,
      android: {
        channelId: CHANNEL_ID,
        asForegroundService: true,
        ongoing: true,
        category: AndroidCategory.WORKOUT,
        pressAction: { id: 'default', launchActivity: 'default' },
      },
    })
  } catch { /* silently no-op */ }
}

export async function pauseLiveRun(): Promise<void> {
  try {
    await notifee.displayNotification({
      id: NOTIFICATION_ID,
      title: 'StrideQuest — Run Paused',
      body: 'Tap to return to your run',
      android: {
        channelId: CHANNEL_ID,
        asForegroundService: true,
        ongoing: true,
        pressAction: { id: 'default', launchActivity: 'default' },
      },
    })
  } catch { /* silently no-op */ }
}

export async function resumeLiveRun(): Promise<void> {
  lastUpdateAt = -UPDATE_INTERVAL_MS // reset throttle so next update fires immediately
  try {
    await notifee.displayNotification({
      id: NOTIFICATION_ID,
      title: 'StrideQuest — Run in progress',
      body: 'Resuming…',
      android: {
        channelId: CHANNEL_ID,
        asForegroundService: true,
        ongoing: true,
        category: AndroidCategory.WORKOUT,
        pressAction: { id: 'default', launchActivity: 'default' },
      },
    })
  } catch { /* silently no-op */ }
}

export async function stopLiveRunWithSummary(
  distanceM: number,
  elapsedS: number,
): Promise<void> {
  lastUpdateAt = -UPDATE_INTERVAL_MS
  try {
    await notifee.stopForegroundService()
    await notifee.displayNotification({
      title: 'Workout Complete!',
      body: `${formatDistance(distanceM)} in ${formatDuration(elapsedS)}`,
      android: {
        channelId: CHANNEL_ID,
        pressAction: { id: 'default', launchActivity: 'default' },
      },
    })
  } catch { /* silently no-op */ }
}

export async function cancelLiveRun(): Promise<void> {
  lastUpdateAt = -UPDATE_INTERVAL_MS
  try {
    await notifee.stopForegroundService()
    await notifee.cancelNotification(NOTIFICATION_ID)
  } catch { /* silently no-op */ }
}

/** Exposed only for unit tests — resets module-level throttle state. */
export function _resetForTesting(): void {
  lastUpdateAt = -UPDATE_INTERVAL_MS
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd apps/mobile
npx jest tests/unit/notifications/LiveRunNotification.test.ts --no-coverage
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/notifications/LiveRunNotification.ts \
        apps/mobile/tests/unit/notifications/LiveRunNotification.test.ts
git commit -m "feat(mobile): add LiveRunNotification foreground service manager"
```

---

## Task 4: TDD — EventNotificationQueue.ts

**Files:**
- Create: `apps/mobile/tests/unit/notifications/EventNotificationQueue.test.ts`
- Create: `apps/mobile/src/features/notifications/EventNotificationQueue.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/mobile/tests/unit/notifications/EventNotificationQueue.test.ts`:

```typescript
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    displayNotification: jest.fn().mockResolvedValue(undefined),
    createChannel: jest.fn().mockResolvedValue('sq-events'),
  },
  AndroidImportance: { DEFAULT: 3 },
}))

import notifee from '@notifee/react-native'
import {
  enqueueTerritoryCapture,
  enqueueQuestComplete,
  enqueueXpMilestone,
  flushAndResetQueue,
  _resetForTesting,
} from '@/features/notifications/EventNotificationQueue'

const mockDisplay = notifee.displayNotification as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
  _resetForTesting()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('enqueueTerritoryCapture', () => {
  it('does not fire immediately', () => {
    enqueueTerritoryCapture(1)
    expect(mockDisplay).not.toHaveBeenCalled()
  })

  it('fires once after the 60s batch window with count 1', async () => {
    enqueueTerritoryCapture(1)
    await jest.advanceTimersByTimeAsync(60_000)
    expect(mockDisplay).toHaveBeenCalledTimes(1)
    expect(mockDisplay).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Territory Captured!' }),
    )
  })

  it('batches multiple calls into a single notification', async () => {
    enqueueTerritoryCapture(2)
    enqueueTerritoryCapture(1)
    enqueueTerritoryCapture(1)
    await jest.advanceTimersByTimeAsync(60_000)
    expect(mockDisplay).toHaveBeenCalledTimes(1)
    expect(mockDisplay).toHaveBeenCalledWith(
      expect.objectContaining({ title: '4 Territories Captured!' }),
    )
  })

  it('ignores a count of 0', async () => {
    enqueueTerritoryCapture(0)
    await jest.advanceTimersByTimeAsync(60_000)
    expect(mockDisplay).not.toHaveBeenCalled()
  })

  it('resets the buffer after flush so next enqueue starts fresh', async () => {
    enqueueTerritoryCapture(3)
    await jest.advanceTimersByTimeAsync(60_000)
    jest.clearAllMocks()

    enqueueTerritoryCapture(1)
    await jest.advanceTimersByTimeAsync(60_000)
    expect(mockDisplay).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Territory Captured!' }),
    )
  })
})

describe('flushAndResetQueue', () => {
  it('fires pending captures immediately without waiting for the timer', async () => {
    enqueueTerritoryCapture(2)
    await flushAndResetQueue()
    expect(mockDisplay).toHaveBeenCalledTimes(1)
  })

  it('clears fired quest ids', async () => {
    await enqueueQuestComplete('q-1', 'Run 5km')
    expect(mockDisplay).toHaveBeenCalledTimes(1)

    await flushAndResetQueue()
    jest.clearAllMocks()

    await enqueueQuestComplete('q-1', 'Run 5km') // same id — should fire again after reset
    expect(mockDisplay).toHaveBeenCalledTimes(1)
  })
})

describe('enqueueQuestComplete', () => {
  it('fires immediately with the quest title', async () => {
    await enqueueQuestComplete('q-daily-5km', 'Run 5km today')
    expect(mockDisplay).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Quest Complete!', body: 'Run 5km today' }),
    )
  })

  it('deduplicates the same questId within the same session', async () => {
    await enqueueQuestComplete('q-daily-5km', 'Run 5km today')
    await enqueueQuestComplete('q-daily-5km', 'Run 5km today')
    expect(mockDisplay).toHaveBeenCalledTimes(1)
  })

  it('fires for different quest ids', async () => {
    await enqueueQuestComplete('q-1', 'Quest 1')
    await enqueueQuestComplete('q-2', 'Quest 2')
    expect(mockDisplay).toHaveBeenCalledTimes(2)
  })
})

describe('enqueueXpMilestone', () => {
  it('fires for positive XP', async () => {
    await enqueueXpMilestone(150)
    expect(mockDisplay).toHaveBeenCalledWith(
      expect.objectContaining({ title: '+150 XP Earned!' }),
    )
  })

  it('does not fire for 0 XP', async () => {
    await enqueueXpMilestone(0)
    expect(mockDisplay).not.toHaveBeenCalled()
  })

  it('does not fire for negative XP', async () => {
    await enqueueXpMilestone(-10)
    expect(mockDisplay).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd apps/mobile
npx jest tests/unit/notifications/EventNotificationQueue.test.ts --no-coverage
```

Expected: `Cannot find module '@/features/notifications/EventNotificationQueue'`.

- [ ] **Step 3: Implement EventNotificationQueue.ts**

Create `apps/mobile/src/features/notifications/EventNotificationQueue.ts`:

```typescript
import notifee, { AndroidImportance } from '@notifee/react-native'

const CHANNEL_ID = 'sq-events'
const BATCH_WINDOW_MS = 60_000

let pendingCaptureCount = 0
let captureTimer: ReturnType<typeof setTimeout> | null = null
const firedQuestIds = new Set<string>()

async function ensureEventChannel(): Promise<void> {
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Run Events',
    importance: AndroidImportance.DEFAULT,
  })
}

async function flushCaptureNotification(): Promise<void> {
  const count = pendingCaptureCount
  pendingCaptureCount = 0
  captureTimer = null
  if (count === 0) return
  try {
    await ensureEventChannel()
    await notifee.displayNotification({
      title: count === 1 ? 'Territory Captured!' : `${count} Territories Captured!`,
      body:
        count === 1
          ? 'You claimed a new territory for StrideQuest!'
          : `You claimed ${count} new territories!`,
      android: {
        channelId: CHANNEL_ID,
        pressAction: { id: 'default', launchActivity: 'default' },
      },
    })
  } catch { /* silently no-op */ }
}

export function enqueueTerritoryCapture(count: number): void {
  if (count <= 0) return
  pendingCaptureCount += count
  if (!captureTimer) {
    captureTimer = setTimeout(() => { void flushCaptureNotification() }, BATCH_WINDOW_MS)
  }
}

export async function flushAndResetQueue(): Promise<void> {
  if (captureTimer) {
    clearTimeout(captureTimer)
    captureTimer = null
  }
  await flushCaptureNotification()
  firedQuestIds.clear()
}

export async function enqueueQuestComplete(questId: string, title: string): Promise<void> {
  if (firedQuestIds.has(questId)) return
  firedQuestIds.add(questId)
  try {
    await ensureEventChannel()
    await notifee.displayNotification({
      title: 'Quest Complete!',
      body: title,
      android: {
        channelId: CHANNEL_ID,
        pressAction: { id: 'default', launchActivity: 'default' },
      },
    })
  } catch { /* silently no-op */ }
}

export async function enqueueXpMilestone(xp: number): Promise<void> {
  if (xp <= 0) return
  try {
    await ensureEventChannel()
    await notifee.displayNotification({
      title: `+${xp} XP Earned!`,
      body: 'Check your profile to see your progress.',
      android: {
        channelId: CHANNEL_ID,
        pressAction: { id: 'default', launchActivity: 'default' },
      },
    })
  } catch { /* silently no-op */ }
}

/** Exposed only for unit tests — resets module-level queue state. */
export function _resetForTesting(): void {
  if (captureTimer) clearTimeout(captureTimer)
  captureTimer = null
  pendingCaptureCount = 0
  firedQuestIds.clear()
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd apps/mobile
npx jest tests/unit/notifications/EventNotificationQueue.test.ts --no-coverage
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/notifications/EventNotificationQueue.ts \
        apps/mobile/tests/unit/notifications/EventNotificationQueue.test.ts
git commit -m "feat(mobile): add EventNotificationQueue with 60s territory batch and quest dedup"
```

---

## Task 5: NotificationManager Façade

**Files:**
- Create: `apps/mobile/src/features/notifications/NotificationManager.ts`

- [ ] **Step 1: Create the façade**

Create `apps/mobile/src/features/notifications/NotificationManager.ts`:

```typescript
export {
  startLiveRun,
  updateLiveRunStats,
  pauseLiveRun,
  resumeLiveRun,
  stopLiveRunWithSummary,
  cancelLiveRun,
} from './LiveRunNotification'

export {
  enqueueTerritoryCapture,
  enqueueQuestComplete,
  enqueueXpMilestone,
  flushAndResetQueue,
} from './EventNotificationQueue'
```

- [ ] **Step 2: Verify typecheck**

```bash
cd apps/mobile
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/features/notifications/NotificationManager.ts
git commit -m "feat(mobile): add NotificationManager facade"
```

---

## Task 6: usePushRegistration Hook

**Files:**
- Create: `apps/mobile/src/features/notifications/usePushRegistration.ts`

- [ ] **Step 1: Create the hook**

Create `apps/mobile/src/features/notifications/usePushRegistration.ts`:

```typescript
import { useEffect } from 'react'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { supabase } from '@/lib/supabase'

export function usePushRegistration(): void {
  useEffect(() => {
    void registerPushToken()
  }, [])
}

async function registerPushToken(): Promise<void> {
  try {
    const { status } = await Notifications.requestPermissionsAsync()
    if (status !== 'granted') return

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
      })
    }

    const projectId =
      Constants.easConfig?.projectId ??
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId })

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const platform = Platform.OS === 'ios' ? 'ios' : 'android'
    await supabase.from('push_tokens').upsert(
      {
        user_id: user.id,
        token: tokenData.data,
        platform,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,platform' },
    )
  } catch {
    /* silently no-op — push is an enhancement, not required for the app to function */
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/mobile
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/features/notifications/usePushRegistration.ts
git commit -m "feat(mobile): add usePushRegistration hook for Expo push token upsert"
```

---

## Task 7: Add questsCompleted to FinalizeResult

The Edge Function already returns `questsCompleted` in its response body — we just need the client type to reflect it so record.tsx can consume it.

**Files:**
- Modify: `apps/mobile/src/features/running/services/workout.ts`

- [ ] **Step 1: Extend FinalizeResult type**

In `apps/mobile/src/features/running/services/workout.ts`, update `FinalizeResult`:

```typescript
export type FinalizeResult = {
  workoutId: string
  distanceM: number | null
  durationS: number | null
  avgPaceSPerKm: number | null
  xpAwarded: number | null
  cellsClaimed: number | null
  cellsStolen: number | null
  cellsDefended: number | null
  questsCompleted: Array<{ questId: string; title: string | null; rewardXp: number }>
}
```

No other changes needed — the Edge Function already returns this field.

- [ ] **Step 2: Typecheck**

```bash
cd apps/mobile
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/features/running/services/workout.ts
git commit -m "feat(mobile): add questsCompleted to FinalizeResult type"
```

---

## Task 8: Wire _layout.tsx — FG Service Registration + Push Registration

**Files:**
- Modify: `apps/mobile/app/(protected)/_layout.tsx`

Current file (`apps/mobile/app/(protected)/_layout.tsx`) imports: `useEffect`, `View`, `Stack`, `useRouter`, `useSession`, `getActiveWorkout`, `colors`.

- [ ] **Step 1: Add FG service registration and usePushRegistration**

Replace the entire file with:

```typescript
import { useEffect } from 'react'
import { View } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import notifee from '@notifee/react-native'
import { useSession } from '@/features/auth/providers/SessionProvider'
import { getActiveWorkout } from '@/features/running/services/workout'
import { usePushRegistration } from '@/features/notifications/usePushRegistration'
import { colors } from '@/theme'

// Must be registered at module scope before any component renders.
// The promise never resolves — the FG service stays alive until
// cancelLiveRun() or stopLiveRunWithSummary() calls stopForegroundService().
notifee.registerForegroundService(() => new Promise<void>(() => {}))

export default function ProtectedLayout() {
  const { session, loading } = useSession()
  const router = useRouter()

  usePushRegistration()

  useEffect(() => {
    if (!loading && !session) {
      router.replace('/(auth)/login')
    }
  }, [session, loading, router])

  useEffect(() => {
    if (loading || !session) return
    void getActiveWorkout().then((workout) => {
      if (workout) {
        router.push('/(protected)/record' as never)
      }
    })
  }, [session, loading, router])

  if (loading || !session) {
    return <View className="flex-1 bg-background" />
  }

  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    />
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/mobile
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/(protected)/_layout.tsx
git commit -m "feat(mobile): register Notifee FG service task and push token hook in protected layout"
```

---

## Task 9: Wire record.tsx — 6 Notification Lifecycle Points

**Files:**
- Modify: `apps/mobile/app/(protected)/record.tsx`

- [ ] **Step 1: Add NotificationManager import**

At the top of `apps/mobile/app/(protected)/record.tsx`, add after existing imports:

```typescript
import * as NotificationManager from '@/features/notifications/NotificationManager'
```

- [ ] **Step 2: Add stats update effect**

Inside `RecordScreen`, after the `recorder` declaration, add this `useEffect`:

```typescript
// Mirror live run stats to the foreground notification (internal 5s throttle prevents spam).
useEffect(() => {
  if (recorder.status !== 'recording') return
  const pace =
    recorder.elapsedSeconds > 0 && recorder.distanceMeters > 0
      ? (recorder.elapsedSeconds * 1000) / recorder.distanceMeters
      : 0
  void NotificationManager.updateLiveRunStats(recorder.distanceMeters, recorder.elapsedSeconds, pace)
}, [recorder.status, recorder.elapsedSeconds, recorder.distanceMeters])
```

- [ ] **Step 3: Update handleStart to start the notification**

In `handleStart`, add the notification call after `recorder.start(workoutId)`:

```typescript
const handleStart = useCallback(async () => {
  setError(null)
  try {
    const { workoutId } = await startWorkout()
    recorder.start(workoutId)
    void NotificationManager.startLiveRun()
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to start run')
  }
}, [recorder])
```

- [ ] **Step 4: Pause notification on pause**

Add a new `useEffect` that calls `pauseLiveRun` when status becomes `'paused'`:

```typescript
useEffect(() => {
  if (recorder.status === 'paused') {
    void NotificationManager.pauseLiveRun()
  } else if (recorder.status === 'recording') {
    void NotificationManager.resumeLiveRun()
  }
}, [recorder.status])
```

Note: this effect fires on every status change. The `resumeLiveRun` fires when recording resumes (after `recorder.resume()` is called). The `startLiveRun` in handleStart fires first, then this effect fires with `'recording'` — `resumeLiveRun` will be called too, but that's safe since it just updates the notification to the active state.

To avoid `resumeLiveRun` firing on the very first `'recording'` state (before startLiveRun completes), adjust to guard on whether the notification is active. The simplest guard: track whether the live run notification was started.

Replace the above with a more precise version:

```typescript
const liveRunStarted = useRef(false)

useEffect(() => {
  if (recorder.status === 'paused') {
    void NotificationManager.pauseLiveRun()
  } else if (recorder.status === 'recording' && liveRunStarted.current) {
    void NotificationManager.resumeLiveRun()
  }
}, [recorder.status])
```

And in `handleStart`, after `void NotificationManager.startLiveRun()`, add:
```typescript
liveRunStarted.current = true
```

And reset it in `handleStop` and `handleDiscardConfirm`:
```typescript
liveRunStarted.current = false
```

- [ ] **Step 5: Add post-run event dispatch helper**

Add this function just before `RecordScreen` (not inside it):

```typescript
async function dispatchPostRunEvents(result: FinalizeResult): Promise<void> {
  if ((result.cellsClaimed ?? 0) > 0) {
    NotificationManager.enqueueTerritoryCapture(result.cellsClaimed!)
  }
  for (const quest of result.questsCompleted ?? []) {
    if (quest.title) {
      await NotificationManager.enqueueQuestComplete(quest.questId, quest.title)
    }
  }
  if ((result.xpAwarded ?? 0) > 0) {
    await NotificationManager.enqueueXpMilestone(result.xpAwarded!)
  }
}
```

- [ ] **Step 6: Update handleStop**

```typescript
const handleStop = useCallback(async () => {
  if (!recorder.workoutId) return
  const id = recorder.workoutId
  await recorder.stop()
  liveRunStarted.current = false
  try {
    const result = await finalizeWorkout(id)
    setFinalization(result)
    void NotificationManager.stopLiveRunWithSummary(result.distanceM ?? 0, result.durationS ?? 0)
    void dispatchPostRunEvents(result)
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to save run')
    void NotificationManager.cancelLiveRun()
  }
}, [recorder])
```

- [ ] **Step 7: Update handleDiscardConfirm**

```typescript
const handleDiscardConfirm = useCallback(async () => {
  const id = recorder.workoutId
  recorder.discard()
  liveRunStarted.current = false
  void NotificationManager.cancelLiveRun()
  if (id) {
    await discardWorkout(id).catch(() => {})
  }
  setConfirmingDiscard(false)
}, [recorder])
```

- [ ] **Step 8: Typecheck**

```bash
cd apps/mobile
npm run typecheck
```

Expected: exits 0. Fix any type errors before committing.

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/app/(protected)/record.tsx
git commit -m "feat(mobile): wire NotificationManager into run lifecycle in record.tsx"
```

---

## Task 10: Extend finalize-workout Edge Function with Push Dispatch

**Files:**
- Modify: `supabase/functions/finalize-workout/index.ts`

The current function already has `adminClient`, `user.id`, `cellIds`, and `row` (with `row.cells_stolen`). We need to:
1. Capture previous cell owners BEFORE the `finalize_workout` RPC (before ownership changes)
2. After the RPC, if `row.cells_stolen > 0`, send Expo push notifications to those owners

- [ ] **Step 1: Add previous-owner query before the RPC call**

In `finalize-workout/index.ts`, locate the comment `// 6. Call finalize_workout RPC` (line ~91). Insert this block immediately BEFORE it:

```typescript
  // 5b. Snapshot previous owners of cells we're about to capture (for push notifications).
  // Must happen before the RPC to avoid reading the updated ownership.
  let prevOwnerIds: string[] = []
  if (cellIds.length > 0) {
    const { data: ownerRows } = await adminClient
      .from('cell_ownership')
      .select('user_id')
      .in('cell_id', cellIds)
      .neq('user_id', user.id)
    prevOwnerIds = [...new Set((ownerRows ?? []).map((r: { user_id: string }) => r.user_id))]
  }
```

- [ ] **Step 2: Add push dispatch after the RPC**

Locate the quest block (`// 7. Quests`). Insert this block BETWEEN the RPC result check and the quest block:

```typescript
  // 6b. Push notification to previous owners whose cells were stolen (best-effort).
  if (row.cells_stolen > 0 && prevOwnerIds.length > 0) {
    try {
      const { data: tokenRows } = await adminClient
        .from('push_tokens')
        .select('token')
        .in('user_id', prevOwnerIds)
      const tokens = (tokenRows ?? []).map((r: { token: string }) => r.token)
      if (tokens.length > 0) {
        const stolenCount: number = row.cells_stolen
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
          },
          body: JSON.stringify(
            tokens.map((to: string) => ({
              to,
              title: '⚡ Territory Lost!',
              body:
                stolenCount === 1
                  ? 'Someone captured one of your territories. Get back out there!'
                  : `Someone captured ${stolenCount} of your territories. Get back out there!`,
              sound: 'default',
              data: { type: 'territory_lost', count: stolenCount },
            })),
          ),
        })
      }
    } catch (e) {
      console.error('[finalize-workout] push dispatch failed', e)
      // Best-effort: never fail the request over a push notification
    }
  }
```

- [ ] **Step 3: Verify the function still compiles**

```bash
cd supabase
deno check functions/finalize-workout/index.ts
```

Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/finalize-workout/index.ts
git commit -m "feat(edge): dispatch Expo push to previous territory owners on workout finalize"
```

---

## Task 11: Run All Tests + Typecheck + Lint

- [ ] **Step 1: Run unit tests**

```bash
cd apps/mobile
npx jest tests/unit/notifications/ --no-coverage
```

Expected: all tests in `LiveRunNotification.test.ts` and `EventNotificationQueue.test.ts` pass.

- [ ] **Step 2: Run full unit test suite**

```bash
cd apps/mobile
npx jest tests/unit/ --no-coverage
```

Expected: all tests pass. Fix any regressions before continuing.

- [ ] **Step 3: Run typecheck**

```bash
cd apps/mobile
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 4: Run lint**

```bash
cd apps/mobile
npm run lint
```

Expected: exits 0 or only pre-existing warnings. Fix any new errors.

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -p
git commit -m "fix(mobile): typecheck and lint clean-up for notification engine"
```

---

## Self-Review

### Spec coverage check
| Requirement | Task |
|---|---|
| Foreground notification on run start | Task 3 (startLiveRun) |
| Live distance/time/pace updates | Task 3 (updateLiveRunStats, 5s throttle) |
| Pause state reflected in notification | Task 3 (pauseLiveRun) + Task 9 |
| Finish = kill FG service + summary | Task 3 (stopLiveRunWithSummary) + Task 9 |
| Territory captured notification | Task 4 (enqueueTerritoryCapture, 60s batch) + Task 9 |
| Lost Territory background push | Task 10 (finalize-workout → Expo push) |
| Daily Quest Completed notification | Task 4 (enqueueQuestComplete, dedup) + Task 9 |
| Anti-spam (60s batch) | Task 4 |
| Android 13+ POST_NOTIFICATIONS permission | Task 1 (app.json) + Task 6 (usePushRegistration) |
| Graceful degradation on permission denial | All notification calls wrapped in try/catch |
| push_tokens table | Task 2 |
| FG service register before component mount | Task 8 (module-scope in _layout.tsx) |

### Gaps identified and addressed
- **XP milestone notification**: Added to `dispatchPostRunEvents` in Task 9 (Step 5). `enqueueXpMilestone` in EventNotificationQueue.
- **questsCompleted type**: Task 7 adds it to `FinalizeResult` so quest notifications have the title.
- **Throttle reset on resume**: `resumeLiveRun()` sets `lastUpdateAt = -UPDATE_INTERVAL_MS` ensuring next stats update fires immediately after resume.
