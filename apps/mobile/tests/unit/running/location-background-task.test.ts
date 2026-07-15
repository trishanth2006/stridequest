jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
}))

jest.mock('expo-location', () => ({
  startLocationUpdatesAsync: jest.fn(),
  stopLocationUpdatesAsync: jest.fn(),
  hasStartedLocationUpdatesAsync: jest.fn(),
  Accuracy: { BestForNavigation: 6 },
}))

import * as Location from 'expo-location'
import {
  stopTrackingService,
  BACKGROUND_TRACKING_TASK,
} from '@/features/running/engine/LocationBackgroundTask'

const mockLocation = Location as jest.Mocked<typeof Location>

describe('stopTrackingService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('stops background updates when the task is running', async () => {
    mockLocation.hasStartedLocationUpdatesAsync.mockResolvedValue(true)

    await stopTrackingService()

    expect(mockLocation.stopLocationUpdatesAsync).toHaveBeenCalledWith(BACKGROUND_TRACKING_TASK)
  })

  it('does not stop updates when the task was never started', async () => {
    // pause() already stopped the task (or startWatch bailed on permissions);
    // a second stop must not reach native, which throws TaskNotFoundException.
    mockLocation.hasStartedLocationUpdatesAsync.mockResolvedValue(false)

    await stopTrackingService()

    expect(mockLocation.stopLocationUpdatesAsync).not.toHaveBeenCalled()
  })
})
