import { supabase } from '@/lib/supabase'
import type { LeaderboardEntry, LeaderboardCategory, MyRank } from '@stridequest/shared'

type RpcLeaderboardRow = {
  rank: number
  user_id: string
  username: string
  value: number
}

type RpcMyRankRow = {
  rank: number
  value: number
  total_users: number
  percentile: string | number
  next_rank_value: number | null
}

export async function fetchLeaderboard(
  category: LeaderboardCategory,
  currentUserId: string,
  limit = 10,
  offset = 0,
): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('get_leaderboard', {
    p_category: category,
    p_limit: limit,
    p_offset: offset,
  })
  if (error) throw new Error(error.message)
  return (data as RpcLeaderboardRow[] | null ?? []).map((row) => ({
    rank: row.rank,
    userId: row.user_id,
    username: row.username,
    value: row.value,
    isCurrentUser: row.user_id === currentUserId,
  }))
}

export async function fetchMyRank(category: LeaderboardCategory): Promise<MyRank> {
  const { data, error } = await supabase.rpc('get_my_rank', {
    p_category: category,
  })
  if (error) throw new Error(error.message)
  const rows = data as RpcMyRankRow[] | null
  const row = rows?.[0]
  if (!row) {
    return { rank: 0, value: 0, totalUsers: 0, percentile: 0, nextRankValue: null }
  }
  return {
    rank: row.rank,
    value: row.value,
    totalUsers: row.total_users,
    percentile: Number(row.percentile),
    nextRankValue: row.next_rank_value ?? null,
  }
}
