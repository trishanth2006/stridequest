import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import {
  generateShareHeadline,
  buildWorkoutShareCard,
  buildLevelUpCard,
  buildAchievementCard,
  buildPersonalRecordCard
} from '@/features/share/services/share-card'

describe('Share Card Services', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-06-05T12:00:00.000Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('generateShareHeadline', () => {
    it('generates PR headline for workout with PR', () => {
      expect(generateShareHeadline('workout', { hasPr: true })).toBe('Set a new Personal Record!')
    })

    it('generates territory headline for workout with captures', () => {
      expect(generateShareHeadline('workout', { territoriesCaptured: 3 })).toBe('Captured 3 new territories!')
    })

    it('generates default workout headline', () => {
      expect(generateShareHeadline('workout')).toBe('Crushed another run!')
    })

    it('generates level up headline', () => {
      expect(generateShareHeadline('level-up', { currentLevel: 5 })).toBe('Reached Level 5!')
    })

    it('generates achievement headline', () => {
      expect(generateShareHeadline('achievement')).toBe('Unlocked a new achievement!')
    })

    it('generates PR headline', () => {
      expect(generateShareHeadline('personal-record')).toBe('Set a new Personal Record!')
    })
  })

  describe('Card Builders', () => {
    it('buildWorkoutShareCard adds metadata and headline', () => {
      const card = buildWorkoutShareCard({
        distance: 5000,
        hasPr: true,
      })

      expect(card.type).toBe('workout')
      expect(card.headline).toBe('Set a new Personal Record!')
      expect(card.distance).toBe(5000)
      expect(card.metadata.generatedAt).toBe('2026-06-05T12:00:00.000Z')
    })

    it('buildLevelUpCard adds metadata and headline', () => {
      const card = buildLevelUpCard({
        previousLevel: 4,
        currentLevel: 5,
        totalXp: 1200,
        xpToNextLevel: 300,
      })

      expect(card.type).toBe('level-up')
      expect(card.headline).toBe('Reached Level 5!')
      expect(card.currentLevel).toBe(5)
      expect(card.xpToNextLevel).toBe(300)
    })

    it('buildAchievementCard adds metadata and headline', () => {
      const card = buildAchievementCard({
        achievementTitle: 'Marathoner',
        achievementDescription: 'Run 42km',
        achievementCategory: 'distance',
      })

      expect(card.type).toBe('achievement')
      expect(card.achievementTitle).toBe('Marathoner')
    })

    it('buildPersonalRecordCard adds metadata and headline', () => {
      const card = buildPersonalRecordCard({
        recordTitle: 'Fastest 5K',
        recordValue: '25:00',
        achievedAt: '2026-06-05T12:00:00.000Z',
      })

      expect(card.type).toBe('personal-record')
      expect(card.recordTitle).toBe('Fastest 5K')
    })
  })
})
