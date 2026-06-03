import { render, screen, fireEvent, act } from '@testing-library/react'
import * as React from 'react'
import { WorkoutControls } from '@/features/running/components/WorkoutControls'
import type { WorkoutActionResult } from '@/features/running/types'
import type { UseWorkoutRecorderResult } from '@/features/running/hooks/useWorkoutRecorder'

jest.mock('@/features/running/actions', () => ({
  startWorkout: jest.fn(),
  stopWorkout: jest.fn(),
  discardWorkout: jest.fn(),
}))

jest.mock('@/features/running/hooks/useWorkoutRecorder', () => ({
  useWorkoutRecorder: jest.fn(),
}))

jest.mock('react', () => ({
  ...jest.requireActual<typeof import('react')>('react'),
  useActionState: jest.fn(),
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useWorkoutRecorder } = require('@/features/running/hooks/useWorkoutRecorder')
const mockUseActionState = React.useActionState as jest.Mock
const mockUseWorkoutRecorder = useWorkoutRecorder as jest.Mock

// WorkoutControls calls useActionState once per render in a FIXED order:
//   1) startWorkout  2) stopWorkout  3) discardWorkout
// The component has no internal *action* state, so it renders deterministically
// and these mockReturnValueOnce results map to each hook. If the hook-call order
// in the component changes, update this mapping.
type Triple = [WorkoutActionResult, () => void, boolean]

const noop = () => {}
const idle: WorkoutActionResult = { status: 'idle' }
const idleTriple: Triple = [idle, noop, false]

function setHooks(start: Triple, stop: Triple, discard: Triple) {
  mockUseActionState
    .mockReturnValueOnce(start)
    .mockReturnValueOnce(stop)
    .mockReturnValueOnce(discard)
}

// Build a controllable recorder result and install it as the hook's return value.
// The recorder is fully mocked here (02B-06 has its own suite); this suite only
// verifies WorkoutControls wires it correctly and renders its live state.
function setRecorder(overrides: Partial<UseWorkoutRecorderResult> = {}): UseWorkoutRecorderResult {
  const recorder: UseWorkoutRecorderResult = {
    status: 'idle',
    distanceMeters: 0,
    hasFix: false,
    permission: 'prompt',
    error: null,
    start: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    stop: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
    ...overrides,
  }
  mockUseWorkoutRecorder.mockReturnValue(recorder)
  return recorder
}

const recordingStart: Triple = [{ status: 'success', workoutId: 'w1' }, noop, false]

describe('WorkoutControls', () => {
  beforeEach(() => {
    mockUseActionState.mockReturnValue(idleTriple)
    setRecorder()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('renders the start button when idle', () => {
    setHooks(idleTriple, idleTriple, idleTriple)
    render(<WorkoutControls />)
    expect(screen.getByRole('button', { name: /start run/i })).toBeInTheDocument()
  })

  it('disables the start button and shows a loading label while starting', () => {
    setHooks([idle, noop, true], idleTriple, idleTriple)
    render(<WorkoutControls />)
    expect(screen.getByRole('button', { name: /starting/i })).toBeDisabled()
  })

  it('surfaces a start error', () => {
    setHooks(
      [{ status: 'error', error: 'You already have an active workout' }, noop, false],
      idleTriple,
      idleTriple
    )
    render(<WorkoutControls />)
    expect(screen.getByRole('alert')).toHaveTextContent('You already have an active workout')
  })

  it('renders stop and discard buttons while recording', () => {
    setHooks(recordingStart, idleTriple, idleTriple)
    render(<WorkoutControls />)
    expect(screen.getByRole('button', { name: /stop run/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /discard run/i })).toBeInTheDocument()
  })

  it('shows a recording status while recording', () => {
    setHooks(recordingStart, idleTriple, idleTriple)
    render(<WorkoutControls />)
    expect(screen.getByText(/recording/i)).toBeInTheDocument()
  })

  it('disables stop and discard while stopping', () => {
    setHooks(recordingStart, [idle, noop, true], idleTriple)
    render(<WorkoutControls />)
    expect(screen.getByRole('button', { name: /stopping/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /discard run/i })).toBeDisabled()
  })

  it('surfaces a stop error while recording', () => {
    setHooks(
      recordingStart,
      [{ status: 'error', error: 'Could not stop workout. Please try again.' }, noop, false],
      idleTriple
    )
    render(<WorkoutControls />)
    expect(screen.getByRole('alert')).toHaveTextContent('Could not stop workout')
  })

  it('shows a completed state after stopping', () => {
    setHooks(recordingStart, recordingStart, idleTriple)
    render(<WorkoutControls />)
    expect(screen.getByText(/run complete/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to dashboard/i })).toBeInTheDocument()
  })

  it('shows a discarded state after discarding', () => {
    setHooks(recordingStart, idleTriple, recordingStart)
    render(<WorkoutControls />)
    expect(screen.getByText(/run discarded/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to dashboard/i })).toBeInTheDocument()
  })

  // --- 02B-08: recorder integration -----------------------------------------

  it('starts the recorder with the workout id once recording begins', () => {
    const recorder = setRecorder({ status: 'idle' })
    setHooks(recordingStart, idleTriple, idleTriple)
    render(<WorkoutControls />)
    expect(recorder.start).toHaveBeenCalledWith('w1')
  })

  it('shows the live distance estimate, labelled non-authoritative, while recording', () => {
    setRecorder({ status: 'recording', distanceMeters: 1234.5 })
    setHooks(recordingStart, idleTriple, idleTriple)
    render(<WorkoutControls />)
    const live = screen.getByTestId('live-distance')
    expect(live).toHaveTextContent(/1\.23\s*km/)
    expect(live).toHaveTextContent(/live estimate/i)
  })

  it('prompts the user while acquiring a GPS fix (hasFix false)', () => {
    setRecorder({ status: 'recording', permission: 'granted', hasFix: false, distanceMeters: 0 })
    setHooks(recordingStart, idleTriple, idleTriple)
    render(<WorkoutControls />)
    expect(screen.getByText(/acquiring gps/i)).toBeInTheDocument()
  })

  it('warns when location permission is denied', () => {
    setRecorder({
      status: 'recording',
      permission: 'denied',
      error: { code: 'permission_denied', message: 'denied' },
    })
    setHooks(recordingStart, idleTriple, idleTriple)
    render(<WorkoutControls />)
    expect(screen.getByText(/location access is required/i)).toBeInTheDocument()
  })

  it('awaits recorder flush before dispatching the stop action', async () => {
    const mockStopAction = jest.fn()
    setHooks(recordingStart, [idle, mockStopAction, false], idleTriple)
    const recorder = setRecorder({ status: 'recording' })
    
    let resolveStop: (value?: void | PromiseLike<void>) => void = () => {}
    ;(recorder.stop as jest.Mock).mockReturnValue(new Promise<void>((resolve) => { resolveStop = resolve }))

    render(<WorkoutControls />)
    
    const stopForm = screen.getByRole('button', { name: /stop run/i }).closest('form')
    fireEvent.submit(stopForm!)

    expect(recorder.stop).toHaveBeenCalled()
    expect(mockStopAction).not.toHaveBeenCalled()

    resolveStop()
    await act(async () => {})

    expect(mockStopAction).toHaveBeenCalled()
  })

  it('awaits recorder flush before dispatching the discard action', async () => {
    const mockDiscardAction = jest.fn()
    setHooks(recordingStart, idleTriple, [idle, mockDiscardAction, false])
    const recorder = setRecorder({ status: 'recording' })
    
    let resolveStop: (value?: void | PromiseLike<void>) => void = () => {}
    ;(recorder.stop as jest.Mock).mockReturnValue(new Promise<void>((resolve) => { resolveStop = resolve }))

    render(<WorkoutControls />)
    
    const discardForm = screen.getByRole('button', { name: /discard run/i }).closest('form')
    fireEvent.submit(discardForm!)

    expect(recorder.stop).toHaveBeenCalled()
    expect(mockDiscardAction).not.toHaveBeenCalled()

    resolveStop()
    await act(async () => {})

    expect(mockDiscardAction).toHaveBeenCalled()
  })

  // --- GPS status: hasFix-based transitions -----------------------------------

  it('shows "Locked" once the first accepted GPS sample arrives (hasFix true)', () => {
    setRecorder({ status: 'recording', permission: 'granted', hasFix: true, distanceMeters: 0 })
    setHooks(recordingStart, idleTriple, idleTriple)
    render(<WorkoutControls />)
    expect(screen.queryByText(/acquiring gps/i)).not.toBeInTheDocument()
    expect(screen.getByText(/locked/i)).toBeInTheDocument()
  })

  it('shows "Locked" for a stationary user who has a fix but zero distance', () => {
    setRecorder({ status: 'recording', permission: 'granted', hasFix: true, distanceMeters: 0 })
    setHooks(recordingStart, idleTriple, idleTriple)
    render(<WorkoutControls />)
    // Distance is 0 m but GPS is Locked — the old bug would show "Acquiring" here
    expect(screen.getByTestId('live-distance-value')).toHaveTextContent('0')
    expect(screen.getByText(/locked/i)).toBeInTheDocument()
  })

  it('still shows "Acquiring" before any fix arrives even with granted permission', () => {
    setRecorder({ status: 'recording', permission: 'granted', hasFix: false, distanceMeters: 0 })
    setHooks(recordingStart, idleTriple, idleTriple)
    render(<WorkoutControls />)
    expect(screen.getByText(/acquiring gps/i)).toBeInTheDocument()
  })
})
