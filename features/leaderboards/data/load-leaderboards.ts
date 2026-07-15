import { createClient } from '@/infrastructure/supabase/server'
import { unstable_cache } from 'next/cache'
import type { LeaderboardEntry, LeaderboardCategory, MyRank } from '@stridequest/shared'
import { mapLeaderboardRows, mapMyRankRow, type RpcLeaderboardRow, type RpcMyRankRow } from '@stridequest/shared'

const getCachedLeaderboardRpc = unstable_cache(
  async (category: LeaderboardCategory, limit: number, offset: number) => {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('get_leaderboard', {
      p_category: category,
      p_limit: limit,
      p_offset: offset,
    })
    if (error) throw new Error(error.message)
    return data as RpcLeaderboardRow[] | null
  },
  ['global-leaderboard'],
  { tags: ['leaderboard'], revalidate: 60 }
)

export async function loadLeaderboardEntries(
  category: LeaderboardCategory,
  currentUserId: string,
  limit = 50,
  offset = 0,
): Promise<LeaderboardEntry[]> {
  const data = await getCachedLeaderboardRpc(category, limit, offset)
  return mapLeaderboardRows(data, currentUserId)
}

export async function loadMyRank(category: LeaderboardCategory): Promise<MyRank> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_my_rank', { p_category: category })
  if (error) throw new Error(error.message)
  const rows = data as RpcMyRankRow[] | null
  return mapMyRankRow(rows?.[0])
}
