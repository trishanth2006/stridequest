/**
 * Mobile workout detail loader — mirrors getWorkoutDetail from
 * features/running/services/workout-detail.ts, using the mobile supabase client.
 *
 * Pure analytics functions (calculateSplits, buildInsights, etc.) are local
 * copies that will move to packages/shared in Sprint 5.
 */
import { supabase } from '@/lib/supabase'
import {
  calculateSplits,
  calculateElevation,
  buildChartSeries,
  mapCaptureDistances,
  buildInsights,
  getPersonalRecords,
  computeAchievements,
  buildComparison,
  type WorkoutRoutePoint,
  type WorkoutSplit,
  type WorkoutElevation,
  type WorkoutChartPoint,
  type WorkoutInsight,
  type PersonalRecord,
  type RecordWorkoutRow,
  type Achievement,
  type WorkoutComparison,
  type WorkoutPrFlags,
  type CaptureRow,
  type XpEventRow,
  type CompletedWorkoutLite,
  type RouteAnchor,
  type PRCaptureRow,
} from '@stridequest/shared/analytics'

// ── Types ────────────────────────────────────────────────────────────────────

export type TerritoryAction = 'claim' | 'steal' | 'defend'

export type WorkoutTerritoryCapture = {
  id: string
  cellId: string
  action: TerritoryAction
  capturedAt: string
}

export type WorkoutTerritoryBreakdown = {
  claimed: number
  stolen: number
  defended: number
  totalImpact: number
}

export type WorkoutXpBreakdown = {
  baseXp: number
  captureXp: number
  stealXp: number
  totalXp: number
}

export type MobileWorkoutDetail = {
  id: string
  status: string
  startedAt: string
  endedAt: string | null
  distanceM: number
  durationS: number
  avgPaceSPerKm: number
  routePoints: WorkoutRoutePoint[]
  territoryCaptures: WorkoutTerritoryCapture[]
  territoryBreakdown: WorkoutTerritoryBreakdown
  xpBreakdown: WorkoutXpBreakdown
  splits: WorkoutSplit[]
  elevation: WorkoutElevation
  insights: WorkoutInsight[]
  chartSeries: WorkoutChartPoint[]
  achievementsUnlocked: Achievement[]
  prFlags: WorkoutPrFlags
  comparison: WorkoutComparison
  personalRecords: PersonalRecord[] // Keeping this for backward compatibility in [id].tsx until we update it
}

// ── XP helpers (match website calculations) ──────────────────────────────────

const XP_PER_KM = 10
const XP_PER_CLAIM = 5
const XP_PER_STEAL = 10

function calculateBaseXp(distanceM: number): number {
  return Math.floor((distanceM / 1000) * XP_PER_KM)
}
function calculateCaptureXp(claimed: number): number {
  return claimed * XP_PER_CLAIM
}
function calculateStealXp(stolen: number): number {
  return stolen * XP_PER_STEAL
}


// ── Main loader ──────────────────────────────────────────────────────────────

