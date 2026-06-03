import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/infrastructure/supabase/database.types'
import type { FinalizeResult } from '@/features/running/types'

/**
 * Call the `finalize_workout` RPC (02C-01) and map the composite result into
 * the typed {@link FinalizeResult}. This is the server-side helper called by
 * `stopWorkout` (02C-02) — it owns no auth, ownership, or idempotency logic
 * itself; the RPC handles all of that (ownership via `auth.uid()` check,
 * idempotency via the `completed` status guard, transactional integrity via
 * `FOR UPDATE`).
 *
 * Errors from the RPC surface as a thrown `Error` with the Postgres message so
 * the action can catch and return a user-facing result without leaking internal
 * details.
 */
export async function finalizeWorkout(
  supabase: SupabaseClient<Database>,
  workoutId: string,
): Promise<FinalizeResult> {
  const { data, error } = await supabase.rpc('finalize_workout', {
    p_workout_id: workoutId,
  })

  if (error) {
    throw new Error(error.message)
  }

  // The RPC returns the finalize_workout_result composite type. Map from
  // snake_case DB column names to camelCase domain type.
  return {
    workoutId: data.workout_id ?? workoutId,
    status: data.status ?? 'completed',
    distanceM: data.distance_m ?? null,
    durationS: data.duration_s ?? null,
    avgPaceSPerKm: data.avg_pace_s_per_km ?? null,
    xpAwarded: data.xp_awarded ?? null,
    cellsClaimed: data.cells_claimed ?? null,
    cellsStolen: data.cells_stolen ?? null,
    cellsDefended: data.cells_defended ?? null,
  }
}
