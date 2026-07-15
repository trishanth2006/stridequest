import type { LeaderboardEntry, MyRank } from './types'

export type RpcLeaderboardRow = {
  rank: number
  user_id: string
  username: string
  value: number
}

export type RpcMyRankRow = {
  rank: number
  value: number
  total_users: number
  percentile: string | number
  next_rank_value: number | null
}

export function mapLeaderboardRows(
  data: RpcLeaderboardRow[] | null,
  currentUserId: string,
): LeaderboardEntry[] {
  return (data ?? []).map((row) => ({
    rank: row.rank,
    userId: row.user_id,
    username: row.username,
    value: row.value,
    isCurrentUser: row.user_id === currentUserId,
  }))
}

export function mapMyRankRow(row: RpcMyRankRow | undefined): MyRank {
  if (!row) return { rank: 0, value: 0, totalUsers: 0, percentile: 0, nextRankValue: null }
  return {
    rank: row.rank,
    value: row.value,
    totalUsers: row.total_users,
    percentile: Number(row.percentile),
    nextRankValue: row.next_rank_value ?? null,
  }
}
