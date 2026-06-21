/**
 * @jest-environment node
 */
import { getWorkoutHistory, getRecentWorkouts, getDashboardActivity, type DashboardActivityRow } from '@/features/running/services/history'

const mockWorkouts = [
  {
    id: 'w1',
    started_at: '2026-06-03T10:00:00Z',
    distance_m: 5000,
    duration_s: 1800,
    avg_pace_s_per_km: 360,
    status: 'completed',
  },
  {
    id: 'w2',
    started_at: '2026-06-02T09:00:00Z',
    distance_m: 3000,
    duration_s: 1200,
    avg_pace_s_per_km: 400,
    status: 'completed',
  },
]

type MockResult = {
  data: typeof mockWorkouts | null
  error: { message: string } | null
}

function mockSupabase(result: MockResult) {
  const order = jest.fn().mockResolvedValue(result)
  const eq = jest.fn().mockReturnValue({ order })
  const select = jest.fn().mockReturnValue({ eq })
  const from = jest.fn().mockReturnValue({ select })
  return { client: { from }, from, select, eq, order }
}

describe('getWorkoutHistory (02C-03)', () => {
  it('queries the workouts table for completed workouts only', async () => {
    const { client, from, select, eq } = mockSupabase({
      data: mockWorkouts,
      error: null,
    })

    await getWorkoutHistory(client as never)

    expect(from).toHaveBeenCalledWith('workouts')
    expect(select).toHaveBeenCalledWith(
      'id, started_at, distance_m, duration_s, avg_pace_s_per_km, status'
    )
    expect(eq).toHaveBeenCalledWith('status', 'completed')
  })

  it('orders results by started_at descending', async () => {
    const { client, order } = mockSupabase({
      data: mockWorkouts,
      error: null,
    })

    await getWorkoutHistory(client as never)

    expect(order).toHaveBeenCalledWith('started_at', { ascending: false })
  })

  it('returns the workout list on success', async () => {
    const { client } = mockSupabase({
      data: mockWorkouts,
      error: null,
    })

    const result = await getWorkoutHistory(client as never)

    expect(result).toEqual({ data: mockWorkouts, error: null })
  })

  it('returns an empty array when no completed workouts exist', async () => {
    const { client } = mockSupabase({
      data: [],
      error: null,
    })

    const result = await getWorkoutHistory(client as never)

    expect(result.data).toEqual([])
    expect(result.error).toBeNull()
  })

  it('returns the error when the query fails', async () => {
    const { client } = mockSupabase({
      data: null,
      error: { message: 'connection failed' },
    })

    const result = await getWorkoutHistory(client as never)

    expect(result.data).toBeNull()
    expect(result.error).toEqual({ message: 'connection failed' })
  })
})

// ── getRecentWorkouts ──────────────────────────────────────────────────────

type RecentResult = {
  data: Array<{
    id: string
    started_at: string
    distance_m: number | null
    duration_s: number | null
    avg_pace_s_per_km: number | null
    xp_awarded: number | null
  }> | null
  error: { message: string } | null
}

function mockRecentSupabase(result: RecentResult) {
  const limit = jest.fn().mockResolvedValue(result)
  const order = jest.fn().mockReturnValue({ limit })
  const eq = jest.fn().mockReturnValue({ order })
  const select = jest.fn().mockReturnValue({ eq })
  const from = jest.fn().mockReturnValue({ select })
  return { client: { from }, from, select, eq, order, limit }
}

