import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/infrastructure/supabase/database.types'

/** The columns selected for the history list — avoids pulling the full row. */
const HISTORY_COLUMNS =
  'id, started_at, distance_m, duration_s, avg_pace_s_per_km, status' as const

/** The columns selected for recent-workout queries (adds xp_awarded, omits status). */
const RECENT_COLUMNS =
  'id, started_at, distance_m, duration_s, avg_pace_s_per_km, xp_awarded' as const

/** Shape of one row returned by the history query. */
export type WorkoutHistoryRow = {
  id: string
  started_at: string
  distance_m: number | null
  duration_s: number | null
  avg_pace_s_per_km: number | null
  status: string
}

/** Shape of one row returned by the recent-workouts query. */
export type RecentWorkout = {
  id: string
  started_at: string
  distance_m: number | null
  duration_s: number | null
  avg_pace_s_per_km: number | null
  xp_awarded: number | null
}

/** Result of the history query — mirrors the Supabase response shape. */
export type WorkoutHistoryResult = {
  data: WorkoutHistoryRow[] | null
  error: { message: string } | null
}

/** Result of the recent-workouts query. */
export type RecentWorkoutResult = {
  data: RecentWorkout[] | null
  error: { message: string } | null
}

/**
 * Fetch the caller's completed workouts ordered by `started_at` descending
 * (02C-03). RLS scopes the query to the authenticated user — no explicit
 * `user_id` filter needed. Only `completed` workouts are shown; `recording`
 * and `discarded` are excluded so the history page always shows finished runs.
 */
export async function getWorkoutHistory(
  supabase: SupabaseClient<Database>,
): Promise<WorkoutHistoryResult> {
  const { data, error } = await supabase
    .from('workouts')
    .select(HISTORY_COLUMNS)
    .eq('status', 'completed')
    .order('started_at', { ascending: false })

  return { data, error }
}

/**
 * Fetch the caller's most recent completed workouts up to `limit` rows.
 * Includes `xp_awarded` for display in activity cards.
 */
export async function getRecentWorkouts(
  supabase: SupabaseClient<Database>,
  limit: number,
): Promise<RecentWorkoutResult> {
  const { data, error } = await supabase
    .from('workouts')
    .select(RECENT_COLUMNS)
    .eq('status', 'completed')
    .order('started_at', { ascending: false })
    .limit(limit)

  return { data, error }
}
