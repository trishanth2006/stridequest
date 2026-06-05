import { getWorkoutXpBreakdown } from '@/features/xp/services/profile'
import type { SupabaseClient } from '@supabase/supabase-js'

describe('getWorkoutXpBreakdown', () => {
  const mockSupabase = (data: Record<string, unknown>[]) => ({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ data, error: null }),
  }) as unknown as SupabaseClient

  it('calculates workout only correctly', async () => {
    const supabase = mockSupabase([
      { event_type: 'workout', xp_awarded: 50 },
    ])
    
    const result = await getWorkoutXpBreakdown(supabase, 'workout-1')
    
    expect(result).toEqual({
      workoutXp: 50,
      captureXp: 0,
      stealXp: 0,
      totalXp: 50,
    })
  })

  it('calculates capture only correctly', async () => {
    const supabase = mockSupabase([
      { event_type: 'capture', xp_awarded: 20 },
      { event_type: 'capture', xp_awarded: 10 },
    ])
    
    const result = await getWorkoutXpBreakdown(supabase, 'workout-1')
    
    expect(result).toEqual({
      workoutXp: 0,
      captureXp: 30,
      stealXp: 0,
      totalXp: 30,
    })
  })

  it('calculates steal only correctly', async () => {
    const supabase = mockSupabase([
      { event_type: 'steal', xp_awarded: 25 },
    ])
    
    const result = await getWorkoutXpBreakdown(supabase, 'workout-1')
    
    expect(result).toEqual({
      workoutXp: 0,
      captureXp: 0,
      stealXp: 25,
      totalXp: 25,
    })
  })

  it('calculates mixed workout correctly', async () => {
    const supabase = mockSupabase([
      { event_type: 'workout', xp_awarded: 30 },
      { event_type: 'capture', xp_awarded: 20 },
      { event_type: 'steal', xp_awarded: 25 },
    ])
    
    const result = await getWorkoutXpBreakdown(supabase, 'workout-1')
    
    expect(result).toEqual({
      workoutXp: 30,
      captureXp: 20,
      stealXp: 25,
      totalXp: 75,
    })
  })

  it('handles empty workout', async () => {
    const supabase = mockSupabase([])
    
    const result = await getWorkoutXpBreakdown(supabase, 'workout-1')
    
    expect(result).toEqual({
      workoutXp: 0,
      captureXp: 0,
      stealXp: 0,
      totalXp: 0,
    })
  })
})
