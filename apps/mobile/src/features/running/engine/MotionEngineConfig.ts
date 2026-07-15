import type { MotionConfig } from './MotionTypes'

export const DEFAULT_MOTION_CONFIG: MotionConfig = {
  pauseSpeedThresholdMps: 0.5,      // ~1.8 km/h
  resumeSpeedThresholdMps: 1.0,     // ~3.6 km/h
  stationaryTimeMs: 8000,           // 8s of low confidence → auto-pause
  resumeSamples: 3,                 // 3 consecutive moving samples to auto-resume
  cooldownAfterResumeMs: 5000,      // 5s cooldown prevents immediate re-pause
  gpsAccuracyThreshold: 25,         // 25m — industry standard
  maximumJumpDistanceM: 150,        // teleport guard
  maximumSpeedMps: 15.0,            // ~54 km/h sprint ceiling
  minimumDisplacementM: 3,
  medianWindowSize: 7,
  driftRadiusM: 8,                  // net displacement < 8m = potential drift
  confidenceRiseRate: 0.15,
  confidenceDecayRate: 0.10,
  pauseConfidenceThreshold: 0.25,
  resumeConfidenceThreshold: 0.60,
  gpsWeight: 0.5,
  accelerometerWeight: 0.3,
  pedometerWeight: 0.2,
}
