import { haversineMeters } from '@/features/running/services/distance'
import type {
  WorkoutRoutePoint,
  WorkoutSplit,
  WorkoutElevation,
  WorkoutChartPoint,
} from '../types/workout-detail'

// Tunables ------------------------------------------------------------------
const FULL_KM_M = 1000
const ADAPTIVE_BUCKET_M = 200
/** A split counts as "full" (eligible for fastest/slowest) at ≥90% of bucket. */
const FULL_SPLIT_RATIO = 0.9
/** Half-window for moving averages (window size = 2n + 1). */
const ELEV_SMOOTH_HALF_WINDOW = 1
const CHART_SMOOTH_HALF_WINDOW = 5
/** Per-step altitude change below this (m) is treated as GPS noise. */
const ELEV_NOISE_THRESHOLD_M = 1
const CHART_MAX_POINTS = 300
/** Cap pace so stoppages don't blow out the chart axis. */
const MAX_PACE_MIN_PER_KM = 20

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function epoch(p: WorkoutRoutePoint): number {
  return Date.parse(p.timestamp)
}

/** Symmetric moving average; window size = 2 * halfWindow + 1. */
function movingAverage(values: number[], halfWindow: number): number[] {
  return values.map((_, i) => {
    let sum = 0
    let count = 0
    const lo = Math.max(0, i - halfWindow)
    const hi = Math.min(values.length - 1, i + halfWindow)
    for (let j = lo; j <= hi; j++) {
      sum += values[j]
      count++
    }
    return sum / count
  })
}

/** Uniform down-sample that always keeps the first and last element. */
function uniformSample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr
  const stride = (arr.length - 1) / (max - 1)
  const out: T[] = []
  for (let i = 0; i < max; i++) out.push(arr[Math.round(i * stride)])
  return out
}

function makeSplit(index: number, distanceM: number, durationS: number): WorkoutSplit {
  const paceSPerKm = distanceM > 0 ? durationS / (distanceM / 1000) : 0
  return { index, distanceM, durationS, paceSPerKm, isFastest: false, isSlowest: false }
}

