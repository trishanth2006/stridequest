# Notification & Engagement Engine — Design Spec
_Date: 2026-06-28_

## Overview
Implement a real-time live-run foreground notification + smart engagement event notifications for the StrideQuest mobile app (Expo 54, Android-first, EAS Build).

## Library Strategy: Option A — Notifee + expo-notifications (Hybrid)
- **@notifee/react-native** — Android Foreground Service, local notification display, channels, styling
- **expo-notifications** — Push token registration (FCM), background push receipt
- **Supabase Edge Function (finalize-workout)** — dispatches FCM push to stolen-cell owners

## File Structure

### New files
```
apps/mobile/src/features/notifications/
├── LiveRunNotification.ts       # Foreground service lifecycle
├── EventNotificationQueue.ts    # Anti-spam throttle + batch
├── NotificationManager.ts       # Façade — single import
└── usePushRegistration.ts       # Push token hook (called from _layout)

supabase/migrations/
└── XXX_create_push_tokens.sql   # FCM token per user

tests/unit/notifications/
├── EventNotificationQueue.test.ts
└── LiveRunNotification.test.ts
```

### Modified files
- `apps/mobile/app/(protected)/_layout.tsx` — register Notifee FG task + usePushRegistration
- `apps/mobile/app/(protected)/record.tsx` — inject NotificationManager at 5 transition points
- `apps/mobile/app.json` — Notifee config plugin + FCM permissions
- `supabase/functions/finalize-workout/index.ts` — push dispatch for stolen cell owners

## Module Responsibilities

### LiveRunNotification.ts
- Create Android notification channel (importance: HIGH, category: NAVIGATION)
- `startForegroundService(workoutId)` — launches un-dismissible Android FG notification
- `updateStats(distanceM, elapsedSeconds, paceSecPerKm)` — throttled to every 5s to protect JS bridge/battery
- `setPaused()` — flips notification to "Run Paused" state
- `setResumed()` — restores active state
- `stopAndSummarise(summary)` — kills FG service, posts dismissible summary notification
- `cancel()` — kills FG service with no summary (discard flow)

### EventNotificationQueue.ts
- `enqueueTerritoryCapture(count)` — buffers count within 60s window, flushes as single "N territories captured!" notification
- `enqueueQuestComplete(title)` — fires immediately (once per quest, idempotent by questId)
- `enqueueXpMilestone(xp)` — fires immediately if xp > 0
- `enqueueTerritoryLost(cellId)` — (background push, received via expo-notifications, displayed via Notifee)
- Internal: 60s debounce timer cleared on flush or run stop

### NotificationManager.ts (façade)
- Re-exports LiveRunNotification and EventNotificationQueue methods
- Single import for consumers: `import { NotificationManager } from '@/features/notifications/NotificationManager'`
- < 50 lines, pure delegation

### usePushRegistration.ts
- `requestPermissionsAsync()` (handles iOS + Android 13+ modal)
- `getDevicePushTokenAsync()` via expo-notifications
- Upserts token to `push_tokens` Supabase table
- Called once on mount in `_layout.tsx`; silently no-ops on permission denial

## Integration Points in record.tsx

| Transition | NotificationManager call |
|---|---|
| `handleStart` (after recorder.start) | `NotificationManager.startLiveRun(workoutId)` |
| `recorder.status === 'recording'` (timer tick, via useEffect) | `NotificationManager.updateStats(distance, elapsed, pace)` — internal 5s throttle |
| `recorder.pause()` | `NotificationManager.pauseLiveRun()` |
| `recorder.resume()` | `NotificationManager.resumeLiveRun()` |
| `handleStop` (after finalizeWorkout result) | `NotificationManager.finishLiveRun(result)` + `enqueuePostRunEvents(result)` |
| `handleDiscardConfirm` | `NotificationManager.cancelLiveRun()` |

## Push Pipeline (Lost Territory)

```
User B finalizes workout, steals cells owned by User A
  → finalize-workout Edge Function
  → queries push_tokens WHERE user_id IN (prev_owners)
  → POST to FCM REST API v1 per token
  → Device receives DataMessage
  → expo-notifications onNotificationReceived / background handler
  → Notifee.displayNotification() with "Someone stole your territory!"
```

### push_tokens table
```sql
CREATE TABLE push_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  token text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, platform)
);
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
-- Users can only upsert their own token
CREATE POLICY "own token" ON push_tokens FOR ALL USING (auth.uid() = user_id);
```

## Anti-Spam Rules

| Event | Window | Batch logic |
|---|---|---|
| Territory captured | 60s | N captures → "You captured N territories!" |
| Territory lost (push) | None | 1 push per theft (server-side dedup by workout) |
| Quest completed | None | 1 per quest (idempotent by questId in memory) |
| XP milestone | None | 1 per run (only fires if xp_awarded > 0) |

## Permissions & Lifecycle

### Android
- `POST_NOTIFICATIONS` (Android 13+) — requested via `usePushRegistration`
- `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_LOCATION` — declared in app.json via Notifee plugin
- FG service runs inside the JS thread (no separate native process needed with Notifee)

### iOS
- `NSUserNotificationUsageDescription` in Info.plist
- No Foreground Services on iOS — persistent notification shown but dismissible
- Live Activities deferred to future sprint

### Graceful degradation
- All NotificationManager calls wrapped in try/catch
- Permission denial → silent no-op, run tracking continues normally
- No crash path for any notification failure

## Battery / Performance Constraints
- Notification updates throttled to 5s intervals (not 1s with the timer)
- Territory capture batch window: 60s
- No persistent Supabase Realtime WebSocket kept alive during run (push covers background)

## Testing
- `EventNotificationQueue.test.ts` — batch window logic, flush, dedup
- `LiveRunNotification.test.ts` — state machine: start → update → pause → resume → stop
- Notifee and expo-notifications mocked at module level
