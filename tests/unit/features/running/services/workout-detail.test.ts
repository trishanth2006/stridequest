import { getWorkoutDetail } from '@/features/running/services/workout-detail'

// Mock Supabase
const chain = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  single: jest.fn()
}
const mockSupabase: any = {
  from: jest.fn(() => chain)
}

describe('workout-detail service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Default chain method responses so we don't have to perfectly align mockResolvedValueOnce
    chain.single.mockResolvedValue({ data: null, error: { message: 'Not found' } })
    chain.eq.mockResolvedValue({ data: [] })
    chain.order.mockResolvedValue({ data: [] })
  })

  it('handles workout not found', async () => {
    const result = await getWorkoutDetail(mockSupabase as any, 'missing')
    expect(result).toBeNull()
  })

  it('aggregates workout detail correctly', async () => {
    const workoutId = 'w1'
    
    // 1. single() for workout
    chain.single.mockResolvedValueOnce({
      data: {
        id: workoutId,
        user_id: 'u1',
        status: 'completed',
        started_at: '2025-01-01T10:00:00Z',
        ended_at: '2025-01-01T10:30:00Z',
        distance_m: 5000,
        duration_s: 1800,
        avg_pace_s_per_km: 360,
        xp_awarded: 60
      },
      error: null
    })

    // 2. We bypass strict ordering by just returning static mocks that satisfy all `.eq` and `.order` calls
    // because getWorkoutDetail handles whatever is in data arrays.
    
    // Mocks for the various queries
    chain.order.mockImplementation(() => Promise.resolve({
      data: [
        { lat: 10, lng: 20, recorded_at: '2025-01-01T10:00:00Z', cell_id: '8928308280fffff', action: 'claim', captured_at: '2025-01-01T10:15:00Z' }
      ]
    }))
    
    chain.eq.mockImplementation(() => Promise.resolve({
      data: [
        { id: workoutId, status: 'completed', started_at: '2025-01-01T10:00:00Z', distance_m: 5000, duration_s: 1800, avg_pace_s_per_km: 360, xp_awarded: 10, event_type: 'capture', created_at: '2025-01-01T10:15:00Z' }
      ]
    }))

    const result = await getWorkoutDetail(mockSupabase as any, workoutId)

    expect(result).not.toBeNull()
    expect(result?.distanceM).toBe(5000)
    expect(result?.routePoints.length).toBe(1)
    expect(result?.territoryCaptures.length).toBe(1)
    
    expect(result?.territoryBreakdown.claimed).toBe(1)
    expect(result?.territoryBreakdown.totalImpact).toBe(1)
    
    expect(result?.prFlags.fastest5k).toBe(true) // first 5k
  })
})
