export interface Coordinate {
  lat: number
  lng: number
}

export interface Viewport {
  width: number
  height: number
  padding?: number
}

export interface RouteBounds {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

/**
 * Normalizes a route by calculating its bounding box.
 */
export function getRouteBounds(route: Coordinate[]): RouteBounds | null {
  if (!route || route.length === 0) return null

  let minLat = Number.POSITIVE_INFINITY
  let maxLat = Number.NEGATIVE_INFINITY
  let minLng = Number.POSITIVE_INFINITY
  let maxLng = Number.NEGATIVE_INFINITY

  for (const p of route) {
    if (p.lat < minLat) minLat = p.lat
    if (p.lat > maxLat) maxLat = p.lat
    if (p.lng < minLng) minLng = p.lng
    if (p.lng > maxLng) maxLng = p.lng
  }

  return { minLat, maxLat, minLng, maxLng }
}

/**
 * Maps a coordinate into the SVG viewport so it scales proportionally and
 * fits within ~80% of the canvas (leaving padding), centered.
 */
export function projectCoordinates(
  route: Coordinate[],
  viewport: Viewport,
): { x: number; y: number }[] {
  const bounds = getRouteBounds(route)
  if (!bounds) return []

  const padding = viewport.padding ?? viewport.width * 0.1 // 10% padding default

  const usableWidth = viewport.width - padding * 2
  const usableHeight = viewport.height - padding * 2

  const latDiff = bounds.maxLat - bounds.minLat
  const lngDiff = bounds.maxLng - bounds.minLng

  // Handle single-point routes or extremely tiny ones
  if (latDiff === 0 && lngDiff === 0) {
    return [{ x: viewport.width / 2, y: viewport.height / 2 }]
  }

  // To preserve aspect ratio, we figure out the scale factors
  // (longitude is x, latitude is y - Note latitude is inverted for screen space)
  const scaleX = usableWidth / (lngDiff || 1)
  const scaleY = usableHeight / (latDiff || 1)

  const scale = Math.min(scaleX, scaleY)

  // Calculate pixel bounds to center the route
  const pixelWidth = lngDiff * scale
  const pixelHeight = latDiff * scale

  const offsetX = (viewport.width - pixelWidth) / 2
  const offsetY = (viewport.height - pixelHeight) / 2

  return route.map((p) => {
    return {
      x: (p.lng - bounds.minLng) * scale + offsetX,
      y: (bounds.maxLat - p.lat) * scale + offsetY
    }
  })
}

export function generatePolyline(points: { x: number; y: number }[]): string {
  if (points.length === 0) return ''
  return points.map((p) => `${p.x},${p.y}`).join(' ')
}
