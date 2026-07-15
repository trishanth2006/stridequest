import { supabase } from '@/lib/supabase'
import { formatDuration, formatDistance } from '@stridequest/shared/running'
import { getPersonalRecords as sharedGetPersonalRecords, type PRWorkoutRow, type PRCaptureRow } from '@stridequest/shared/analytics'

export type PersonalRecord = {
  id: string
  title: string
  displayValue: string
}

export type RecentActivity = {
  id: string
  type: 'workout' | 'capture' | 'achievement'
  title: string
  createdAt: string
}

export type OwnProfileExtras = {
  personalRecords: PersonalRecord[]
  recentActivity: RecentActivity[]
}

type CaptureRow = {
  cell_id: string
  captured_at: string
  action: string
  workout_id: string
}

type XpEventRow = {
  xp_awarded: number
  created_at: string
  workout_id: string | null
}

function formatPersonalRecords(workouts: PRWorkoutRow[], captures: PRCaptureRow[]): PersonalRecord[] {
  const raw = sharedGetPersonalRecords(workouts, captures)
  return raw
    .filter((r) => r.value !== undefined && r.value > 0)
    .map((r) => {
      let displayValue: string
      if (r.id === 'fastest-1k' || r.id === 'fastest-5k' || r.id === 'fastest-10k') {
        displayValue = formatDuration(Math.round(r.value!))
      } else if (r.id === 'longest-run') {
        displayValue = formatDistance(r.value!)
      } else if (r.id === 'most-xp-workout') {
        displayValue = `${r.value} XP`
      } else if (r.id === 'most-territory-workout') {
        displayValue = `${r.value} cells`
      } else {
        displayValue = String(r.value)
      }
      return { id: r.id, title: r.title, displayValue }
    })
}

function buildRecentActivity(
  workouts: PRWorkoutRow[],
  captures: CaptureRow[],
  xpEvents: XpEventRow[],
): RecentActivity[] {
  const activities: RecentActivity[] = []

  for (const w of workouts) {
    const distKm = (((w.distance_m ?? 0) / 1000)).toFixed(1).replace(/\.0$/, '')
    activities.push({
      id: `workout-${w.id}`,
      type: 'workout',
      title: `🏃 Completed ${distKm} km run`,
      createdAt: w.started_at,
    })
  }

  const capturesByWorkout = new Map<string, CaptureRow[]>()
  for (const c of captures) {
    if (!capturesByWorkout.has(c.workout_id)) capturesByWorkout.set(c.workout_id, [])
    capturesByWorkout.get(c.workout_id)!.push(c)
  }
  for (const [workoutId, caps] of capturesByWorkout.entries()) {
    activities.push({
      id: `captures-${workoutId}`,
      type: 'capture',
      title: `🌍 Captured ${caps.length} ${caps.length === 1 ? 'territory' : 'territories'}`,
      createdAt: caps[caps.length - 1].captured_at,
    })
  }

  const xpByWorkout = new Map<string, { xp: number; at: string }>()
  for (const e of xpEvents) {
    if (e.workout_id) {
      const prev = xpByWorkout.get(e.workout_id)
      xpByWorkout.set(e.workout_id, {
        xp: (prev?.xp ?? 0) + e.xp_awarded,
        at: e.created_at,
      })
    }
  }
  for (const [workoutId, { xp, at }] of xpByWorkout.entries()) {
    activities.push({
      id: `xp-${workoutId}`,
      type: 'achievement',
      title: `⚡ Earned ${xp} XP`,
      createdAt: at,
    })
  }

  activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return activities.slice(0, 10)
}

export async function loadOwnProfileExtras(): Promise<OwnProfileExtras> {
  const [workoutsRes, capturesRes, xpEventsRes] = await Promise.all([
    supabase
      .from('workouts')
      .select('id, started_at, distance_m, duration_s, avg_pace_s_per_km, xp_awarded, status')
      .eq('status', 'completed'),
    supabase
      .from('territory_captures')
      .select('cell_id, captured_at, action, workout_id'),
    supabase
      .from('xp_events')
      .select('xp_awarded, created_at, workout_id'),
  ])

  const workouts = (workoutsRes.data ?? []) as PRWorkoutRow[]
  const captures = (capturesRes.data ?? []) as CaptureRow[]
  const xpEvents = (xpEventsRes.data ?? []) as XpEventRow[]

  return {
    personalRecords: formatPersonalRecords(workouts, captures as PRCaptureRow[]),
    recentActivity: buildRecentActivity(workouts, captures, xpEvents),
  }
}
