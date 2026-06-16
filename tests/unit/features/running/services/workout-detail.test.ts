import { getWorkoutDetail } from '@/features/running/services/workout-detail'

// Mock Supabase
const chain: any = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  then: jest.fn((resolve) => resolve({ data: [], error: null }))
}
const mockSupabase: any = {
  from: jest.fn(() => chain),
  // Route-anchors RPC (used for route-matching); not part of the `from` chain.
  rpc: jest.fn(() => Promise.resolve({ data: [], error: null }))
}

describe('workout-detail service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    chain.then.mockImplementation((resolve: any) => resolve({ data: [], error: null }))
    mockSupabase.rpc.mockResolvedValue({ data: [], error: null })
  })

  it('handles workout not found', async () => {
    chain.then.mockImplementationOnce((resolve: any) => resolve({ data: null, error: { message: 'Not found' } }))
    const result = await getWorkoutDetail(mockSupabase as any, 'missing')
    expect(result).toBeNull()
  })

  it('aggregates workout detail correctly', async () => {
    const workoutId = 'w1'
    
    // We have 7 await calls in getWorkoutDetail.
    // 1. single() for workout
    // 2. order() for route points
    // 3. order() for captures
    // 4. eq() for xp events
    // 5. eq() for all user workouts
    // 6. eq() for all user captures
    // 7. eq() for all user xp
    
    chain.then
      // 1. Workout
      .mockImplementationOnce((resolve: any) => resolve({
        data: { id: workoutId, user_id: 'u1', status: 'completed', started_at: '2025-01-01T10:00:00Z', ended_at: '2025-01-01T10:30:00Z', distance_m: 5000, duration_s: 1800, avg_pace_s_per_km: 360, xp_awarded: 60 },
        error: null
      }))
      // 2. route_points
      .mockImplementationOnce((resolve: any) => resolve({
        data: [{ lat: 10, lng: 20, recorded_at: '2025-01-01T10:00:00Z' }]
      }))
      // 3. territory_captures
      .mockImplementationOnce((resolve: any) => resolve({
        data: [{ id: 'c1', cell_id: '8928308280fffff', action: 'claim', captured_at: '2025-01-01T10:15:00Z' }]
      }))
      // 4. xp_events
      .mockImplementationOnce((resolve: any) => resolve({
        data: [{ xp_awarded: 10, event_type: 'capture', created_at: '2025-01-01T10:15:00Z' }]
      }))
      // 5. all user workouts
      .mockImplementationOnce((resolve: any) => resolve({
        data: [{ id: workoutId, status: 'completed', started_at: '2025-01-01T10:00:00Z', distance_m: 5000, duration_s: 1800, avg_pace_s_per_km: 360, xp_awarded: 60 }]
      }))
      // 6. all user captures
      .mockImplementationOnce((resolve: any) => resolve({ data: [] }))
      // 7. all user xp events
      .mockImplementationOnce((resolve: any) => resolve({ data: [] }))

    const result = await getWorkoutDetail(mockSupabase as any, workoutId)

    expect(result).not.toBeNull()
    expect(result?.distanceM).toBe(5000)
    expect(result?.routePoints.length).toBe(1)
    expect(result?.territoryCaptures.length).toBe(1)
    
    expect(result?.territoryBreakdown.claimed).toBe(1)
    expect(result?.territoryBreakdown.totalImpact).toBe(1)

    expect(result?.prFlags.fastest5k).toBe(true) // first 5k

    // Server-side analytics fields are present and well-formed.
    expect(Array.isArray(result?.splits)).toBe(true)
    expect(Array.isArray(result?.chartSeries)).toBe(true)
    expect(Array.isArray(result?.insights)).toBe(true)
    expect(result?.elevation.hasData).toBe(false) // single point → no elevation
    expect(result?.comparison.hasHistory).toBe(false) // only this workout exists
  })
})
