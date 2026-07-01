import { haversineMeters } from '@stridequest/shared/running'
import type { GpsSample } from '@stridequest/shared/running'
import type { GPSQuality, MotionConfig } from './MotionTypes'

/**
 * Pure GPS quality classifier. Never trusts sample.speed — derives
 * implied speed from displacement and elapsed time.
 */
export function validateGPSSample(
  sample: GpsSample,
  prev: GpsSample | null,
  config: MotionConfig,
): GPSQuality {
  // Hard invalid: terrible accuracy
  if (sample.accuracy > config.gpsAccuracyThreshold * 3) return 'INVALID'

  if (prev !== null) {
    // Out-of-order or duplicate timestamp
    if (sample.recordedAt <= prev.recordedAt) return 'INVALID'

    const distM = haversineMeters(prev, sample)
    const deltaS = (sample.recordedAt - prev.recordedAt) / 1000

    // Teleport guard
    if (distM > config.maximumJumpDistanceM) return 'INVALID'

    // Physically impossible speed
    const impliedSpeedMps = distM / deltaS
    if (impliedSpeedMps > config.maximumSpeedMps) return 'INVALID'
  }

  // Quality band by horizontal accuracy
  if (sample.accuracy <= config.gpsAccuracyThreshold / 2) return 'GOOD'
  if (sample.accuracy <= config.gpsAccuracyThreshold) return 'FAIR'
  return 'POOR'
}
