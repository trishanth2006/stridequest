import type { Tables } from '@/infrastructure/supabase/database.types';
import {
  getAchievements,
  sortAchievements,
  groupAchievementsByCategory,
  getCategorySummaries,
  getClosestAchievement,
  getAchievementSummary
} from '@/features/achievements/services/achievements'

describe('achievements service', () => {
  const mockWorkouts = [
    { id: 'w1', status: 'completed', distance_m: 5000, xp_awarded: 50, started_at: '2026-06-01T08:00:00Z', created_at: '', updated_at: '', user_id: '', duration_s: 0, avg_pace_s_per_km: 0, elevation_gain_m: null, ended_at: null, path: null, source: '' },
    { id: 'w2', status: 'completed', distance_m: 10000, xp_awarded: 75, started_at: '2026-06-02T08:00:00Z', created_at: '', updated_at: '', user_id: '', duration_s: 0, avg_pace_s_per_km: 0, elevation_gain_m: null, ended_at: null, path: null, source: '' },
    { id: 'w3', status: 'completed', distance_m: 30000, xp_awarded: 200, started_at: '2026-06-03T08:00:00Z', created_at: '', updated_at: '', user_id: '', duration_s: 0, avg_pace_s_per_km: 0, elevation_gain_m: null, ended_at: null, path: null, source: '' }
  ] as Tables<'workouts'>[]

  const mockCaptures = [
    { id: 'c1', workout_id: 'w1', cell_id: 'cell1', action: 'claim', captured_at: '2026-06-01T08:05:00Z', user_id: '' }
  ] as Tables<'territory_captures'>[]

  const mockXpEvents = [
    { id: 'e1', xp_awarded: 50, created_at: '2026-06-01T08:30:00Z', user_id: '', workout_id: null, event_type: '' },
    { id: 'e2', xp_awarded: 75, created_at: '2026-06-02T08:30:00Z', user_id: '', workout_id: null, event_type: '' },
    { id: 'e3', xp_awarded: 200, created_at: '2026-06-03T08:30:00Z', user_id: '', workout_id: null, event_type: '' }
  ] as Tables<'xp_events'>[]

  describe('getAchievements', () => {
    it('calculates running achievements correctly', () => {
      const achievements = getAchievements(mockWorkouts, mockCaptures, 325, 3, mockXpEvents)

      const firstRun = achievements.find(a => a.id === 'first-run')!
      expect(firstRun.unlocked).toBe(true)
      expect(firstRun.unlockedAt).toBe('2026-06-01T08:00:00Z')

      const runner = achievements.find(a => a.id === 'runner')!
      expect(runner.unlocked).toBe(false)
      expect(runner.progress).toBe(3)

      const marathoner = achievements.find(a => a.id === 'marathoner')!
      expect(marathoner.unlocked).toBe(true)
      expect(marathoner.unlockedAt).toBe('2026-06-03T08:00:00Z')

      const distanceBeast = achievements.find(a => a.id === 'distance-beast')!
      expect(distanceBeast.unlocked).toBe(false)
      expect(distanceBeast.progress).toBe(45000)
    })

    it('calculates territory achievements correctly', () => {
      const achievements = getAchievements(mockWorkouts, mockCaptures, 325, 3, mockXpEvents)

      const firstTerritory = achievements.find(a => a.id === 'first-territory')!
      expect(firstTerritory.unlocked).toBe(true)
      expect(firstTerritory.unlockedAt).toBe('2026-06-01T08:05:00Z')

      const explorer = achievements.find(a => a.id === 'explorer')!
      expect(explorer.unlocked).toBe(false)
      expect(explorer.progress).toBe(1)
    })

    it('calculates XP achievements correctly', () => {
      const achievements = getAchievements(mockWorkouts, mockCaptures, 325, 3, mockXpEvents)

      const xpHunter = achievements.find(a => a.id === 'xp-hunter')!
      expect(xpHunter.unlocked).toBe(true)
      expect(xpHunter.unlockedAt).toBe('2026-06-02T08:30:00Z')

      const xpMaster = achievements.find(a => a.id === 'xp-master')!
      expect(xpMaster.unlocked).toBe(false)
      expect(xpMaster.progress).toBe(325)

      const risingStar = achievements.find(a => a.id === 'rising-star')!
      expect(risingStar.unlocked).toBe(true)
      expect(risingStar.unlockedAt).toBe('2026-06-03T08:30:00Z')

      const eliteRunner = achievements.find(a => a.id === 'elite-runner')!
      expect(eliteRunner.unlocked).toBe(false)
      expect(eliteRunner.progress).toBe(3)
    })
  })

  describe('sortAchievements', () => {
    it('sorts achievements by unlocked first, then highest completion percentage', () => {
      const achievements = [
        { id: 'a1', title: 'A1', description: '', icon: '', category: 'running' as const, unlocked: false, progress: 2, target: 10 },
        { id: 'a2', title: 'A2', description: '', icon: '', category: 'running' as const, unlocked: true, progress: 10, target: 10 },
        { id: 'a3', title: 'A3', description: '', icon: '', category: 'running' as const, unlocked: false, progress: 8, target: 10 }
      ]

      const sorted = sortAchievements(achievements)
      expect(sorted[0].id).toBe('a2')
      expect(sorted[1].id).toBe('a3')
      expect(sorted[2].id).toBe('a1')
    })
  })

  describe('groupAchievementsByCategory', () => {
    it('groups achievements by category', () => {
      const achievements = getAchievements(mockWorkouts, mockCaptures, 325, 3, mockXpEvents)
      const grouped = groupAchievementsByCategory(achievements)

      expect(grouped.running).toHaveLength(4)
      expect(grouped.territory).toHaveLength(2)
      expect(grouped.xp).toHaveLength(4)
    })
  })

  describe('getCategorySummaries', () => {
    it('calculates category summaries', () => {
      const achievements = getAchievements(mockWorkouts, mockCaptures, 325, 3, mockXpEvents)
      const summaries = getCategorySummaries(achievements)

      expect(summaries.running).toEqual({ unlocked: 2, total: 4 })
      expect(summaries.territory).toEqual({ unlocked: 1, total: 2 })
      expect(summaries.xp).toEqual({ unlocked: 2, total: 4 })
    })
  })

  describe('getClosestAchievement', () => {
    it('returns closest locked achievement with remaining progress', () => {
      const achievements = getAchievements(mockWorkouts, mockCaptures, 325, 3, mockXpEvents)
      const closestResult = getClosestAchievement(achievements)

      expect(closestResult).toBeDefined()
      expect(closestResult!.achievement.id).toBe('xp-master')
      expect(closestResult!.remaining).toBe(175)
    })

    it('returns remaining progress for closest achievement', () => {
      const achievements = getAchievements(mockWorkouts, mockCaptures, 325, 3, mockXpEvents)
      const closestResult = getClosestAchievement(achievements)!
      expect(closestResult.remaining).toBe(500 - 325)
    })
  })

  describe('getAchievementSummary', () => {
    it('calculates achievement completion percentage and closest achievement', () => {
      const achievements = getAchievements(mockWorkouts, mockCaptures, 325, 3, mockXpEvents)
      const summary = getAchievementSummary(achievements)

      expect(summary.unlocked).toBe(5)
      expect(summary.total).toBe(10)
      expect(summary.percentage).toBe(50)
      expect(summary.closestAchievement).toBeDefined()
      expect(summary.closestAchievement!.id).toBe('xp-master')
      expect(summary.closestAchievement!.remaining).toBe(175)
    })
  })
})