export async function getMobileWorkoutDetail(
  workoutId: string,
): Promise<MobileWorkoutDetail | null> {
  // 1. Workout record
  const { data: workout, error: workoutErr } = await supabase
    .from('workouts')
    .select('id, started_at, ended_at, distance_m, duration_s, avg_pace_s_per_km, xp_awarded, status')
    .eq('id', workoutId)
    .single()

  if (workoutErr || !workout) return null

  // 2. Route points, captures, xp events, all workouts for PRs (parallel)
  const [routeRes, capturesRes, allWorkoutsRes, allCapturesRes, xpRes, xpEventsRes, anchorsRes] = await Promise.all([
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
      .from('workouts')
      .select('id, started_at, distance_m, duration_s, avg_pace_s_per_km, xp_awarded, status')
      .eq('status', 'completed'),
    supabase
      .from('territory_captures')
      .select('cell_id, captured_at, action, workout_id'),
    supabase
      .from('user_xp')
      .select('total_xp'),
    supabase
      .from('xp_events')
      .select('xp_awarded, created_at, event_type, workout_id'),
    supabase
      .rpc('get_workout_route_anchors')
  ])

  const fullRoutePoints: WorkoutRoutePoint[] = (routeRes.data ?? []).map((p) => ({
    lat: p.lat,
    lng: p.lng,
    altitude: p.altitude_m,
    timestamp: p.recorded_at,
  }))

  const territoryCaptures: WorkoutTerritoryCapture[] = (capturesRes.data ?? []).map((c) => ({
    id: c.id,
    cellId: c.cell_id,
    action: c.action as TerritoryAction,
    capturedAt: c.captured_at,
  }))

  // 3. Territory breakdown
  const claimed = territoryCaptures.filter((c) => c.action === 'claim').length
  const stolen = territoryCaptures.filter((c) => c.action === 'steal').length
  const defended = territoryCaptures.filter((c) => c.action === 'defend').length
  const territoryBreakdown: WorkoutTerritoryBreakdown = {
    claimed,
    stolen,
    defended,
    totalImpact: claimed + stolen + defended,
  }

  // 4. XP breakdown
  const baseXp = calculateBaseXp(workout.distance_m ?? 0)
  const captureXp = calculateCaptureXp(claimed)
  const stealXp = calculateStealXp(stolen)
  const totalXp = (workout.xp_awarded as number | null) ?? baseXp + captureXp + stealXp
  const xpBreakdown: WorkoutXpBreakdown = { baseXp, captureXp, stealXp, totalXp }

  // 5. Telemetry analytics
  const distanceM = (workout.distance_m as number | null) ?? 0
  const splits = calculateSplits(fullRoutePoints, distanceM)
  const elevation = calculateElevation(fullRoutePoints)
  const chartSeries = buildChartSeries(fullRoutePoints)

  // 6. Insights
  const captureCoords = territoryCaptures
    .filter((c) => c.action === 'claim' || c.action === 'steal')
    .map(() => ({ lat: 0, lng: 0 })) // cell centres not available without h3-js — use count-based insight
  const captureDistancesM = mapCaptureDistances(fullRoutePoints, captureCoords)
  const insights = buildInsights({
    splits,
    distanceM,
    totalXp,
    cellsCaptured: claimed + stolen,
    captureDistancesM,
  })

  // 7. Personal records
  const allWorkouts = (allWorkoutsRes.data ?? []) as any[]
  const allCaptures = (allCapturesRes.data ?? []) as any[]
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

  // 8. Achievements
  const userTotalXp = (xpRes.data?.[0]?.total_xp as number | null) ?? 0
  const xpEvents = (xpEventsRes.data ?? []) as XpEventRow[]
  // @ts-ignore
  const allAchievements = computeAchievements(allWorkouts, allCaptures, userTotalXp, xpEvents)
  
  const achievementsUnlocked = allAchievements.filter(ach => {
    if (!ach.unlocked || !ach.unlockedAt) return false
    if (ach.unlockedAt === workout.started_at) return true
    if (territoryCaptures.some(c => c.capturedAt === ach.unlockedAt)) return true
    if (xpEvents.some(e => e.created_at === ach.unlockedAt && e.workout_id === workoutId)) return true
    return false
  })

  // 9. Comparison
  const toLite = (w: typeof allWorkouts[0]): CompletedWorkoutLite => ({
    id: w.id,
    startedAt: w.started_at,
    distanceM: w.distance_m || 0,
    durationS: w.duration_s || 0,
    paceSPerKm: w.avg_pace_s_per_km || 0,
    xp: w.xp_awarded || 0
  })

  const anchors: RouteAnchor[] = (anchorsRes.data || []).map((a: any) => ({
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
      durationS: workout.duration_s ?? 0,
      paceSPerKm: workout.avg_pace_s_per_km ?? 0,
      xp: totalXp
    },
    currentAnchor,
    allWorkouts.map(toLite),
    anchors
  )

  return {
    id: workout.id,
    status: workout.status,
    startedAt: workout.started_at,
    endedAt: (workout.ended_at as string | null),
    distanceM,
    durationS: (workout.duration_s as number | null) ?? 0,
    avgPaceSPerKm: (workout.avg_pace_s_per_km as number | null) ?? 0,
    routePoints: fullRoutePoints,
    territoryCaptures,
    territoryBreakdown,
    xpBreakdown,
    splits,
    elevation,
    insights,
    chartSeries,
    personalRecords: prFlags.records,
    achievementsUnlocked,
    comparison,
    prFlags
  }
}
