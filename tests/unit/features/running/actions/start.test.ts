/**
 * @jest-environment node
 */
import { startWorkout } from '@/features/running/actions'

jest.mock('@/infrastructure/supabase/server', () => ({
  createClient: jest.fn(),
}))

import { createClient } from '@/infrastructure/supabase/server'

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

type InsertResult = { data: { id: string } | null; error: { code: string } | null }

function mockClient(opts: {
  user: { id: string } | null
  insertResult?: InsertResult
}) {
  const single = jest.fn().mockResolvedValue(opts.insertResult ?? { data: null, error: null })
  const select = jest.fn().mockReturnValue({ single })
  const insert = jest.fn().mockReturnValue({ select })
  const from = jest.fn().mockReturnValue({ insert })
  const getUser = jest.fn().mockResolvedValue({ data: { user: opts.user }, error: null })
  return { client: { auth: { getUser }, from }, insert, from }
}

describe('startWorkout', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns an error when the user is not authenticated', async () => {
    const { client } = mockClient({ user: null })
    mockCreateClient.mockResolvedValue(client as never)

    const result = await startWorkout()

    expect(result.status).toBe('error')
  })

  it('inserts a workout for the authenticated user and returns its id', async () => {
    const { client, insert, from } = mockClient({
      user: { id: 'user-1' },
      insertResult: { data: { id: 'workout-1' }, error: null },
    })
    mockCreateClient.mockResolvedValue(client as never)

    const result = await startWorkout()

    expect(from).toHaveBeenCalledWith('workouts')
    expect(insert).toHaveBeenCalledWith({ user_id: 'user-1' })
    expect(result).toEqual({ status: 'success', workoutId: 'workout-1' })
  })

  it('FR-WL-2: rejects a second active workout (unique violation 23505)', async () => {
    const { client } = mockClient({
      user: { id: 'user-1' },
      insertResult: { data: null, error: { code: '23505' } },
    })
    mockCreateClient.mockResolvedValue(client as never)

    const result = await startWorkout()

    expect(result.status).toBe('error')
    expect(result.status === 'error' && result.error).toMatch(/active workout/i)
  })

  it('returns a generic error on an unexpected insert failure', async () => {
    const { client } = mockClient({
      user: { id: 'user-1' },
      insertResult: { data: null, error: { code: '500' } },
    })
    mockCreateClient.mockResolvedValue(client as never)

    const result = await startWorkout()

    expect(result.status).toBe('error')
  })
})
