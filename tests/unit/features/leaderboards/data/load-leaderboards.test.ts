/**
 * @jest-environment node
 *
 * Tests for the leaderboard data loader after the Phase 4 refactor.
 * Mocks `createClient` from the server Supabase module (not service-role).
 * Verifies DB-row → LeaderboardEntry / MyRank mapping and error propagation.
 */
import { loadLeaderboardEntries, loadMyRank } from '@/features/leaderboards/data/load-leaderboards'
import { createClient } from '@/infrastructure/supabase/server'

jest.mock('@/infrastructure/supabase/server', () => ({
  createClient: jest.fn(),
}))

const mockedCreateClient = createClient as jest.Mock

function mockSupabase(rpcResults: Record<string, { data: unknown; error: { message: string } | null }>) {
  return {
    rpc: jest.fn((fn: string) =>
      Promise.resolve(rpcResults[fn] ?? { data: [], error: null }),
    ),
  }
}

afterEach(() => jest.clearAllMocks())

describe('loadLeaderboardEntries', () => {
  it('maps RPC rows to LeaderboardEntry and sets isCurrentUser', async () => {
    mockedCreateClient.mockResolvedValue(
      mockSupabase({
        get_leaderboard: {
          data: [
            { rank: 1, user_id: 'u-alice', username: 'alice', value: 500 },
            { rank: 2, user_id: 'u-bob',   username: 'bob',   value: 250 },
          ],
          error: null,
        },
      }),
    )

    const entries = await loadLeaderboardEntries('xp', 'u-alice')
    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual({
      rank: 1, userId: 'u-alice', username: 'alice', value: 500, isCurrentUser: true,
    })
    expect(entries[1]).toEqual({
      rank: 2, userId: 'u-bob', username: 'bob', value: 250, isCurrentUser: false,
    })
  })

  it('passes p_category, p_limit, p_offset to the RPC', async () => {
    const mockRpc = jest.fn().mockResolvedValue({ data: [], error: null })
    mockedCreateClient.mockResolvedValue({ rpc: mockRpc })

    await loadLeaderboardEntries('territory', 'u1', 20, 40)
    expect(mockRpc).toHaveBeenCalledWith('get_leaderboard', {
      p_category: 'territory',
      p_limit: 20,
      p_offset: 40,
    })
  })

  it('throws when the RPC returns an error', async () => {
    mockedCreateClient.mockResolvedValue(
      mockSupabase({ get_leaderboard: { data: null, error: { message: 'rpc exploded' } } }),
    )
    await expect(loadLeaderboardEntries('xp', 'u1')).rejects.toThrow('rpc exploded')
  })

  it('returns empty array when RPC returns null data', async () => {
    mockedCreateClient.mockResolvedValue(
      mockSupabase({ get_leaderboard: { data: null, error: null } }),
    )
    expect(await loadLeaderboardEntries('xp', 'u1')).toEqual([])
  })
})

describe('loadMyRank', () => {
  it('maps RPC row to MyRank', async () => {
    mockedCreateClient.mockResolvedValue(
      mockSupabase({
        get_my_rank: {
          data: [{
            rank: 5, value: 300, total_users: 100,
            percentile: '96.0', next_rank_value: 350,
          }],
          error: null,
        },
      }),
    )

    const result = await loadMyRank('xp')
    expect(result).toEqual({
      rank: 5, value: 300, totalUsers: 100, percentile: 96, nextRankValue: 350,
    })
  })

  it('maps null next_rank_value to null (caller is rank 1)', async () => {
    mockedCreateClient.mockResolvedValue(
      mockSupabase({
        get_my_rank: {
          data: [{ rank: 1, value: 999, total_users: 50, percentile: '100.0', next_rank_value: null }],
          error: null,
        },
      }),
    )
    expect((await loadMyRank('xp')).nextRankValue).toBeNull()
  })

  it('returns zeroed unranked shape when RPC returns empty array', async () => {
    mockedCreateClient.mockResolvedValue(
      mockSupabase({ get_my_rank: { data: [], error: null } }),
    )
    expect(await loadMyRank('xp')).toEqual({
      rank: 0, value: 0, totalUsers: 0, percentile: 0, nextRankValue: null,
    })
  })

  it('throws when RPC returns an error', async () => {
    mockedCreateClient.mockResolvedValue(
      mockSupabase({ get_my_rank: { data: null, error: { message: 'auth failed' } } }),
    )
    await expect(loadMyRank('xp')).rejects.toThrow('auth failed')
  })
})
