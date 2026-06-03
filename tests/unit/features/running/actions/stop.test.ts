/**
 * @jest-environment node
 */
import { stopWorkout } from '@/features/running/actions'

jest.mock('@/infrastructure/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/features/running/services/finalize', () => ({
  finalizeWorkout: jest.fn(),
}))

import { createClient } from '@/infrastructure/supabase/server'
import { finalizeWorkout } from '@/features/running/services/finalize'

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>
const mockFinalizeWorkout = finalizeWorkout as jest.MockedFunction<typeof finalizeWorkout>

const initialState = { status: 'idle' as const }
const validId = '123e4567-e89b-12d3-a456-426614174000'

type Workout = { id: string; status: string } | null

function formData(workoutId: string): FormData {
  const fd = new FormData()
  fd.set('workoutId', workoutId)
  return fd
}

function mockClient(opts: { workout: Workout; fetchError?: { code: string } | null }) {
  const maybeSingle = jest.fn().mockResolvedValue({ data: opts.workout, error: opts.fetchError ?? null })
  const selectEq = jest.fn().mockReturnValue({ maybeSingle })
  const select = jest.fn().mockReturnValue({ eq: selectEq })
  const from = jest.fn().mockReturnValue({ select })
  return { client: { from } }
}

describe('stopWorkout (02C-02: wired to finalize RPC)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rejects an invalid workoutId before touching the database', async () => {
    const result = await stopWorkout(initialState, formData('not-a-uuid'))
    expect(result.status).toBe('error')
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('FR-WL-3: calls finalizeWorkout for a recording workout and returns metrics', async () => {
    const { client } = mockClient({ workout: { id: validId, status: 'recording' } })
    mockCreateClient.mockResolvedValue(client as never)
    mockFinalizeWorkout.mockResolvedValue({
      workoutId: validId,
      status: 'completed',
      distanceM: 5000,
      durationS: 1800,
      avgPaceSPerKm: 360,
      xpAwarded: null,
      cellsClaimed: null,
      cellsStolen: null,
      cellsDefended: null,
    })

    const result = await stopWorkout(initialState, formData(validId))

    expect(mockFinalizeWorkout).toHaveBeenCalledWith(client, validId)
    expect(result).toEqual({
      status: 'success',
      workoutId: validId,
      metrics: {
        workoutId: validId,
        status: 'completed',
        distanceM: 5000,
        durationS: 1800,
        avgPaceSPerKm: 360,
        xpAwarded: null,
        cellsClaimed: null,
        cellsStolen: null,
        cellsDefended: null,
      },
    })
  })

  it('02C-02: stopWorkout returns server-computed distance and duration', async () => {
    const { client } = mockClient({ workout: { id: validId, status: 'recording' } })
    mockCreateClient.mockResolvedValue(client as never)
    mockFinalizeWorkout.mockResolvedValue({
      workoutId: validId,
      status: 'completed',
      distanceM: 3456,
      durationS: 1234,
      avgPaceSPerKm: 357,
      xpAwarded: null,
      cellsClaimed: null,
      cellsStolen: null,
      cellsDefended: null,
    })

    const result = await stopWorkout(initialState, formData(validId))

    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.metrics?.distanceM).toBe(3456)
      expect(result.metrics?.durationS).toBe(1234)
      expect(result.metrics?.avgPaceSPerKm).toBe(357)
    }
  })

  it('FR-RP-4: stopping an already-completed workout is idempotent — returns stored metrics', async () => {
    const { client } = mockClient({ workout: { id: validId, status: 'completed' } })
    mockCreateClient.mockResolvedValue(client as never)
    mockFinalizeWorkout.mockResolvedValue({
      workoutId: validId,
      status: 'completed',
      distanceM: 5000,
      durationS: 1800,
      avgPaceSPerKm: 360,
      xpAwarded: null,
      cellsClaimed: null,
      cellsStolen: null,
      cellsDefended: null,
    })

    const result = await stopWorkout(initialState, formData(validId))

    // The RPC is called even for completed workouts (it returns stored record),
    // so the caller always gets metrics.
    expect(mockFinalizeWorkout).toHaveBeenCalledWith(client, validId)
    expect(result).toEqual({
      status: 'success',
      workoutId: validId,
      metrics: expect.objectContaining({ status: 'completed', distanceM: 5000 }),
    })
  })

  it('rejects stopping a discarded workout without calling the RPC', async () => {
    const { client } = mockClient({ workout: { id: validId, status: 'discarded' } })
    mockCreateClient.mockResolvedValue(client as never)

    const result = await stopWorkout(initialState, formData(validId))

    expect(mockFinalizeWorkout).not.toHaveBeenCalled()
    expect(result.status).toBe('error')
  })

  it('returns a not-found error when the workout does not exist (or is not owned)', async () => {
    const { client } = mockClient({ workout: null })
    mockCreateClient.mockResolvedValue(client as never)

    const result = await stopWorkout(initialState, formData(validId))

    expect(mockFinalizeWorkout).not.toHaveBeenCalled()
    expect(result.status).toBe('error')
    expect(result.status === 'error' && result.error).toMatch(/not found/i)
  })

  it('returns an error when the RPC throws (e.g. DB failure)', async () => {
    const { client } = mockClient({ workout: { id: validId, status: 'recording' } })
    mockCreateClient.mockResolvedValue(client as never)
    mockFinalizeWorkout.mockRejectedValue(new Error('connection refused'))

    const result = await stopWorkout(initialState, formData(validId))

    expect(result.status).toBe('error')
    // User-facing message should not leak internal details
    expect(result.status === 'error' && result.error).toMatch(/could not stop/i)
  })

  it('returns an error when the preflight fetch fails', async () => {
    const { client } = mockClient({
      workout: null,
      fetchError: { code: '42P01' },
    })
    mockCreateClient.mockResolvedValue(client as never)

    const result = await stopWorkout(initialState, formData(validId))

    expect(result.status).toBe('error')
    expect(mockFinalizeWorkout).not.toHaveBeenCalled()
  })
})
