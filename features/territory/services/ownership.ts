import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/infrastructure/supabase/database.types'
import type { CellId, TerritoryOwnership } from '@/features/territory/types'
import { toTerritoryOwnership } from '@/features/territory/mappers'

/**
 * Read-side territory ownership service (02D-06).
 *
 * Pure query logic over an injected Supabase client — the same dependency-
 * injection pattern as `features/running/services/{finalize,history}.ts`, so the
 * server caller owns client creation and these stay unit-testable.
 *
 * Read-only by design: it reads the live board (`cell_ownership`) and never
 * mutates. Ownership writes happen exclusively in the finalize_workout RPC
 * (02D-05); this layer does not touch captures, XP, or ownership changes.
 *
 * DB errors throw (the caller gets clean domain models on the happy path),
 * mirroring `finalizeWorkout`.
 */

/** The columns of `cell_ownership` — exactly the fields `toTerritoryOwnership` needs. */
const OWNERSHIP_COLUMNS = 'cell_id, owner_user_id, owned_since_workout_id, updated_at' as const

/**
 * All cells currently owned by `userId`, as `TerritoryOwnership` domain models,
 * ordered by cell id for deterministic output. RLS allows any authenticated
 * user to read the board (FR-OW-1/2, 02D-02); the explicit `owner_user_id`
 * filter scopes the result to the requested user.
 */
export async function getOwnedCells(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<TerritoryOwnership[]> {
  const { data, error } = await supabase
    .from('cell_ownership')
    .select(OWNERSHIP_COLUMNS)
    .eq('owner_user_id', userId)
    .order('cell_id')

  if (error) throw new Error(error.message)
  return (data ?? []).map(toTerritoryOwnership)
}

/**
 * Ownership for a specific set of cells — used by board rendering to resolve who
 * owns each visible cell. Cells with no owner are simply absent from the result
 * (no row). An empty input returns `[]` without issuing a query.
 */
export async function getCellOwnership(
  supabase: SupabaseClient<Database>,
  cellIds: readonly CellId[],
): Promise<TerritoryOwnership[]> {
  if (cellIds.length === 0) return []

  const { data, error } = await supabase
    .from('cell_ownership')
    .select(OWNERSHIP_COLUMNS)
    .in('cell_id', [...cellIds])
    .order('cell_id')

  if (error) throw new Error(error.message)
  return (data ?? []).map(toTerritoryOwnership)
}

/**
 * Current-ownership stats for a user: the number of cells owned right now.
 * Uses a `head` + `count` query so no rows are transferred — only the count.
 * Current ownership only: no XP, no capture history.
 */
export async function getOwnershipStats(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{ totalCells: number }> {
  const { count, error } = await supabase
    .from('cell_ownership')
    .select('*', { count: 'exact', head: true })
    .eq('owner_user_id', userId)

  if (error) throw new Error(error.message)
  return { totalCells: count ?? 0 }
}
