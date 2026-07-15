import type { MotionConfig, MovementState } from './MotionTypes'

export type TransitionResult = {
  state: MovementState
  didPause: boolean
  didResume: boolean
  reason: string
}

type SMContext = {
  state: MovementState
  pauseEvalStartMs: number | null
  resumeSampleCount: number
  lastResumeMs: number
  hasEstablishedMovement: boolean
  movingStreak: number
  resumeWindow: boolean[]
}

// Warm-start: require this many consecutive high-confidence samples before
// auto-pause evaluation activates (prevents false pause at the start line).
const MOVEMENT_ESTABLISHMENT_SAMPLES = 5

export class StateMachine {
  private ctx: SMContext = {
    state: 'Recording',
    pauseEvalStartMs: null,
    resumeSampleCount: 0,
    lastResumeMs: 0,
    hasEstablishedMovement: false,
    movingStreak: 0,
    resumeWindow: [],
  }

  process(confidence: number, config: MotionConfig, nowMs: number): TransitionResult {
    // Track movement streak to establish warm-start gate
    if (confidence >= config.resumeConfidenceThreshold) {
      this.ctx.movingStreak++
      if (this.ctx.movingStreak >= MOVEMENT_ESTABLISHMENT_SAMPLES) {
        this.ctx.hasEstablishedMovement = true
      }
    } else {
      this.ctx.movingStreak = 0
    }

    switch (this.ctx.state) {
      case 'Recording': {
        const inCooldown =
          this.ctx.lastResumeMs > 0 &&
          nowMs - this.ctx.lastResumeMs < config.cooldownAfterResumeMs

        if (inCooldown) {
          return { state: 'Recording', didPause: false, didResume: false, reason: 'cooldown' }
        }

        if (!this.ctx.hasEstablishedMovement) {
          return { state: 'Recording', didPause: false, didResume: false, reason: 'warming up' }
        }

        if (confidence < config.pauseConfidenceThreshold) {
          this.ctx.state = 'EvaluatingPause'
          this.ctx.pauseEvalStartMs = nowMs
          return { state: 'EvaluatingPause', didPause: false, didResume: false, reason: 'low confidence' }
        }
        return { state: 'Recording', didPause: false, didResume: false, reason: 'moving' }
      }

      case 'EvaluatingPause': {
        if (confidence >= config.pauseConfidenceThreshold) {
          this.ctx.state = 'Recording'
          this.ctx.pauseEvalStartMs = null
          return { state: 'Recording', didPause: false, didResume: false, reason: 'confidence recovered' }
        }

        const stationaryMs = nowMs - (this.ctx.pauseEvalStartMs ?? nowMs)
        if (stationaryMs >= config.stationaryTimeMs) {
          this.ctx.state = 'AutoPaused'
          this.ctx.pauseEvalStartMs = null
          return {
            state: 'AutoPaused',
            didPause: true,
            didResume: false,
            reason: `stationary ${Math.round(stationaryMs / 1000)}s`,
          }
        }
        return { state: 'EvaluatingPause', didPause: false, didResume: false, reason: 'evaluating' }
      }

      case 'AutoPaused': {
        if (confidence >= config.resumeConfidenceThreshold) {
          this.ctx.state = 'EvaluatingResume'
          this.ctx.resumeWindow = [true]
          return { state: 'EvaluatingResume', didPause: false, didResume: false, reason: 'movement detected' }
        }
        return { state: 'AutoPaused', didPause: false, didResume: false, reason: 'stationary' }
      }

      case 'EvaluatingResume': {
        const isHigh = confidence >= config.resumeConfidenceThreshold
        this.ctx.resumeWindow.push(isHigh)
        if (this.ctx.resumeWindow.length > 5) {
          this.ctx.resumeWindow.shift()
        }

        const highCount = this.ctx.resumeWindow.filter(Boolean).length
        const lowCount = this.ctx.resumeWindow.length - highCount

        if (highCount >= config.resumeSamples) {
          this.ctx.state = 'Recording'
          this.ctx.lastResumeMs = nowMs
          this.ctx.resumeWindow = []
          return {
            state: 'Recording',
            didPause: false,
            didResume: true,
            reason: `${config.resumeSamples} moving samples in window`,
          }
        }

        if (lowCount > 2) {
          this.ctx.state = 'AutoPaused'
          this.ctx.resumeWindow = []
          return { state: 'AutoPaused', didPause: false, didResume: false, reason: 'confidence lost' }
        }

        return { state: 'EvaluatingResume', didPause: false, didResume: false, reason: 'confirming resume' }
      }
    }
  }

  getState(): MovementState {
    return this.ctx.state
  }

  forcePause(): void {
    this.ctx.state = 'AutoPaused'
  }

  forceResume(): void {
    this.ctx.state = 'Recording'
    this.ctx.lastResumeMs = Date.now()
    this.ctx.hasEstablishedMovement = true
  }

  reset(): void {
    this.ctx = {
      state: 'Recording',
      pauseEvalStartMs: null,
      resumeSampleCount: 0,
      lastResumeMs: 0,
      hasEstablishedMovement: false,
      movingStreak: 0,
      resumeWindow: [],
    }
  }
}
