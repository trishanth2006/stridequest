import { renderHook, act } from '@testing-library/react-native'
import { useWorkoutRecorder } from '@/features/running/hooks/useWorkoutRecorder'
import type { GpsSample } from '@stridequest/shared/running'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(() => ({ insert: jest.fn().mockResolvedValue({ error: null }) })) },
}))

jest.mock('@/features/running/hooks/useLocation', () => ({
  useLocation: jest.fn(() => ({
    permissionStatus: 'granted',
    hasFix: false,
    requestPermission: jest.fn().mockResolvedValue(undefined),
    startWatch: jest.fn().mockResolvedValue(undefined),
    stopWatch: jest.fn(),
  })),
}))

import { useLocation } from '@/features/running/hooks/useLocation'
const mockUseLocation = useLocation as jest.MockedFunction<typeof useLocation>

// Suppress unused import warning — GpsSample is available for future test extensions
void (undefined as unknown as GpsSample)

describe('useWorkoutRecorder state machine', () => {
  beforeEach(() => {
    mockUseLocation.mockReturnValue({
      permissionStatus: 'granted',
      hasFix: false,
      requestPermission: jest.fn(),
      startWatch: jest.fn().mockResolvedValue(undefined),
      stopWatch: jest.fn(),
    })
  })

  it('starts in idle state', async () => {
    const { result } = await renderHook(() => useWorkoutRecorder())
    expect(result.current.status).toBe('idle')
    expect(result.current.distanceMeters).toBe(0)
  })

  it('transitions idle → recording on start()', async () => {
    const { result } = await renderHook(() => useWorkoutRecorder())
    await act(async () => { result.current.start('workout-123') })
    expect(result.current.status).toBe('recording')
  })

  it('transitions recording → paused on pause()', async () => {
    const { result } = await renderHook(() => useWorkoutRecorder())
    await act(async () => { result.current.start('workout-123') })
    await act(async () => { result.current.pause() })
    expect(result.current.status).toBe('paused')
  })

  it('transitions paused → recording on resume()', async () => {
    const { result } = await renderHook(() => useWorkoutRecorder())
    await act(async () => { result.current.start('workout-123') })
    await act(async () => { result.current.pause() })
    await act(async () => { result.current.resume() })
    expect(result.current.status).toBe('recording')
  })

  it('transitions recording → stopped on stop()', async () => {
    const { result } = await renderHook(() => useWorkoutRecorder())
    await act(async () => { result.current.start('workout-123') })
    await act(async () => { await result.current.stop() })
    expect(result.current.status).toBe('stopped')
  })

  it('transitions to discarded on discard()', async () => {
    const { result } = await renderHook(() => useWorkoutRecorder())
    await act(async () => { result.current.start('workout-123') })
    await act(async () => { result.current.discard() })
    expect(result.current.status).toBe('discarded')
  })

  it('restore() sets paused state with correct elapsed time', async () => {
    const { result } = await renderHook(() => useWorkoutRecorder())
    await act(async () => { result.current.restore('workout-abc', 90000) })
    expect(result.current.status).toBe('paused')
    expect(result.current.elapsedSeconds).toBe(90)
    expect(result.current.workoutId).toBe('workout-abc')
  })
})
