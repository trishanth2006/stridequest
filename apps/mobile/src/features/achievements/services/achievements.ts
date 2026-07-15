/**
 * Mobile achievement loader — fetches the required data and delegates
 * to the website's pure getAchievements/getPersonalRecords logic.
 * Mirrors the pattern in features/achievements/services/achievements.ts.
 */
import { supabase } from '@/lib/supabase'

import {
  computeAchievements,
  sortAchievements,
  type AchievementCategory,
  type Achievement,
  type AchievementWorkoutRow,
  type CaptureRow,
  type XpEventRow,
} from '@stridequest/shared/analytics'

// ── Data loader ──────────────────────────────────────────────────────────────

export type AchievementLoadResult = {
  achievements: Achievement[]
  totalXp: number
}

export async function loadAchievements(): Promise<AchievementLoadResult> {
  // TECH-DEBT-ACH-001: Move achievement aggregation to get_user_achievements() RPC when dataset growth justifies it.
  const [workoutsRes, capturesRes, xpRes, xpEventsRes] = await Promise.all([
    supabase.from('workouts').select('id, started_at, distance_m, xp_awarded, status'),
    supabase.from('territory_captures').select('cell_id, captured_at, action'),
    supabase.from('user_xp').select('total_xp'),
    supabase.from('xp_events').select('xp_awarded, created_at'),
  ])

  const workouts = (workoutsRes.data ?? []) as AchievementWorkoutRow[]
  const captures = (capturesRes.data ?? []) as CaptureRow[]
  const totalXp = (xpRes.data?.[0]?.total_xp as number | null | undefined) ?? 0
  const xpEvents = (xpEventsRes.data ?? []) as XpEventRow[]

  const achievements = sortAchievements(computeAchievements(workouts, captures, totalXp, xpEvents))

  return { achievements, totalXp }
}
