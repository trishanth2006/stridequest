import type { Tables } from '@/infrastructure/supabase/database.types'
import type { Achievement, AchievementCategory, PersonalRecord } from '../types'
import {
  computeAchievements,
  sortAchievements,
  getPersonalRecords as sharedGetPersonalRecords,
  getBestRecord,
  type AchievementWorkoutRow,
  type CaptureRow,
  type XpEventRow,
  type PRWorkoutRow,
  type PRCaptureRow,
} from '@stridequest/shared/analytics'

export { sortAchievements, getBestRecord }

export function getAchievements(
  workouts: Tables<'workouts'>[],
  territoryCaptures: Tables<'territory_captures'>[] = [],
  totalXp: number = 0,
  _level: number = 1,
  xpEvents: Tables<'xp_events'>[] = [],
): Achievement[] {
  return computeAchievements(
    workouts as unknown as AchievementWorkoutRow[],
    territoryCaptures as unknown as CaptureRow[],
    totalXp,
    xpEvents as unknown as XpEventRow[],
  )
}

export function getPersonalRecords(
  workouts: Tables<'workouts'>[],
  captures: Tables<'territory_captures'>[] = [],
): PersonalRecord[] {
  return sharedGetPersonalRecords(
    workouts as unknown as PRWorkoutRow[],
    captures as unknown as PRCaptureRow[],
  ) as PersonalRecord[]
}

export function groupAchievementsByCategory(
  achievements: Achievement[],
): Record<AchievementCategory, Achievement[]> {
  const result: Record<AchievementCategory, Achievement[]> = {
    running: [],
    territory: [],
    xp: [],
  }
  for (const ach of achievements) {
    result[ach.category].push(ach)
  }
  return result
}

export function getCategorySummaries(
  achievements: Achievement[],
): Record<AchievementCategory, { unlocked: number; total: number }> {
  const result: Record<AchievementCategory, { unlocked: number; total: number }> = {
    running: { unlocked: 0, total: 0 },
    territory: { unlocked: 0, total: 0 },
    xp: { unlocked: 0, total: 0 },
  }
  for (const ach of achievements) {
    result[ach.category].total += 1
    if (ach.unlocked) result[ach.category].unlocked += 1
  }
  return result
}

export function getClosestAchievement(
  achievements: Achievement[],
): { achievement: Achievement; remaining: number } | undefined {
  const locked = achievements.filter((a) => !a.unlocked)
  if (locked.length === 0) return undefined

  let best = locked[0]
  let bestPct = locked[0].target > 0 ? locked[0].progress / locked[0].target : 0

  for (let i = 1; i < locked.length; i++) {
    const pct = locked[i].target > 0 ? locked[i].progress / locked[i].target : 0
    if (pct > bestPct) {
      best = locked[i]
      bestPct = pct
    } else if (pct === bestPct) {
      const remCurrent = locked[i].target - locked[i].progress
      const remBest = best.target - best.progress
      if (remCurrent < remBest) {
        best = locked[i]
        bestPct = pct
      } else if (remCurrent === remBest && locked[i].id.localeCompare(best.id) < 0) {
        best = locked[i]
      }
    }
  }

  return { achievement: best, remaining: Math.max(0, best.target - best.progress) }
}

export function getAchievementSummary(achievements: Achievement[]): {
  unlocked: number
  total: number
  percentage: number
  closestAchievement?: Achievement & { remaining: number }
} {
  const total = achievements.length
  const unlocked = achievements.filter((a) => a.unlocked).length
  const percentage = total > 0 ? Math.round((unlocked / total) * 100) : 0
  const closest = getClosestAchievement(achievements)
  return {
    unlocked,
    total,
    percentage,
    closestAchievement: closest
      ? { ...closest.achievement, remaining: closest.remaining }
      : undefined,
  }
}
