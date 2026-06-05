import { getLevelUpResult } from '@/features/xp/services/xp'

describe('getLevelUpResult', () => {
  it('detects no level up when remaining in same tier', () => {
    // Level 1 is 0-99
    const result = getLevelUpResult(10, 50)
    expect(result).toEqual({
      leveledUp: false,
      previousLevel: 1,
      currentLevel: 1,
    })
  })

  it('detects single level up', () => {
    // Level 1 (0-99) to Level 2 (100-249)
    const result = getLevelUpResult(90, 110)
    expect(result).toEqual({
      leveledUp: true,
      previousLevel: 1,
      currentLevel: 2,
    })
  })

  it('detects multiple threshold crossing', () => {
    // Level 1 (0-99) to Level 4 (500-999)
    const result = getLevelUpResult(50, 600)
    expect(result).toEqual({
      leveledUp: true,
      previousLevel: 1,
      currentLevel: 4,
    })
  })

  it('handles exact threshold values', () => {
    // 99 is L1, 100 is L2
    const result = getLevelUpResult(99, 100)
    expect(result).toEqual({
      leveledUp: true,
      previousLevel: 1,
      currentLevel: 2,
    })
  })

  it('handles negative/edge values defensively', () => {
    const result = getLevelUpResult(-50, -10)
    expect(result).toEqual({
      leveledUp: false,
      previousLevel: 1,
      currentLevel: 1,
    })
  })

  it('handles starting at max level correctly', () => {
    // Level 5 is 1000+
    const result = getLevelUpResult(1000, 1500)
    expect(result).toEqual({
      leveledUp: false,
      previousLevel: 5,
      currentLevel: 5,
    })
  })
})
