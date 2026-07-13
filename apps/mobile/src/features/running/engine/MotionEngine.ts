import { haversineMeters } from '@stridequest/shared/running'
import type { GpsSample } from '@stridequest/shared/running'
import type {
  GPSQuality,
  MotionConfig,
  MotionDiagnostics,
  SampleDecision,
  SensorCapabilities,
} from './MotionTypes'
import { DEFAULT_MOTION_CONFIG } from './MotionEngineConfig'
import { MedianFilter } from './MedianFilter'
import { GPSFilter } from './GPSFilter'
import { validateGPSSample } from './GPSValidator'
import { detectDrift } from './DriftDetector'
import type { DriftResult } from './DriftDetector'
import { extractFeatures } from './FeatureExtractor'
import { computeConfidence } from './MovementConfidence'
import { StateMachine } from './StateMachine'
import { SensorManager } from './SensorManager'
import type { WorkoutTarget } from '../types/workout'

type Handler<T> = (data: T) => void
type EngineEvents = {
  validatedSample: SampleDecision
  autoPause: MotionDiagnostics
  autoResume: MotionDiagnostics
  diagnosticsUpdated: MotionDiagnostics
  phaseTransition: { previousBlockIndex: number, currentBlockIndex: number, completedDistance: number, completedDurationMs: number }
  paceDeviation: 'TOO_FAST' | 'TOO_SLOW' | 'ON_PACE'
}

class TypedEmitter<Events extends Record<string, unknown>> {
  private readonly handlers = {} as { [K in keyof Events]?: Set<Handler<Events[K]>> }

  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): void {
    if (!this.handlers[event]) this.handlers[event] = new Set()
    this.handlers[event]!.add(handler)
  }

  off<K extends keyof Events>(event: K, handler: Handler<Events[K]>): void {
    this.handlers[event]?.delete(handler)
  }

  protected emit<K extends keyof Events>(event: K, data: Events[K]): void {
    this.handlers[event]?.forEach((h) => h(data))
  }

  removeAllListeners(): void {
    for (const key in this.handlers) {
      delete this.handlers[key as keyof Events]
    }
  }
}

class CircularBuffer<T> {
  private readonly buf: T[]
  private head = 0
  private size = 0

  constructor(private readonly capacity: number) {
    this.buf = new Array(capacity)
  }

  push(value: T): void {
    this.buf[this.head] = value
    this.head = (this.head + 1) % this.capacity
    if (this.size < this.capacity) this.size++
  }

  toArray(): T[] {
    if (this.size === 0) return []
    if (this.size < this.capacity) {
      return this.buf.slice(0, this.size)
    }
    const result = new Array(this.capacity)
    for (let i = 0; i < this.capacity; i++) {
      result[i] = this.buf[(this.head + i) % this.capacity]
    }
    return result
  }
}

export type WorkoutPhase = {
  type: 'work' | 'rest' | 'warmup' | 'cooldown'
  targetDistance?: number // in meters
  targetDuration?: number // in seconds
  targetPace?: number // seconds per km
  paceTolerance?: number // seconds
}

export class MotionEngine extends TypedEmitter<EngineEvents> {
  private config: MotionConfig
  private prevSample: GpsSample | null = null
  private readonly sampleWindow: CircularBuffer<GpsSample>

  private readonly speedFilter: MedianFilter
  private readonly gpsFilter = new GPSFilter()
  private readonly stateMachine = new StateMachine()
  private readonly sensorManager = new SensorManager()

  private confidence = 0.5
  private isManuallyPaused = false
  private totalDistanceM = 0
  private runStartMs = 0
  private stationaryStartMs: number | null = null
  private readonly recentHeadings: CircularBuffer<number>

  private movingSamples = 0
  private stationarySamples = 0
  private lastQuality: GPSQuality = 'INVALID'
  private lastDrift: DriftResult = { isDrifting: false, netDisplacementM: 0, totalTraveledM: 0 }
  private lastTransitionReason = 'initializing'
  
  // Phase 4: Workout Tracking State
  private activeWorkout: WorkoutTarget | null = null
  private flattenedPhases: WorkoutPhase[] = []
  private currentBlockIndex = 0
  private blockAccumulatedDistance = 0
  private blockStartMs = 0
  
  // Pace Deviation State
  private consecutivePaceDeviations = 0
  private lastPaceDeviationEvent: 'TOO_FAST' | 'TOO_SLOW' | null = null

  constructor(config: MotionConfig = DEFAULT_MOTION_CONFIG) {
    super()
    this.config = config
    this.speedFilter = new MedianFilter(config.medianWindowSize)
    this.sampleWindow = new CircularBuffer(config.medianWindowSize)
    this.recentHeadings = new CircularBuffer(config.medianWindowSize)
  }

