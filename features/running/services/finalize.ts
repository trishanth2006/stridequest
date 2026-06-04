import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/infrastructure/supabase/database.types'
import type { FinalizeResult } from '@/features/running/types'

/**
 * Call the `finalize_workout` RPC v2 (02D-05) and map the composite result into
 * the typed {@link FinalizeResult}. This is the server-side helper called by
 * `stopWorkout` (02C-02, updated in 02D-05).
 *
 * ### v2 differences from v1:
 * - Accepts `cellIds` — the precomputed canonical H3 cell set from `captureCells()`
 *   (computed in `stop.ts` from the workout's route points).
 * - Accepts `userId` — the verified caller UID obtained via `getUser()` in the
 *   server action **before** switching to the service-role client. The RPC uses
 *   `p_user_id` instead of `auth.uid()` because service-role calls return null
 *   for `auth.uid()`.
 * - `supabase` must be the **service-role client** (created via
 *   `createServiceRoleClient()`). The RPC has `EXECUTE` revoked from
 *   `authenticated` and granted only to `service_role` (ADR Option A, 02D-05).
 *
 * Errors from the RPC surface as a thrown `Error` with the Postgres message so
 * the action can catch and return a user-facing result without leaking internal
 * details.
 */
export async function finalizeWorkout(
  supabase: SupabaseClient<Database>,
  workoutId: string,
  cellIds: readonly string[],
  userId: string,
): Promise<FinalizeResult> {
  const { data, error } = await supabase.rpc('finalize_workout', {
    p_workout_id: workoutId,
    p_cell_ids: [...cellIds],
    p_user_id: userId,
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
