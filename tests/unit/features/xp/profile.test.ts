/**
 * @jest-environment node
 *
 * Unit tests for the read-side XP profile service (02E-01). Mocked client; no DB.
 */
import {
  getUserXP,
  getUserLevel,
  getRecentXPEvents,
  getWorkoutXpHistory,
} from '@/features/xp/services/profile'

const userId = '987e6543-e21b-12d3-a456-426614174999'

type AnyResult = { data: unknown; error: { message: string } | null; count?: number }

function mockSupabase(result: AnyResult) {
  const builder: Record<string, unknown> = {}
  builder.select = jest.fn(() => builder)
  builder.eq = jest.fn(() => builder)
  builder.not = jest.fn(() => builder)
  builder.order = jest.fn(() => builder)
  builder.limit = jest.fn(() => builder)
  builder.maybeSingle = jest.fn(() => Promise.resolve(result))
  builder.then = (resolve: (v: AnyResult) => unknown) => resolve(result)
  const from = jest.fn(() => builder)
  return { client: { from }, from, builder }
}

describe('getUserXP (02E-01)', () => {
  it('maps an existing user_xp row to the domain shape', async () => {
    const { client, from } = mockSupabase({
      data: { user_id: userId, total_xp: 300, level: 3, updated_at: '2026-06-05T10:00:00Z' },
      error: null,
    })

    const result = await getUserXP(client as never, userId)

    expect(from).toHaveBeenCalledWith('user_xp')
    expect(result).toEqual({ userId, totalXp: 300, level: 3, updatedAt: '2026-06-05T10:00:00Z' })
  })

  it('returns a zeroed level-1 record when the user has no XP yet', async () => {
    const { client } = mockSupabase({ data: null, error: null })
    const result = await getUserXP(client as never, userId)
    expect(result.totalXp).toBe(0)
    expect(result.level).toBe(1)
    expect(result.userId).toBe(userId)
  })

  it('propagates a DB error by throwing', async () => {
    const { client } = mockSupabase({ data: null, error: { message: 'boom' } })
    await expect(getUserXP(client as never, userId)).rejects.toThrow('boom')
  })
})

describe('getUserLevel (02E-01)', () => {
  it('derives the level from total XP via the MVP formula', async () => {
    const { client } = mockSupabase({
      data: { user_id: userId, total_xp: 600, level: 4, updated_at: '2026-06-05T10:00:00Z' },
      error: null,
    })
    expect(await getUserLevel(client as never, userId)).toBe(4) // 500..999 => L4
  })

  it('is level 1 for a user with no XP', async () => {
    const { client } = mockSupabase({ data: null, error: null })
    expect(await getUserLevel(client as never, userId)).toBe(1)
  })
})

describe('getRecentXPEvents (02E-01)', () => {
  it('maps events newest-first and queries with order + limit', async () => {
    const { client, from, builder } = mockSupabase({
      data: [
        { id: 'e1', user_id: userId, workout_id: 'w1', event_type: 'workout', xp_awarded: 30, created_at: '2026-06-05T10:00:00Z' },
        { id: 'e2', user_id: userId, workout_id: 'w1', event_type: 'capture', xp_awarded: 20, created_at: '2026-06-05T09:59:00Z' },
      ],
      error: null,
    })

    const result = await getRecentXPEvents(client as never, userId, 5)

    expect(from).toHaveBeenCalledWith('xp_events')
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(builder.limit).toHaveBeenCalledWith(5)
    expect(result).toEqual([
      { id: 'e1', userId, workoutId: 'w1', eventType: 'workout', xpAwarded: 30, createdAt: '2026-06-05T10:00:00Z' },
      { id: 'e2', userId, workoutId: 'w1', eventType: 'capture', xpAwarded: 20, createdAt: '2026-06-05T09:59:00Z' },
    ])
  })

  it('defaults to a limit of 10', async () => {
    const { client, builder } = mockSupabase({ data: [], error: null })
    await getRecentXPEvents(client as never, userId)
    expect(builder.limit).toHaveBeenCalledWith(10)
  })

  it('propagates a DB error by throwing', async () => {
    const { client } = mockSupabase({ data: null, error: { message: 'down' } })
    await expect(getRecentXPEvents(client as never, userId)).rejects.toThrow('down')
  })
})

describe('getWorkoutXpHistory (02E-02)', () => {
  it('maps completed workouts with xp_awarded newest-first and applies the expected filters', async () => {
    const { client, from, builder } = mockSupabase({
      data: [
        {
          id: 'w2',
          started_at: '2026-06-05T10:00:00Z',
          xp_awarded: 45,
          distance_m: 850,
          duration_s: 360,
        },
        {
          id: 'w1',
          started_at: '2026-06-04T09:00:00Z',
          xp_awarded: 30,
          distance_m: 1100,
          duration_s: 420,
        },
      ],
      error: null,
    })

    const result = await getWorkoutXpHistory(client as never, userId, 5)

    expect(from).toHaveBeenCalledWith('workouts')
    expect(builder.eq).toHaveBeenNthCalledWith(1, 'user_id', userId)
    expect(builder.eq).toHaveBeenNthCalledWith(2, 'status', 'completed')
    expect(builder.not).toHaveBeenCalledWith('xp_awarded', 'is', null)
    expect(builder.order).toHaveBeenCalledWith('started_at', { ascending: false })
    expect(builder.limit).toHaveBeenCalledWith(5)
    expect(result).toEqual([
      {
        workoutId: 'w2',
        startedAt: '2026-06-05T10:00:00Z',
        xpAwarded: 45,
        distanceM: 850,
        durationS: 360,
      },
      {
        workoutId: 'w1',
        startedAt: '2026-06-04T09:00:00Z',
        xpAwarded: 30,
        distanceM: 1100,
        durationS: 420,
      },
    ])
  })

  it('defaults to a limit of 10', async () => {
    const { client, builder } = mockSupabase({ data: [], error: null })
    await getWorkoutXpHistory(client as never, userId)
    expect(builder.limit).toHaveBeenCalledWith(10)
  })

  it('propagates a DB error by throwing', async () => {
    const { client } = mockSupabase({ data: null, error: { message: 'history down' } })
    await expect(getWorkoutXpHistory(client as never, userId)).rejects.toThrow('history down')
  })
})
