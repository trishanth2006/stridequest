import { getRunnerProfile, getRecentActivity, getUserIdByUsername } from '@/features/profiles/services/profile-summary'
import { createServiceRoleClient } from '@/infrastructure/supabase/service-role'

jest.mock('@/infrastructure/supabase/service-role', () => ({
  createServiceRoleClient: jest.fn(),
}))

jest.mock('@/features/leaderboards/data/load-leaderboards', () => ({
  loadLeaderboardData: jest.fn().mockResolvedValue({
    users: [{ userId: 'user-1', username: 'Trishanth', createdAt: '2026-01-01' }],
    standings: [{ userId: 'user-1', totalXp: 875, updatedAt: '2026-01-01' }],
    contributions: [],
    cells: [],
    weeklyEvents: [],
  }),
}))

describe('Profile Summary Service', () => {
  const mockSupabase = {
    from: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(createServiceRoleClient as jest.Mock).mockReturnValue(mockSupabase)
  })

  it('returns profile not found for unknown username', async () => {
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    })

    const userId = await getUserIdByUsername('unknown')
    expect(userId).toBeNull()
  })

  it('aggregates profile correctly', async () => {
    // Setup mock chain for 6 queries in Promise.all inside getRunnerProfile
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'user-1', username: 'Trishanth' } }) }) }) }
      }
      if (table === 'user_xp') {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { level: 5, total_xp: 875 } }) }) }) }
      }
      if (table === 'workouts') {
        return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [{ id: 'w1', distance_m: 5000, status: 'completed', started_at: '2026-06-01T10:00:00Z', avg_pace_s_per_km: 300 }] }) }) }) }
      }
      if (table === 'cell_ownership') {
        return { select: () => ({ eq: () => Promise.resolve({ data: [{ cell_id: 'c1' }, { cell_id: 'c2' }] }) }) }
      }
      if (table === 'territory_captures') {
        return { select: () => ({ eq: () => Promise.resolve({ data: [{ action: 'claim', workout_id: 'w1' }, { action: 'steal', workout_id: 'w1' }] }) }) }
      }
      if (table === 'xp_events') {
        return { select: () => ({ eq: () => Promise.resolve({ data: [] }) }) }
      }
    })

    const profile = await getRunnerProfile('user-1')
    
    expect(profile).toBeDefined()
    expect(profile?.username).toBe('Trishanth')
    expect(profile?.level).toBe(5)
    expect(profile?.totalXp).toBe(875)
    expect(profile?.territoriesOwned).toBe(2)
    expect(profile?.territoriesCaptured).toBe(1)
    expect(profile?.territoriesStolen).toBe(1)
    expect(profile?.totalDistanceM).toBe(5000)
    expect(profile?.totalWorkouts).toBe(1)
    expect(profile?.fastest5K).toBe(1500) // 5 * 300
  })

  it('merges activity feed chronologically', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'workouts') {
        return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [
          { id: 'w1', distance_m: 5000, started_at: '2026-06-01T10:00:00Z', status: 'completed' },
          { id: 'w2', distance_m: 10000, started_at: '2026-06-02T10:00:00Z', status: 'completed' }
        ]}) }) }) }
      }
      if (table === 'territory_captures') {
        return { select: () => ({ eq: () => Promise.resolve({ data: [
          { workout_id: 'w1', captured_at: '2026-06-01T10:30:00Z', action: 'claim' }
        ]}) }) }
      }
      if (table === 'xp_events') {
        return { select: () => ({ eq: () => Promise.resolve({ data: [
          { workout_id: 'w2', xp_awarded: 100, created_at: '2026-06-02T11:00:00Z' }
        ]}) }) }
      }
      if (table === 'user_xp') {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { level: 5, total_xp: 875 } }) }) }) }
      }
    })

    const feed = await getRecentActivity('user-1')
    expect(feed.length).toBeGreaterThan(0)
    // Check chronological sorting (newest first)
    for (let i = 1; i < feed.length; i++) {
      expect(new Date(feed[i-1].createdAt).getTime()).toBeGreaterThanOrEqual(new Date(feed[i].createdAt).getTime())
    }
  })

  it('returns top unlocked achievements', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'profiles') return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: '1' } }) }) }) }
      if (table === 'user_xp') return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { level: 5, total_xp: 1000 } }) }) }) }
      if (table === 'workouts') return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: Array.from({ length: 15 }, (_, i) => ({ id: `w${i}`, distance_m: 5000, started_at: '2026-01-01', status: 'completed' })) }) }) }) }
      if (table === 'cell_ownership') return { select: () => ({ eq: () => Promise.resolve({ data: [] }) }) }
      if (table === 'territory_captures') return { select: () => ({ eq: () => Promise.resolve({ data: [] }) }) }
      if (table === 'xp_events') return { select: () => ({ eq: () => Promise.resolve({ data: [] }) }) }
    })

    const profile = await getRunnerProfile('user-1')
    expect(profile?.topAchievements.length).toBeLessThanOrEqual(3)
    expect(profile?.topAchievements[0].unlocked).toBe(true)
  })

  it('calculates profile completion percentage', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'profiles') return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: '1' } }) }) }) }
      if (table === 'user_xp') return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { level: 5, total_xp: 1000 } }) }) }) }
      if (table === 'workouts') return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [] }) }) }) }
      if (table === 'cell_ownership') return { select: () => ({ eq: () => Promise.resolve({ data: [] }) }) }
      if (table === 'territory_captures') return { select: () => ({ eq: () => Promise.resolve({ data: [] }) }) }
      if (table === 'xp_events') return { select: () => ({ eq: () => Promise.resolve({ data: [] }) }) }
    })

    const profile = await getRunnerProfile('user-1')
    // No workouts/achievements -> completion is just the baseline
    expect(profile?.profileCompletion).toBeDefined()
    expect(typeof profile?.profileCompletion).toBe('number')
  })
})
