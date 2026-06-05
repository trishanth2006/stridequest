export type WorkoutSummary = {
  workoutId: string
  distanceM: number
  durationS: number
  avgPaceSPerKm: number | null
  cellsClaimed: number
  cellsStolen: number
  cellsDefended: number
  xpEarned: number
  completedAt: string | null
}
