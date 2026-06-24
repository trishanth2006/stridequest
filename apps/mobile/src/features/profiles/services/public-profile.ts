import { supabase } from '@/lib/supabase'
import { formatDuration, formatDistance } from '@stridequest/shared/running'

export type PublicProfileRecord = {
  id: string
  title: string
  displayValue: string
}

export type PublicProfile = {
  userId: string
  username: string
  level: number
  totalXp: number
  totalDistanceM: number
  totalWorkouts: number
  territoriesOwned: number
  territoriesCaptured: number
  territoriesStolen: number
  records: PublicProfileRecord[]
  recentActivity: Array<{ id: string; type: 'workout' | 'capture'; title: string; createdAt: string }>
}

type RpcRow = {
  userId: string
  username: string
  level: number
  totalXp: number
  totalDistanceM: number
  totalWorkouts: number
  territoriesOwned: number
  territoriesCaptured: number
  territoriesStolen: number
  fastest1K: number | null
  fastest5K: number | null
  fastest10K: number | null
  longestRunM: number | null
}

function buildRecords(row: RpcRow): PublicProfileRecord[] {
  const out: PublicProfileRecord[] = []
  if (row.fastest1K != null) out.push({ id: 'fastest-1k', title: 'Fastest 1K', displayValue: formatDuration(Math.round(row.fastest1K)) })
  if (row.fastest5K != null) out.push({ id: 'fastest-5k', title: 'Fastest 5K', displayValue: formatDuration(Math.round(row.fastest5K)) })
  if (row.fastest10K != null) out.push({ id: 'fastest-10k', title: 'Fastest 10K', displayValue: formatDuration(Math.round(row.fastest10K)) })
  if (row.longestRunM != null) out.push({ id: 'longest-run', title: 'Longest Run', displayValue: formatDistance(row.longestRunM) })
  return out
}

export async function fetchPublicProfile(username: string): Promise<PublicProfile | null> {
  const { data, error } = await supabase.rpc('get_public_profile', { p_username: username })
  if (error || !data) return null
  const row = data as RpcRow

  // Fetch recent activity (respects RLS — returns empty if user has no public workouts)
  const { data: activityWorkouts } = await supabase
    .from('workouts')
    .select('id, started_at, distance_m')
    .eq('user_id', row.userId)
    .eq('status', 'completed')
    .order('started_at', { ascending: false })
    .limit(8)

  const recentActivity = (activityWorkouts ?? []).map((w) => {
    const distKm = (((w.distance_m as number) ?? 0) / 1000).toFixed(1).replace(/\.0$/, '')
    return {
      id: `workout-${w.id as string}`,
      type: 'workout' as const,
      title: `🏃 Completed ${distKm} km run`,
      createdAt: w.started_at as string,
    }
  })

  return {
    userId: row.userId,
    username: row.username,
    level: row.level,
    totalXp: row.totalXp,
    totalDistanceM: row.totalDistanceM,
    totalWorkouts: row.totalWorkouts,
    territoriesOwned: row.territoriesOwned,
    territoriesCaptured: row.territoriesCaptured,
    territoriesStolen: row.territoriesStolen,
    records: buildRecords(row),
    recentActivity,
  }
}
