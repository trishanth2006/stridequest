import { getActiveWorkout } from '@/features/running/services/workout'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
    })),
  },
}))

import { supabase } from '@/lib/supabase'

describe('getActiveWorkout (recovery)', () => {
  it('returns null when no recording workout exists', async () => {
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    }
    ;(supabase.from as jest.Mock).mockReturnValue(chain)

    const result = await getActiveWorkout()
    expect(result).toBeNull()
  })

  it('returns the workout when a recording workout exists', async () => {
    const workout = { id: 'w-1', started_at: '2026-06-21T08:00:00Z', status: 'recording' }
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: workout, error: null }),
    }
    ;(supabase.from as jest.Mock).mockReturnValue(chain)

    const result = await getActiveWorkout()
    expect(result?.id).toBe('w-1')
    expect(result?.status).toBe('recording')
  })
})
