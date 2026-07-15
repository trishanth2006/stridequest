import { cellToBoundary } from 'h3-js'

type LngLat = [number, number]

export type CellPolygonFeature = {
  type: 'Feature'
  geometry: {
    type: 'Polygon'
    coordinates: LngLat[][]
  }
  properties: { cellId: string }
}

export type CellFeatureCollection = {
  type: 'FeatureCollection'
  features: CellPolygonFeature[]
}

/**
 * Convert a single H3 cell ID to a GeoJSON Polygon Feature.
 * h3-js cellToBoundary returns [lat, lng] pairs; GeoJSON requires [lng, lat].
 */
export function cellToPolygon(cellId: string): CellPolygonFeature {
  const boundary = cellToBoundary(cellId)
  const ring: LngLat[] = boundary.map(([lat, lng]) => [lng, lat])
  ring.push(ring[0]) // close the ring
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [ring] },
    properties: { cellId },
  }
}

/**
 * Convert an array of H3 cell IDs to a GeoJSON FeatureCollection.
 * Empty input produces a FeatureCollection with zero features.
 */
export function cellsToFeatureCollection(cellIds: string[]): CellFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: cellIds.map(cellToPolygon),
  }
}
