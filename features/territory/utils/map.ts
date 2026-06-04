import { cellToBoundary } from 'h3-js'

/**
 * Converts a list of H3 cell IDs into a GeoJSON FeatureCollection of Polygons.
 */
export function cellsToGeoJSON(cellIds: string[]) {
  const features = cellIds.map(cellId => {
    // cellToBoundary with true formatAsGeoJson returns [[lng, lat], ...]
    const boundary = cellToBoundary(cellId, true)
    
    // GeoJSON linear rings must be closed (first and last coordinate must match)
    if (boundary.length > 0) {
      const first = boundary[0]
      const last = boundary[boundary.length - 1]
      if (first[0] !== last[0] || first[1] !== last[1]) {
        boundary.push([...first])
      }
    }

    return {
      type: 'Feature' as const,
      id: cellId,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [boundary],
      },
      properties: {
        cellId,
      }
    }
  })

  return {
    type: 'FeatureCollection' as const,
    features
  }
}

/**
 * Calculates the bounding box [minLng, minLat, maxLng, maxLat] of all given cell IDs.
 * Returns null if the list is empty.
 */
export function calculateBounds(cellIds: string[]): [number, number, number, number] | null {
  if (cellIds.length === 0) return null

  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity

  for (const cellId of cellIds) {
    const boundary = cellToBoundary(cellId, true)
    for (const [lng, lat] of boundary) {
      if (lng < minLng) minLng = lng
      if (lat < minLat) minLat = lat
      if (lng > maxLng) maxLng = lng
      if (lat > maxLat) maxLat = lat
    }
  }

  return [minLng, minLat, maxLng, maxLat]
}
