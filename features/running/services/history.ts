import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/infrastructure/supabase/database.types'

/** The columns selected for the history list — avoids pulling the full row. */
const HISTORY_COLUMNS =
  'id, started_at, distance_m, duration_s, avg_pace_s_per_km, status' as const

/** Shape of one row returned by the history query. */
export type WorkoutHistoryRow = {
  id: string
  started_at: string
  distance_m: number | null
  duration_s: number | null
  avg_pace_s_per_km: number | null
  status: string
}

/** Result of the history query — mirrors the Supabase response shape. */
export type WorkoutHistoryResult = {
  data: WorkoutHistoryRow[] | null
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
