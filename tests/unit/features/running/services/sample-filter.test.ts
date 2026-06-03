import {
  filterSamples,
  DEFAULT_SAMPLE_FILTER_CONFIG,
  type SampleFilterConfig,
} from '@/features/running/services/sample-filter'
import type { GpsSample } from '@/features/running/types'

// Metres per degree of longitude at the equator, using the same spherical
// constant as the distance module. At lat 0 the haversine round-trip is exact,
// so `lngFor(d)` produces a point ~d metres east of lng 0 — letting tests
// control inter-sample distance precisely.
const M_PER_DEG = (Math.PI / 180) * 6_371_000
const lngFor = (meters: number) => meters / M_PER_DEG

const sample = (overrides: Partial<GpsSample> = {}): GpsSample => ({
  lat: 0,
  lng: 0,
  accuracy: 5,
  recordedAt: 0,
  ...overrides,
})

describe('filterSamples — accuracy gate', () => {
  it('drops a sample whose accuracy exceeds the threshold', () => {
    expect(filterSamples([sample({ accuracy: 50 })])).toEqual([])
  })

  it('keeps a sample at the exact threshold (rule is strictly greater-than)', () => {
    const kept = filterSamples([sample({ accuracy: DEFAULT_SAMPLE_FILTER_CONFIG.accuracyMaxM })])
    expect(kept).toHaveLength(1)
  })

  it('keeps a sample just below the threshold', () => {
    const kept = filterSamples([sample({ accuracy: DEFAULT_SAMPLE_FILTER_CONFIG.accuracyMaxM - 0.1 })])
    expect(kept).toHaveLength(1)
  })

  it('respects a custom accuracy threshold from config', () => {
    const config: SampleFilterConfig = { ...DEFAULT_SAMPLE_FILTER_CONFIG, accuracyMaxM: 10 }
    expect(filterSamples([sample({ accuracy: 20 })], config)).toEqual([])
    expect(filterSamples([sample({ accuracy: 20 })])).toHaveLength(1) // default keeps it
  })
})

describe('filterSamples — min-distance dedupe', () => {
  it('drops a near-duplicate point closer than the minimum distance', () => {
    const s0 = sample({ recordedAt: 0 })
    const s1 = sample({ lng: lngFor(3), recordedAt: 60_000 }) // ~3 m, < 5 m min
    expect(filterSamples([s0, s1])).toEqual([s0])
  })

  it('keeps a point beyond the minimum distance', () => {
    const s0 = sample({ recordedAt: 0 })
    const s1 = sample({ lng: lngFor(6), recordedAt: 60_000 }) // ~6 m, >= 5 m min
    expect(filterSamples([s0, s1])).toEqual([s0, s1])
  })

  it('measures distance from the last accepted sample, not the last raw sample', () => {
    const s0 = sample({ recordedAt: 0 }) // anchor
    const s1 = sample({ lng: lngFor(3), recordedAt: 60_000 }) // ~3 m from s0 → dropped
    const s2 = sample({ lng: lngFor(6), recordedAt: 120_000 }) // ~6 m from s0 (anchor) → kept
    // If distance were measured from s1 (raw), s2 would be ~3 m away and dropped.
    expect(filterSamples([s0, s1, s2])).toEqual([s0, s2])
  })
})

describe('filterSamples — speed sanity', () => {
  it('drops a teleport spike implying impossible speed', () => {
    const s0 = sample({ recordedAt: 0 })
    const s1 = sample({ lng: lngFor(1000), recordedAt: 1_000 }) // 1000 m in 1 s → 1000 m/s
    expect(filterSamples([s0, s1])).toEqual([s0])
  })

  it('keeps a move within a plausible human speed', () => {
    const s0 = sample({ recordedAt: 0 })
    const s1 = sample({ lng: lngFor(100), recordedAt: 20_000 }) // 100 m in 20 s → 5 m/s
    expect(filterSamples([s0, s1])).toEqual([s0, s1])
  })

  it('drops a sample with a non-increasing timestamp (dt <= 0)', () => {
    const s0 = sample({ recordedAt: 1_000 })
    const s1 = sample({ lng: lngFor(100), recordedAt: 1_000 }) // same instant → dt 0
    expect(filterSamples([s0, s1])).toEqual([s0])
  })
})

describe('filterSamples — purity and ordering', () => {
  it('returns an empty array for empty input', () => {
    expect(filterSamples([])).toEqual([])
  })

  it('preserves input order among accepted samples', () => {
    const samples = [
      sample({ lng: lngFor(0), recordedAt: 0 }),
      sample({ lng: lngFor(20), recordedAt: 30_000 }),
      sample({ lng: lngFor(40), recordedAt: 60_000 }),
      sample({ lng: lngFor(60), recordedAt: 90_000 }),
    ]
    const result = filterSamples(samples)
    expect(result.map((s) => s.recordedAt)).toEqual([0, 30_000, 60_000, 90_000])
  })

  it('is pure: same input yields an equal result and does not mutate input', () => {
    const samples = [
      sample({ accuracy: 50, recordedAt: 0 }), // dropped (bad accuracy)
      sample({ lng: lngFor(10), recordedAt: 30_000 }),
      sample({ lng: lngFor(13), recordedAt: 60_000 }), // ~3 m from prior anchor → dropped
      sample({ lng: lngFor(40), recordedAt: 90_000 }),
    ]
    const snapshot = JSON.parse(JSON.stringify(samples))
    const first = filterSamples(samples)
    const second = filterSamples(samples)
    expect(first).toEqual(second)
    expect(samples).toEqual(snapshot) // input untouched
  })

  it('treats a leading bad-accuracy sample as no anchor; the next good sample anchors', () => {
    const bad = sample({ accuracy: 100, recordedAt: 0 }) // dropped
    const first = sample({ lng: lngFor(2), recordedAt: 60_000 }) // first accepted → anchor
    const next = sample({ lng: lngFor(8), recordedAt: 120_000 }) // ~6 m from `first` → kept
    expect(filterSamples([bad, first, next])).toEqual([first, next])
  })
})
