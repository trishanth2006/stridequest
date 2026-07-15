import { detectDrift } from '../../../src/features/running/engine/DriftDetector'
import type { GpsSample } from '@stridequest/shared/running'
import { DEFAULT_MOTION_CONFIG } from '../../../src/features/running/engine/MotionEngineConfig'

const cfg = DEFAULT_MOTION_CONFIG
const t0 = 1_700_000_000_000

function pt(lat: number, lng: number, offsetMs = 0): GpsSample {
  return { lat, lng, accuracy: 5, recordedAt: t0 + offsetMs }
}

describe('DriftDetector', () => {
  it('returns not-drifting for fewer than 2 samples', () => {
    expect(detectDrift([], cfg).isDrifting).toBe(false)
    expect(detectDrift([pt(12.97, 77.59)], cfg).isDrifting).toBe(false)
  })

  it('detects drift: GPS wanders in a square, net displacement < driftRadiusM', () => {
    // Square with ~22m sides: totalTraveled≈78m, netDisplacement≈0m
    const samples: GpsSample[] = [
      pt(12.971600, 77.594600), // origin
      pt(12.971800, 77.594600), // ~22m north
      pt(12.971800, 77.594800), // ~17m east
      pt(12.971600, 77.594800), // ~22m south
      pt(12.971600, 77.594600), // back to origin
    ]
    const result = detectDrift(samples, cfg)
    expect(result.isDrifting).toBe(true)
    expect(result.netDisplacementM).toBeLessThan(cfg.driftRadiusM)
    expect(result.totalTraveledM).toBeGreaterThan(cfg.driftRadiusM * 2)
  })

  it('does not flag as drift for linear movement', () => {
    // ~30m north — clear directional movement
    const samples: GpsSample[] = [
      pt(12.971600, 77.594600),
      pt(12.971700, 77.594600),
      pt(12.971800, 77.594600),
      pt(12.971900, 77.594600),
    ]
    const result = detectDrift(samples, cfg)
    expect(result.isDrifting).toBe(false)
    expect(result.totalTraveledM).toBeGreaterThan(cfg.driftRadiusM)
  })

  it('returns correct net displacement and total traveled', () => {
    const samples: GpsSample[] = [
      pt(12.971600, 77.594600),
      pt(12.971700, 77.594600), // ~11m north
    ]
    const result = detectDrift(samples, cfg)
    expect(result.netDisplacementM).toBeCloseTo(result.totalTraveledM, 1)
    expect(result.netDisplacementM).toBeGreaterThan(0)
  })
})
