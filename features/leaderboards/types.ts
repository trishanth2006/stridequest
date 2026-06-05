/**
 * Leaderboards domain types (02E-06). Read-only rankings computed dynamically
 * from existing data — no new tables, no persistence.
 *
 * The ranking functions in `services/leaderboards.ts` are pure and operate over
 * the *input* row shapes below (mapped from DB rows by the server-only loader in
 * `data/load-leaderboards.ts`). The *output* shapes (LeaderboardEntry etc.) are
 * what the UI renders.
 */

/** The four ranking dimensions exposed in the MVP. */
export type LeaderboardCategory = 'xp' | 'territory' | 'distance' | 'weekly'

/** One ranked row in a leaderboard table. */
export type LeaderboardEntry = {
  rank: number
  userId: string
  username: string
  value: number
  isCurrentUser: boolean
}

/** Header summary for a single category board. */
export type LeaderboardSummary = {
  category: LeaderboardCategory
  totalParticipants: number
  currentUserRank?: number
}

/** Top territory owner (the "Territory King"). */
export type TerritoryKing = {
  userId: string
  username: string
  territoryCount: number
}

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
