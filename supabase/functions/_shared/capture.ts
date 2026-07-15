// TECH-DEBT: This file duplicates packages/shared/src/territory/{types,grid,capture}.ts.
// They must stay in sync. Unify once a Deno-compatible import path exists for the
// shared npm package (e.g., via an npm registry or JSR publication).
// Tracked as: TECH-DEBT-001
import type { CaptureRoutePoint, CellId } from './types.ts'
import { pathToCells, normalizeCellIds } from './grid.ts'

function compareRoutePoints(a: CaptureRoutePoint, b: CaptureRoutePoint): number {
  if (a.recordedAt < b.recordedAt) return -1
  if (a.recordedAt > b.recordedAt) return 1
  if (a.batchSeq !== b.batchSeq) return a.batchSeq - b.batchSeq
  return a.pointSeq - b.pointSeq
}

export function captureCells(points: readonly CaptureRoutePoint[]): CellId[] {
  if (points.length === 0) return []
  const ordered = [...points].sort(compareRoutePoints)
  const path = ordered.map((p) => ({ lat: p.lat, lng: p.lng }))
  return normalizeCellIds(pathToCells(path))
}
