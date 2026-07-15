// deno-lint-ignore-file no-explicit-any
import { latLngToCell, gridPathCells, isValidCell } from 'npm:h3-js'
import type { LatLng, CellId } from './types.ts'

export const H3_RESOLUTION = 9

function assertValidCoordinate(point: LatLng): void {
  const { lat, lng } = point
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error(`Invalid coordinate: ${JSON.stringify(point)}`)
  }
}

function gridLine(from: CellId, to: CellId): CellId[] {
  try {
    return gridPathCells(from, to) as CellId[]
  } catch {
    return [from, to]
  }
}

export function pathToCells(path: readonly LatLng[]): CellId[] {
  if (path.length === 0) return []
  for (const point of path) assertValidCoordinate(point)
  const cells: CellId[] = []
  let previous: CellId | null = null
  for (const point of path) {
    const cell = latLngToCell(point.lat, point.lng, H3_RESOLUTION) as CellId
    if (previous === null) {
      cells.push(cell)
    } else if (cell !== previous) {
      const line = gridLine(previous, cell)
      for (let i = 1; i < line.length; i++) cells.push(line[i])
    }
    previous = cell
  }
  return cells
}

export function normalizeCellIds(cells: readonly CellId[]): CellId[] {
  const canonical = cells.map((c) => c.trim().toLowerCase())
  for (const cell of canonical) {
    if (!isValidCell(cell)) throw new Error(`Invalid H3 cell id: ${cell}`)
  }
  return Array.from(new Set(canonical)).sort()
}
