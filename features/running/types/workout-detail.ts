import type { Achievement, PersonalRecord } from '@/features/achievements/types'
export type { ComparisonDeltas, WorkoutComparisonEntry, WorkoutRouteMatch, WorkoutComparison, WorkoutPrFlags } from '@stridequest/shared/analytics'

export type WorkoutRoutePoint = {
  lat: number
  lng: number
  timestamp: string
  /** GPS altitude in metres; null when the device did not report one. */
  altitude: number | null
}

/** One pace split (full km, adaptive sub-km bucket, or final partial). */
export type WorkoutSplit = {
  index: number
  distanceM: number
  durationS: number
  paceSPerKm: number
  isFastest: boolean
  isSlowest: boolean
}

/** Elevation summary derived from smoothed, noise-thresholded altitude. */
export type WorkoutElevation = {
  hasData: boolean
  gainM: number
  lossM: number
  highestM: number | null
  lowestM: number | null
}

/** A single downsampled sample for the pace / speed / elevation charts. */
export type WorkoutChartPoint = {
  distanceKm: number
  timeS: number
  /** Smoothed pace in min/km, capped so stoppages don't break the axis. */
  pace: number
  /** Smoothed speed in km/h. */
  speed: number
  altitude: number | null
}

/** One deterministic insight card (no LLM, no network). */
export type WorkoutInsight = {
  id: string
  label: string
  value: string
  detail: string | null
}


export type TerritoryAction = 'claim' | 'steal' | 'defend'

export type WorkoutTerritoryCapture = {
  id: string
  cellId: string
  lat: number
  lng: number
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
  levelReached: number
  progressPct: number
}

export type WorkoutDetail = {
  id: string
  status: string
  startedAt: string
  endedAt: string | null
  distanceM: number
  durationS: number
  avgPaceSPerKm: number
  
  /** Downsampled polyline for map + share rendering (not the raw stream). */
  routePoints: WorkoutRoutePoint[]

  territoryCaptures: WorkoutTerritoryCapture[]
  territoryBreakdown: WorkoutTerritoryBreakdown

  xpBreakdown: WorkoutXpBreakdown

  achievementsUnlocked: Achievement[]
  prFlags: WorkoutPrFlags

  // Server-computed analytics (Phase: Run Detail upgrade).
  splits: WorkoutSplit[]
  elevation: WorkoutElevation
  insights: WorkoutInsight[]
  comparison: WorkoutComparison
  chartSeries: WorkoutChartPoint[]
}
