/**
 * @jest-environment node
 *
 * Unit tests for the finalize_workout service helper, updated for the 02D-05 v2
 * contract: finalizeWorkout(supabase, workoutId, cellIds, userId). The helper is
 * called with the service-role client and the verified caller uid, and forwards
 * the precomputed cell set to the RPC as p_cell_ids.
 */
import { finalizeWorkout } from '@/features/running/services/finalize'
import type { FinalizeResult } from '@/features/running/types'

const validId = '123e4567-e89b-12d3-a456-426614174000'
const userId = '987e6543-e21b-12d3-a456-426614174999'
const cellIds = ['89283082803ffff', '89283082807ffff']

/** A complete finalize_workout_result composite row (all 9 columns). */
function completedRow(overrides: Record<string, unknown> = {}) {
  return {
    workout_id: validId,
    status: 'completed',
    distance_m: 5000,
    duration_s: 1800,
    avg_pace_s_per_km: 360,
    xp_awarded: null,
    cells_claimed: null,
    cells_stolen: null,
    cells_defended: null,
    ...overrides,
  }
}

// Minimal mock of a Supabase client that just exposes `.rpc()`.
function mockSupabase(rpcResult: { data: Record<string, unknown> | null; error: { message: string } | null }) {
  return {
    rpc: jest.fn().mockResolvedValue(rpcResult),
  }
}

describe('finalizeWorkout (02D-05: v2 — cells + service-role identity)', () => {
  it('calls the finalize_workout RPC with workoutId, cellIds, and userId', async () => {
    const client = mockSupabase({ data: completedRow(), error: null })

    await finalizeWorkout(client as never, validId, cellIds, userId)

    expect(client.rpc).toHaveBeenCalledWith('finalize_workout', {
      p_workout_id: validId,
      p_cell_ids: cellIds,
      p_user_id: userId,
    })
  })

  it('forwards p_cell_ids as a fresh array copy (does not pass the caller array by reference)', async () => {
    const client = mockSupabase({ data: completedRow(), error: null })
    const readonlyCells: readonly string[] = cellIds

    await finalizeWorkout(client as never, validId, readonlyCells, userId)

    const passed = (client.rpc as jest.Mock).mock.calls[0][1].p_cell_ids
    expect(passed).toEqual([...cellIds])
    expect(passed).not.toBe(readonlyCells) // spread copy, not the same reference
  })

  it('maps the RPC composite result to the FinalizeResult domain type', async () => {
    const client = mockSupabase({
      data: completedRow({ distance_m: 5123, avg_pace_s_per_km: 351 }),
      error: null,
    })

    const result: FinalizeResult = await finalizeWorkout(client as never, validId, cellIds, userId)

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

  it('maps territory capture counts (cells_claimed/stolen/defended) through to the domain type', async () => {
    const client = mockSupabase({
      data: completedRow({ cells_claimed: 5, cells_stolen: 1, cells_defended: 2 }),
      error: null,
    })

    const result = await finalizeWorkout(client as never, validId, cellIds, userId)

    expect(result.cellsClaimed).toBe(5)
    expect(result.cellsStolen).toBe(1)
    expect(result.cellsDefended).toBe(2)
  })

  it('returns an idempotent result when the workout is already completed (FR-RP-4)', async () => {
    const client = mockSupabase({
      data: completedRow({ distance_m: 3000, duration_s: 900, avg_pace_s_per_km: 300, xp_awarded: 42, cells_claimed: 5, cells_stolen: 1, cells_defended: 0 }),
      error: null,
    })

    const result = await finalizeWorkout(client as never, validId, cellIds, userId)

    expect(result.status).toBe('completed')
    expect(result.distanceM).toBe(3000)
    expect(result.xpAwarded).toBe(42)
    expect(result.cellsClaimed).toBe(5)
  })

  it('throws an Error when the RPC returns an error (e.g. not authorized)', async () => {
    const client = mockSupabase({
      data: null,
      error: { message: 'finalize_workout: not authorized' },
    })

    await expect(finalizeWorkout(client as never, validId, cellIds, userId)).rejects.toThrow(
      'finalize_workout: not authorized'
    )
  })

  it('throws an Error when the workout is not found', async () => {
    const client = mockSupabase({
      data: null,
      error: { message: 'finalize_workout: workout not found' },
    })

    await expect(finalizeWorkout(client as never, validId, cellIds, userId)).rejects.toThrow(
      'workout not found'
    )
  })

  it('throws an Error when the RPC rejects a non-active workout', async () => {
    const client = mockSupabase({
      data: null,
      error: { message: 'finalize_workout: workout is not active (status=discarded)' },
    })

    await expect(finalizeWorkout(client as never, validId, cellIds, userId)).rejects.toThrow(
      'not active'
    )
  })

  it('handles null fields gracefully (zero-point workout, empty cell set)', async () => {
    const client = mockSupabase({
      data: completedRow({ distance_m: 0, duration_s: 5, avg_pace_s_per_km: null }),
      error: null,
    })

    const result = await finalizeWorkout(client as never, validId, [], userId)

    expect(result.distanceM).toBe(0)
    expect(result.avgPaceSPerKm).toBeNull()
    expect(result.xpAwarded).toBeNull()
    // Even with no cells, the RPC is still invoked with an empty array.
    expect(client.rpc).toHaveBeenCalledWith('finalize_workout', {
      p_workout_id: validId,
      p_cell_ids: [],
      p_user_id: userId,
    })
  })
})
