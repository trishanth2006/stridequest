import { createServiceRoleClient } from '@/infrastructure/supabase/service-role'
import {
  getAchievements,
  getPersonalRecords,
  sortAchievements,
} from '@/features/achievements/services/achievements'
import { loadLeaderboardData } from '@/features/leaderboards/data/load-leaderboards'
import { getXpLeaderboard } from '@/features/leaderboards/services/leaderboards'
import type { RunnerProfile, RecentActivity } from '../types'

/**
 * Uses the service role client to bypass RLS.
 * This is necessary because `workouts`, `xp_events`, and `territory_captures`
 * are strictly limited to `auth.uid() = user_id` for reads by default,
 * making public profiles impossible to render without elevated privileges.
 */
export async function getUserIdByUsername(username: string): Promise<string | null> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle()
  return data?.id || null
}

export async function getRunnerProfile(userId: string): Promise<RunnerProfile | null> {
  const supabase = createServiceRoleClient()

  const [
    profileRes,
    xpRes,
    workoutsRes,
    ownedCellsRes,
    capturesRes,
    xpEventsRes,
  ] = await Promise.all([
    supabase.from('profiles').select('id, username').eq('id', userId).maybeSingle(),
    supabase.from('user_xp').select('level, total_xp').eq('user_id', userId).maybeSingle(),
    supabase.from('workouts').select('*').eq('user_id', userId).eq('status', 'completed'),
    supabase.from('cell_ownership').select('cell_id').eq('owner_user_id', userId),
    supabase.from('territory_captures').select('*').eq('user_id', userId),
    supabase.from('xp_events').select('*').eq('user_id', userId),
  ])

  if (profileRes.error) throw new Error(profileRes.error.message)
  if (!profileRes.data) return null // Profile not found

  const workouts = workoutsRes.data || []
  const captures = capturesRes.data || []
  const xpEvents = xpEventsRes.data || []
  const ownedCellsCount = ownedCellsRes.data?.length || 0

  const totalDistanceM = workouts.reduce((sum, w) => sum + (w.distance_m || 0), 0)
  const totalWorkouts = workouts.length
  
  const territoriesCaptured = captures.filter((c) => c.action === 'claim').length
  const territoriesStolen = captures.filter((c) => c.action === 'steal').length

  const level = xpRes.data?.level || 1
  const totalXp = xpRes.data?.total_xp || 0

  const achievements = getAchievements(workouts, captures, totalXp, level, xpEvents)
  const unlockedAchievements = sortAchievements(achievements).filter(a => a.unlocked)
  
  const prs = getPersonalRecords(workouts, captures)

  const findPr = (id: string) => prs.find((pr) => pr.id === id)?.value

  // Profile Completion logic
  const achievementCompletion = Math.min(100, Math.round((unlockedAchievements.length / achievements.length) * 100)) || 0
  const prCompletion = Math.min(100, Math.round((prs.length / 8) * 100)) || 0
  const recentActivities = await getRecentActivity(userId)
  const profileActivityCompletion = Math.min(100, recentActivities.length * 10)
  
  const profileCompletion = Math.round((achievementCompletion + prCompletion + profileActivityCompletion) / 3)

  return {
    userId: profileRes.data.id,
    username: profileRes.data.username,
    level,
    totalXp,
    territoriesOwned: ownedCellsCount,
    territoriesCaptured,
    territoriesStolen,
    totalDistanceM,
    totalWorkouts,
    achievementCount: unlockedAchievements.length,
    longestRunM: findPr('longest-run'),
    fastest1K: findPr('fastest-1k'),
    fastest5K: findPr('fastest-5k'),
    fastest10K: findPr('fastest-10k'),
    topAchievements: unlockedAchievements.slice(0, 3),
    profileCompletion,
  }
}

export async function getProfileRank(userId: string): Promise<number | undefined> {
  const data = await loadLeaderboardData(new Date())
  const entries = getXpLeaderboard(data.users, data.standings, userId)
  const userEntry = entries.find((e) => e.userId === userId)
  return userEntry?.rank
}

export async function getRecentActivity(userId: string): Promise<RecentActivity[]> {
  const supabase = createServiceRoleClient()

  // We only need basic profile data for achievements, so we fetch what's needed.
  const [workoutsRes, capturesRes, xpEventsRes, xpRes] = await Promise.all([
    supabase.from('workouts').select('*').eq('user_id', userId).eq('status', 'completed'),
    supabase.from('territory_captures').select('*').eq('user_id', userId),
    supabase.from('xp_events').select('*').eq('user_id', userId),
    supabase.from('user_xp').select('level, total_xp').eq('user_id', userId).maybeSingle(),
  ])

  const workouts = workoutsRes.data || []
  const captures = capturesRes.data || []
  const xpEvents = xpEventsRes.data || []
  const level = xpRes.data?.level || 1
  const totalXp = xpRes.data?.total_xp || 0

  const activities: RecentActivity[] = []

  // Add workouts
  for (const w of workouts) {
    const distKm = ((w.distance_m || 0) / 1000).toFixed(1).replace(/\.0$/, '')
    activities.push({
      id: `workout-${w.id}`,
      type: 'workout',
      title: `🏃 Completed ${distKm} km run`,
      createdAt: w.started_at,
    })
  }

  // Add captures (Grouped by workout is best, or individual? Spec says: "🌍 Captured 3 territories")
  // Let's group captures by workout so it doesn't spam the feed
  const capturesByWorkout = new Map<string, typeof captures>()
  for (const c of captures) {
    if (!capturesByWorkout.has(c.workout_id)) capturesByWorkout.set(c.workout_id, [])
    capturesByWorkout.get(c.workout_id)!.push(c)
  }

  for (const [workoutId, caps] of capturesByWorkout.entries()) {
    const time = caps[caps.length - 1].captured_at
    activities.push({
      id: `captures-${workoutId}`,
      type: 'capture',
      title: `🌍 Captured ${caps.length} ${caps.length === 1 ? 'territory' : 'territories'}`,
      createdAt: time,
    })
  }

  // Add achievements
  const achievements = getAchievements(workouts, captures, totalXp, level, xpEvents)
  for (const a of achievements) {
    if (a.unlocked && a.unlockedAt) {
      activities.push({
        id: `achievement-${a.id}`,
        type: 'achievement',
        title: `🏆 Unlocked ${a.title}`,
        createdAt: a.unlockedAt,
      })
    }
  }

  // Add XP events (optional? Spec: "⚡ Earned 60 XP"). Let's sum XP per workout to avoid spam.
  const xpByWorkout = new Map<string, number>()
  for (const e of xpEvents) {
    if (e.workout_id) {
      xpByWorkout.set(e.workout_id, (xpByWorkout.get(e.workout_id) || 0) + e.xp_awarded)
    }
  }
  
  for (const [workoutId, xp] of xpByWorkout.entries()) {
    // Find the workout to get a timestamp. If not found, use a fallback from xpEvents
    const evs = xpEvents.filter(e => e.workout_id === workoutId)
    if (evs.length > 0) {
      activities.push({
        id: `xp-${workoutId}`,
        type: 'achievement', // using achievement icon/type for XP for now
        title: `⚡ Earned ${xp} XP`,
        createdAt: evs[evs.length - 1].created_at,
      })
    }
  }

  // Sort by createdAt desc
  activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // Limit to 10
  return activities.slice(0, 10)
}
