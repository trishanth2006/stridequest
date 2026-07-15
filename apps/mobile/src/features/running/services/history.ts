import { supabase } from '@/lib/supabase'

export type RecentWorkout = {
  id: string
  started_at: string
  distance_m: number | null
  duration_s: number | null
  avg_pace_s_per_km: number | null
  xp_awarded: number | null
}

export type SortField = 'started_at' | 'distance_m' | 'xp_awarded'

const RECENT_COLS = 'id, started_at, distance_m, duration_s, avg_pace_s_per_km, xp_awarded'
const PAGE_SIZE = 20

export async function getRecentWorkouts(limit: number): Promise<RecentWorkout[]> {
  const { data } = await supabase
    .from('workouts')
    .select(RECENT_COLS)
    .eq('status', 'completed')
    .order('started_at', { ascending: false })
    .limit(limit)

  return (data ?? []) as RecentWorkout[]
}

export async function getWorkoutsPage(page: number, sort: SortField): Promise<RecentWorkout[]> {
  const start = page * PAGE_SIZE
  const end = start + PAGE_SIZE - 1

  const { data } = await supabase
    .from('workouts')
    .select(RECENT_COLS)
    .eq('status', 'completed')
    .order(sort, { ascending: false })
    .range(start, end)

  return (data ?? []) as RecentWorkout[]
}
