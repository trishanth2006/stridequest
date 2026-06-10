import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/infrastructure/supabase/database.types'
import type { 
  WorkoutDetail, 
  WorkoutRoutePoint, 
  WorkoutTerritoryCapture, 
  WorkoutTerritoryBreakdown,
  WorkoutXpBreakdown,
  WorkoutPrFlags
} from '../types/workout-detail'
import { getAchievements, getPersonalRecords } from '@/features/achievements/services/achievements'
import { getLevelFromXP, getXpProgress, calculateWorkoutXP, calculateCaptureXP, calculateStealXP } from '@/features/xp/services/xp'
import { cellToLatLng } from 'h3-js'

export async function getWorkoutDetail(
  supabase: SupabaseClient<Database>,
  workoutId: string
): Promise<WorkoutDetail | null> {
  
  // 1. Fetch workout record
  const { data: workout, error: workoutErr } = await supabase
    .from('workouts')
    .select('*')
    .eq('id', workoutId)
    .single()

  if (workoutErr || !workout) return null

  // 2. Fetch all related data for THIS workout
  const [routeRes, capturesRes, xpRes] = await Promise.all([
    supabase
      .from('route_points')
      .select('lat, lng, recorded_at')
      .eq('workout_id', workoutId)
      .order('recorded_at', { ascending: true }),
    supabase
      .from('territory_captures')
      .select('id, cell_id, action, captured_at')
      .eq('workout_id', workoutId)
      .order('captured_at', { ascending: true }),
    supabase
      .from('xp_events')
      .select('xp_awarded, event_type, created_at')
      .eq('workout_id', workoutId)
  ])

  const routePoints = (routeRes.data || []).map(p => ({
    lat: p.lat,
    lng: p.lng,
    timestamp: p.recorded_at
  })) as WorkoutRoutePoint[]

  const territoryCaptures = (capturesRes.data || []).map(c => {
    const [lat, lng] = cellToLatLng(c.cell_id)
    return {
      id: c.id,
      cellId: c.cell_id,
      lat,
      lng,
      action: c.action as any,
      capturedAt: c.captured_at
    }
  }) as WorkoutTerritoryCapture[]

  const xpEvents = xpRes.data || []

  // Compute Territory Breakdown
  const claimed = territoryCaptures.filter(c => c.action === 'claim').length
  const stolen = territoryCaptures.filter(c => c.action === 'steal').length
  const defended = territoryCaptures.filter(c => c.action === 'defend').length
  const territoryBreakdown: WorkoutTerritoryBreakdown = {
    claimed,
    stolen,
    defended,
    totalImpact: claimed + stolen + defended
  }

  // 3. Fetch user's total history for Achievements and PRs
  // RLS scopes to current user.
  const [allWorkoutsRes, allCapturesRes, allXpRes] = await Promise.all([
    supabase.from('workouts').select('*').eq('status', 'completed'),
    supabase.from('territory_captures').select('*'),
    supabase.from('xp_events').select('*')
  ])

  const allWorkouts = allWorkoutsRes.data || []
  const allCaptures = allCapturesRes.data || []
  const allXpEvents = allXpRes.data || []

  // Compute XP Breakdown & Level State at the time of this workout
  // To get exact level at THIS workout, we find total XP up to this workout.
  const xpUpToThis = allXpEvents
    .filter(e => new Date(e.created_at).getTime() <= new Date(workout.ended_at || workout.started_at).getTime())
    .reduce((sum, e) => sum + (e.xp_awarded || 0), 0)
    
  // If no xp_events fallback to sum of workout xp up to this
  const fallbackXpUpToThis = xpUpToThis > 0 ? xpUpToThis : allWorkouts
    .filter(w => new Date(w.started_at).getTime() <= new Date(workout.ended_at || workout.started_at).getTime())
    .reduce((sum, w) => sum + (w.xp_awarded || 0), 0)
    
  const progress = getXpProgress(fallbackXpUpToThis)
  
  // Actually breakdown for this workout specifically
  const baseXp = calculateWorkoutXP(workout.distance_m || 0)
  const captureXp = calculateCaptureXP(claimed)
  const stealXp = calculateStealXP(stolen)
  const totalXp = workout.xp_awarded ?? (baseXp + captureXp + stealXp)

  const xpBreakdown: WorkoutXpBreakdown = {
    baseXp,
    captureXp,
    stealXp,
    totalXp,
    levelReached: progress.currentLevel,
    progressPct: progress.progressPercent
  }

  // Compute PRs
  const prs = getPersonalRecords(allWorkouts, allCaptures)
  const prFlags: WorkoutPrFlags = {
    fastest1k: prs.find(r => r.id === 'fastest-1k')?.workoutId === workoutId,
    fastest5k: prs.find(r => r.id === 'fastest-5k')?.workoutId === workoutId,
    fastest10k: prs.find(r => r.id === 'fastest-10k')?.workoutId === workoutId,
    longestRun: prs.find(r => r.id === 'longest-run')?.workoutId === workoutId,
    mostXp: prs.find(r => r.id === 'most-xp-workout')?.workoutId === workoutId,
    mostTerritory: prs.find(r => r.id === 'most-territory-workout')?.workoutId === workoutId,
    mostEfficient: prs.find(r => r.id === 'most-efficient-run')?.workoutId === workoutId,
    territoryEfficiency: prs.find(r => r.id === 'territory-efficiency')?.workoutId === workoutId,
    records: prs.filter(r => r.workoutId === workoutId)
  }

  // Compute Achievements
  // Calculate user total XP for getAchievements
  const userTotalXp = allWorkouts.reduce((sum, w) => sum + (w.xp_awarded || 0), 0)
  const userLevel = getLevelFromXP(userTotalXp)
  
  const allAchievements = getAchievements(allWorkouts, allCaptures, userTotalXp, userLevel, allXpEvents)
  
  // Determine achievements unlocked exactly on this workout
  const achievementsUnlocked = allAchievements.filter(ach => {
    if (!ach.unlocked || !ach.unlockedAt) return false
    // It was unlocked on this workout if the unlockedAt matches this workout's started_at
    // Or if unlockedAt matches any of this workout's captures
    if (ach.unlockedAt === workout.started_at) return true
    if (territoryCaptures.some(c => c.capturedAt === ach.unlockedAt)) return true
    if (xpEvents.some(e => e.created_at === ach.unlockedAt)) return true
    return false
  })

  return {
    id: workout.id,
    status: workout.status,
    startedAt: workout.started_at,
    endedAt: workout.ended_at,
    distanceM: workout.distance_m || 0,
    durationS: workout.duration_s || 0,
    avgPaceSPerKm: workout.avg_pace_s_per_km || 0,
    routePoints,
    territoryCaptures,
    territoryBreakdown,
    xpBreakdown,
    achievementsUnlocked,
    prFlags
  }
}
