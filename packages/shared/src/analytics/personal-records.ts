import type { PersonalRecord } from './records'

export type WorkoutPrFlags = {
  fastest1k: boolean
  fastest5k: boolean
  fastest10k: boolean
  longestRun: boolean
  mostXp: boolean
  mostTerritory: boolean
  mostEfficient: boolean
  territoryEfficiency: boolean
  records: PersonalRecord[]
}

export type PRWorkoutRow = {
  id: string
  started_at: string
  distance_m: number | null
  avg_pace_s_per_km: number | null
  xp_awarded: number | null
  status: string
}

export type PRCaptureRow = {
  workout_id: string
  action: string
}

function isEarlier(a: PRWorkoutRow, b: PRWorkoutRow): boolean {
  return new Date(a.started_at).getTime() < new Date(b.started_at).getTime()
}

/**
 * Computes all-time personal records across every completed workout.
 * Used by profile and achievements pages on both web and mobile.
 */
export function getPersonalRecords(
  workouts: PRWorkoutRow[],
  captures: PRCaptureRow[] = [],
): PersonalRecord[] {
  const valid = workouts.filter(
    (w) => w.status === 'completed' && w.distance_m != null && w.avg_pace_s_per_km != null,
  )
  if (valid.length === 0) return []

  const capturesByWorkout: Record<string, number> = {}
  for (const c of captures) {
    if (c.action === 'claim' || c.action === 'steal') {
      capturesByWorkout[c.workout_id] = (capturesByWorkout[c.workout_id] ?? 0) + 1
    }
  }

  let best1k: { value: number; w: PRWorkoutRow } | null = null
  let best5k: { value: number; w: PRWorkoutRow } | null = null
  let best10k: { value: number; w: PRWorkoutRow } | null = null
  let longest: { value: number; w: PRWorkoutRow } | null = null
  let mostXp: { value: number; w: PRWorkoutRow } | null = null
  let mostTerritory: { value: number; w: PRWorkoutRow } | null = null
  let mostEfficient: { value: number; w: PRWorkoutRow } | null = null
  let territoryEff: { value: number; w: PRWorkoutRow } | null = null

  for (const w of valid) {
    const dist = w.distance_m!
    const pace = w.avg_pace_s_per_km!
    const xp = w.xp_awarded ?? 0
    const caps = capturesByWorkout[w.id] ?? 0
    const distKm = dist / 1000

    if (dist >= 1000) {
      const t = pace * 1
      if (!best1k || t < best1k.value || (t === best1k.value && isEarlier(w, best1k.w))) best1k = { value: t, w }
    }
    if (dist >= 5000) {
      const t = pace * 5
      if (!best5k || t < best5k.value || (t === best5k.value && isEarlier(w, best5k.w))) best5k = { value: t, w }
    }
    if (dist >= 10000) {
      const t = pace * 10
      if (!best10k || t < best10k.value || (t === best10k.value && isEarlier(w, best10k.w))) best10k = { value: t, w }
    }
    if (!longest || dist > longest.value || (dist === longest.value && isEarlier(w, longest.w))) longest = { value: dist, w }
    if (!mostXp || xp > mostXp.value || (xp === mostXp.value && isEarlier(w, mostXp.w))) mostXp = { value: xp, w }
    if (!mostTerritory || caps > mostTerritory.value || (caps === mostTerritory.value && isEarlier(w, mostTerritory.w))) mostTerritory = { value: caps, w }
    if (dist > 0) {
      const eff = xp / distKm
      if (!mostEfficient || eff > mostEfficient.value || (eff === mostEfficient.value && isEarlier(w, mostEfficient.w))) mostEfficient = { value: eff, w }
      const effT = caps / distKm
      if (!territoryEff || effT > territoryEff.value || (effT === territoryEff.value && isEarlier(w, territoryEff.w))) territoryEff = { value: effT, w }
    }
  }

  const records: PersonalRecord[] = []
  const add = (id: string, title: string, best: { value: number; w: PRWorkoutRow } | null) => {
    if (best) {
      records.push({
        id,
        title,
        value: best.value,
        workoutId: best.w.id,
        achievedAt: best.w.started_at,
        workoutDistanceM: best.w.distance_m ?? undefined,
        workoutXp: best.w.xp_awarded ?? undefined,
      })
    }
  }

  add('fastest-1k', 'Fastest 1K', best1k)
  add('fastest-5k', 'Fastest 5K', best5k)
  add('fastest-10k', 'Fastest 10K', best10k)
  add('longest-run', 'Longest Run', longest)
  add('most-xp-workout', 'Most XP Workout', mostXp)
  add('most-territory-workout', 'Most Territory Workout', mostTerritory)
  add('most-efficient-run', 'Most Efficient Run', mostEfficient)
  add('territory-efficiency', 'Territory Efficiency', territoryEff)

  return records
}

const PR_PRIORITY = [
  'fastest-10k',
  'fastest-5k',
  'fastest-1k',
  'longest-run',
  'most-xp-workout',
  'most-territory-workout',
  'most-efficient-run',
  'territory-efficiency',
] as const

export function getBestRecord(records: PersonalRecord[]): PersonalRecord | undefined {
  for (const id of PR_PRIORITY) {
    const rec = records.find((r) => r.id === id)
    if (rec) return rec
  }
  return undefined
}
