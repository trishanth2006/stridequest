import { startWorkout, discardWorkout, getActiveWorkout } from '@/features/running/services/workout'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getSession: jest.fn(),
    },
  },
}))

import { supabase } from '@/lib/supabase'
const mockSupabase = supabase as jest.Mocked<typeof supabase>

const mockFrom = (returnValue: unknown) => {
  const chain = {
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(returnValue),
    single: jest.fn().mockResolvedValue(returnValue),
  }
  ;(mockSupabase.from as jest.Mock).mockReturnValue(chain)
  return chain
}

describe('startWorkout', () => {
  it('returns workoutId on successful insert', async () => {
    const chain = mockFrom(null)
    chain.single.mockResolvedValue({ data: { id: 'workout-123' }, error: null })
    chain.insert.mockReturnValue(chain)

    const result = await startWorkout()
    expect(result.workoutId).toBe('workout-123')
  })

  it('throws on duplicate active workout (Postgres 23505)', async () => {
    const chain = mockFrom(null)
    chain.single.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    })
    chain.insert.mockReturnValue(chain)

    await expect(startWorkout()).rejects.toThrow('active workout')
  })
})

describe('discardWorkout', () => {
  it('resolves on successful update', async () => {
    const chain = mockFrom(null)
    chain.update.mockReturnValue(chain)
    chain.eq.mockResolvedValue({ error: null })

    await expect(discardWorkout('workout-123')).resolves.toBeUndefined()
  })
})

describe('getActiveWorkout', () => {
  it('returns null when no active workout exists', async () => {
    const chain = mockFrom({ data: null, error: null })
    ;(chain.maybeSingle as jest.Mock).mockResolvedValue({ data: null, error: null })

    const result = await getActiveWorkout()
    expect(result).toBeNull()
  })

  it('returns the active workout when one exists', async () => {
    const workout = { id: 'workout-abc', started_at: '2026-06-21T10:00:00Z', status: 'recording' }
    const chain = mockFrom({ data: workout, error: null })
    ;(chain.maybeSingle as jest.Mock).mockResolvedValue({ data: workout, error: null })

    const result = await getActiveWorkout()
    expect(result?.id).toBe('workout-abc')
  })
})
