/**
 * Pure leaderboard helpers. Ranking is owned by the DB (get_leaderboard RPC).
 * These derive UI summary data from an already-ranked entry list.
 */
import type { LeaderboardCategory, LeaderboardEntry, LeaderboardSummary, TerritoryKing } from '@stridequest/shared'

/** Header summary for a ranked board: participant count + current user rank. */
export function getLeaderboardSummary(
  category: LeaderboardCategory,
  entries: LeaderboardEntry[],
): LeaderboardSummary {
  const currentUser = entries.find((e) => e.isCurrentUser)
  return {
    category,
    totalParticipants: entries.length,
    currentUserRank: currentUser?.rank,
  }
}

/** Top territory owner from a ranked territory entry list, or null if empty. */
export function getTerritoryKing(entries: LeaderboardEntry[]): TerritoryKing | null {
  const top = entries[0]
  if (!top) return null
  return {
    userId: top.userId,
    username: top.username,
    territoryCount: top.value,
  }
}
