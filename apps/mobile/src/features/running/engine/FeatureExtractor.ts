import type { GPSQuality, MotionFeatures, SensorSnapshot, SensorTier } from './MotionTypes'
import type { DriftResult } from './DriftDetector'

export type FeatureExtractorInput = {
  medianSpeedMps: number
  totalElapsedMs: number
  totalDistanceM: number
  elapsedStationaryMs: number
  recentHeadings: number[]
  sensorSnapshot: SensorSnapshot
  drift: DriftResult
  gpsQuality: GPSQuality
  movingSampleCount: number
  stationarySampleCount: number
  sensorTier: SensorTier
}

export function extractFeatures(input: FeatureExtractorInput): MotionFeatures {
  const averageSpeedMps =
    input.totalElapsedMs > 0
      ? input.totalDistanceM / (input.totalElapsedMs / 1000)
      : 0

  // Non-circular heading variance (acceptable for short windows)
  let headingVarianceDeg = 0
  if (input.recentHeadings.length > 1) {
    const mean =
      input.recentHeadings.reduce((a, b) => a + b, 0) / input.recentHeadings.length
    const variance =
      input.recentHeadings.reduce((s, h) => s + (h - mean) ** 2, 0) /
      input.recentHeadings.length
    headingVarianceDeg = Math.sqrt(variance)
  }

  // Dynamic acceleration = deviation from 1g gravity baseline
  let accelerationVariance = 0
  const accel = input.sensorSnapshot.accelerometer
  if (accel !== null) {
    accelerationVariance = Math.abs(accel.magnitude - 9.81)
  }

  return {
    medianSpeedMps: input.medianSpeedMps,
    averageSpeedMps,
    netDisplacementM: input.drift.netDisplacementM,
    totalTraveledM: input.drift.totalTraveledM,
    elapsedStationaryMs: input.elapsedStationaryMs,
    headingVarianceDeg,
    accelerationVariance,
    stepFrequencyHz: input.sensorSnapshot.stepFrequencyHz ?? 0,
    gpsQuality: input.gpsQuality,
    movingSampleCount: input.movingSampleCount,
    stationarySampleCount: input.stationarySampleCount,
    sensorTier: input.sensorTier,
  }
}
