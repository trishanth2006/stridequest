/**
 * Pure XP calculation + leveling (02E-01).
 *
 * These functions are the authoritative definition of the XP rules. The
 * finalize_workout RPC awards XP in SQL using the SAME constants; the XP
 * integration test asserts the RPC's award equals `calculateTotalXP(...)` for
 * the same inputs (parity guard). Keep the two in lockstep when changing rules.
 *
 * No I/O — deterministic, side-effect free.
 */

/** XP rule constants (mirrored in the finalize_workout SQL). */
export const XP_RULES = {
  /** Flat bonus for completing a workout. */
  workoutCompletion: 25,
  /** XP per whole kilometre run. */
  perKm: 5,
  /** XP per neutral cell claimed. */
  capturePerCell: 10,
  /** XP per cell stolen from another user. */
  stealPerCell: 25,
} as const

/** Completion bonus + distance XP (floored to whole km). */
export function calculateWorkoutXP(distanceM: number): number {
  const km = Math.floor(Math.max(0, distanceM) / 1000)
  return XP_RULES.workoutCompletion + km * XP_RULES.perKm
}

/** XP for claiming neutral cells (+10 each). */
export function calculateCaptureXP(cellsClaimed: number): number {
  return Math.max(0, cellsClaimed) * XP_RULES.capturePerCell
}

/** XP for stealing cells from other users (+25 each). */
export function calculateStealXP(cellsStolen: number): number {
  return Math.max(0, cellsStolen) * XP_RULES.stealPerCell
}

/** Total XP a finalized workout earns. Defends contribute 0 (never passed in). */
export function calculateTotalXP(input: {
  distanceM: number
  cellsClaimed: number
  cellsStolen: number
}): number {
  return (
    calculateWorkoutXP(input.distanceM) +
    calculateCaptureXP(input.cellsClaimed) +
    calculateStealXP(input.cellsStolen)
  )
}

/**
 * MVP level thresholds — minimum cumulative XP for each level (1-indexed):
 * L1=0, L2=100, L3=250, L4=500, L5=1000. Mirrored in the SQL `xp_level()` helper.
 */
export const LEVEL_THRESHOLDS = [0, 100, 250, 500, 1000] as const

/** The level for a given total XP (capped at the top MVP tier). */
export function getLevelFromXP(totalXp: number): number {
  let level = 1
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (totalXp >= LEVEL_THRESHOLDS[i]) level = i + 1
  }
  return level
}
