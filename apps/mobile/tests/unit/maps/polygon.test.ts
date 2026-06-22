// Mock h3-js to prevent WASM loading — jest-expo replaces TextDecoder globally
// which conflicts with h3-js's WASM TextDecoder usage. We test our code, not h3-js.
jest.mock('h3-js', () => ({
  cellToBoundary: jest.fn(() => [
    [37.77, -122.42],
    [37.78, -122.42],
    [37.78, -122.41],
    [37.77, -122.41],
    [37.76, -122.41],
    [37.76, -122.42],
  ]),
  latLngToCell: jest.fn(() => 'mock-h3-cell'),
  gridPathCells: jest.fn((from: string, to: string) => [from, to]),
  isValidCell: jest.fn(() => true),
}))

import { cellToPolygon, cellsToFeatureCollection } from '@stridequest/shared/territory'

const MOCK_CELL = 'mock-h3-cell'

describe('cellToPolygon', () => {
  it('returns a Feature with Polygon geometry', () => {
    const feature = cellToPolygon(MOCK_CELL)
    expect(feature.type).toBe('Feature')
    expect(feature.geometry.type).toBe('Polygon')
  })

  it('closes the ring — first and last coordinates are equal', () => {
    const feature = cellToPolygon(MOCK_CELL)
    const ring = feature.geometry.coordinates[0]
    expect(ring[0]).toEqual(ring[ring.length - 1])
  })

  it('swaps h3 [lat, lng] to GeoJSON [lng, lat] order', () => {
    // mock returns [lat=37.77, lng=-122.42] as first pair → expect [lng, lat]
    const feature = cellToPolygon(MOCK_CELL)
    const [lng, lat] = feature.geometry.coordinates[0][0]
    expect(lng).toBeCloseTo(-122.42)
    expect(lat).toBeCloseTo(37.77)
  })

  it('stores the cell id in properties', () => {
    const feature = cellToPolygon(MOCK_CELL)
    expect(feature.properties.cellId).toBe(MOCK_CELL)
  })
})

describe('cellsToFeatureCollection', () => {
  it('returns a FeatureCollection with one feature per cell', () => {
    const result = cellsToFeatureCollection([MOCK_CELL])
    expect(result.type).toBe('FeatureCollection')
    expect(result.features).toHaveLength(1)
  })

  it('returns empty FeatureCollection for empty input', () => {
    const result = cellsToFeatureCollection([])
    expect(result.type).toBe('FeatureCollection')
    expect(result.features).toHaveLength(0)
  })
})
