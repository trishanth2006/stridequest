/**
 * @jest-environment node
 */
import { getWorkoutHistory } from '@/features/running/services/history'

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
