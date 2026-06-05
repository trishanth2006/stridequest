/**
 * Pure leaderboard ranking logic (02E-06). Deterministic, read-only, no I/O —
 * every function ranks plain input arrays mapped from DB rows by the loader
 * (`data/load-leaderboards.ts`). Mirrors the achievements-service pattern.
 *
 * Sources (per the phase spec):
 *   - XP:        user_xp.total_xp
 *   - territory: owned-cell count from cell_ownership
 *   - distance:  sum(distance_m) over completed workouts
 *   - weekly:    XP earned in the current ISO week from xp_events
 *
 * Tie-break (deterministic total order), applied to equal values:
 *   1. earlier "achievement date" wins (the moment the user reached the value —
 *      the latest contributing timestamp for that category)
 *   2. earlier account creation date wins
 *   3. ascending userId
 *
 * Users with a non-positive value in a category are excluded from that board.
 */
import type {
  LeaderboardCategory,
  LeaderboardEntry,
  LeaderboardSummary,
  LeaderboardUser,
  XpStanding,
  DistanceContribution,
  CellOwnership,
  WeeklyXpEvent,
  TerritoryKing,
} from '@/features/leaderboards/types'

/** A user's score in one category, before ranking. */
type Scored = {
  userId: string
  value: number
  /** When the user reached `value` (tie-break #1); null sorts last. */
  achievementDate: string | null
}

const MS_PER_DAY = 86_400_000

function toMs(date: string | null): number {
  if (date === null) return Number.POSITIVE_INFINITY
  const ms = Date.parse(date)
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms
}

/** Monday 00:00:00.000 UTC of the week containing `now`. */
export function startOfIsoWeekUtc(now: Date): Date {
  const midnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
  const dow = midnight.getUTCDay() // 0=Sun … 6=Sat
  const daysSinceMonday = dow === 0 ? 6 : dow - 1
  return new Date(midnight.getTime() - daysSinceMonday * MS_PER_DAY)
}

/**
 * Joins scores to users, drops non-positive / unknown users, applies the
 * tie-break order, and assigns sequential ranks.
 */
function rankScored(
  users: LeaderboardUser[],
  scored: Scored[],
  currentUserId: string | null,
): LeaderboardEntry[] {
  const userMap = new Map(users.map((u) => [u.userId, u]))

  const ranked = scored
    .filter((s) => s.value > 0 && userMap.has(s.userId))
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value

      const ad = toMs(a.achievementDate)
      const bd = toMs(b.achievementDate)
      if (ad !== bd) return ad - bd

      const ac = toMs(userMap.get(a.userId)!.createdAt)
      const bc = toMs(userMap.get(b.userId)!.createdAt)
      if (ac !== bc) return ac - bc

      return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0
    })

  return ranked.map((s, i) => {
    const user = userMap.get(s.userId)!
    return {
      rank: i + 1,
      userId: s.userId,
      username: user.username,
      value: s.value,
      isCurrentUser: s.userId === currentUserId,
    }
  })
}

/**
 * Aggregates rows keyed by user into a single score per user, summing `value`
 * and keeping the latest contributing date as the achievement date.
 */
function aggregate(
  rows: { userId: string; value: number; date: string }[],
): Scored[] {
  const byUser = new Map<string, Scored>()
  for (const row of rows) {
    const existing = byUser.get(row.userId)
    if (!existing) {
      byUser.set(row.userId, {
        userId: row.userId,
        value: row.value,
        achievementDate: row.date,
      })
    } else {
      existing.value += row.value
      if (toMs(row.date) > toMs(existing.achievementDate)) {
        existing.achievementDate = row.date
      }
    }
  }
  return [...byUser.values()]
}

/** Rank by cumulative XP (`user_xp.total_xp`), highest first. */
export function getXpLeaderboard(
  users: LeaderboardUser[],
  standings: XpStanding[],
  currentUserId: string | null,
): LeaderboardEntry[] {
  const scored: Scored[] = standings.map((s) => ({
    userId: s.userId,
    value: s.totalXp,
    achievementDate: s.updatedAt,
  }))
  return rankScored(users, scored, currentUserId)
}

/** Rank by owned-cell count (`cell_ownership`), highest first. */
export function getTerritoryLeaderboard(
  users: LeaderboardUser[],
  cells: CellOwnership[],
  currentUserId: string | null,
): LeaderboardEntry[] {
  const scored = aggregate(
    cells.map((c) => ({ userId: c.ownerUserId, value: 1, date: c.updatedAt })),
  )
  return rankScored(users, scored, currentUserId)
}

/** Rank by summed distance over completed workouts, highest first. */
export function getDistanceLeaderboard(
  users: LeaderboardUser[],
  contributions: DistanceContribution[],
  currentUserId: string | null,
): LeaderboardEntry[] {
  const scored = aggregate(
    contributions.map((c) => ({
      userId: c.userId,
      value: c.distanceM,
      date: c.startedAt,
    })),
  )
  return rankScored(users, scored, currentUserId)
}

/** Rank by XP earned in the current ISO week (`xp_events`), highest first. */
export function getWeeklyLeaderboard(
  users: LeaderboardUser[],
  events: WeeklyXpEvent[],
  currentUserId: string | null,
  now: Date,
): LeaderboardEntry[] {
  const weekStart = startOfIsoWeekUtc(now).getTime()
  const nowMs = now.getTime()
  const inWeek = events.filter((e) => {
    const t = toMs(e.createdAt)
    return t >= weekStart && t <= nowMs
  })
  const scored = aggregate(
    inWeek.map((e) => ({
      userId: e.userId,
      value: e.xpAwarded,
      date: e.createdAt,
    })),
  )
  return rankScored(users, scored, currentUserId)
}

/** Header summary for a ranked board (participant count + current user rank). */
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

/** The top territory owner, or null when nobody owns any cells. */
export function getTerritoryKing(
  users: LeaderboardUser[],
  cells: CellOwnership[],
): TerritoryKing | null {
  const board = getTerritoryLeaderboard(users, cells, null)
  const top = board[0]
  if (!top) return null
  return {
    userId: top.userId,
    username: top.username,
    territoryCount: top.value,
  }
}
