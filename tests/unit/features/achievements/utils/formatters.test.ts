import {
  formatDuration,
  formatDistance,
  formatPercentage,
  formatRecordValue,
  getAchievementProgress
} from '@/features/achievements/utils/formatters'

describe('achievements formatters', () => {
  describe('formatDuration', () => {
    it('formats record times correctly', () => {
      expect(formatDuration(1458)).toBe('24:18') // 24m 18s
      expect(formatDuration(2901)).toBe('48:21') // 48m 21s
      expect(formatDuration(3665)).toBe('1:01:05') // 1h 1m 5s
      expect(formatDuration(0)).toBe('0:00')
      expect(formatDuration(-10)).toBe('0:00')
    })
  })

  describe('formatDistance', () => {
    it('formats longest run correctly', () => {
      expect(formatDistance(12400)).toBe('12.4 km')
      expect(formatDistance(10000)).toBe('10 km')
      expect(formatDistance(0)).toBe('0 km')
      expect(formatDistance(15230)).toBe('15.2 km')
    })
  })

  describe('formatPercentage', () => {
    it('formats percentages correctly', () => {
      expect(formatPercentage(80)).toBe('80%')
      expect(formatPercentage(100)).toBe('100%')
      expect(formatPercentage(88.3)).toBe('88%')
    })
  })

  describe('formatRecordValue', () => {
    it('formats most xp workout correctly', () => {
      expect(formatRecordValue('most-xp-workout', 250)).toBe('250 XP')
    })

    it('formats most territory workout correctly', () => {
      expect(formatRecordValue('most-territory-workout', 18)).toBe('18 Territories')
      expect(formatRecordValue('most-territory-workout', 1)).toBe('1 Territory')
    })

    it('formats most efficient run correctly', () => {
      expect(formatRecordValue('most-efficient-run', 12.5)).toBe('12.5 XP/km')
      expect(formatRecordValue('most-efficient-run', 12.0)).toBe('12 XP/km')
    })

    it('formats territory efficiency correctly', () => {
      expect(formatRecordValue('territory-efficiency', 5.5)).toBe('5.5 captures/km')
      expect(formatRecordValue('territory-efficiency', 5.0)).toBe('5 captures/km')
    })
  })

  describe('getAchievementProgress', () => {
    it('clamps progress to target and never exceeds 100%', () => {
      const result = getAchievementProgress(87, 50)
      expect(result.progress).toBe(50)
      expect(result.percentage).toBe(100)
    })

    it('calculates regular progress percentage correctly', () => {
      const result = getAchievementProgress(8, 10)
      expect(result.progress).toBe(8)
      expect(result.percentage).toBe(80)
    })
  })
})
