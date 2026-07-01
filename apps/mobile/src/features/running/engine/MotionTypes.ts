import type { GpsSample } from '@stridequest/shared/running'

export type GPSQuality = 'GOOD' | 'FAIR' | 'POOR' | 'INVALID'
export type MovementState = 'Recording' | 'EvaluatingPause' | 'AutoPaused' | 'EvaluatingResume'
export type SensorTier = 1 | 2 | 3 | 4

export type SensorCapabilities = {
  hasAccelerometer: boolean
  hasGyroscope: boolean
  hasPedometer: boolean
  tier: SensorTier
}

export type AccelerometerReading = {
  x: number
  y: number
  z: number
  magnitude: number
  timestamp: number
}

export type GyroscopeReading = {
  x: number
  y: number
  z: number
  timestamp: number
}

export type SensorSnapshot = {
  accelerometer: AccelerometerReading | null
  gyroscope: GyroscopeReading | null
  stepCount: number | null
  stepFrequencyHz: number | null
  heartRateBpm?: number | null
  wearableStepCount?: number | null
}

export type MotionFeatures = {
  medianSpeedMps: number
  averageSpeedMps: number
  netDisplacementM: number
  totalTraveledM: number
  elapsedStationaryMs: number
  headingVarianceDeg: number
  accelerationVariance: number
  stepFrequencyHz: number
  gpsQuality: GPSQuality
  movingSampleCount: number
  stationarySampleCount: number
  sensorTier: SensorTier
}

export type SampleDecision = {
  readonly sample: GpsSample
  readonly quality: GPSQuality
  /** false during drift/poor GPS/auto-pause — no phantom distance */
  readonly shouldCountDistance: boolean
  /** true for FAIR/GOOD — dot keeps moving on map during auto-pause */
  readonly shouldRenderRoute: boolean
  readonly shouldPersist: boolean
  readonly confidence: number
  readonly state: MovementState
  readonly reason: string
}

export type MotionDiagnostics = {
  readonly confidence: number
  readonly gpsQuality: GPSQuality
  readonly medianSpeedMps: number
  readonly state: MovementState
  readonly driftRadiusM: number
  readonly movingSamples: number
  readonly stationarySamples: number
  readonly sensorTier: SensorTier
  readonly lastTransitionReason: string
  readonly isAutopaused: boolean
}

export type MotionConfig = {
  pauseSpeedThresholdMps: number
  resumeSpeedThresholdMps: number
  stationaryTimeMs: number
  resumeSamples: number
  cooldownAfterResumeMs: number
  gpsAccuracyThreshold: number
  maximumJumpDistanceM: number
  maximumSpeedMps: number
  minimumDisplacementM: number
  medianWindowSize: number
  driftRadiusM: number
  confidenceRiseRate: number
  confidenceDecayRate: number
  pauseConfidenceThreshold: number
  resumeConfidenceThreshold: number
  gpsWeight: number
  accelerometerWeight: number
  pedometerWeight: number
}