  setWorkoutTarget(config: WorkoutTarget): void {
    this.activeWorkout = config
    this.currentBlockIndex = 0
    this.blockAccumulatedDistance = 0
    this.blockStartMs = Date.now()
    this.flattenedPhases = []
    this.consecutivePaceDeviations = 0
    this.lastPaceDeviationEvent = null
    
    if (config.type === 'INTERVAL' && config.intervals) {
       for (const block of config.intervals) {
          for (let i = 0; i < block.repeatCount; i++) {
             this.flattenedPhases.push({
               type: 'work',
               targetDistance: block.workDistance,
               targetPace: block.workPace,
               paceTolerance: config.paceTolerance ?? 15
             })
             if (block.restDistance || block.restDuration) {
               this.flattenedPhases.push({
                 type: 'rest',
                 targetDistance: block.restDistance,
                 targetDuration: block.restDuration
               })
             }
          }
       }
    } else {
       this.flattenedPhases.push({
         type: 'work',
         targetDistance: config.distanceTarget,
         targetDuration: config.durationTarget,
         targetPace: config.targetPace,
         paceTolerance: config.paceTolerance ?? 15
       })
    }
  }

  getPhase(index: number): WorkoutPhase | null {
    if (index >= 0 && index < this.flattenedPhases.length) {
      return this.flattenedPhases[index]
    }
    return null
  }

  getCurrentPhase(): WorkoutPhase | null {
    return this.getPhase(this.currentBlockIndex)
  }

  getNextPhase(): WorkoutPhase | null {
    return this.getPhase(this.currentBlockIndex + 1)
  }

  async initialize(): Promise<SensorCapabilities> {
    return this.sensorManager.initialize()
  }

  start(): void {
    this.runStartMs = Date.now()
    if (this.blockStartMs === 0) this.blockStartMs = Date.now()
    this.sensorManager.start(() => {})
  }

  pause(): void {
    this.isManuallyPaused = true
    this.stateMachine.forcePause()
    this.sensorManager.stop()
  }

  resume(): void {
    this.isManuallyPaused = false
    this.prevSample = null
    this.stateMachine.forceResume()
    this.sensorManager.start(() => {})
  }

  setPowerMode(mode: 'HIGH' | 'LOW'): void {
    this.sensorManager.setPowerMode(mode)
  }

  injectWearableSnapshot(data: { heartRateBpm: number | null; stepCount: number | null }): void {
    this.sensorManager.mergeWearableData(data)
  }

