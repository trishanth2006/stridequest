/**
 * @jest-environment node
 */
import { finalizeWorkout } from '@/features/running/services/finalize'
import type { FinalizeResult } from '@/features/running/types'

const validId = '123e4567-e89b-12d3-a456-426614174000'

// Minimal mock of a Supabase client that just exposes `.rpc()`.
function mockSupabase(rpcResult: { data: Record<string, unknown> | null; error: { message: string } | null }) {
  return {
    rpc: jest.fn().mockResolvedValue(rpcResult),
  }
}

describe('finalizeWorkout (02C-02)', () => {
  it('calls the finalize_workout RPC with the correct arguments', async () => {
    const client = mockSupabase({
      data: {
        workout_id: validId,
        status: 'completed',
        distance_m: 5000,
        duration_s: 1800,
        avg_pace_s_per_km: 360,
        xp_awarded: null,
        cells_claimed: null,
        cells_stolen: null,
        cells_defended: null,
      },
      error: null,
    })

    await finalizeWorkout(client as never, validId)

    expect(client.rpc).toHaveBeenCalledWith('finalize_workout', {
      p_workout_id: validId,
    })
  })

  it('maps the RPC composite result to the FinalizeResult domain type', async () => {
    const client = mockSupabase({
      data: {
        workout_id: validId,
        status: 'completed',
        distance_m: 5123,
        duration_s: 1800,
        avg_pace_s_per_km: 351,
        xp_awarded: null,
        cells_claimed: null,
        cells_stolen: null,
        cells_defended: null,
      },
      error: null,
    })

    const result: FinalizeResult = await finalizeWorkout(client as never, validId)

    expect(result).toEqual({
      workoutId: validId,
      status: 'completed',
      distanceM: 5123,
      durationS: 1800,
      avgPaceSPerKm: 351,
      xpAwarded: null,
      cellsClaimed: null,
      cellsStolen: null,
      cellsDefended: null,
    })
  })

  it('returns an idempotent result when the workout is already completed (FR-RP-4)', async () => {
    const client = mockSupabase({
      data: {
        workout_id: validId,
        status: 'completed',
        distance_m: 3000,
        duration_s: 900,
        avg_pace_s_per_km: 300,
        xp_awarded: 42,
        cells_claimed: 5,
        cells_stolen: 1,
        cells_defended: 0,
      },
      error: null,
    })

    const result = await finalizeWorkout(client as never, validId)

    expect(result.status).toBe('completed')
    expect(result.distanceM).toBe(3000)
    expect(result.xpAwarded).toBe(42)
    expect(result.cellsClaimed).toBe(5)
  })

  it('throws an Error when the RPC returns an error (e.g. not authenticated)', async () => {
    const client = mockSupabase({
      data: null,
      error: { message: 'finalize_workout: not authenticated' },
    })

    await expect(finalizeWorkout(client as never, validId)).rejects.toThrow(
      'finalize_workout: not authenticated'
    )
  })

  it('throws an Error when the workout is not found', async () => {
    const client = mockSupabase({
      data: null,
      error: { message: 'finalize_workout: workout not found' },
    })

    await expect(finalizeWorkout(client as never, validId)).rejects.toThrow(
      'workout not found'
    )
  })

  it('throws an Error when the RPC rejects a non-active workout', async () => {
    const client = mockSupabase({
      data: null,
      error: { message: 'finalize_workout: workout is not active (status=discarded)' },
    })

    await expect(finalizeWorkout(client as never, validId)).rejects.toThrow(
      'not active'
    )
  })

  it('handles null fields gracefully (zero-point workout)', async () => {
    const client = mockSupabase({
      data: {
        workout_id: validId,
        status: 'completed',
        distance_m: 0,
        duration_s: 5,
        avg_pace_s_per_km: null,
        xp_awarded: null,
        cells_claimed: null,
        cells_stolen: null,
        cells_defended: null,
      },
      error: null,
    })

    const result = await finalizeWorkout(client as never, validId)

    expect(result.distanceM).toBe(0)
    expect(result.avgPaceSPerKm).toBeNull()
    expect(result.xpAwarded).toBeNull()
  })
})
