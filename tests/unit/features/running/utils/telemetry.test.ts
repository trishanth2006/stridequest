import {
  calculateSplits,
  calculateElevation,
  buildChartSeries,
  downsamplePath,
  mapCaptureDistances,
} from '@/features/running/utils/telemetry'
import type { WorkoutRoutePoint } from '@/features/running/types/workout-detail'

// At the equator, 1 degree of longitude is ~111195 m, so placing points along
// lat=0 makes cumulative haversine distance match the metres we intend exactly.
const METERS_PER_DEG = 111194.93

type Step = { dm: number; dt: number; alt?: number | null }

function buildRoute(steps: Step[], startAlt: number | null = 500): WorkoutRoutePoint[] {
  let lng = 0
  let t = Date.parse('2025-01-01T00:00:00.000Z')
  const points: WorkoutRoutePoint[] = [
    { lat: 0, lng: 0, timestamp: new Date(t).toISOString(), altitude: startAlt },
  ]
  for (const s of steps) {
    lng += s.dm / METERS_PER_DEG
    t += s.dt * 1000
    points.push({
      lat: 0,
      lng,
      timestamp: new Date(t).toISOString(),
      altitude: s.alt ?? null,
    })
  }
  return points
}

const steps = (count: number, dm: number, dt: number): Step[] =>
  Array.from({ length: count }, () => ({ dm, dt }))

describe('calculateSplits', () => {
  it('returns [] for fewer than 2 points', () => {
    expect(calculateSplits([])).toEqual([])
    expect(calculateSplits([{ lat: 0, lng: 0, timestamp: '2025-01-01T00:00:00Z', altitude: null }])).toEqual([])
  })

  it('produces one full-km split per kilometre with correct pace', () => {
    // km1 = 300s, km2 = 240s (fastest), km3 = 360s (slowest)
    const route = buildRoute([
      ...steps(10, 100, 30),
      ...steps(10, 100, 24),
      ...steps(10, 100, 36),
    ])
    const splits = calculateSplits(route)

    expect(splits).toHaveLength(3)
    expect(splits.map((s) => s.index)).toEqual([1, 2, 3])
    splits.forEach((s) => expect(Math.abs(s.distanceM - 1000)).toBeLessThan(1))
    expect(Math.abs(splits[0].paceSPerKm - 300)).toBeLessThan(2)
    expect(Math.abs(splits[1].paceSPerKm - 240)).toBeLessThan(2)
    expect(Math.abs(splits[2].paceSPerKm - 360)).toBeLessThan(2)
  })

  it('highlights both the fastest and the slowest full split', () => {
    const route = buildRoute([
      ...steps(10, 100, 30),
      ...steps(10, 100, 24),
      ...steps(10, 100, 36),
    ])
    const splits = calculateSplits(route)

    expect(splits.filter((s) => s.isFastest).map((s) => s.index)).toEqual([2])
    expect(splits.filter((s) => s.isSlowest).map((s) => s.index)).toEqual([3])
  })

  it('uses adaptive 200 m buckets for runs under 1 km', () => {
    // 600 m total → three 200 m buckets.
    const route = buildRoute(steps(6, 100, 30))
    const splits = calculateSplits(route)

    expect(splits).toHaveLength(3)
    splits.forEach((s) => expect(Math.abs(s.distanceM - 200)).toBeLessThan(1))
  })

  it('scales split distances so they sum to the stored total distance', () => {
    // Haversine total ~3000 m, but PostGIS stored 3300 m.
    const route = buildRoute(steps(30, 100, 30))
    const splits = calculateSplits(route, 3300)

    const sum = splits.reduce((acc, s) => acc + s.distanceM, 0)
    expect(Math.abs(sum - 3300)).toBeLessThan(2)
  })
})

