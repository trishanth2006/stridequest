/**
 * @jest-environment node
 *
 * Unit tests for the pure XP calculation functions (02E-01). These define the
 * authoritative XP rules; the finalize_workout RPC mirrors the same constants in
 * SQL and the integration test asserts they agree (parity guard).
 */
import {
  calculateWorkoutXP,
  calculateCaptureXP,
  calculateStealXP,
  calculateTotalXP,
} from '@/features/xp/services/xp'

describe('calculateWorkoutXP (02E-01)', () => {
  it('awards the +25 completion bonus even at zero distance', () => {
    expect(calculateWorkoutXP(0)).toBe(25)
  })

  it('adds +5 XP per whole km on top of completion', () => {
    expect(calculateWorkoutXP(1000)).toBe(30) // 25 + 5
    expect(calculateWorkoutXP(5000)).toBe(50) // 25 + 25
    expect(calculateWorkoutXP(10000)).toBe(75) // 25 + 50
  })

  it('floors partial kilometres', () => {
    expect(calculateWorkoutXP(1999)).toBe(30) // 1 km
    expect(calculateWorkoutXP(2000)).toBe(35) // 2 km
  })
})

describe('calculateCaptureXP (02E-01)', () => {
  it('awards +10 per claimed (neutral) cell', () => {
    expect(calculateCaptureXP(0)).toBe(0)
    expect(calculateCaptureXP(1)).toBe(10)
    expect(calculateCaptureXP(7)).toBe(70)
  })
})

describe('calculateStealXP (02E-01)', () => {
  it('awards +25 per stolen cell', () => {
    expect(calculateStealXP(0)).toBe(0)
    expect(calculateStealXP(1)).toBe(25)
    expect(calculateStealXP(4)).toBe(100)
  })
})

describe('calculateTotalXP (02E-01)', () => {
  it('sums workout + capture + steal (defend contributes 0)', () => {
    // 5 km, 3 claimed, 2 stolen: workout(50) + capture(30) + steal(50) = 130
    expect(calculateTotalXP({ distanceM: 5000, cellsClaimed: 3, cellsStolen: 2 })).toBe(130)
  })

  it('is just the completion bonus for an empty workout', () => {
    expect(calculateTotalXP({ distanceM: 0, cellsClaimed: 0, cellsStolen: 0 })).toBe(25)
  })

  it('ignores defends (they are never passed in — only claimed/stolen count)', () => {
    // A workout that only defended cells: distance 3 km, 0 claimed, 0 stolen.
    expect(calculateTotalXP({ distanceM: 3000, cellsClaimed: 0, cellsStolen: 0 })).toBe(40) // 25 + 15
  })
})
