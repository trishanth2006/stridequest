import { getWorkoutSummary } from '@/features/running/services/workouts'
import type { SupabaseClient } from '@supabase/supabase-js'

describe('getWorkoutSummary', () => {
  it('maps workout summary correctly with mixed data', async () => {
    const mockSupabase = {
      from: jest.fn().mockImplementation((table) => {
        if (table === 'workouts') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                distance_m: 5000,
                duration_s: 1800,
                avg_pace_s_per_km: 360,
                ended_at: '2023-01-01T10:00:00Z',
                xp_awarded: null
              },
              error: null
            })
          }
        }
        if (table === 'territory_captures') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({
              data: [
                { action: 'claim' },
                { action: 'claim' },
                { action: 'steal' },
                { action: 'defend' },
                { action: 'defend' }
              ],
              error: null
            })
          }
        }
        if (table === 'xp_events') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({
              data: [
                { xp_awarded: 50 },
                { xp_awarded: 100 }
              ],
              error: null
            })
          }
        }
      })
    } as unknown as SupabaseClient

    const result = await getWorkoutSummary(mockSupabase, 'workout-1')
    
    expect(result).toEqual({
      workoutId: 'workout-1',
      distanceM: 5000,
      durationS: 1800,
      avgPaceSPerKm: 360,
      cellsClaimed: 2,
      cellsStolen: 1,
      cellsDefended: 2,
      xpEarned: 150,
      completedAt: '2023-01-01T10:00:00Z'
    })
  })

  it('handles empty states correctly', async () => {
    const mockSupabase = {
      from: jest.fn().mockImplementation((table) => {
        if (table === 'workouts') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                distance_m: null,
                duration_s: null,
                avg_pace_s_per_km: null,
                ended_at: null,
                xp_awarded: 0
              },
              error: null
            })
          }
        }
        if (table === 'territory_captures') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({
              data: [],
              error: null
            })
          }
        }
        if (table === 'xp_events') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({
              data: [],
              error: null
            })
          }
        }
      })
    } as unknown as SupabaseClient

    const result = await getWorkoutSummary(mockSupabase, 'workout-1')
    
    expect(result).toEqual({
      workoutId: 'workout-1',
      distanceM: 0,
      durationS: 0,
      avgPaceSPerKm: null,
      cellsClaimed: 0,
      cellsStolen: 0,
      cellsDefended: 0,
      xpEarned: 0,
      completedAt: null
    })
  })
})
