import type { Tables } from '@/infrastructure/supabase/database.types'

/**
 * A grid cell identifier. Phase 02 stores this as the H3 res-9 index in its
 * string form (`cell_id text`). Kept as a named alias — not a branded type — to
 * match the project's plain-string id convention (`workoutId`, `userId`); it
 * documents intent and gives a single rename point if branding ever earns its
 * keep. H3 generation/validation is out of scope here (deferred to the grid
 * layer).
 */
export type CellId = string

/** The three capture outcomes (FR-TC-4 / the DB CHECK on territory_captures.action). */
export type TerritoryAction = 'claim' | 'steal' | 'defend'

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
