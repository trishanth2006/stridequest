import { supabase } from '@/lib/supabase'
import type { LeaderboardEntry, LeaderboardCategory, MyRank } from '@stridequest/shared'
import { mapLeaderboardRows, mapMyRankRow, type RpcLeaderboardRow, type RpcMyRankRow } from '@stridequest/shared'

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
  return mapLeaderboardRows(data as RpcLeaderboardRow[] | null, currentUserId)
}

export async function fetchMyRank(category: LeaderboardCategory): Promise<MyRank> {
  const { data, error } = await supabase.rpc('get_my_rank', { p_category: category })
  if (error) throw new Error(error.message)
  const rows = data as RpcMyRankRow[] | null
  return mapMyRankRow(rows?.[0])
}
