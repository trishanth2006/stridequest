import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/infrastructure/supabase/database.types'
import type { WorkoutSummary } from '../types/workout-summary'

export async function getWorkoutSummary(
  supabase: SupabaseClient<Database>,
  workoutId: string
): Promise<WorkoutSummary> {
  const [workoutResult, capturesResult, xpEventsResult] = await Promise.all([
    supabase
      .from('workouts')
      .select('distance_m, duration_s, avg_pace_s_per_km, ended_at, xp_awarded')
      .eq('id', workoutId)
      .single(),
    supabase
      .from('territory_captures')
      .select('action')
      .eq('workout_id', workoutId),
    supabase
      .from('xp_events')
      .select('xp_awarded')
      .eq('workout_id', workoutId)
  ])

  if (workoutResult.error) {
    throw new Error(`Failed to fetch workout: ${workoutResult.error.message}`)
  }

  const workout = workoutResult.data
  const captures = capturesResult.data || []
  const xpEvents = xpEventsResult.data || []

  const cellsClaimed = captures.filter(c => c.action === 'claim').length
  const cellsStolen = captures.filter(c => c.action === 'steal').length
  const cellsDefended = captures.filter(c => c.action === 'defend').length

  // Fallback to sum of xp_events if workout.xp_awarded is null (it shouldn't be, but just in case)
  const xpEarned = workout.xp_awarded ?? xpEvents.reduce((sum, e) => sum + (e.xp_awarded || 0), 0)

  return {
    workoutId,
    distanceM: workout.distance_m || 0,
    durationS: workout.duration_s || 0,
    avgPaceSPerKm: workout.avg_pace_s_per_km,
    cellsClaimed,
    cellsStolen,
    cellsDefended,
    xpEarned,
    completedAt: workout.ended_at,
  }
}
