import { cellToBoundary } from 'h3-js'
import type { HeatmapCell } from '@/features/territory/types'

/**
 * H3 cell boundary as a closed GeoJSON linear ring ([[lng, lat], ...] with the
 * first coordinate repeated at the end). Shared by both the ownership and
 * heatmap GeoJSON builders.
 */
function closedBoundaryRing(cellId: string): number[][] {
  // cellToBoundary with formatAsGeoJson=true returns [[lng, lat], ...].
  const boundary = cellToBoundary(cellId, true)
  if (boundary.length > 0) {
    const first = boundary[0]
    const last = boundary[boundary.length - 1]
    if (first[0] !== last[0] || first[1] !== last[1]) {
      boundary.push([...first])
    }
  }
  return boundary
}

/**
 * Converts a list of H3 cell IDs into a GeoJSON FeatureCollection of Polygons
 * (ownership mode — one polygon per owned cell).
 */
export function cellsToGeoJSON(cellIds: string[]) {
  const features = cellIds.map((cellId) => ({
    type: 'Feature' as const,
    id: cellId,
    geometry: { type: 'Polygon' as const, coordinates: [closedBoundaryRing(cellId)] },
    properties: { cellId },
  }))

  return { type: 'FeatureCollection' as const, features }
}

/**
 * Graduated heatmap color for a cell's capture frequency (02D-07B buckets).
 * Boundaries: 1 → light; 2–5; 6–10; 11+ → darkest. Zero/negative → neutral
 * (not expected in heatmap mode, which only renders captured cells).
 */
export function captureColor(captures: number): string {
  if (captures >= 11) return '#16a34a' // 10+ (i.e. 11 and above)
  if (captures >= 6) return '#22c55e' // 6–10
  if (captures >= 2) return '#4ade80' // 2–5
  if (captures >= 1) return '#86efac' // 1
  return '#374151' // neutral
}

/**
 * Converts heatmap cells into a GeoJSON FeatureCollection where each feature
 * carries its `captures` count and precomputed graduated `color`, so the map
 * layer can render activity density with a simple `['get','color']` paint.
 */
export function cellsToHeatmapGeoJSON(cells: readonly HeatmapCell[]) {
  const features = cells.map(({ cellId, captures }) => ({
    type: 'Feature' as const,
    id: cellId,
    geometry: { type: 'Polygon' as const, coordinates: [closedBoundaryRing(cellId)] },
    properties: { cellId, captures, color: captureColor(captures) },
  }))

  return { type: 'FeatureCollection' as const, features }
}

/** Resolved tooltip content for a hovered cell. */
export type TooltipData = { cellId: string; owner: string; captures: number }

/**
 * Tooltip content for a hovered cell: cell id, an owner label
 * ("Owned by You" when the viewer owns the cell, else "Neutral Territory"),
 * and the capture count (0 when unknown, e.g. ownership mode).
 */
export function buildTooltip(cellId: string, owned: boolean, captures = 0): TooltipData {
  return { cellId, owner: owned ? 'Owned by You' : 'Neutral Territory', captures }
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
