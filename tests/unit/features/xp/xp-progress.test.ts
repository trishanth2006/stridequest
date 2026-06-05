/**
 * @jest-environment node
 */
import { getXpProgress } from '@/features/xp/services/xp'

describe('getXpProgress (02E-02)', () => {
  it('calculates progress within level 1 toward level 2', () => {
    expect(getXpProgress(45)).toEqual({
      currentXp: 45,
      currentLevel: 1,
      currentLevelXp: 0,
      nextLevel: 2,
      nextLevelXp: 100,
      xpNeededToNextLevel: 55,
      progressPercent: 45,
    })
  })

  it('calculates progress inside a higher tier', () => {
    expect(getXpProgress(300)).toEqual({
      currentXp: 300,
      currentLevel: 3,
      currentLevelXp: 250,
      nextLevel: 4,
      nextLevelXp: 500,
      xpNeededToNextLevel: 200,
      progressPercent: 20,
    })
  })

  it('treats the top MVP tier as complete', () => {
    expect(getXpProgress(1200)).toEqual({
      currentXp: 1200,
      currentLevel: 5,
      currentLevelXp: 1000,
      nextLevel: null,
      nextLevelXp: null,
      xpNeededToNextLevel: 0,
      progressPercent: 100,
    })
  })
})
