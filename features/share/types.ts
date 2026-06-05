export type ShareCardType =
  | 'workout'
  | 'level-up'
  | 'achievement'
  | 'personal-record'

export type ShareTheme =
  | 'midnight'
  | 'territory'
  | 'minimal'
  | 'retro'

export type ShareLayout =
  | 'classic'
  | 'territory'
  | 'achievement'
  | 'record'
  | 'hero-route'

export type ShareAspectRatio =
  | 'square'    // 1080 x 1080
  | 'portrait'  // 1080 x 1920 (IG Story)
  | 'landscape' // 1200 x 628 (Twitter)

export interface ShareConfig {
  theme: ShareTheme
  layout: ShareLayout
  aspectRatio: ShareAspectRatio
  showDistance: boolean
  showDuration: boolean
  showPace: boolean
  showXp: boolean
  showLevel: boolean
  showTerritories: boolean
  showRoute: boolean
  routeColor: string
  routeThickness: number
  showTerritoryOverlay: boolean
  showBranding: boolean
  transparentBackground: boolean
}

export interface ShareCardMetadata {
  generatedAt: string
  strideQuestVersion: string
}

// Internal models that back the ShareCardPreview
export interface BaseShareCard {
  type: ShareCardType
  metadata: ShareCardMetadata
  headline: string
}

export interface WorkoutShareCard extends BaseShareCard {
  type: 'workout'
  distance?: number // meters
  duration?: number // seconds
  pace?: number // seconds per km
  xp?: number
  territoriesCaptured?: number
  territoriesStolen?: number
  level?: number
  date?: string
  routeData?: { lat: number; lng: number }[]
  territoryMarkers?: { lat: number; lng: number, action: 'claim' | 'steal' }[]
  hasPr?: boolean
}

export interface LevelUpCard extends BaseShareCard {
  type: 'level-up'
  previousLevel: number
  currentLevel: number
  totalXp: number
}

export interface AchievementCard extends BaseShareCard {
  type: 'achievement'
  achievementTitle: string
  achievementDescription: string
  achievementCategory: string
}

export interface PersonalRecordCard extends BaseShareCard {
  type: 'personal-record'
  recordTitle: string
  recordValue: string
  achievedAt: string
}

export type AnyShareCard = WorkoutShareCard | LevelUpCard | AchievementCard | PersonalRecordCard
