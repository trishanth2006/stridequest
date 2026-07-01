import type { GpsSample } from '@stridequest/shared/running'
import type { GPSQuality } from './MotionTypes'

const EMA_ALPHA = 0.7

/**
 * Exponential moving average smoother for GPS positions.
 * GOOD quality passes through unchanged; FAIR/POOR are blended
 * toward the running EMA anchor to dampen noise.
 */
export class GPSFilter {
  private anchor: GpsSample | null = null

  apply(sample: GpsSample, quality: GPSQuality): GpsSample {
    if (quality === 'GOOD' || this.anchor === null) {
      this.anchor = sample
      return sample
    }

    const smoothed: GpsSample = {
      ...sample,
      lat: EMA_ALPHA * sample.lat + (1 - EMA_ALPHA) * this.anchor.lat,
      lng: EMA_ALPHA * sample.lng + (1 - EMA_ALPHA) * this.anchor.lng,
    }
    this.anchor = smoothed
    return smoothed
  }

  reset(): void {
    this.anchor = null
  }
}