describe('getRecentWorkouts', () => {
  it('selects the correct columns including xp_awarded', async () => {
    const { client, select } = mockRecentSupabase({ data: [], error: null })
    await getRecentWorkouts(client as never, 5)
    expect(select).toHaveBeenCalledWith(
      'id, started_at, distance_m, duration_s, avg_pace_s_per_km, xp_awarded'
    )
  })

  it('filters to completed workouts only', async () => {
    const { client, eq } = mockRecentSupabase({ data: [], error: null })
    await getRecentWorkouts(client as never, 5)
    expect(eq).toHaveBeenCalledWith('status', 'completed')
  })

  it('orders by started_at descending', async () => {
    const { client, order } = mockRecentSupabase({ data: [], error: null })
    await getRecentWorkouts(client as never, 5)
    expect(order).toHaveBeenCalledWith('started_at', { ascending: false })
  })

  it('applies the supplied limit', async () => {
    const { client, limit } = mockRecentSupabase({ data: [], error: null })
    await getRecentWorkouts(client as never, 5)
    expect(limit).toHaveBeenCalledWith(5)
  })

  it('returns data on success', async () => {
    const row = {
      id: 'w1',
      started_at: '2026-06-21T10:00:00Z',
      distance_m: 5000,
      duration_s: 1800,
      avg_pace_s_per_km: 360,
      xp_awarded: 50,
    }
    const { client } = mockRecentSupabase({ data: [row], error: null })
    const result = await getRecentWorkouts(client as never, 5)
    expect(result.data).toEqual([row])
    expect(result.error).toBeNull()
  })

  it('returns error when the query fails', async () => {
    const { client } = mockRecentSupabase({ data: null, error: { message: 'db error' } })
    const result = await getRecentWorkouts(client as never, 5)
    expect(result.data).toBeNull()
    expect(result.error).toEqual({ message: 'db error' })
  })

  it('handles null xp_awarded gracefully', async () => {
    const row = {
      id: 'w2',
      started_at: '2026-06-20T08:00:00Z',
      distance_m: 3000,
      duration_s: 900,
      avg_pace_s_per_km: 300,
      xp_awarded: null,
    }
    const { client } = mockRecentSupabase({ data: [row], error: null })
    const result = await getRecentWorkouts(client as never, 1)
    expect(result.data?.[0].xp_awarded).toBeNull()
  })
})

// ── getDashboardActivity ───────────────────────────────────────────────────

type DashboardResult = {
  data: DashboardActivityRow[] | null
  error: { message: string } | null
}

function mockDashboardActivitySupabase(result: DashboardResult) {
  const order = jest.fn().mockResolvedValue(result)
  const gte = jest.fn().mockReturnValue({ order })
  const eq = jest.fn().mockReturnValue({ gte })
  const select = jest.fn().mockReturnValue({ eq })
  const from = jest.fn().mockReturnValue({ select })
  return { client: { from }, from, select, eq, gte, order }
}

describe('getDashboardActivity', () => {
  it('selects id, started_at, distance_m, duration_s, xp_awarded', async () => {
    const { client, select } = mockDashboardActivitySupabase({ data: [], error: null })
    await getDashboardActivity(client as never)
    expect(select).toHaveBeenCalledWith(
      'id, started_at, distance_m, duration_s, xp_awarded'
    )
  })

  it('filters to completed workouts', async () => {
    const { client, eq } = mockDashboardActivitySupabase({ data: [], error: null })
    await getDashboardActivity(client as never)
    expect(eq).toHaveBeenCalledWith('status', 'completed')
  })

  it('applies a 90-day lower bound on started_at', async () => {
    const { client, gte } = mockDashboardActivitySupabase({ data: [], error: null })
    await getDashboardActivity(client as never)
    expect(gte).toHaveBeenCalledWith('started_at', expect.any(String))
    const cutoffArg = (gte as jest.Mock).mock.calls[0][1] as string
    const cutoffDate = new Date(cutoffArg)
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90)
    expect(cutoffDate.getTime()).toBeCloseTo(ninetyDaysAgo.getTime(), -4)
  })

  it('orders by started_at descending', async () => {
    const { client, order } = mockDashboardActivitySupabase({ data: [], error: null })
    await getDashboardActivity(client as never)
    expect(order).toHaveBeenCalledWith('started_at', { ascending: false })
  })

  it('returns rows on success', async () => {
    const row = { id: 'w1', started_at: '2026-06-21T10:00:00Z', distance_m: 5000, duration_s: 1800, xp_awarded: 50 }
    const { client } = mockDashboardActivitySupabase({ data: [row], error: null })
    const result = await getDashboardActivity(client as never)
    expect(result).toEqual([row])
  })

  it('returns empty array when no rows', async () => {
    const { client } = mockDashboardActivitySupabase({ data: [], error: null })
    const result = await getDashboardActivity(client as never)
    expect(result).toEqual([])
  })

  it('throws on DB error', async () => {
    const { client } = mockDashboardActivitySupabase({ data: null, error: { message: 'timeout' } })
    await expect(getDashboardActivity(client as never)).rejects.toThrow('timeout')
  })
})
