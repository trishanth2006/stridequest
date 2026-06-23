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

export type XpProgress = {
  currentXp: number
  currentLevel: number
  currentLevelXp: number
  nextLevel: number | null
  nextLevelXp: number | null
  xpNeededToNextLevel: number
  progressPercent: number
}

/**
 * Progress snapshot for the XP dashboard. The top MVP tier is treated as a
 * completed track: no next level, 0 XP remaining, 100% progress.
 */
export function getXpProgress(totalXp: number): XpProgress {
  const currentXp = Math.max(0, totalXp)
  const currentLevel = getLevelFromXP(currentXp)
  const currentLevelXp = LEVEL_THRESHOLDS[currentLevel - 1]
  const nextLevel = currentLevel < LEVEL_THRESHOLDS.length ? currentLevel + 1 : null
  const nextLevelXp = nextLevel === null ? null : LEVEL_THRESHOLDS[nextLevel - 1]

  if (nextLevelXp === null) {
    return {
      currentXp,
      currentLevel,
      currentLevelXp,
      nextLevel: null,
      nextLevelXp: null,
      xpNeededToNextLevel: 0,
      progressPercent: 100,
    }
  }

  const span = nextLevelXp - currentLevelXp
  const progressPercent = span <= 0
    ? 100
    : Math.round(((currentXp - currentLevelXp) / span) * 100)

  return {
    currentXp,
    currentLevel,
    currentLevelXp,
    nextLevel,
    nextLevelXp,
    xpNeededToNextLevel: Math.max(0, nextLevelXp - currentXp),
    progressPercent: Math.max(0, Math.min(100, progressPercent)),
  }
}

export type LevelUpResult = {
  leveledUp: boolean
  previousLevel: number
  currentLevel: number
}

/** Determines if a level-up occurred based on XP before and after an award. */
export function getLevelUpResult(beforeXp: number, afterXp: number): LevelUpResult {
  const previousLevel = getLevelFromXP(Math.max(0, beforeXp))
  const currentLevel = getLevelFromXP(Math.max(0, afterXp))

  return {
    leveledUp: currentLevel > previousLevel,
    previousLevel,
    currentLevel,
  }
}
