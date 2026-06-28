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

  it('does not update within 5s even after _resetForTesting resets lastUpdateAt', async () => {
    _resetForTesting()
    jest.setSystemTime(10_000)
    await updateLiveRunStats(1000, 300, 300)
    expect(mockNotifee.displayNotification).toHaveBeenCalledTimes(1)
  })

  it('includes distance and duration in notification body', async () => {
    await updateLiveRunStats(2500, 900, 360)
    const call = (mockNotifee.displayNotification as jest.Mock).mock.calls[0][0] as { body: string }
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

  it('resets throttle so next updateLiveRunStats fires immediately after resume', async () => {
    jest.setSystemTime(10_000)
    await updateLiveRunStats(100, 60, 600) // fires + sets lastUpdateAt = 10_000
    jest.clearAllMocks()

    await resumeLiveRun() // resets lastUpdateAt to -UPDATE_INTERVAL_MS
    jest.clearAllMocks()

    jest.setSystemTime(10_001) // only 1ms later — would normally be throttled
    await updateLiveRunStats(110, 61, 555)
    expect(mockNotifee.displayNotification).toHaveBeenCalledTimes(1)
  })
})

describe('stopLiveRunWithSummary', () => {
  it('stops the foreground service', async () => {
    await stopLiveRunWithSummary(5000, 1800)
    expect(mockNotifee.stopForegroundService).toHaveBeenCalled()
  })

  it('displays a dismissible Workout Complete summary without ongoing', async () => {
    await stopLiveRunWithSummary(5000, 1800)
    expect(mockNotifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Workout Complete!' }),
    )
    const call = (mockNotifee.displayNotification as jest.Mock).mock.calls[0][0] as {
      android: { ongoing?: boolean }
    }
    expect(call.android.ongoing).toBeUndefined()
  })
})

describe('cancelLiveRun', () => {
  it('stops the foreground service and cancels the notification', async () => {
    await cancelLiveRun()
    expect(mockNotifee.stopForegroundService).toHaveBeenCalled()
    expect(mockNotifee.cancelNotification).toHaveBeenCalledWith('sq-live-run-active')
  })
})
