import { latLngToCell, isValidCell, getResolution } from 'h3-js'
import { pathToCells, normalizeCellIds } from '@/features/territory/grid'
import { captureCells } from '@/features/territory/capture'
import type { CaptureRoutePoint } from '@/features/territory/capture'

// ---------------------------------------------------------------------------
// Real coordinates for fixtures
// ---------------------------------------------------------------------------
// San Francisco area — well-tested in grid.test.ts, same ground-truth approach.
const SF = { lat: 37.7752, lng: -122.4188 }
const SF_NORTH = { lat: 37.79, lng: -122.4188 } // ~1.6 km north

// Helper: build a minimal CaptureRoutePoint from lat/lng with controllable order fields.
function pt(
  lat: number,
  lng: number,
  recordedAt: string,
  batchSeq: number,
  pointSeq: number,
): CaptureRoutePoint {
  return { lat, lng, recordedAt, batchSeq, pointSeq }
}

// ---------------------------------------------------------------------------
// Fixtures: L-shape and loop (loaded from JSON fixtures)
// Paths are relative from tests/unit/features/territory/ to tests/fixtures/geo/
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-require-imports
const lShapeFixture = require('../../../../tests/fixtures/geo/l-shape.json') as CaptureRoutePoint[]
// eslint-disable-next-line @typescript-eslint/no-require-imports
const loopFixture = require('../../../../tests/fixtures/geo/loop.json') as {
  points: CaptureRoutePoint[]
  interiorPoint: { lat: number; lng: number }
}

