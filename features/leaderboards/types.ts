/**
 * Leaderboard domain types.
 *
 * Output types (what the UI renders) are re-exported from @stridequest/shared.
 * Input shapes (mapped from DB rows by the server-only loader) live here until
 * the service-role loader is replaced by RPC calls in the Phase 4 refactor.
 */

// ── Output types (shared; consumed by web + mobile) ──────────────────────────
export type {
  LeaderboardCategory,
  LeaderboardEntry,
  LeaderboardSummary,
  TerritoryKing,
  MyRank,
} from '@stridequest/shared'

// ── Input shapes (server-only; used by load-leaderboards.ts until Phase 4) ───

/** A participant: identity + account age. */
export type LeaderboardUser = {
  userId: string
  username: string
  createdAt: string
}

/** Cumulative XP row from `user_xp`. */
export type XpStanding = {
  userId: string
  totalXp: number
  updatedAt: string
}

/** One completed workout's distance contribution. */
export type DistanceContribution = {
  userId: string
  distanceM: number
  startedAt: string
}

/** One owned cell from `cell_ownership`. */
export type CellOwnership = {
  ownerUserId: string
  updatedAt: string
}

/** One XP award from `xp_events`. */
export type WeeklyXpEvent = {
  userId: string
  xpAwarded: number
  createdAt: string
}
