import { validateGPSSample } from '../../../src/features/running/engine/GPSValidator'
import type { GpsSample } from '@stridequest/shared/running'
import type { MotionConfig } from '../../../src/features/running/engine/MotionTypes'
import { DEFAULT_MOTION_CONFIG } from '../../../src/features/running/engine/MotionEngineConfig'

const cfg: MotionConfig = DEFAULT_MOTION_CONFIG

function makeSample(overrides: Partial<GpsSample> & { accuracy: number }): GpsSample {
  return {
    lat: 12.9716,
    lng: 77.5946,
    recordedAt: Date.now(),
    ...overrides,
  }
}

const t0 = 1_700_000_000_000

describe('validateGPSSample — accuracy bands', () => {
  it('GOOD when accuracy <= threshold/2 (12.5m)', () => {
    const s = makeSample({ accuracy: 5, recordedAt: t0 })
    expect(validateGPSSample(s, null, cfg)).toBe('GOOD')
  })

  it('FAIR when accuracy in (12.5, 25]', () => {
    const s = makeSample({ accuracy: 20, recordedAt: t0 })
    expect(validateGPSSample(s, null, cfg)).toBe('FAIR')
  })

  it('POOR when accuracy in (25, 75)', () => {
    const s = makeSample({ accuracy: 50, recordedAt: t0 })
    expect(validateGPSSample(s, null, cfg)).toBe('POOR')
  })

  it('INVALID when accuracy >= threshold*3 (75m)', () => {
    const s = makeSample({ accuracy: 80, recordedAt: t0 })
    expect(validateGPSSample(s, null, cfg)).toBe('INVALID')
  })
})

describe('validateGPSSample — temporal guards', () => {
  const prev = makeSample({ accuracy: 5, recordedAt: t0 })

  it('INVALID when timestamp is not later than previous', () => {
    const same = makeSample({ accuracy: 5, recordedAt: t0 })
    expect(validateGPSSample(same, prev, cfg)).toBe('INVALID')
  })

  it('INVALID when timestamp is before previous', () => {
    const older = makeSample({ accuracy: 5, recordedAt: t0 - 1000 })
    expect(validateGPSSample(older, prev, cfg)).toBe('INVALID')
  })
})

describe('validateGPSSample — jump/speed guards', () => {
  it('INVALID when displacement exceeds maximumJumpDistanceM (150m)', () => {
    // Roughly 200m north of prev — ~0.0018 degrees latitude
    const prev = makeSample({ accuracy: 5, recordedAt: t0 })
    const far = makeSample({ accuracy: 5, lat: 12.9716 + 0.002, recordedAt: t0 + 2000 })
    expect(validateGPSSample(far, prev, cfg)).toBe('INVALID')
  })

  it('INVALID when implied speed exceeds maximumSpeedMps (15 m/s)', () => {
    // 100m in 1 second = 100 m/s — physically impossible
    const prev = makeSample({ accuracy: 5, recordedAt: t0 })
    const fast = makeSample({ accuracy: 5, lat: 12.9716 + 0.0009, recordedAt: t0 + 1000 })
    // ~100m in 1s = 100 m/s > 15 m/s threshold
    expect(validateGPSSample(fast, prev, cfg)).toBe('INVALID')
  })

  it('GOOD for normal running pace (~4 m/s, good accuracy)', () => {
    const prev = makeSample({ accuracy: 5, lat: 12.9716, lng: 77.5946, recordedAt: t0 })
    // ~16m north in 4 seconds = 4 m/s
    const next = makeSample({ accuracy: 5, lat: 12.97174, lng: 77.5946, recordedAt: t0 + 4000 })
    expect(validateGPSSample(next, prev, cfg)).toBe('GOOD')
  })
})