describe('calculateElevation', () => {
  it('reports no data when altitude is absent', () => {
    const route = buildRoute(steps(5, 100, 30), null)
    expect(calculateElevation(route)).toEqual({
      hasData: false,
      gainM: 0,
      lossM: 0,
      highestM: null,
      lowestM: null,
    })
  })

  it('accumulates gain and loss from a real climb and descent', () => {
    const up: Step[] = [3, 3, 3, 3, 3].map((d, i) => ({ dm: 100, dt: 30, alt: 500 + (i + 1) * 3 }))
    const down: Step[] = [2, 2, 2, 2, 2].map((d, i) => ({ dm: 100, dt: 30, alt: 515 - (i + 1) * 2 }))
    const elev = calculateElevation(buildRoute([...up, ...down], 500))

    expect(elev.hasData).toBe(true)
    expect(elev.gainM).toBeGreaterThanOrEqual(10)
    expect(elev.gainM).toBeLessThanOrEqual(16)
    expect(elev.lossM).toBeGreaterThanOrEqual(6)
    expect(elev.lossM).toBeLessThanOrEqual(12)
    expect(elev.highestM).toBeGreaterThanOrEqual(510)
    expect(elev.lowestM).toBeLessThanOrEqual(502)
  })

  it('filters out GPS noise below the threshold', () => {
    const jitter: Step[] = Array.from({ length: 10 }, (_, i) => ({
      dm: 100,
      dt: 30,
      alt: i % 2 === 0 ? 500.4 : 499.6,
    }))
    const elev = calculateElevation(buildRoute(jitter, 500))
    expect(elev.gainM).toBe(0)
    expect(elev.lossM).toBe(0)
  })
})

describe('buildChartSeries', () => {
  it('returns [] for fewer than 2 points', () => {
    expect(buildChartSeries([])).toEqual([])
  })

  it('caps the series length and keeps distance monotonically increasing', () => {
    const route = buildRoute(steps(1000, 5, 2))
    const series = buildChartSeries(route, 300)

    expect(series.length).toBeLessThanOrEqual(300)
    expect(series.length).toBeGreaterThan(0)
    for (let i = 1; i < series.length; i++) {
      expect(series[i].distanceKm).toBeGreaterThanOrEqual(series[i - 1].distanceKm)
    }
    expect(series[0]).toHaveProperty('pace')
    expect(series[0]).toHaveProperty('speed')
    expect(series[0]).toHaveProperty('altitude')
  })
})

describe('downsamplePath', () => {
  it('caps the path and preserves the first and last points', () => {
    const route = buildRoute(steps(1000, 5, 2))
    const sampled = downsamplePath(route, 100)

    expect(sampled.length).toBeLessThanOrEqual(100)
    expect(sampled[0]).toEqual(route[0])
    expect(sampled[sampled.length - 1]).toEqual(route[route.length - 1])
  })

  it('returns the input unchanged when already under the cap', () => {
    const route = buildRoute(steps(10, 100, 30))
    expect(downsamplePath(route, 100)).toEqual(route)
  })
})

describe('mapCaptureDistances', () => {
  it('maps capture coordinates to cumulative distance at the spatially nearest point', () => {
    const route = buildRoute(steps(30, 100, 30)) // 3000 m, points every 100 m
    // Captures near point 10 (~1000 m) and point 20 (~2000 m).
    const c1 = { lat: route[10].lat, lng: route[10].lng }
    const c2 = { lat: route[20].lat, lng: route[20].lng }
    const dists = mapCaptureDistances(route, [c1, c2])

    expect(Math.abs(dists[0] - 1000)).toBeLessThan(1)
    expect(Math.abs(dists[1] - 2000)).toBeLessThan(1)
  })

  it('does not collapse captures that share a timestamp (spatial, not temporal)', () => {
    const route = buildRoute(steps(30, 100, 30))
    // Two captures at clearly different places along the route.
    const near500 = { lat: route[5].lat, lng: route[5].lng }
    const near2500 = { lat: route[25].lat, lng: route[25].lng }
    const dists = mapCaptureDistances(route, [near500, near2500])

    expect(Math.abs(dists[0] - 500)).toBeLessThan(1)
    expect(Math.abs(dists[1] - 2500)).toBeLessThan(1)
    expect(dists[1] - dists[0]).toBeGreaterThan(1500)
  })
})
