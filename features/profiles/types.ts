import type { Achievement } from '@/features/achievements/types'

export type RunnerProfile = {
  userId: string
  username: string

  level: number
  totalXp: number

  territoriesOwned: number
  territoriesCaptured: number
  territoriesStolen: number

  totalDistanceM: number
  totalWorkouts: number

  achievementCount: number

  longestRunM?: number

  fastest1K?: number
  fastest5K?: number
  fastest10K?: number

  leaderboardRank?: number

  topAchievements: Achievement[]
  profileCompletion: number
}

export type RecentActivity = {
  id: string
  type: 'workout' | 'capture' | 'achievement'
  title: string
  createdAt: string
  // Additional optional raw data to aid rendering
  workoutId?: string
  xpAwarded?: number
  distanceM?: number
}
