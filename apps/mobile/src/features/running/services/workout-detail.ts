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
  computePersonalRecords,
  type WorkoutRoutePoint,
  type WorkoutSplit,
  type WorkoutElevation,
  type WorkoutChartPoint,
  type WorkoutInsight,
  type PersonalRecord,
  type RecordWorkoutRow,
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
  personalRecords: PersonalRecord[]
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
  const [routeRes, capturesRes, allWorkoutsRes] = await Promise.all([
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
  const allWorkouts = (allWorkoutsRes.data ?? []) as RecordWorkoutRow[]
  const personalRecords = computePersonalRecords(allWorkouts, workoutId)

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
    personalRecords,
  }
}
