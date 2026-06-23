import { supabase } from '@/lib/supabase'

export type HeatmapCell = {
  cellId: string
  captures: number
}

export type HeatmapSummary = {
  totalCaptures: number
  mostCapturedCell: HeatmapCell | null
}

/**
 * Fetch the user's territory capture frequency per cell — mirrors
 * getCellCaptureCounts from features/territory/services/heatmap.ts.
 * RLS scopes territory_captures to the owner automatically.
 */
export async function getUserHeatmap(): Promise<HeatmapCell[]> {
  // TECH-DEBT-MAP-001: Create user_heatmap materialized view or RPC returning aggregated cell counts.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('territory_captures')
    .select('cell_id')
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)

  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    counts.set(row.cell_id, (counts.get(row.cell_id) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([cellId, captures]) => ({ cellId, captures }))
    .sort((a, b) => b.captures - a.captures || a.cellId.localeCompare(b.cellId))
}

/** Pure summary from a heatmap array. */
export function heatmapSummary(cells: HeatmapCell[]): HeatmapSummary {
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

/** Territory stats for the bottom sheet panel. */
export type TerritoryStats = {
  totalCells: number
  totalCaptures: number
  mostCapturedCellId: string | null
  topCells: HeatmapCell[]
}

export async function loadTerritoryStats(): Promise<TerritoryStats> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { totalCells: 0, totalCaptures: 0, mostCapturedCellId: null, topCells: [] }
  }

  const [ownershipRes, heatmap] = await Promise.all([
    supabase
      .from('cell_ownership')
      .select('*', { count: 'exact', head: true })
      .eq('owner_user_id', user.id),
    getUserHeatmap(),
  ])

  const summary = heatmapSummary(heatmap)

  return {
    totalCells: ownershipRes.count ?? 0,
    totalCaptures: summary.totalCaptures,
    mostCapturedCellId: summary.mostCapturedCell?.cellId ?? null,
    topCells: heatmap.slice(0, 10),
  }
}