  processSample(raw: GpsSample): void {
    if (this.isManuallyPaused) return

    const nowMs = raw.recordedAt
    if (this.runStartMs === 0) this.runStartMs = nowMs
    if (this.blockStartMs === 0) this.blockStartMs = nowMs

    // 1. Validate
    const quality = validateGPSSample(raw, this.prevSample, this.config)
    this.lastQuality = quality

    if (quality === 'INVALID') {
      this.stationarySamples++
      return
    }

    // 2. Smooth position for FAIR/POOR samples
    const filtered = this.gpsFilter.apply(raw, quality)

    // 3. Displacement-derived speed
    if (this.prevSample !== null) {
      const distM = haversineMeters(this.prevSample, filtered)
      const deltaMs = filtered.recordedAt - this.prevSample.recordedAt
      if (deltaMs > 0) {
        this.speedFilter.push(distM / (deltaMs / 1000))
      }
    }

    // 4. Sliding window for drift detection & rolling pace
    this.sampleWindow.push(filtered)

    // 5. Drift detection
    this.lastDrift = detectDrift(this.sampleWindow.toArray(), this.config)

    // 6. Stationary timer + sample counters
    const medianSpeed = this.speedFilter.value
    if (medianSpeed < this.config.pauseSpeedThresholdMps) {
      if (this.stationaryStartMs === null) this.stationaryStartMs = nowMs
      this.stationarySamples++
    } else {
      this.stationaryStartMs = null
      this.movingSamples++
    }

    // 7. Distance accumulation + Block Phase Logic
    const state = this.stateMachine.getState()
    const shouldCountDistance = quality !== 'POOR' && !this.lastDrift.isDrifting && state === 'Recording'

    if (shouldCountDistance && this.prevSample !== null) {
      const distM = haversineMeters(this.prevSample, filtered)
      this.totalDistanceM += distM
      if (this.activeWorkout) {
        this.blockAccumulatedDistance += distM
      }
    }

    // Phase 4: Interval State Machine & Block Phase Progress
    let smoothedPaceSecPerKm = 0
    if (this.activeWorkout && this.flattenedPhases.length > this.currentBlockIndex) {
      const currentPhase = this.flattenedPhases[this.currentBlockIndex]
      let phaseComplete = false
      
      // Check Distance target
      if (currentPhase.targetDistance && this.blockAccumulatedDistance >= currentPhase.targetDistance) {
        phaseComplete = true
      }
      // Check Duration target
      if (currentPhase.targetDuration && (nowMs - this.blockStartMs) / 1000 >= currentPhase.targetDuration) {
        phaseComplete = true
      }

      if (phaseComplete) {
        const completedDistance = this.blockAccumulatedDistance
        const completedDurationMs = nowMs - this.blockStartMs
        this.currentBlockIndex++
        this.blockAccumulatedDistance = 0
        this.blockStartMs = nowMs
        this.consecutivePaceDeviations = 0
        this.lastPaceDeviationEvent = null

        this.emit('phaseTransition', {
          previousBlockIndex: this.currentBlockIndex - 1,
          currentBlockIndex: this.currentBlockIndex,
          completedDistance,
          completedDurationMs
        })
      }

      // Phase 4: Rolling Pace & Deviation Alert
      const samples = this.sampleWindow.toArray()
      if (samples.length >= 2 && state === 'Recording') {
        const oldest = samples[0]
        const newest = samples[samples.length - 1]
        const windowDistM = haversineMeters(oldest, newest)
        const windowTimeMs = newest.recordedAt - oldest.recordedAt
        
        if (windowDistM > 0 && windowTimeMs > 0) {
          const speedMps = windowDistM / (windowTimeMs / 1000)
          smoothedPaceSecPerKm = 1000 / speedMps
          
          if (currentPhase.type === 'work' && currentPhase.targetPace) {
            const target = currentPhase.targetPace
            const tol = currentPhase.paceTolerance ?? 15
            let deviation: 'TOO_FAST' | 'TOO_SLOW' | 'ON_PACE' = 'ON_PACE'
            
            // Pace in sec/km: lower number means faster pace
            if (smoothedPaceSecPerKm < target - tol) {
               deviation = 'TOO_FAST'
            } else if (smoothedPaceSecPerKm > target + tol) {
               deviation = 'TOO_SLOW'
            }
            
            if (deviation !== 'ON_PACE') {
               this.consecutivePaceDeviations++
               if (this.consecutivePaceDeviations >= 5 && this.lastPaceDeviationEvent !== deviation) {
                  this.emit('paceDeviation', deviation)
                  this.lastPaceDeviationEvent = deviation
               }
            } else {
               this.consecutivePaceDeviations = 0
               if (this.lastPaceDeviationEvent !== null) {
                  this.emit('paceDeviation', 'ON_PACE')
                  this.lastPaceDeviationEvent = null
               }
            }
          }
        }
      }
    }

    // 8. Heading history
    if (filtered.heading !== undefined) {
      this.recentHeadings.push(filtered.heading)
    }

    // 9. Feature extraction
    const features = extractFeatures({
      medianSpeedMps: medianSpeed,
      totalElapsedMs: nowMs - this.runStartMs,
      totalDistanceM: this.totalDistanceM,
      elapsedStationaryMs:
        this.stationaryStartMs !== null ? nowMs - this.stationaryStartMs : 0,
      recentHeadings: this.recentHeadings.toArray(),
      sensorSnapshot: this.sensorManager.getSnapshot(),
      drift: this.lastDrift,
      gpsQuality: quality,
      movingSampleCount: this.movingSamples,
      stationarySampleCount: this.stationarySamples,
      sensorTier: this.sensorManager.getCapabilities().tier,
    })

    // 10. Confidence
    this.confidence = computeConfidence(
      features,
      this.confidence,
      this.config,
      this.lastDrift.isDrifting,
    )

    // 11. State machine (Movement state: AutoPause etc)
    const transition = this.stateMachine.process(this.confidence, this.config, nowMs)
    this.lastTransitionReason = transition.reason

    // 12. Build decision
    const decision: SampleDecision = {
      sample: filtered,
      quality,
      shouldCountDistance,
      shouldRenderRoute: quality !== 'POOR',
      shouldPersist: true,
      confidence: this.confidence,
      state: this.stateMachine.getState(),
      reason: transition.reason,
    }

    // 13. Emit
    this.emit('validatedSample', decision)
    const diag = this.getDiagnostics()
    if (transition.didPause) this.emit('autoPause', diag)
    else if (transition.didResume) this.emit('autoResume', diag)
    this.emit('diagnosticsUpdated', diag)

    this.prevSample = filtered
  }

  getDiagnostics(): MotionDiagnostics {
    return {
      confidence: this.confidence,
      gpsQuality: this.lastQuality,
      medianSpeedMps: this.speedFilter.value,
      state: this.stateMachine.getState(),
      driftRadiusM: this.lastDrift.netDisplacementM,
      movingSamples: this.movingSamples,
      stationarySamples: this.stationarySamples,
      sensorTier: this.sensorManager.getCapabilities().tier,
      lastTransitionReason: this.lastTransitionReason,
      isAutopaused: this.stateMachine.getState() === 'AutoPaused',
    }
  }

  updateConfig(partial: Partial<MotionConfig>): void {
    this.config = { ...this.config, ...partial }
  }

  destroy(): void {
    this.sensorManager.destroy()
    this.removeAllListeners()
    this.stateMachine.reset()
  }
}
