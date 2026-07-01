import { Accelerometer, Gyroscope, Pedometer } from 'expo-sensors'
import type { SensorCapabilities, SensorSnapshot } from './MotionTypes'

type SensorUpdate = (snapshot: SensorSnapshot) => void

type Subscription = { remove(): void }

export class SensorManager {
  private capabilities: SensorCapabilities = {
    hasAccelerometer: false,
    hasGyroscope: false,
    hasPedometer: false,
    tier: 4,
  }

  private snapshot: SensorSnapshot = {
    accelerometer: null,
    gyroscope: null,
    stepCount: null,
    stepFrequencyHz: null,
  }

  private subscriptions: Subscription[] = []
  private stepWatchStartTs = 0
  private isStarted = false
  private powerMode: 'HIGH' | 'LOW' = 'HIGH'
  private wearableData = { heartRateBpm: null as number | null, stepCount: null as number | null }

  mergeWearableData(data: { heartRateBpm: number | null; stepCount: number | null }): void {
    this.wearableData = data
  }

  async initialize(): Promise<SensorCapabilities> {
    const [hasAccel, hasGyro, hasPedo] = await Promise.all([
      Accelerometer.isAvailableAsync(),
      Gyroscope.isAvailableAsync(),
      Pedometer.isAvailableAsync(),
    ])

    this.capabilities = {
      hasAccelerometer: hasAccel,
      hasGyroscope: hasGyro,
      hasPedometer: hasPedo,
      tier: this.deriveTier(hasAccel, hasGyro, hasPedo),
    }

    return this.capabilities
  }

  private deriveTier(
    hasAccel: boolean,
    hasGyro: boolean,
    hasPedo: boolean,
  ): SensorCapabilities['tier'] {
    if (hasAccel && hasGyro && hasPedo) return 1
    if (hasAccel && hasGyro) return 2
    if (hasAccel) return 3
    return 4
  }

  setPowerMode(mode: 'HIGH' | 'LOW'): void {
    if (this.powerMode === mode) return
    this.powerMode = mode
    
    if (this.isStarted) {
      const intervalMs = mode === 'HIGH' ? 200 : 1000
      if (this.capabilities.hasAccelerometer) {
        Accelerometer.setUpdateInterval(intervalMs)
      }
      if (this.capabilities.hasGyroscope) {
        Gyroscope.setUpdateInterval(intervalMs)
      }
    }
  }

  start(onUpdate: SensorUpdate): void {
    if (this.isStarted) return
    this.isStarted = true

    const intervalMs = this.powerMode === 'HIGH' ? 200 : 1000

    if (this.capabilities.hasAccelerometer) {
      Accelerometer.setUpdateInterval(intervalMs)
      const sub = Accelerometer.addListener((data) => {
        const magnitude = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2)
        this.snapshot = {
          ...this.snapshot,
          accelerometer: {
            x: data.x,
            y: data.y,
            z: data.z,
            magnitude,
            timestamp: Date.now(),
          },
        }
        onUpdate(this.snapshot)
      })
      this.subscriptions.push(sub)
    }

    if (this.capabilities.hasGyroscope) {
      Gyroscope.setUpdateInterval(intervalMs)
      const sub = Gyroscope.addListener((data) => {
        this.snapshot = {
          ...this.snapshot,
          gyroscope: { x: data.x, y: data.y, z: data.z, timestamp: Date.now() },
        }
        onUpdate(this.snapshot)
      })
      this.subscriptions.push(sub)
    }

    if (this.capabilities.hasPedometer) {
      this.stepWatchStartTs = Date.now()
      const sub = Pedometer.watchStepCount((result) => {
        const elapsedSecs = (Date.now() - this.stepWatchStartTs) / 1000
        const avgFreqHz = elapsedSecs > 0 ? result.steps / elapsedSecs : 0
        this.snapshot = {
          ...this.snapshot,
          stepCount: result.steps,
          stepFrequencyHz: avgFreqHz,
        }
        onUpdate(this.snapshot)
      })
      this.subscriptions.push(sub)
    }
  }

  getSnapshot(): SensorSnapshot {
    const current = { ...this.snapshot }
    
    // Fusion Rules: Prefer wearable step count over phone pedometer
    if (this.wearableData.stepCount !== null) {
      current.wearableStepCount = this.wearableData.stepCount
      current.stepCount = this.wearableData.stepCount 
    }
    
    // Pass through HR as inert telemetry
    current.heartRateBpm = this.wearableData.heartRateBpm
    
    return current
  }

  getCapabilities(): SensorCapabilities {
    return this.capabilities
  }

  stop(): void {
    this.subscriptions.forEach((s) => s.remove())
    this.subscriptions = []
    this.isStarted = false
  }

  destroy(): void {
    this.stop()
  }
}
