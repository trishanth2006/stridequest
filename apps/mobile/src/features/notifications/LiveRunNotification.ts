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
