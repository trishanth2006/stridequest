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
  | 'hero-route'
  | 'territory'

export type ShareAspectRatio =
  | 'square'    // 1080 x 1080
  | 'portrait'  // 1080 x 1920 (IG Story)
  | 'landscape' // 1200 x 628 (Twitter)

export interface ShareConfig {
  theme: ShareTheme
  layout: ShareLayout // internal: set by entry-point preset or the workout Card Style radio
  aspectRatio: ShareAspectRatio
  showPreviousRecord: boolean
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
  totalTerritory?: number // Added for Territory Conquest layout
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
  xpToNextLevel?: number
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
  previousRecordValue?: string // Added for new design
  hasNewRecord?: boolean // Added for new design
  achievedAt: string
}

export type AnyShareCard = WorkoutShareCard | LevelUpCard | AchievementCard | PersonalRecordCard
