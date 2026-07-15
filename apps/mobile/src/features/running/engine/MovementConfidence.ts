import type { GPSQuality, MotionConfig, MotionFeatures } from './MotionTypes'

const GPS_QUALITY_SCORE: Record<GPSQuality, number> = {
  GOOD: 1.0,
  FAIR: 0.6,
  POOR: 0.2,
  INVALID: 0.0,
}

function sigmoid(value: number, steepness: number, threshold: number): number {
  return 1 / (1 + Math.exp(-steepness * (value - threshold)))
}

/**
 * Computes movement confidence in [0, 1] using tier-weighted sensor fusion
 * with hysteresis to prevent rapid oscillation.
 */
export function computeConfidence(
  features: MotionFeatures,
  currentConfidence: number,
  config: MotionConfig,
  isDrifting: boolean,
): number {
  const speedScore = sigmoid(features.medianSpeedMps, 5, 0.5)
  const qualityScore = GPS_QUALITY_SCORE[features.gpsQuality]
  const driftPenalty = isDrifting ? 0.3 : 0.0

  const gpsComposite = Math.max(
    0,
    speedScore * 0.6 + qualityScore * 0.4 - driftPenalty,
  )

  let rawConfidence: number

  if (features.sensorTier === 1) {
    const accelScore = sigmoid(features.accelerationVariance, 3, 0.5)
    const pedometerScore = Math.min(1.0, features.stepFrequencyHz / 3.0)
    rawConfidence =
      gpsComposite * config.gpsWeight +
      accelScore * config.accelerometerWeight +
      pedometerScore * config.pedometerWeight
  } else if (features.sensorTier === 2) {
    const accelScore = sigmoid(features.accelerationVariance, 3, 0.5)
    const totalWeight = config.gpsWeight + config.accelerometerWeight
    rawConfidence =
      (gpsComposite * config.gpsWeight + accelScore * config.accelerometerWeight) /
      totalWeight
  } else if (features.sensorTier === 3) {
    const accelScore = sigmoid(features.accelerationVariance, 3, 0.5)
    rawConfidence = gpsComposite * 0.65 + accelScore * 0.35
  } else {
    rawConfidence = gpsComposite
  }

  rawConfidence = Math.max(0, Math.min(1, rawConfidence))

  // Hysteresis: gradual rise/decay prevents instant confidence jumps
  if (rawConfidence > currentConfidence) {
    return Math.min(1, currentConfidence + config.confidenceRiseRate)
  }
  return Math.max(0, currentConfidence - config.confidenceDecayRate)
}
