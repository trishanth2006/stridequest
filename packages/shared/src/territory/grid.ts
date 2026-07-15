import './patchTextDecoder' // must precede h3-js: silences utf-16le TextDecoder throw
import { latLngToCell, gridPathCells, isValidCell } from 'h3-js'
import type { LatLng } from '../running/types'
import type { CellId } from './types'

/**
 * Territory grid abstraction (02D-03A). Pure, deterministic, TypeScript-side H3
 * generation — no DB, no RPC, no ownership/XP. H3 is isolated behind these three
 * functions so the grid choice stays swappable (architecture §5, §11).
 *
 * The resolution is a fixed, migration-versioned constant: a cell id must mean
 * the same place forever (architecture §5 "global and fixed"). Never re-tile.
 */
export const H3_RESOLUTION = 9

function assertValidCoordinate(point: LatLng): void {
  const { lat, lng } = point
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    throw new Error(`Invalid coordinate: ${JSON.stringify(point)}`)
  }
}

/** gridPathCells can throw for pathologically long lines; fall back to the two
 *  endpoints so the function stays total and deterministic on valid coordinates. */
function gridLine(from: CellId, to: CellId): CellId[] {
  try {
    return gridPathCells(from, to)
  } catch {
    return [from, to]
  }
}

/**
 * Map an ordered path of coordinates to the H3 cells it passes through, in
 * traversal order (path coverage — architecture §4.1 model A). Segments that
 * span multiple cells are filled via the H3 grid line so no crossed cell is
 * skipped. Consecutive points in the same cell collapse. Output may contain
 * non-adjacent repeats if the path revisits a cell; use `dedupeCells` or
 * `normalizeCellIds` to collapse those.
 *
 * Throws on any invalid coordinate (out of range / non-finite). Empty path -> [].
 */
export function pathToCells(path: readonly LatLng[]): CellId[] {
  if (path.length === 0) return []
  for (const point of path) assertValidCoordinate(point)

  const cells: CellId[] = []
  let previous: CellId | null = null
  for (const point of path) {
    const cell = latLngToCell(point.lat, point.lng, H3_RESOLUTION)
    if (previous === null) {
      cells.push(cell)
    } else if (cell !== previous) {
      // gridLine includes both endpoints; the first equals `previous`, already pushed.
      const line = gridLine(previous, cell)
      for (let i = 1; i < line.length; i++) cells.push(line[i])
    }
    previous = cell
  }
  return cells
}

/** Remove duplicate cells, preserving first-occurrence (traversal) order. */
export function dedupeCells(cells: readonly CellId[]): CellId[] {
  const seen = new Set<CellId>()
  const result: CellId[] = []
  for (const cell of cells) {
    if (!seen.has(cell)) {
      seen.add(cell)
      result.push(cell)
    }
  }
  return result
}

/**
 * Canonicalize a list of cell ids: lower-cased, validated, de-duplicated, and
 * lexicographically sorted. The sort makes the result order-independent so that
 * the same geographic set normalizes identically regardless of traversal
 * direction (reversed / overlapping paths). Throws on any invalid H3 cell id.
 */
export function normalizeCellIds(cells: readonly CellId[]): CellId[] {
  const canonical = cells.map((cell) => cell.trim().toLowerCase())
  for (const cell of canonical) {
    if (!isValidCell(cell)) {
      throw new Error(`Invalid H3 cell id: ${cell}`)
    }
  }
  return Array.from(new Set(canonical)).sort()
}
