/**
 * @jest-environment node
 *
 * Unit tests for the server-only leaderboard loader (02E-06). The service-role
 * client is mocked (mirrors the xp profile-service test pattern); no DB / no env.
 * Covers DB-row → input-shape mapping and error propagation only — ranking logic
 * lives in the separately-tested pure services.
 */
import { loadLeaderboardData } from '@/features/leaderboards/data/load-leaderboards'
import { createServiceRoleClient } from '@/infrastructure/supabase/service-role'

jest.mock('@/infrastructure/supabase/service-role', () => ({
  createServiceRoleClient: jest.fn(),
}))

type AnyResult = { data: unknown; error: { message: string } | null }

/** A client whose `from(table)` resolves the per-table result through any chain. */
function mockClient(results: Record<string, AnyResult>) {
  const builderFor = (table: string) => {
    const result = results[table] ?? { data: [], error: null }
    const builder: Record<string, unknown> = {}
    builder.select = () => builder
    builder.eq = () => builder
    builder.not = () => builder
    builder.gte = () => builder
    builder.then = (resolve: (v: AnyResult) => unknown) => resolve(result)
    return builder
  }
  return { from: (table: string) => builderFor(table) }
}

const mockedFactory = createServiceRoleClient as jest.Mock

afterEach(() => jest.clearAllMocks())

describe('loadLeaderboardData', () => {
  it('maps each table to its domain input shape', async () => {
    mockedFactory.mockReturnValue(
      mockClient({
        profiles: {
          data: [{ id: 'u1', username: 'alice', created_at: '2026-01-01T00:00:00Z' }],
          error: null,
        },
        user_xp: {
          data: [{ user_id: 'u1', total_xp: 100, updated_at: '2026-06-01T00:00:00Z' }],
          error: null,
        },
        workouts: {
          data: [
            { user_id: 'u1', distance_m: 5000, started_at: '2026-06-01T00:00:00Z' },
            { user_id: 'u1', distance_m: null, started_at: '2026-06-02T00:00:00Z' },
          ],
          error: null,
        },
        cell_ownership: {
          data: [{ owner_user_id: 'u1', updated_at: '2026-06-02T00:00:00Z' }],
          error: null,
        },
        xp_events: {
          data: [{ user_id: 'u1', xp_awarded: 50, created_at: '2026-06-03T00:00:00Z' }],
          error: null,
        },
      }),
    )

    const data = await loadLeaderboardData(new Date('2026-06-04T00:00:00Z'))

    expect(data.users).toEqual([
      { userId: 'u1', username: 'alice', createdAt: '2026-01-01T00:00:00Z' },
    ])
    expect(data.standings).toEqual([
      { userId: 'u1', totalXp: 100, updatedAt: '2026-06-01T00:00:00Z' },
    ])
    expect(data.contributions).toEqual([
      { userId: 'u1', distanceM: 5000, startedAt: '2026-06-01T00:00:00Z' },
      // null distance coerces to 0 (defended by the pure ranker's value > 0 filter).
      { userId: 'u1', distanceM: 0, startedAt: '2026-06-02T00:00:00Z' },
    ])
    expect(data.cells).toEqual([
      { ownerUserId: 'u1', updatedAt: '2026-06-02T00:00:00Z' },
    ])
    expect(data.weeklyEvents).toEqual([
      { userId: 'u1', xpAwarded: 50, createdAt: '2026-06-03T00:00:00Z' },
    ])
  })

  it('throws when any query returns an error', async () => {
    mockedFactory.mockReturnValue(
      mockClient({
        profiles: { data: null, error: { message: 'boom' } },
      }),
    )

    await expect(
      loadLeaderboardData(new Date('2026-06-04T00:00:00Z')),
    ).rejects.toThrow('boom')
  })
})
