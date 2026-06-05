import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/infrastructure/supabase/database.types'
import type { HeatmapCell } from '@/features/territory/types'

/**
 * Read-side territory heatmap service (02D-07B).
 *
 * Aggregates the signed-in user's own capture activity into per-cell frequency
 * counts — "where do I run most often?". Same dependency-injection pattern as
 * `ownership.ts`/`finalize.ts`; pure query logic, read-only, throws on DB error.
 *
 * `territory_captures` is owner-scoped by RLS, so this can only ever see the
 * caller's own rows — no cross-user/global data (respects the 02D-02 RLS design
 * and the "no global territory view" scope boundary). Aggregation is done in TS
 * to avoid any RPC/schema change.
 */

/**
 * The signed-in user's captures grouped by cell, as capture-frequency counts.
 * RLS scopes `territory_captures` to the owner; the explicit `user_id` filter
 * states the intent and keeps the query correct for any injected client.
 * Sorted by `captures` desc, then `cellId` asc (deterministic, top-first).
 */
export async function getCellCaptureCounts(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<HeatmapCell[]> {
  const { data, error } = await supabase
    .from('territory_captures')
    .select('cell_id')
    .eq('user_id', userId)

  if (error) throw new Error(error.message)

  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    counts.set(row.cell_id, (counts.get(row.cell_id) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([cellId, captures]) => ({ cellId, captures }))
    .sort((a, b) => b.captures - a.captures || compareCellId(a.cellId, b.cellId))
}

/** The signed-in user's activity heatmap (capture frequency per cell). */
export async function getUserHeatmap(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<HeatmapCell[]> {
  return getCellCaptureCounts(supabase, userId)
}

/**
 * Board summary derived from a heatmap: total captures across all cells and the
 * single most-captured cell (null for an empty heatmap). Pure.
 */
export function heatmapSummary(cells: readonly HeatmapCell[]): {
  totalCaptures: number
  mostCapturedCell: HeatmapCell | null
} {
  let totalCaptures = 0
  let mostCapturedCell: HeatmapCell | null = null
  for (const cell of cells) {
    totalCaptures += cell.captures
    if (!mostCapturedCell || cell.captures > mostCapturedCell.captures) {
      mostCapturedCell = cell
    }
  }
  return { totalCaptures, mostCapturedCell }
}

function compareCellId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
