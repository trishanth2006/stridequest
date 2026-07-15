export type LeaderboardCategory = 'xp' | 'territory' | 'distance' | 'weekly'

export interface LeaderboardEntry {
  rank: number
  userId: string
  username: string
  value: number
  /** Set client-side: entry.userId === authedUserId. Not returned by the RPC. */
  isCurrentUser: boolean
}

export interface LeaderboardSummary {
  category: LeaderboardCategory
  totalParticipants: number
  currentUserRank?: number
}

export interface TerritoryKing {
  userId: string
  username: string
  territoryCount: number
}

export interface MyRank {
  /** 0 = unranked sentinel (caller has no score in this category); 1-based otherwise. */
  rank: number
  value: number
  totalUsers: number
  /** 0–100.0; 0 = unranked. */
  percentile: number
  /** Score needed to reach the next rank. null = already rank 1. */
  nextRankValue: number | null
}
