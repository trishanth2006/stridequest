import { supabase } from '@/lib/supabase'

/** Columns selected for dashboard activity (last 90 days). */
const DASHBOARD_ACTIVITY_COLUMNS =
  'id, started_at, distance_m, duration_s, xp_awarded' as const

export type DashboardActivityRow = {
  id: string
  started_at: string
  distance_m: number | null
  duration_s: number | null
  xp_awarded: number | null
}

export type DashboardTotals = {
  totalDistanceM: number
  totalRunCount: number
}

/**
 * Returns the caller's completed workouts from the last 90 days, newest
 * first — used by the dashboard to compute today/streak/weekly stats
 * without an unbounded all-time scan. Mirrors getDashboardActivity on web.
 */
export async function getDashboardActivity(): Promise<DashboardActivityRow[]> {
  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - 90)

  const { data, error } = await supabase
    .from('workouts')
    .select(DASHBOARD_ACTIVITY_COLUMNS)
    .eq('status', 'completed')
    .gte('started_at', cutoff.toISOString())
    .order('started_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as DashboardActivityRow[]
}

/**
 * Lifetime totals across all completed workouts. Fetches only distance_m
 * to keep payload minimal. Mirrors getDashboardTotals on web.
 */
export async function getDashboardTotals(): Promise<DashboardTotals> {
  const { data, error } = await supabase
    .from('workouts')
    .select('distance_m')
    .eq('status', 'completed')

  if (error) throw new Error(error.message)
  const rows = data ?? []
  return {
    totalDistanceM: rows.reduce((sum, w) => sum + ((w.distance_m as number | null) ?? 0), 0),
    totalRunCount: rows.length,
  }
}

/** Combined fetch — single call from the home screen. */
export async function loadDashboard(): Promise<{
  activity: DashboardActivityRow[]
  totals: DashboardTotals
}> {
  const [activity, totals] = await Promise.all([
    getDashboardActivity(),
    getDashboardTotals(),
  ])
  return { activity, totals }
}
