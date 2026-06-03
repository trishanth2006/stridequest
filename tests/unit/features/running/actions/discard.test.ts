/**
 * @jest-environment node
 */
import { discardWorkout } from '@/features/running/actions'

jest.mock('@/infrastructure/supabase/server', () => ({
  createClient: jest.fn(),
}))

import { createClient } from '@/infrastructure/supabase/server'

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

const initialState = { status: 'idle' as const }
const validId = '123e4567-e89b-12d3-a456-426614174000'

type Workout = { id: string; status: string } | null

function formData(workoutId: string): FormData {
  const fd = new FormData()
  fd.set('workoutId', workoutId)
  return fd
}

function mockClient(opts: { workout: Workout; updateError?: { code: string } | null }) {
  const maybeSingle = jest.fn().mockResolvedValue({ data: opts.workout, error: null })
  const selectEq = jest.fn().mockReturnValue({ maybeSingle })
  const select = jest.fn().mockReturnValue({ eq: selectEq })
  const updateEq = jest.fn().mockResolvedValue({ error: opts.updateError ?? null })
  const update = jest.fn().mockReturnValue({ eq: updateEq })
  const from = jest.fn().mockReturnValue({ select, update })
  return { client: { from }, update }
}

describe('discardWorkout', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rejects an invalid workoutId before touching the database', async () => {
    const result = await discardWorkout(initialState, formData('not-a-uuid'))
    expect(result.status).toBe('error')
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('FR-WL-4: discards a recording workout without finalize', async () => {
    const { client, update } = mockClient({ workout: { id: validId, status: 'recording' } })
    mockCreateClient.mockResolvedValue(client as never)

    const result = await discardWorkout(initialState, formData(validId))

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'discarded' })
    )
    const payload = update.mock.calls[0][0] as Record<string, unknown>
    expect(payload).not.toHaveProperty('xp_awarded')
    expect(result).toEqual({ status: 'success', workoutId: validId })
  })

  it('discarding an already-discarded workout is an idempotent no-op success', async () => {
    const { client, update } = mockClient({ workout: { id: validId, status: 'discarded' } })
    mockCreateClient.mockResolvedValue(client as never)

    const result = await discardWorkout(initialState, formData(validId))

    expect(update).not.toHaveBeenCalled()
    expect(result).toEqual({ status: 'success', workoutId: validId })
  })

  it('rejects discarding a completed workout', async () => {
    const { client, update } = mockClient({ workout: { id: validId, status: 'completed' } })
    mockCreateClient.mockResolvedValue(client as never)

    const result = await discardWorkout(initialState, formData(validId))

    expect(update).not.toHaveBeenCalled()
    expect(result.status).toBe('error')
  })

  it('returns a not-found error when the workout does not exist (or is not owned)', async () => {
    const { client } = mockClient({ workout: null })
    mockCreateClient.mockResolvedValue(client as never)

    const result = await discardWorkout(initialState, formData(validId))

    expect(result.status).toBe('error')
    expect(result.status === 'error' && result.error).toMatch(/not found/i)
  })
})
