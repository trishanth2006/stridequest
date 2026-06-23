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

// ---------------------------------------------------------------------------
// Input row shapes (mapped from DB rows by the loader; consumed by pure services).
// ---------------------------------------------------------------------------

/** A participant: their identity + account age (createdAt is tie-break #2). */
export type LeaderboardUser = {
  userId: string
  username: string
  createdAt: string
}

/** A user's cumulative XP (`user_xp`); updatedAt is the XP achievement date. */
export type XpStanding = {
  userId: string
  totalXp: number
  updatedAt: string
}

/** One completed workout's distance contribution; startedAt is the achievement date. */
export type DistanceContribution = {
  userId: string
  distanceM: number
  startedAt: string
}

/** One owned cell (`cell_ownership`); updatedAt is the territory achievement date. */
export type CellOwnership = {
  ownerUserId: string
  updatedAt: string
}

/** One XP award (`xp_events`); createdAt scopes the current week + achievement date. */
export type WeeklyXpEvent = {
  userId: string
  xpAwarded: number
  createdAt: string
}
