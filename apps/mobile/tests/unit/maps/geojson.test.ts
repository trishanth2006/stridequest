import {
  simplifyRoute,
  routePointsToLineString,
  fitBoundsFromCoordinates,
  computeCentroid,
} from '@/features/maps/utils/geojson'
import type { RoutePoint } from '@/features/maps/types'

const STRAIGHT_LINE: RoutePoint[] = [
  { lat: 37.770, lng: -122.420 },
  { lat: 37.771, lng: -122.420 },
  { lat: 37.772, lng: -122.420 },
  { lat: 37.773, lng: -122.420 },
  { lat: 37.774, lng: -122.420 },
]

describe('simplifyRoute', () => {
  it('returns points unchanged when 2 or fewer', () => {
    const two = STRAIGHT_LINE.slice(0, 2)
    expect(simplifyRoute(two)).toEqual(two)
  })

  it('collapses a straight line to 2 points', () => {
    const result = simplifyRoute(STRAIGHT_LINE)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual(STRAIGHT_LINE[0])
    expect(result[result.length - 1]).toEqual(STRAIGHT_LINE[STRAIGHT_LINE.length - 1])
  })

  it('preserves a sharp bend', () => {
    const bend: RoutePoint[] = [
      { lat: 37.770, lng: -122.420 },
      { lat: 37.775, lng: -122.420 },
      { lat: 37.775, lng: -122.415 },
    ]
    const result = simplifyRoute(bend, 1e-5)
    expect(result.length).toBeGreaterThan(2)
  })

  it('returns empty array unchanged', () => {
    expect(simplifyRoute([])).toEqual([])
  })
})

describe('routePointsToLineString', () => {
  it('returns a GeoJSON LineString Feature', () => {
    const feature = routePointsToLineString(STRAIGHT_LINE)
    expect(feature.type).toBe('Feature')
    expect(feature.geometry.type).toBe('LineString')
  })

  it('outputs coordinates in [lng, lat] order', () => {
    const feature = routePointsToLineString([{ lat: 37.77, lng: -122.42 }])
    expect(feature.geometry.coordinates[0]).toEqual([-122.42, 37.77])
  })

  it('has the correct number of coordinate pairs', () => {
    const feature = routePointsToLineString(STRAIGHT_LINE)
    expect(feature.geometry.coordinates).toHaveLength(5)
  })
})

describe('fitBoundsFromCoordinates', () => {
  it('returns ne and sw corners from a set of coordinates', () => {
    const coords: [number, number][] = [
      [-122.42, 37.77],
      [-122.41, 37.78],
      [-122.43, 37.76],
    ]
    const { ne, sw } = fitBoundsFromCoordinates(coords)
    expect(ne).toEqual([-122.41, 37.78])
    expect(sw).toEqual([-122.43, 37.76])
  })

  it('handles a single coordinate', () => {
    const coords: [number, number][] = [[-122.42, 37.77]]
    const { ne, sw } = fitBoundsFromCoordinates(coords)
    expect(ne).toEqual([-122.42, 37.77])
    expect(sw).toEqual([-122.42, 37.77])
  })

  it('returns zeros for empty input', () => {
    const { ne, sw } = fitBoundsFromCoordinates([])
    expect(ne).toEqual([0, 0])
    expect(sw).toEqual([0, 0])
  })
})

describe('computeCentroid', () => {
  it('returns the average of an open ring', () => {
    const ring: [number, number][] = [
      [0, 0],
      [0, 2],
      [2, 2],
      [2, 0],
    ]
    expect(computeCentroid(ring)).toEqual([1, 1])
  })

  it('ignores a duplicated closing point', () => {
    const ring: [number, number][] = [
      [0, 0],
      [0, 2],
      [2, 2],
      [2, 0],
      [0, 0],
    ]
    expect(computeCentroid(ring)).toEqual([1, 1])
  })

  it('handles a single point', () => {
    expect(computeCentroid([[5, 5]])).toEqual([5, 5])
  })
})
