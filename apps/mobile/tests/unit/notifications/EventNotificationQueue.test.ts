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

  it('clears fired quest ids so the same quest can fire again after reset', async () => {
    await enqueueQuestComplete('q-1', 'Run 5km')
    expect(mockDisplay).toHaveBeenCalledTimes(1)

    await flushAndResetQueue()
    jest.clearAllMocks()

    await enqueueQuestComplete('q-1', 'Run 5km')
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
