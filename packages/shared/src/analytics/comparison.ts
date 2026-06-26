import { haversineMeters } from '../running/distance'

/** Signed metric deltas of this workout vs a comparison baseline. */
export type ComparisonDeltas = {
  distanceDeltaM: number
  /** Negative = faster than the baseline. */
  paceDeltaSPerKm: number
  timeDeltaS: number
  xpDelta: number
}

export type WorkoutComparisonEntry = {
  key: 'previous' | 'personalBest' | 'weeklyAverage' | 'monthlyAverage'
  label: string
  deltas: ComparisonDeltas
}

/** Result of the lightweight start/end/distance route-matching heuristic. */
export type WorkoutRouteMatch = {
  matchedWorkoutId: string
  matchedAt: string
  /** Negative = faster than the matched run. */
  timeDeltaS: number
  /** Positive = pace improvement vs the matched run, in percent. */
  pacePctImprovement: number
}

export type WorkoutComparison = {
  hasHistory: boolean
  entries: WorkoutComparisonEntry[]
  routeMatch: WorkoutRouteMatch | null
}

/** A completed workout reduced to the fields needed for comparison. */
export type CompletedWorkoutLite = {
  id: string
  startedAt: string
  distanceM: number
  durationS: number
  paceSPerKm: number
  xp: number
}

/** Start/end coordinates of a workout's route (from the route-anchors RPC). */
export type RouteAnchor = {
  workoutId: string
  startLat: number
  startLng: number
  endLat: number
  endLng: number
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const MONTH_MS = 30 * 24 * 60 * 60 * 1000
/** Route-match heuristic thresholds (no GIS, no Fréchet — just endpoints). */
const MATCH_RADIUS_M = 100
const MATCH_DISTANCE_PCT = 0.05

function deltasVs(
  current: CompletedWorkoutLite,
  baseline: { distanceM: number; durationS: number; paceSPerKm: number; xp: number },
): ComparisonDeltas {
  return {
    distanceDeltaM: Math.round(current.distanceM - baseline.distanceM),
    paceDeltaSPerKm: Math.round(current.paceSPerKm - baseline.paceSPerKm),
    timeDeltaS: Math.round(current.durationS - baseline.durationS),
    xpDelta: Math.round(current.xp - baseline.xp),
  }
}

function averageBaseline(list: CompletedWorkoutLite[]) {
  const n = list.length
  return {
    distanceM: list.reduce((a, w) => a + w.distanceM, 0) / n,
    durationS: list.reduce((a, w) => a + w.durationS, 0) / n,
    paceSPerKm: list.reduce((a, w) => a + w.paceSPerKm, 0) / n,
    xp: list.reduce((a, w) => a + w.xp, 0) / n,
  }
}

function findRouteMatch(
  current: CompletedWorkoutLite,
  currentAnchor: RouteAnchor | null,
  prior: CompletedWorkoutLite[],
  anchors: RouteAnchor[],
): WorkoutRouteMatch | null {
  if (!currentAnchor) return null
  const anchorById = new Map(anchors.map((a) => [a.workoutId, a]))
  const start = { lat: currentAnchor.startLat, lng: currentAnchor.startLng }
  const end = { lat: currentAnchor.endLat, lng: currentAnchor.endLng }

  // `prior` is newest-first, so the first match is the most recent one.
  for (const w of prior) {
    const a = anchorById.get(w.id)
    if (!a) continue
    if (current.distanceM <= 0) continue
    const distPct = Math.abs(current.distanceM - w.distanceM) / current.distanceM
    if (distPct > MATCH_DISTANCE_PCT) continue
    if (haversineMeters(start, { lat: a.startLat, lng: a.startLng }) > MATCH_RADIUS_M) continue
    if (haversineMeters(end, { lat: a.endLat, lng: a.endLng }) > MATCH_RADIUS_M) continue

    const pacePctImprovement =
      w.paceSPerKm > 0 ? ((w.paceSPerKm - current.paceSPerKm) / w.paceSPerKm) * 100 : 0
    return {
      matchedWorkoutId: w.id,
      matchedAt: w.startedAt,
      timeDeltaS: Math.round(current.durationS - w.durationS),
      pacePctImprovement: Math.round(pacePctImprovement * 10) / 10,
    }
  }

  return null
}

/**
 * Compare a finalized workout against the runner's own history: previous run,
 * personal best (fastest pace), weekly average, monthly average — plus a
 * lightweight start/end/distance route match. All deltas are signed
 * `current − baseline` (negative pace/time = faster). Pure; no I/O.
 */
export function buildComparison(
  current: CompletedWorkoutLite,
  currentAnchor: RouteAnchor | null,
  history: CompletedWorkoutLite[],
  anchors: RouteAnchor[],
): WorkoutComparison {
  const currentMs = Date.parse(current.startedAt)
  const prior = history
    .filter((w) => w.id !== current.id && w.distanceM > 0 && Date.parse(w.startedAt) < currentMs)
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))

  if (prior.length === 0) {
    return { hasHistory: false, entries: [], routeMatch: null }
  }

  const entries: WorkoutComparisonEntry[] = []

  entries.push({ key: 'previous', label: 'Previous Run', deltas: deltasVs(current, prior[0]) })

  const personalBest = prior.reduce((best, w) => (w.paceSPerKm < best.paceSPerKm ? w : best), prior[0])
  entries.push({ key: 'personalBest', label: 'Personal Best', deltas: deltasVs(current, personalBest) })

  const weekly = prior.filter((w) => currentMs - Date.parse(w.startedAt) <= WEEK_MS)
  if (weekly.length > 0) {
    entries.push({ key: 'weeklyAverage', label: 'Weekly Average', deltas: deltasVs(current, averageBaseline(weekly)) })
  }

  const monthly = prior.filter((w) => currentMs - Date.parse(w.startedAt) <= MONTH_MS)
  if (monthly.length > 0) {
    entries.push({ key: 'monthlyAverage', label: 'Monthly Average', deltas: deltasVs(current, averageBaseline(monthly)) })
  }

  return {
    hasHistory: true,
    entries,
    routeMatch: findRouteMatch(current, currentAnchor, prior, anchors),
  }
}
