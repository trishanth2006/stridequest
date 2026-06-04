import type {
  CaptureSummary,
  CaptureSummarySource,
  CellOwnershipRow,
  TerritoryAction,
  TerritoryCapture,
  TerritoryCaptureRow,
  TerritoryOwnership,
} from '@/features/territory/types'

/** Runtime list of the valid actions, kept in sync with the union via `satisfies`. */
export const TERRITORY_ACTIONS = ['claim', 'steal', 'defend'] as const satisfies readonly TerritoryAction[]

/** Type guard narrowing an unknown value to a TerritoryAction. */
export function isTerritoryAction(value: unknown): value is TerritoryAction {
  return typeof value === 'string' && (TERRITORY_ACTIONS as readonly string[]).includes(value)
}

/**
 * Deserialize a territory_captures row into the domain shape. The DB CHECK
 * guarantees `action` is valid, but the generated type widens it to `string`,
 * so we narrow defensively and fail loudly on the impossible case.
 */
export function toTerritoryCapture(row: TerritoryCaptureRow): TerritoryCapture {
  if (!isTerritoryAction(row.action)) {
    throw new Error(`Unknown territory action: ${row.action}`)
  }
  return {
    id: row.id,
    workoutId: row.workout_id,
    userId: row.user_id,
    cellId: row.cell_id,
    action: row.action,
    capturedAt: row.captured_at,
  }
}

/** Deserialize a cell_ownership row into the domain shape. */
export function toTerritoryOwnership(row: CellOwnershipRow): TerritoryOwnership {
  return {
    cellId: row.cell_id,
    ownerUserId: row.owner_user_id,
    ownedSinceWorkoutId: row.owned_since_workout_id,
    updatedAt: row.updated_at,
  }
}

/** Normalize the nullable finalize cell counts into a concrete summary. */
export function toCaptureSummary(source: CaptureSummarySource): CaptureSummary {
  return {
    cellsClaimed: source.cellsClaimed ?? 0,
    cellsStolen: source.cellsStolen ?? 0,
    cellsDefended: source.cellsDefended ?? 0,
  }
}
