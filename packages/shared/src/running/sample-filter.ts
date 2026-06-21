import type { GpsSample } from './types'
import { haversineMeters } from './distance'

/** Tunable thresholds for the GPS sample filter. */
export type SampleFilterConfig = {
  /** Drop samples whose reported accuracy is worse than this many metres. */
  accuracyMaxM: number
  /** Drop samples closer than this many metres to the last accepted point. */
  minDistanceM: number
  /** Drop samples implying a speed faster than this (m/s) as teleport spikes. */
  maxSpeedMps: number
}

/**
 * Defaults: 30 m accuracy gate, 5 m jitter dedupe, 12.5 m/s (~45 km/h) speed
 * cap — comfortably above sustainable human running speed, so only GPS
 * teleport spikes are rejected. Tunable per call.
 */
export const DEFAULT_SAMPLE_FILTER_CONFIG: SampleFilterConfig = {
  accuracyMaxM: 30,
  minDistanceM: 5,
  maxSpeedMps: 12.5,
}

/**
 * Filters a raw GPS stream into a cleaned point list (architecture §2.3). Each
 * sample is tested, in order, against the last *accepted* sample (the anchor):
 *
 *   1. accuracy gate — drop `accuracy > accuracyMaxM`
 *   2. min-distance  — drop `distance(anchor, sample) < minDistanceM` (jitter)
 *   3. speed sanity  — drop non-monotonic time (`dt <= 0`) or implied speed
 *                      `distance / dt > maxSpeedMps` (teleport spike)
 *
 * Implied speed is derived from position and time; the device-reported `speed`
 * field is never trusted. Pure and deterministic: equal input yields equal
 * output, and the input array is never mutated.
 */
export function filterSamples(
  samples: readonly GpsSample[],
  config: SampleFilterConfig = DEFAULT_SAMPLE_FILTER_CONFIG,
): GpsSample[] {
  const accepted: GpsSample[] = []
  let anchor: GpsSample | null = null

  for (const sample of samples) {
    if (sample.accuracy > config.accuracyMaxM) continue

    if (anchor !== null) {
      const distance = haversineMeters(anchor, sample)
      if (distance < config.minDistanceM) continue

      const dtSeconds = (sample.recordedAt - anchor.recordedAt) / 1000
      if (dtSeconds <= 0) continue
      if (distance / dtSeconds > config.maxSpeedMps) continue
    }

    accepted.push(sample)
    anchor = sample
  }

  return accepted
}
