export type PersonalRecord = {
  id: string
  title: string
  workoutId: string
  achievedAt?: string
  /** Raw numeric value (seconds for pace records, metres for distance, XP count etc). Populated by getPersonalRecords; absent in computePersonalRecords. */
  value?: number
  workoutDistanceM?: number
  workoutXp?: number
}

export type RecordWorkoutRow = {
  id: string
  started_at: string
  distance_m: number | null
  duration_s: number | null
  avg_pace_s_per_km: number | null
  xp_awarded: number | null
  status: string
}

/**
 * Computes personal records (longest run, most XP) by scanning all known
 * completed workouts for the user.
 * Will be extended in the future to handle speed records per distance.
 */
export function computePersonalRecords(
  allWorkouts: RecordWorkoutRow[],
  thisWorkoutId: string,
): PersonalRecord[] {
  const valid = allWorkouts.filter(
    (w) => w.status === 'completed' && w.distance_m != null && w.avg_pace_s_per_km != null,
  )

  const records: PersonalRecord[] = []

  // Longest run
  const longest = valid.reduce<RecordWorkoutRow | null>((best, w) => {
    if (!best || (w.distance_m ?? 0) > (best.distance_m ?? 0)) return w
    return best
  }, null)
  if (longest?.id === thisWorkoutId) {
    records.push({ id: 'longest-run', title: 'Longest Run', workoutId: thisWorkoutId, achievedAt: longest.started_at })
  }

  // Most XP workout
  const mostXp = valid.reduce<RecordWorkoutRow | null>((best, w) => {
    if (!best || (w.xp_awarded ?? 0) > (best.xp_awarded ?? 0)) return w
    return best
  }, null)
  if (mostXp?.id === thisWorkoutId && (mostXp.xp_awarded ?? 0) > 0) {
    records.push({ id: 'most-xp-workout', title: 'Most XP Workout', workoutId: thisWorkoutId, achievedAt: mostXp.started_at })
  }

  return records
}
