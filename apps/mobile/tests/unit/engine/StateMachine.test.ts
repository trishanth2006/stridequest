import { StateMachine } from '../../../src/features/running/engine/StateMachine'
import { DEFAULT_MOTION_CONFIG } from '../../../src/features/running/engine/MotionEngineConfig'

const cfg = DEFAULT_MOTION_CONFIG
const t0 = 1_700_000_000_000

describe('StateMachine — warm-start protection', () => {
  it('stays Recording when confidence is low but movement not yet established', () => {
    const sm = new StateMachine()
    // Low confidence but hasn't established movement yet
    const result = sm.process(0.1, cfg, t0)
    expect(result.state).toBe('Recording')
    expect(result.didPause).toBe(false)
    expect(result.reason).toBe('warming up')
  })

  it('establishes movement after 5 consecutive high-confidence samples', () => {
    const sm = new StateMachine()
    for (let i = 0; i < 5; i++) {
      sm.process(0.8, cfg, t0 + i * 2000)
    }
    // Now drop confidence — should enter EvaluatingPause (movement established)
    const result = sm.process(0.1, cfg, t0 + 10000)
    expect(result.state).toBe('EvaluatingPause')
  })
})

describe('StateMachine — auto-pause flow', () => {
  function establishMovement(sm: StateMachine, startTs: number): void {
    for (let i = 0; i < 5; i++) {
      sm.process(0.8, cfg, startTs + i * 2000)
    }
  }

  it('enters EvaluatingPause when confidence drops below threshold', () => {
    const sm = new StateMachine()
    establishMovement(sm, t0)
    const result = sm.process(0.1, cfg, t0 + 15000)
    expect(result.state).toBe('EvaluatingPause')
    expect(result.didPause).toBe(false)
  })

  it('recovers to Recording when confidence rises above threshold in EvaluatingPause', () => {
    const sm = new StateMachine()
    establishMovement(sm, t0)
    sm.process(0.1, cfg, t0 + 15000) // → EvaluatingPause
    const result = sm.process(0.8, cfg, t0 + 17000)
    expect(result.state).toBe('Recording')
    expect(result.reason).toBe('confidence recovered')
  })

  it('transitions to AutoPaused after stationaryTimeMs with low confidence', () => {
    const sm = new StateMachine()
    establishMovement(sm, t0)
    sm.process(0.1, cfg, t0 + 15000) // → EvaluatingPause at t0+15s

    // Advance time past stationaryTimeMs (8000ms)
    const result = sm.process(0.1, cfg, t0 + 24000)
    expect(result.state).toBe('AutoPaused')
    expect(result.didPause).toBe(true)
  })
})

describe('StateMachine — auto-resume flow', () => {
  function driveToAutoPaused(sm: StateMachine): void {
    for (let i = 0; i < 5; i++) sm.process(0.8, cfg, t0 + i * 2000)
    sm.process(0.1, cfg, t0 + 15000) // EvaluatingPause
    sm.process(0.1, cfg, t0 + 24000) // AutoPaused
  }

  it('enters EvaluatingResume when confidence exceeds resumeThreshold in AutoPaused', () => {
    const sm = new StateMachine()
    driveToAutoPaused(sm)
    const result = sm.process(0.8, cfg, t0 + 26000)
    expect(result.state).toBe('EvaluatingResume')
  })

  it('transitions to Recording after resumeSamples consecutive confirmations', () => {
    const sm = new StateMachine()
    driveToAutoPaused(sm)
    sm.process(0.8, cfg, t0 + 26000) // → EvaluatingResume (count=1)
    sm.process(0.8, cfg, t0 + 28000) // count=2
    const result = sm.process(0.8, cfg, t0 + 30000) // count=3 → Recording
    expect(result.state).toBe('Recording')
    expect(result.didResume).toBe(true)
  })

  it('falls back to AutoPaused when confidence drops during EvaluatingResume', () => {
    const sm = new StateMachine()
    driveToAutoPaused(sm)
    sm.process(0.8, cfg, t0 + 26000) // → EvaluatingResume
    const result = sm.process(0.1, cfg, t0 + 28000) // confidence lost
    expect(result.state).toBe('AutoPaused')
  })
})

describe('StateMachine — cooldown after resume', () => {
  it('stays in Recording during cooldown even with low confidence', () => {
    const sm = new StateMachine()
    sm.forceResume()
    // Immediately after resume, confidence drops
    const result = sm.process(0.1, cfg, t0 + 100)
    expect(result.state).toBe('Recording')
    expect(result.reason).toBe('cooldown')
  })
})

describe('StateMachine — force methods', () => {
  it('forcePause sets state to AutoPaused', () => {
    const sm = new StateMachine()
    sm.forcePause()
    expect(sm.getState()).toBe('AutoPaused')
  })

  it('forceResume sets state to Recording and establishes movement', () => {
    const sm = new StateMachine()
    sm.forcePause()
    sm.forceResume()
    expect(sm.getState()).toBe('Recording')
  })

  it('reset restores initial state', () => {
    const sm = new StateMachine()
    for (let i = 0; i < 5; i++) sm.process(0.8, cfg, t0 + i * 2000)
    sm.reset()
    // After reset, should be back to warming up
    const result = sm.process(0.1, cfg, t0 + 20000)
    expect(result.reason).toBe('warming up')
  })
})
