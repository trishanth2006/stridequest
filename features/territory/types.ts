import type { Tables } from '@/infrastructure/supabase/database.types'
import type { CellId, TerritoryAction } from '@stridequest/shared/territory'

/**
 * `CellId` and `TerritoryAction` are defined in the shared workspace package
 * (consumed by both web and mobile) and re-exported here so existing
 * `@/features/territory/types` imports keep working. H3 generation/validation
 * lives in the shared grid layer.
 */
export type { CellId, TerritoryAction }

/** Raw DB rows (snake_case), aliased from the generated schema types. */
export type TerritoryCaptureRow = Tables<'territory_captures'>
export type CellOwnershipRow = Tables<'cell_ownership'>

/**
 * One capture audit record — camelCase domain shape (mirrors the running
 * feature's domain/DB split). Append-only; written only by finalize_workout.
 */
export type TerritoryCapture = {
  id: string
  workoutId: string
  userId: string
  cellId: CellId
  action: TerritoryAction
  capturedAt: string
}

/** Current owner of one cell — the live board row, camelCase domain shape. */
export type TerritoryOwnership = {
  cellId: CellId
  ownerUserId: string
  ownedSinceWorkoutId: string
  updatedAt: string
}

/**
 * One cell's capture frequency for the activity heatmap (02D-07B). `captures` is
 * how many times the cell appears in the (RLS-scoped) `territory_captures` log —
 * i.e. how often the viewing user has run through it. Read-only visualization;
 * no ownership semantics.
 */
export type HeatmapCell = {
  cellId: CellId
  captures: number
}

/** Per-finalize territory outcome (the cell_* fields of finalize_workout_result). */
export type CaptureSummary = {
  cellsClaimed: number
  cellsStolen: number
  cellsDefended: number
}

/**
 * Nullable source shape produced by the finalize RPC result before capture is
 * wired (02D-05): cell counts are null until then. Structurally compatible with
 * the running feature's FinalizeResult, so no cross-feature import is needed.
 */
export type CaptureSummarySource = {
  cellsClaimed: number | null
  cellsStolen: number | null
  cellsDefended: number | null
}
