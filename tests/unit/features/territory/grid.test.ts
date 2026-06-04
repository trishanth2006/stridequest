import {
  latLngToCell,
  isValidCell,
  getResolution,
  gridDistance,
} from 'h3-js'
import {
  H3_RESOLUTION,
  pathToCells,
  dedupeCells,
  normalizeCellIds,
} from '@/features/territory/grid'
import type { LatLng } from '@/features/running/types'

// Real coordinates → real res-9 cells (h3-js is the trusted dependency; it
// supplies ground-truth fixtures, the SUT is grid.ts's orchestration).
const SF: LatLng = { lat: 37.7752, lng: -122.4188 }
const SF_NORTH: LatLng = { lat: 37.79, lng: -122.4188 } // ~1.6 km north → several cells away
const NYC: LatLng = { lat: 40.0, lng: -74.0 }
const LONDON: LatLng = { lat: 51.5, lng: -0.1 }

const cellOf = (p: LatLng) => latLngToCell(p.lat, p.lng, 9)

describe('H3_RESOLUTION', () => {
  it('is fixed at 9 (approved architecture)', () => {
    expect(H3_RESOLUTION).toBe(9)
  })
})

describe('pathToCells', () => {
  it('empty path -> []', () => {
    expect(pathToCells([])).toEqual([])
  })

  it('single point -> the one cell containing it', () => {
    expect(pathToCells([SF])).toEqual([cellOf(SF)])
  })

  it('consecutive points in the same cell collapse to one cell', () => {
    expect(pathToCells([SF, SF, SF])).toEqual([cellOf(SF)])
  })

  it('two points in different cells include both endpoints in traversal order', () => {
    const cells = pathToCells([SF, SF_NORTH])
    expect(cells[0]).toBe(cellOf(SF))
    expect(cells[cells.length - 1]).toBe(cellOf(SF_NORTH))
    expect(cells.length).toBeGreaterThanOrEqual(2)
  })

  it('fills the segment between far cells into a contiguous chain (path coverage)', () => {
    const cells = pathToCells([SF, SF_NORTH])
    // every cell is a valid res-9 index
    expect(cells.every((c) => isValidCell(c) && getResolution(c) === 9)).toBe(true)
    // no consecutive duplicates, and each consecutive pair are grid neighbors
    for (let i = 0; i < cells.length - 1; i++) {
      expect(cells[i]).not.toBe(cells[i + 1])
      expect(gridDistance(cells[i], cells[i + 1])).toBe(1)
    }
  })

  it('is deterministic: same input -> identical output', () => {
    const path = [SF, SF_NORTH, NYC]
    expect(pathToCells(path)).toEqual(pathToCells([...path]))
  })

  it.each<LatLng>([
    { lat: 91, lng: 0 },
    { lat: -91, lng: 0 },
    { lat: 0, lng: 181 },
    { lat: 0, lng: -181 },
    { lat: Number.NaN, lng: 0 },
    { lat: 0, lng: Number.POSITIVE_INFINITY },
  ])('throws on invalid coordinate %p', (bad) => {
    expect(() => pathToCells([SF, bad])).toThrow(/invalid coordinate/i)
  })
})

describe('dedupeCells', () => {
  it('removes duplicates preserving first-occurrence order', () => {
    expect(dedupeCells(['a', 'b', 'a', 'c', 'b'])).toEqual(['a', 'b', 'c'])
  })

  it('empty -> []', () => {
    expect(dedupeCells([])).toEqual([])
  })

  it('no duplicates -> unchanged order', () => {
    expect(dedupeCells(['x', 'y', 'z'])).toEqual(['x', 'y', 'z'])
  })
})

describe('normalizeCellIds', () => {
  it('empty -> []', () => {
    expect(normalizeCellIds([])).toEqual([])
  })

  it('dedupes and returns a sorted, canonical set', () => {
    const out = normalizeCellIds([cellOf(NYC), cellOf(SF), cellOf(LONDON), cellOf(SF)])
    expect(out).toHaveLength(3)
    expect(new Set(out).size).toBe(3)
    expect([...out].sort()).toEqual(out) // already sorted
  })

  it('is order-independent (overlapping/reversed paths normalize equally)', () => {
    const a = cellOf(SF)
    const b = cellOf(NYC)
    const c = cellOf(LONDON)
    expect(normalizeCellIds([a, b, c])).toEqual(normalizeCellIds([c, b, a, a]))
  })

  it('lowercases before validating (uppercase hex is accepted)', () => {
    const c = cellOf(SF)
    expect(normalizeCellIds([c.toUpperCase()])).toEqual([c])
  })

  it.each(['not-a-cell', 'zzzz', ''])('throws on invalid cell id %p', (bad) => {
    expect(() => normalizeCellIds([bad])).toThrow(/invalid h3 cell/i)
  })
})

describe('composition: overlapping paths', () => {
  it('two paths crossing the same cell share it after normalization', () => {
    const pathA = [SF, { lat: 37.776, lng: -122.4188 }]
    const pathB = [{ lat: 37.7745, lng: -122.4195 }, SF]
    const setA = new Set(normalizeCellIds(pathToCells(pathA)))
    const setB = new Set(normalizeCellIds(pathToCells(pathB)))
    expect(setA.has(cellOf(SF))).toBe(true)
    expect(setB.has(cellOf(SF))).toBe(true)
  })
})
