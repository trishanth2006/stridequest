import type { LatLng } from './types'

/** Mean Earth radius in metres (spherical model used for great-circle math). */
export const EARTH_RADIUS_M = 6_371_000

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180

/**
 * Great-circle distance between two coordinates in metres, via the haversine
 * formula on a spherical Earth. Always returns a non-negative value, and
 * exactly 0 for identical points. The `Math.min(1, …)` guard keeps the result
 * finite for (near-)antipodal points where floating-point error could push the
 * argument of `asin` slightly above 1.
 */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat)
  const dLng = toRadians(b.lng - a.lng)
  const lat1 = toRadians(a.lat)
  const lat2 = toRadians(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * Total length of an ordered path: the sum of haversine distances between
 * consecutive points. Empty and single-point paths have length 0.
 */
export function cumulativeDistanceMeters(points: readonly LatLng[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += haversineMeters(points[i - 1], points[i])
  }
  return total
}

/**
 * Sum of `distance_m` across workout rows, treating null/missing as 0.
 * Canonical way to derive lifetime distance from workouts — the denormalised
 * `profiles.total_distance_m` column is unmaintained, so callers should always
 * aggregate completed workouts through this helper.
 */
export function sumDistanceM(rows: readonly { distance_m: number | null }[]): number {
  return rows.reduce((total, row) => total + (row.distance_m ?? 0), 0)
}
