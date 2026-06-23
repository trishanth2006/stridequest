/**
 * Server-only leaderboard data loader.
 *
 * Calls the security-definer RPCs via the standard authenticated Supabase
 * server client. No service-role key needed — the RPCs bypass RLS internally
 * and return only the minimal ranked data (rank / user_id / username / value).
 */
import { createClient } from '@/infrastructure/supabase/server'
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

/**
 * Fetches one page of ranked entries for the given category.
 * Sets `isCurrentUser` based on `currentUserId` (the caller's auth.uid).
 */
export async function loadLeaderboardEntries(
  category: LeaderboardCategory,
  currentUserId: string,
  limit = 50,
  offset = 0,
): Promise<LeaderboardEntry[]> {
  const supabase = await createClient()
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

/**
 * Returns the authenticated caller's rank, percentile, and next-rank milestone.
 * Returns the zeroed unranked shape when the caller has no score in this category.
 */
export async function loadMyRank(category: LeaderboardCategory): Promise<MyRank> {
  const supabase = await createClient()
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
