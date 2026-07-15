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
