import { haversineMeters } from '@stridequest/shared/running'
import type { GpsSample } from '@stridequest/shared/running'
import type { MotionConfig } from './MotionTypes'

export type DriftResult = {
  isDrifting: boolean
  netDisplacementM: number
  totalTraveledM: number
}

/**
 * Detects GPS drift: runner appears stationary but GPS wanders.
 * Drift = net displacement small relative to total path length.
 */
export function detectDrift(samples: GpsSample[], config: MotionConfig): DriftResult {
  if (samples.length < 2) {
    return { isDrifting: false, netDisplacementM: 0, totalTraveledM: 0 }
  }

  const first = samples[0]!
  const last = samples[samples.length - 1]!
  const netDisplacementM = haversineMeters(first, last)

  let totalTraveledM = 0
  for (let i = 1; i < samples.length; i++) {
    totalTraveledM += haversineMeters(samples[i - 1]!, samples[i]!)
  }

  const isDrifting =
    netDisplacementM < config.driftRadiusM &&
    totalTraveledM > config.driftRadiusM * 2

  return { isDrifting, netDisplacementM, totalTraveledM }
}
