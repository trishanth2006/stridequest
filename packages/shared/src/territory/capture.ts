import { pathToCells, normalizeCellIds } from './grid'
import type { CellId } from './types'

/**
 * A route point sample as seen by the capture service. Contains only the
 * fields needed to sort and project to H3 cells — no accuracy, altitude, or
 * speed, so capture stays decoupled from the GPS layer.
 *
 * Ordering key: (recordedAt, batchSeq, pointSeq) — mirrors the SQL
 * `ORDER BY recorded_at, batch_seq, point_seq` in finalize_workout so that
 * the TypeScript cell set stays in parity with the server-side LINESTRING
 * (architecture §4.1, risk R-03/R-07).
 */
export type CaptureRoutePoint = {
  lat: number
  lng: number
  /** ISO-8601 timestamp string. Lexicographic comparison is sufficient for ordering. */
  recordedAt: string
  /** Monotonically increasing batch counter from the GPS buffer flush. */
  batchSeq: number
  /** Sequence number within a single batch. */
  pointSeq: number
}

/**
 * Derive the canonical set of H3 cells captured by a route.
 *
 * **Responsibilities owned by this function:**
 * 1. **Point ordering** — sorts by `(recordedAt, batchSeq, pointSeq)` before
 *    delegating to grid. Out-of-order input causes wrong intermediate cells
 *    (gridPathCells fills segments between *consecutive* points), so ordering
 *    is load-bearing, not cosmetic.
 * 2. **Adaptation** — maps `CaptureRoutePoint` to the `LatLng` shape that
 *    `grid.pathToCells` expects.
 *
 * **Delegated entirely to grid (no direct h3-js usage here):**
 * - `pathToCells` — coordinate-to-cell mapping + segment fill.
 * - `normalizeCellIds` — deduplication, lower-casing, validation, and
 *   lexicographic sort for a canonical, order-independent output.
 *
 * **Guarantees:**
 * - Pure function: no DB, no RPC, no side effects.
 * - Deterministic: identical input (any order) → identical output.
 * - Empty input → `[]`.
 * - Single point → `[oneCell]`.
 * - Invalid coordinate → throws (delegated to `pathToCells`).
 *
 * Equivalent to: `normalizeCellIds(pathToCells(sortedPoints.map(toLatLng)))`
 */
export function captureCells(points: readonly CaptureRoutePoint[]): CellId[] {
  if (points.length === 0) return []

  const ordered = [...points].sort(compareRoutePoints)

  const path = ordered.map((p) => ({ lat: p.lat, lng: p.lng }))

  return normalizeCellIds(pathToCells(path))
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Total order for route points: `recordedAt` (ISO-8601 lexicographic) →
 * `batchSeq` → `pointSeq`. Mirrors the SQL `ORDER BY recorded_at, batch_seq,
 * point_seq` in `finalize_workout` so that TS and SQL LINESTRING composition
 * always agree on the traversal order (R-03 parity guard).
 */
function compareRoutePoints(a: CaptureRoutePoint, b: CaptureRoutePoint): number {
  if (a.recordedAt < b.recordedAt) return -1
  if (a.recordedAt > b.recordedAt) return 1
  if (a.batchSeq !== b.batchSeq) return a.batchSeq - b.batchSeq
  return a.pointSeq - b.pointSeq
}
