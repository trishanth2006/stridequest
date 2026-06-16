import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/infrastructure/supabase/database.types'
import type {
  WorkoutDetail,
  WorkoutRoutePoint,
  WorkoutTerritoryCapture,
  WorkoutTerritoryBreakdown,
  WorkoutXpBreakdown,
  WorkoutPrFlags,
  TerritoryAction,
} from '../types/workout-detail'
import { getAchievements, getPersonalRecords } from '@/features/achievements/services/achievements'
import { getLevelFromXP, getXpProgress, calculateWorkoutXP, calculateCaptureXP, calculateStealXP } from '@/features/xp/services/xp'
import {
  calculateSplits,
  calculateElevation,
  buildChartSeries,
  downsamplePath,
  mapCaptureDistances,
} from '../utils/telemetry'
import { buildInsights } from '../utils/insights'
import { buildComparison, type CompletedWorkoutLite, type RouteAnchor } from '../utils/comparison'
import { cellToLatLng } from 'h3-js'

/** Max polyline points sent to the client for map/share rendering. */
const MAP_MAX_POINTS = 2000

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
      .select('lat, lng, altitude_m, recorded_at')
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

  // Full-resolution stream — used for all server-side aggregation below.
  const fullRoutePoints = (routeRes.data || []).map(p => ({
    lat: p.lat,
    lng: p.lng,
    altitude: p.altitude_m,
    timestamp: p.recorded_at
  })) as WorkoutRoutePoint[]

  const territoryCaptures = (capturesRes.data || []).map(c => {
    const [lat, lng] = cellToLatLng(c.cell_id)
    return {
      id: c.id,
      cellId: c.cell_id,
      lat,
      lng,
      action: c.action as TerritoryAction,
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

  // 3. Fetch user's total history for Achievements, PRs and comparison, plus
  //    route anchors (start/end of each completed run) for route-matching.
  //    RLS scopes every read to the current user.
  const [allWorkoutsRes, allCapturesRes, allXpRes, anchorsRes] = await Promise.all([
    supabase.from('workouts').select('*').eq('status', 'completed'),
    supabase.from('territory_captures').select('*'),
    supabase.from('xp_events').select('*'),
    supabase.rpc('get_workout_route_anchors')
  ])

  const allWorkouts = allWorkoutsRes.data || []
  const allCaptures = allCapturesRes.data || []
  const allXpEvents = allXpRes.data || []

  // Compute XP Breakdown & Level State at the time of this workout
  const xpUpToThis = allXpEvents
    .filter(e => new Date(e.created_at).getTime() <= new Date(workout.ended_at || workout.started_at).getTime())
    .reduce((sum, e) => sum + (e.xp_awarded || 0), 0)

  const fallbackXpUpToThis = xpUpToThis > 0 ? xpUpToThis : allWorkouts
    .filter(w => new Date(w.started_at).getTime() <= new Date(workout.ended_at || workout.started_at).getTime())
    .reduce((sum, w) => sum + (w.xp_awarded || 0), 0)

  const progress = getXpProgress(fallbackXpUpToThis)

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
  const userTotalXp = allWorkouts.reduce((sum, w) => sum + (w.xp_awarded || 0), 0)
  const userLevel = getLevelFromXP(userTotalXp)

  const allAchievements = getAchievements(allWorkouts, allCaptures, userTotalXp, userLevel, allXpEvents)

  const achievementsUnlocked = allAchievements.filter(ach => {
    if (!ach.unlocked || !ach.unlockedAt) return false
    if (ach.unlockedAt === workout.started_at) return true
    if (territoryCaptures.some(c => c.capturedAt === ach.unlockedAt)) return true
    if (xpEvents.some(e => e.created_at === ach.unlockedAt)) return true
    return false
  })

  // --- Server-side analytics (splits / elevation / charts / insights) --------
  const distanceM = workout.distance_m || 0
  const durationS = workout.duration_s || 0
  const splits = calculateSplits(fullRoutePoints, distanceM)
  const elevation = calculateElevation(fullRoutePoints)
  const chartSeries = buildChartSeries(fullRoutePoints)

  // Spatial mapping: captures share one finalize-transaction timestamp, so we
  // locate each by its cell-centre coordinate, not by time.
  const captureCoords = territoryCaptures
    .filter(c => c.action === 'claim' || c.action === 'steal')
    .map(c => ({ lat: c.lat, lng: c.lng }))
  const captureDistancesM = mapCaptureDistances(fullRoutePoints, captureCoords)

  const insights = buildInsights({
    splits,
    distanceM,
    totalXp,
    cellsCaptured: claimed + stolen,
    captureDistancesM
  })

  // --- Historical comparison -------------------------------------------------
  const toLite = (w: typeof allWorkouts[number]): CompletedWorkoutLite => ({
    id: w.id,
    startedAt: w.started_at,
    distanceM: w.distance_m || 0,
    durationS: w.duration_s || 0,
    paceSPerKm: w.avg_pace_s_per_km || 0,
    xp: w.xp_awarded || 0
  })

  const anchors: RouteAnchor[] = (anchorsRes.data || []).map(a => ({
    workoutId: a.workout_id,
    startLat: a.start_lat,
    startLng: a.start_lng,
    endLat: a.end_lat,
    endLng: a.end_lng
  }))

  const currentAnchor: RouteAnchor | null = fullRoutePoints.length >= 2
    ? {
        workoutId: workout.id,
        startLat: fullRoutePoints[0].lat,
        startLng: fullRoutePoints[0].lng,
        endLat: fullRoutePoints[fullRoutePoints.length - 1].lat,
        endLng: fullRoutePoints[fullRoutePoints.length - 1].lng
      }
    : null

  const comparison = buildComparison(
    {
      id: workout.id,
      startedAt: workout.started_at,
      distanceM,
      durationS,
      paceSPerKm: workout.avg_pace_s_per_km || 0,
      xp: totalXp
    },
    currentAnchor,
    allWorkouts.map(toLite),
    anchors
  )

  // Down-sample the polyline so the client never receives the raw stream.
  const routePoints = downsamplePath(fullRoutePoints, MAP_MAX_POINTS)

  return {
    id: workout.id,
    status: workout.status,
    startedAt: workout.started_at,
    endedAt: workout.ended_at,
    distanceM,
    durationS,
    avgPaceSPerKm: workout.avg_pace_s_per_km || 0,
    routePoints,
    territoryCaptures,
    territoryBreakdown,
    xpBreakdown,
    achievementsUnlocked,
    prFlags,
    splits,
    elevation,
    insights,
    comparison,
    chartSeries
  }
}
