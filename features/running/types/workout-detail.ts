import type { Achievement, PersonalRecord } from '@/features/achievements/types'

export type WorkoutRoutePoint = {
  lat: number
  lng: number
  timestamp: string
}

export type TerritoryAction = 'claim' | 'steal' | 'defend'

export type WorkoutTerritoryCapture = {
  id: string
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

export type WorkoutPrFlags = {
  fastest1k: boolean
  fastest5k: boolean
  fastest10k: boolean
  longestRun: boolean
  mostXp: boolean
  mostTerritory: boolean
  mostEfficient: boolean
  territoryEfficiency: boolean
  records: PersonalRecord[]
}

export type WorkoutDetail = {
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
  
  achievementsUnlocked: Achievement[]
  prFlags: WorkoutPrFlags
}
