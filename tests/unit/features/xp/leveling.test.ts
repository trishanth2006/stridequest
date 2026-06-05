/**
 * @jest-environment node
 *
 * Unit tests for the MVP level formula (02E-01). Thresholds:
 * L1=0, L2=100, L3=250, L4=500, L5=1000 (capped at 5 for the MVP).
 */
import { getLevelFromXP } from '@/features/xp/services/xp'

describe('getLevelFromXP (02E-01)', () => {
  it('is level 1 below 100 XP', () => {
    expect(getLevelFromXP(0)).toBe(1)
    expect(getLevelFromXP(99)).toBe(1)
  })

  it('is level 2 from 100 to 249 XP', () => {
    expect(getLevelFromXP(100)).toBe(2)
    expect(getLevelFromXP(249)).toBe(2)
  })

  it('is level 3 from 250 to 499 XP', () => {
    expect(getLevelFromXP(250)).toBe(3)
    expect(getLevelFromXP(499)).toBe(3)
  })

  it('is level 4 from 500 to 999 XP', () => {
    expect(getLevelFromXP(500)).toBe(4)
    expect(getLevelFromXP(999)).toBe(4)
  })

  it('is level 5 at 1000 XP and above (MVP cap)', () => {
    expect(getLevelFromXP(1000)).toBe(5)
    expect(getLevelFromXP(999999)).toBe(5)
  })

  it('treats negative/zero defensively as level 1', () => {
    expect(getLevelFromXP(-10)).toBe(1)
  })
})
