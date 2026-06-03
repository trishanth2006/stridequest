import {
  haversineMeters,
  cumulativeDistanceMeters,
} from '@/features/running/services/distance'
import type { LatLng } from '@/features/running/types'

// Mean Earth radius used by the implementation (documented constant).
const R = 6_371_000
// At the equator, one degree of longitude ≈ π/180 * R metres.
const ONE_DEGREE_M = (Math.PI / 180) * R // ≈ 111_195 m
const HALF_CIRCUMFERENCE_M = Math.PI * R // ≈ 20_015_087 m

// Tolerance for great-circle assertions (spherical model vs. exact value).
const within = (actual: number, expected: number, fraction: number) =>
  Math.abs(actual - expected) / expected < fraction

// A tiny deterministic, seeded PRNG (mulberry32). No external dependency; the
// same seed yields the same sequence on every run, so "random" inputs are
// reproducible. Used only to exercise the never-negative invariant broadly.
const seededRandom = (seed: number): (() => number) => {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('haversineMeters', () => {
  it('returns the documented great-circle distance for two known points', () => {
    // (0,0) → (0,1): one degree of longitude at the equator.
    const d = haversineMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })
    expect(within(d, ONE_DEGREE_M, 0.005)).toBe(true)
  })

  it('returns 0 for identical points', () => {
    const p: LatLng = { lat: 51.5074, lng: -0.1278 }
    expect(haversineMeters(p, p)).toBe(0)
  })

  it('returns ~half the circumference for antipodal points', () => {
    const d = haversineMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 180 })
    expect(within(d, HALF_CIRCUMFERENCE_M, 0.005)).toBe(true)
  })
})

describe('cumulativeDistanceMeters', () => {
  it('returns 0 for an empty list', () => {
    expect(cumulativeDistanceMeters([])).toBe(0)
  })

  it('returns 0 for a single-point list', () => {
    expect(cumulativeDistanceMeters([{ lat: 12, lng: 34 }])).toBe(0)
  })

  it('is order-dependent across three non-collinear points', () => {
    // Asymmetric points so that reordering changes the total. A→B is ~2°,
    // A→C is ~1°, so the two orderings produce different sums.
    const a: LatLng = { lat: 0, lng: 0 }
    const b: LatLng = { lat: 0, lng: 2 }
    const c: LatLng = { lat: 1, lng: 0 }
    const abc = cumulativeDistanceMeters([a, b, c])
    const acb = cumulativeDistanceMeters([a, c, b])
    expect(abc).toBeGreaterThan(0)
    expect(acb).toBeGreaterThan(0)
    expect(abc).toBeGreaterThan(acb)
  })

  it('equals the single segment distance for a two-point list', () => {
    const a: LatLng = { lat: 0, lng: 0 }
    const b: LatLng = { lat: 0, lng: 1 }
    expect(cumulativeDistanceMeters([a, b])).toBeCloseTo(haversineMeters(a, b), 6)
  })
})

describe('distance is never negative (deterministic seeded inputs)', () => {
  it('haversineMeters >= 0 across 200 seeded coordinate pairs', () => {
    const rng = seededRandom(1337)
    const coord = (): LatLng => ({
      lat: rng() * 180 - 90,
      lng: rng() * 360 - 180,
    })
    for (let i = 0; i < 200; i++) {
      expect(haversineMeters(coord(), coord())).toBeGreaterThanOrEqual(0)
    }
  })

  it('cumulativeDistanceMeters >= 0 across seeded paths', () => {
    const rng = seededRandom(2024)
    const coord = (): LatLng => ({
      lat: rng() * 180 - 90,
      lng: rng() * 360 - 180,
    })
    for (let i = 0; i < 50; i++) {
      const path = Array.from({ length: 10 }, coord)
      expect(cumulativeDistanceMeters(path)).toBeGreaterThanOrEqual(0)
    }
  })
})