function flagFastestSlowest(splits: WorkoutSplit[], bucketM: number): WorkoutSplit[] {
  const eligible = splits.filter((s) => s.distanceM >= FULL_SPLIT_RATIO * bucketM && s.paceSPerKm > 0)
  if (eligible.length < 2) return splits

  let fastest = eligible[0]
  let slowest = eligible[0]
  for (const s of eligible) {
    if (s.paceSPerKm < fastest.paceSPerKm) fastest = s
    if (s.paceSPerKm > slowest.paceSPerKm) slowest = s
  }
  if (fastest.paceSPerKm === slowest.paceSPerKm) return splits

  return splits.map((s) => ({
    ...s,
    isFastest: s === fastest,
    isSlowest: s === slowest,
  }))
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Split a route into pace splits. Full kilometre splits for runs ≥ 1 km, and
 * adaptive 200 m buckets for shorter runs. Distances are normalised to
 * `totalDistanceM` (the stored PostGIS distance) when given, so the splits sum
 * to the hero number rather than to the raw haversine total. Split boundaries
 * are interpolated by distance fraction so a point straddling a boundary still
 * yields an accurate split time.
 */
export function calculateSplits(
  routePoints: WorkoutRoutePoint[],
  totalDistanceM?: number,
): WorkoutSplit[] {
  if (!routePoints || routePoints.length < 2) return []

  const cumDist: number[] = [0]
  const times: number[] = [epoch(routePoints[0])]
  for (let i = 1; i < routePoints.length; i++) {
    cumDist[i] = cumDist[i - 1] + haversineMeters(routePoints[i - 1], routePoints[i])
    times[i] = epoch(routePoints[i])
  }

  const haversineTotal = cumDist[cumDist.length - 1]
  if (haversineTotal <= 0) return []

  const scale = totalDistanceM && totalDistanceM > 0 ? totalDistanceM / haversineTotal : 1
  const scaledTotal = haversineTotal * scale
  const bucket = scaledTotal < FULL_KM_M ? ADAPTIVE_BUCKET_M : FULL_KM_M

  const splits: WorkoutSplit[] = []
  let segStartDist = 0
  let segStartTime = times[0]
  let boundary = bucket
  let index = 1

  for (let i = 1; i < routePoints.length; i++) {
    const dPrev = cumDist[i - 1] * scale
    const dCurr = cumDist[i] * scale
    while (dCurr >= boundary && dPrev < boundary) {
      const span = dCurr - dPrev || 1
      const frac = (boundary - dPrev) / span
      const boundaryTime = times[i - 1] + frac * (times[i] - times[i - 1])
      splits.push(makeSplit(index, boundary - segStartDist, (boundaryTime - segStartTime) / 1000))
      index++
      segStartDist = boundary
      segStartTime = boundaryTime
      boundary += bucket
    }
  }

  const lastDist = scaledTotal - segStartDist
  if (lastDist > 1) {
    const durationS = (times[times.length - 1] - segStartTime) / 1000
    splits.push(makeSplit(index, lastDist, durationS))
  }

  return flagFastestSlowest(splits, bucket)
}

/**
 * Elevation summary from `altitude` values. Altitude is smoothed and a per-step
 * noise threshold is applied before accumulating gain/loss, so GPS jitter does
 * not inflate the totals. Returns `hasData: false` when fewer than two samples
 * carry altitude.
 */
export function calculateElevation(routePoints: WorkoutRoutePoint[]): WorkoutElevation {
  const alts = routePoints
    .map((p) => p.altitude)
    .filter((a): a is number => a != null && Number.isFinite(a))

  if (alts.length < 2) {
    return { hasData: false, gainM: 0, lossM: 0, highestM: null, lowestM: null }
  }

  const smoothed = movingAverage(alts, ELEV_SMOOTH_HALF_WINDOW)
  let gain = 0
  let loss = 0
  for (let i = 1; i < smoothed.length; i++) {
    const delta = smoothed[i] - smoothed[i - 1]
    if (delta > ELEV_NOISE_THRESHOLD_M) gain += delta
    else if (delta < -ELEV_NOISE_THRESHOLD_M) loss += -delta
  }

  return {
    hasData: true,
    gainM: Math.round(gain),
    lossM: Math.round(loss),
    highestM: Math.round(Math.max(...smoothed)),
    lowestM: Math.round(Math.min(...smoothed)),
  }
}

/**
 * Build a smoothed, down-sampled series for the pace / speed / elevation charts.
 * Smoothing runs on the full-resolution data, then the result is capped to
 * `maxPoints` so the client renders a few hundred points instead of tens of
 * thousands.
 */
export function buildChartSeries(
  routePoints: WorkoutRoutePoint[],
  maxPoints: number = CHART_MAX_POINTS,
): WorkoutChartPoint[] {
  if (!routePoints || routePoints.length < 2) return []

  const startT = epoch(routePoints[0])
  const raw: WorkoutChartPoint[] = []
  let cumulative = 0

  for (let i = 1; i < routePoints.length; i++) {
    const dist = haversineMeters(routePoints[i - 1], routePoints[i])
    cumulative += dist
    const dt = (epoch(routePoints[i]) - epoch(routePoints[i - 1])) / 1000
    if (dt <= 0) continue

    const speedKmh = (dist / dt) * 3.6
    const pace = speedKmh > 0 ? Math.min(MAX_PACE_MIN_PER_KM, 60 / speedKmh) : MAX_PACE_MIN_PER_KM
    raw.push({
      distanceKm: cumulative / 1000,
      timeS: (epoch(routePoints[i]) - startT) / 1000,
      pace,
      speed: speedKmh,
      altitude: routePoints[i].altitude,
    })
  }

  if (raw.length === 0) return []

  const speeds = movingAverage(raw.map((r) => r.speed), CHART_SMOOTH_HALF_WINDOW)
  const paces = movingAverage(raw.map((r) => r.pace), CHART_SMOOTH_HALF_WINDOW)
  const smoothed = raw.map((r, i) => ({ ...r, speed: speeds[i], pace: paces[i] }))

  return uniformSample(smoothed, maxPoints)
}

/** Down-sample a route polyline for map/share rendering, keeping the endpoints. */
export function downsamplePath(
  routePoints: WorkoutRoutePoint[],
  maxPoints: number,
): WorkoutRoutePoint[] {
  if (!routePoints) return []
  return uniformSample(routePoints, maxPoints)
}

/**
 * Map each capture location to the cumulative route distance (m) at the
 * spatially nearest route point. Used by the "Strongest Push" insight.
 *
 * Mapping is spatial, NOT temporal: every capture in a workout is written in
 * the same finalize transaction, so they all share one `captured_at`. Matching
 * on the cell centre coordinate is the only way to recover where on the route
 * each capture happened.
 */
export function mapCaptureDistances(
  routePoints: WorkoutRoutePoint[],
  captures: { lat: number; lng: number }[],
): number[] {
  if (routePoints.length < 2) return []

  const cumDist: number[] = [0]
  for (let i = 1; i < routePoints.length; i++) {
    cumDist[i] = cumDist[i - 1] + haversineMeters(routePoints[i - 1], routePoints[i])
  }

  return captures.map((capture) => {
    let bestIndex = 0
    let bestDist = Infinity
    for (let i = 0; i < routePoints.length; i++) {
      const d = haversineMeters(routePoints[i], capture)
      if (d < bestDist) {
        bestDist = d
        bestIndex = i
      }
    }
    return cumDist[bestIndex]
  })
}
