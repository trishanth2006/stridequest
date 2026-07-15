/**
 * @jest-environment node
 */
import { fetchLeaderboard, fetchMyRank } from '../../../src/features/leaderboards/services/leaderboards'
import { supabase } from '@/lib/supabase'

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: jest.fn() },
}))

const mockedRpc = supabase.rpc as jest.Mock
afterEach(() => jest.clearAllMocks())

describe('fetchLeaderboard', () => {
  it('maps RPC rows to LeaderboardEntry with isCurrentUser set', async () => {
    mockedRpc.mockResolvedValue({
      data: [
        { rank: 1, user_id: 'u-alice', username: 'alice', value: 500 },
        { rank: 2, user_id: 'u-bob', username: 'bob', value: 250 },
      ],
      error: null,
    })

    const entries = await fetchLeaderboard('xp', 'u-alice')
    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual({
      rank: 1,
      userId: 'u-alice',
      username: 'alice',
      value: 500,
      isCurrentUser: true,
    })
    expect(entries[1].isCurrentUser).toBe(false)
  })

  it('passes p_category / p_limit / p_offset to the RPC', async () => {
    mockedRpc.mockResolvedValue({ data: [], error: null })

    await fetchLeaderboard('distance', 'u1', 20, 20)
    expect(mockedRpc).toHaveBeenCalledWith('get_leaderboard', {
      p_category: 'distance',
      p_limit: 20,
      p_offset: 20,
    })
  })

  it('throws on RPC error', async () => {
    mockedRpc.mockResolvedValue({ data: null, error: { message: 'connection refused' } })
    await expect(fetchLeaderboard('xp', 'u1')).rejects.toThrow('connection refused')
  })

  it('returns empty array when data is null', async () => {
    mockedRpc.mockResolvedValue({ data: null, error: null })
    expect(await fetchLeaderboard('xp', 'u1')).toEqual([])
  })
})

describe('fetchMyRank', () => {
  it('maps RPC row to MyRank', async () => {
    mockedRpc.mockResolvedValue({
      data: [
        {
          rank: 3,
          value: 400,
          total_users: 50,
          percentile: '96.0',
          next_rank_value: 450,
        },
      ],
      error: null,
    })
    expect(await fetchMyRank('xp')).toEqual({
      rank: 3,
      value: 400,
      totalUsers: 50,
      percentile: 96,
      nextRankValue: 450,
    })
  })

  it('maps null next_rank_value for rank-1 user', async () => {
    mockedRpc.mockResolvedValue({
      data: [
        {
          rank: 1,
          value: 999,
          total_users: 50,
          percentile: '100.0',
          next_rank_value: null,
        },
      ],
      error: null,
    })
    expect((await fetchMyRank('territory')).nextRankValue).toBeNull()
  })

  it('returns zeroed unranked shape for empty data', async () => {
    mockedRpc.mockResolvedValue({ data: [], error: null })
    expect(await fetchMyRank('weekly')).toEqual({
      rank: 0,
      value: 0,
      totalUsers: 0,
      percentile: 0,
      nextRankValue: null,
    })
  })

  it('throws on RPC error', async () => {
    mockedRpc.mockResolvedValue({ data: null, error: { message: 'not auth' } })
    await expect(fetchMyRank('xp')).rejects.toThrow('not auth')
  })
})
