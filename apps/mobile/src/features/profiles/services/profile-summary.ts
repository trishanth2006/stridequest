import { supabase } from '@/lib/supabase'
import { sumDistanceM } from '@stridequest/shared/running'
import { loadOwnProfileExtras, type PersonalRecord, type RecentActivity } from './profile'
import { fetchMyRank } from '@/features/leaderboards/services/leaderboards'
import { loadAchievements } from '@/features/achievements/services/achievements'

export type ProfileData = {
  username: string
  totalXp: number
  totalDistanceM: number
  workoutCount: number
  territoryCount: number
  xpRank: number
  totalUsers: number
  achievementCount: number
  totalAchievements: number
  captureCount: number
  stolenCount: number
  profileCompletion: number
}

export type ProfileSummary = {
  data: ProfileData
  records: PersonalRecord[]
  activity: RecentActivity[]
  topAchievements: { id: string; icon: string; title: string }[]
}

/**
 * Aggregates every piece of the profile screen (identity, XP, lifetime
 * distance, territory counts, rank, achievements, personal records, recent
 * activity) into a single object. Keeps the raw Supabase access out of the
 * screen component.
 */
export async function loadProfileSummary(
  userId: string,
  userEmail: string | undefined,
): Promise<ProfileSummary> {
  const [profileResult, xpResult, workoutsResult, territoryResult, extras, rankResult, achResult, claimsResult, stolenResult] =
    await Promise.all([
      supabase.from('profiles').select('username').eq('id', userId).single(),
      supabase.from('user_xp').select('total_xp').eq('user_id', userId).single(),
      supabase
        .from('workouts')
        .select('distance_m')
        .eq('user_id', userId)
        .eq('status', 'completed'),
      supabase
        .from('cell_ownership')
        .select('cell_id', { count: 'exact', head: true })
        .eq('owner_user_id', userId),
      loadOwnProfileExtras(),
      fetchMyRank('xp').catch(() => ({ rank: 0, totalUsers: 0, value: 0, percentile: 0, nextRankValue: null })),
      loadAchievements().catch(() => ({ achievements: [], totalXp: 0 })),
      supabase.from('territory_captures').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('action', 'claim'),
      supabase.from('territory_captures').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('action', 'steal'),
    ])

  const workouts = workoutsResult.data ?? []
  const totalDistanceM = sumDistanceM(workouts)

  const achs = achResult.achievements
  const unlocked = achs.filter((a) => a.unlocked)
  const unlockedCount = unlocked.length

  const captureCount = claimsResult.count ?? 0
  const stolenCount = stolenResult.count ?? 0
  const totalXp = xpResult.data?.total_xp ?? 0
  const workoutCount = workouts.length
  const profileCompletion = Math.round(
    ([
      totalXp > 0,
      workoutCount > 0,
      (territoryResult.count ?? 0) > 0,
      unlockedCount > 0,
    ].filter(Boolean).length / 4) * 100,
  )

  const topAchievements = unlocked.slice(0, 3).map((a) => ({ id: a.id, icon: a.icon, title: a.title }))

  const data: ProfileData = {
    username: profileResult.data?.username ?? userEmail ?? 'Runner',
    totalXp,
    totalDistanceM,
    workoutCount,
    territoryCount: territoryResult.count ?? 0,
    xpRank: rankResult.rank,
    totalUsers: rankResult.totalUsers,
    achievementCount: unlockedCount,
    totalAchievements: achs.length,
    captureCount,
    stolenCount,
    profileCompletion,
  }

  return {
    data,
    records: extras.personalRecords,
    activity: extras.recentActivity,
    topAchievements,
  }
}