describe('captureCells', () => {
  // -------------------------------------------------------------------------
  // 1. Empty route
  // -------------------------------------------------------------------------
  describe('empty route', () => {
    it('returns [] for an empty points array', () => {
      expect(captureCells([])).toEqual([])
    })
  })

  // -------------------------------------------------------------------------
  // 2. Single point
  // -------------------------------------------------------------------------
  describe('single point', () => {
    it('returns one valid CellId for a single route point', () => {
      const point = pt(SF.lat, SF.lng, '2024-01-01T00:00:00Z', 0, 0)
      const result = captureCells([point])
      expect(result).toHaveLength(1)
      // The cell must be the res-9 H3 index for SF — validated via h3-js directly
      expect(result[0]).toBe(latLngToCell(SF.lat, SF.lng, 9))
    })
  })

  // -------------------------------------------------------------------------
  // 3. Deterministic output
  // -------------------------------------------------------------------------
  describe('deterministic output', () => {
    it('returns identical output on repeated calls with the same input', () => {
      const points = [
        pt(SF.lat, SF.lng, '2024-01-01T00:00:00Z', 0, 0),
        pt(SF_NORTH.lat, SF_NORTH.lng, '2024-01-01T00:00:10Z', 0, 1),
      ]
      const first = captureCells(points)
      const second = captureCells([...points])
      expect(first).toEqual(second)
    })
  })

  // -------------------------------------------------------------------------
  // 4. Scrambled ordering — ordering must be owned by captureCells
  // -------------------------------------------------------------------------
  describe('scrambled ordering', () => {
    it('produces identical output regardless of input order (captureCells orders internally)', () => {
      const sorted = [
        pt(SF.lat, SF.lng, '2024-01-01T00:00:00Z', 0, 0),
        pt(SF_NORTH.lat, SF_NORTH.lng, '2024-01-01T00:00:10Z', 0, 1),
      ]
      // Scramble: reverse order
      const scrambled = [
        pt(SF_NORTH.lat, SF_NORTH.lng, '2024-01-01T00:00:10Z', 0, 1),
        pt(SF.lat, SF.lng, '2024-01-01T00:00:00Z', 0, 0),
      ]
      expect(captureCells(sorted)).toEqual(captureCells(scrambled))
    })

    it('sorts by recordedAt first, then batchSeq, then pointSeq', () => {
      // Build two points in different timestamps and verify ordering
      const early = pt(SF.lat, SF.lng, '2024-01-01T00:00:00Z', 1, 5)
      const late = pt(SF_NORTH.lat, SF_NORTH.lng, '2024-01-01T00:01:00Z', 0, 0)
      // Regardless of input order, cells should be based on SF → SF_NORTH path
      const forwardResult = captureCells([early, late])
      const reversedResult = captureCells([late, early])
      expect(forwardResult).toEqual(reversedResult)
    })

    it('uses batchSeq to break recordedAt ties', () => {
      const sameTime = '2024-01-01T00:00:00Z'
      // batchSeq=0 comes before batchSeq=1 at same recordedAt
      const first = pt(SF.lat, SF.lng, sameTime, 0, 0)
      const second = pt(SF_NORTH.lat, SF_NORTH.lng, sameTime, 1, 0)
      const normal = captureCells([first, second])
      const reversed = captureCells([second, first])
      expect(normal).toEqual(reversed)
    })

    it('uses pointSeq to break batchSeq ties', () => {
      const sameTime = '2024-01-01T00:00:00Z'
      // pointSeq=0 comes before pointSeq=1 in the same batch
      const first = pt(SF.lat, SF.lng, sameTime, 0, 0)
      const second = pt(SF_NORTH.lat, SF_NORTH.lng, sameTime, 0, 1)
      const normal = captureCells([first, second])
      const reversed = captureCells([second, first])
      expect(normal).toEqual(reversed)
    })
  })

  // -------------------------------------------------------------------------
  // 5. Invalid coordinates must throw
  // -------------------------------------------------------------------------
  describe('invalid coordinates', () => {
    it.each<[string, number, number]>([
      ['lat > 90', 91, 0],
      ['lat < -90', -91, 0],
      ['lng > 180', 0, 181],
      ['lng < -180', 0, -181],
      ['NaN lat', Number.NaN, 0],
      ['Infinity lng', 0, Number.POSITIVE_INFINITY],
    ])('throws on %s', (_label, lat, lng) => {
      const point = pt(lat, lng, '2024-01-01T00:00:00Z', 0, 0)
      expect(() => captureCells([point])).toThrow(/invalid coordinate/i)
    })
  })

  // -------------------------------------------------------------------------
  // 6. Output invariants: canonical ordering, no duplicates
  // -------------------------------------------------------------------------
  describe('output invariants', () => {
    it('output is lexicographically sorted', () => {
      const points = [
        pt(SF.lat, SF.lng, '2024-01-01T00:00:00Z', 0, 0),
        pt(SF_NORTH.lat, SF_NORTH.lng, '2024-01-01T00:00:10Z', 0, 1),
      ]
      const result = captureCells(points)
      const sorted = [...result].sort()
      expect(result).toEqual(sorted)
    })

    it('output contains no duplicate cells', () => {
      // Path that revisits the same area
      const points = [
        pt(SF.lat, SF.lng, '2024-01-01T00:00:00Z', 0, 0),
        pt(SF_NORTH.lat, SF_NORTH.lng, '2024-01-01T00:00:10Z', 0, 1),
        pt(SF.lat, SF.lng, '2024-01-01T00:00:20Z', 0, 2), // revisit
      ]
      const result = captureCells(points)
      expect(new Set(result).size).toBe(result.length)
    })
  })

  // -------------------------------------------------------------------------
  // 7. Contract: captureCells ≡ normalizeCellIds(pathToCells(sortedPoints))
  // -------------------------------------------------------------------------
  describe('contract equivalence', () => {
    it('captureCells(points) === normalizeCellIds(pathToCells(sortedPoints))', () => {
      const points = [
        pt(SF.lat, SF.lng, '2024-01-01T00:00:00Z', 0, 0),
        pt(SF_NORTH.lat, SF_NORTH.lng, '2024-01-01T00:00:10Z', 0, 1),
      ]
      // Manually sort in the same order captureCells uses
      const sorted = [...points].sort((a, b) => {
        if (a.recordedAt !== b.recordedAt) return a.recordedAt < b.recordedAt ? -1 : 1
        if (a.batchSeq !== b.batchSeq) return a.batchSeq - b.batchSeq
        return a.pointSeq - b.pointSeq
      })
      const expected = normalizeCellIds(pathToCells(sorted.map((p) => ({ lat: p.lat, lng: p.lng }))))
      expect(captureCells(points)).toEqual(expected)
    })

    it('captureCells(scrambled) === normalizeCellIds(pathToCells(sortedPoints)) for scrambled input', () => {
      const sorted = [
        pt(SF.lat, SF.lng, '2024-01-01T00:00:00Z', 0, 0),
        pt(SF_NORTH.lat, SF_NORTH.lng, '2024-01-01T00:00:10Z', 0, 1),
      ]
      const scrambled = [...sorted].reverse()
      const expected = normalizeCellIds(
        pathToCells(sorted.map((p) => ({ lat: p.lat, lng: p.lng }))),
      )
      expect(captureCells(scrambled)).toEqual(expected)
    })
  })

  // -------------------------------------------------------------------------
  // 8. L-shape fixture
  // -------------------------------------------------------------------------
  describe('l-shape fixture', () => {
    it('returns valid res-9 cells for the L-shaped route', () => {
      const result = captureCells(lShapeFixture)
      expect(result.length).toBeGreaterThan(0)
      // All cells are valid res-9 H3 indexes
      expect(result.every((c) => isValidCell(c) && getResolution(c) === 9)).toBe(true)
    })

    it('L-shape result is sorted (canonical)', () => {
      const result = captureCells(lShapeFixture)
      expect(result).toEqual([...result].sort())
    })

    it('L-shape result contains no duplicates', () => {
      const result = captureCells(lShapeFixture)
      expect(new Set(result).size).toBe(result.length)
    })

    it('L-shape result is deterministic (stable across calls)', () => {
      const a = captureCells(lShapeFixture)
      const b = captureCells(lShapeFixture)
      expect(a).toEqual(b)
    })

    it('L-shape scrambled produces the same set as sorted', () => {
      const scrambled = [...lShapeFixture].reverse()
      expect(captureCells(lShapeFixture)).toEqual(captureCells(scrambled))
    })
  })

  // -------------------------------------------------------------------------
  // 9. Loop fixture — model A: path coverage, not fill
  // -------------------------------------------------------------------------
  describe('loop fixture (model A — path coverage, not interior fill)', () => {
    it('returns valid res-9 cells for the loop route', () => {
      const result = captureCells(loopFixture.points)
      expect(result.length).toBeGreaterThan(0)
      expect(result.every((c) => isValidCell(c) && getResolution(c) === 9)).toBe(true)
    })

    it('loop result is sorted and deduplicated', () => {
      const result = captureCells(loopFixture.points)
      expect(result).toEqual([...result].sort())
      expect(new Set(result).size).toBe(result.length)
    })

    it('loop result is deterministic', () => {
      const a = captureCells(loopFixture.points)
      const b = captureCells(loopFixture.points)
      expect(a).toEqual(b)
    })

    it('model A: does NOT include a known interior-only cell (path coverage, not fill)', () => {
      const result = captureCells(loopFixture.points)
      const interiorCell = latLngToCell(
        loopFixture.interiorPoint.lat,
        loopFixture.interiorPoint.lng,
        9,
      )
      // The interior cell is inside the loop but not on its perimeter path.
      // Model A only captures cells the path crosses, so the interior cell
      // must not appear unless the path literally passed through it.
      expect(result).not.toContain(interiorCell)
    })
  })
})
