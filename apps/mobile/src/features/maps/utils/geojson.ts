import type { Feature, LineString } from 'geojson'
import type { RoutePoint } from '../types'

// 3 m expressed as approximate degrees (1° ≈ 111 000 m at equator)
const DEFAULT_TOLERANCE_DEG = 3 / 111_000

function perpendicularDistance(
  point: RoutePoint,
  lineStart: RoutePoint,
  lineEnd: RoutePoint,
): number {
  const dx = lineEnd.lng - lineStart.lng
  const dy = lineEnd.lat - lineStart.lat
  const mag = Math.sqrt(dx * dx + dy * dy)
  if (mag === 0) {
    return Math.sqrt(
      Math.pow(point.lng - lineStart.lng, 2) + Math.pow(point.lat - lineStart.lat, 2),
    )
  }
  return (
    Math.abs(dx * (lineStart.lat - point.lat) - (lineStart.lng - point.lng) * dy) / mag
  )
}

function douglasPeucker(points: RoutePoint[], tolerance: number): RoutePoint[] {
  if (points.length <= 2) return points
  let maxDist = 0
  let maxIdx = 0
  const last = points.length - 1
  for (let i = 1; i < last; i++) {
    const d = perpendicularDistance(points[i], points[0], points[last])
    if (d > maxDist) {
      maxDist = d
      maxIdx = i
    }
  }
  if (maxDist > tolerance) {
    const left = douglasPeucker(points.slice(0, maxIdx + 1), tolerance)
    const right = douglasPeucker(points.slice(maxIdx), tolerance)
    return [...left.slice(0, -1), ...right]
  }
  return [points[0], points[last]]
}

export function simplifyRoute(
  points: RoutePoint[],
  toleranceDeg = DEFAULT_TOLERANCE_DEG,
): RoutePoint[] {
  if (points.length <= 2) return points
  return douglasPeucker(points, toleranceDeg)
}

export function routePointsToLineString(points: RoutePoint[]): Feature<LineString> {
  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: points.map((p) => [p.lng, p.lat]),
    },
    properties: null,
  }
}

export function fitBoundsFromCoordinates(
  coords: [number, number][],
): { ne: [number, number]; sw: [number, number] } {
  if (coords.length === 0) return { ne: [0, 0], sw: [0, 0] }
  let minLng = coords[0][0]
  let maxLng = coords[0][0]
  let minLat = coords[0][1]
  let maxLat = coords[0][1]
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }
  return { ne: [maxLng, maxLat], sw: [minLng, minLat] }
}
