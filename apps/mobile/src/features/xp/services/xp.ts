import { supabase } from '@/lib/supabase'

export type XpEvent = {
  id: string
  eventType: 'workout' | 'capture' | 'steal'
  xpAwarded: number
  createdAt: string
  workoutId: string | null
}

export type WorkoutXpEntry = {
  workoutId: string
  startedAt: string
  xpAwarded: number
  distanceM: number | null
  durationS: number | null
}

export type XpScreenData = {
  totalXp: number
  level: number
  recentEvents: XpEvent[]
  workoutHistory: WorkoutXpEntry[]
}

const VALID_TYPES = new Set(['workout', 'capture', 'steal'])

function toEventType(v: string): 'workout' | 'capture' | 'steal' {
  if (VALID_TYPES.has(v)) return v as 'workout' | 'capture' | 'steal'
  return 'workout'
}

export async function loadXpScreenData(): Promise<XpScreenData> {
  const [xpRes, eventsRes, historyRes] = await Promise.all([
    supabase.from('user_xp').select('total_xp, level').maybeSingle(),
    supabase
      .from('xp_events')
      .select('id, event_type, xp_awarded, created_at, workout_id')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('workouts')
      .select('id, started_at, xp_awarded, distance_m, duration_s')
      .eq('status', 'completed')
      .not('xp_awarded', 'is', null)
      .order('started_at', { ascending: false })
      .limit(8),
  ])

  return {
    totalXp: xpRes.data?.total_xp ?? 0,
    level: xpRes.data?.level ?? 1,
    recentEvents: (eventsRes.data ?? []).map((r) => ({
      id: r.id,
      eventType: toEventType(r.event_type),
      xpAwarded: r.xp_awarded,
      createdAt: r.created_at,
      workoutId: r.workout_id,
    })),
    workoutHistory: (historyRes.data ?? []).map((r) => ({
      workoutId: r.id,
      startedAt: r.started_at,
      xpAwarded: r.xp_awarded ?? 0,
      distanceM: r.distance_m,
      durationS: r.duration_s,
    })),
  }
}
