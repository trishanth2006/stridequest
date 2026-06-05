/**
 * @jest-environment node
 *
 * Unit tests for the pure leaderboard ranking services (02E-06). No I/O — every
 * function operates over plain input arrays mapped from DB rows by the loader.
 */
import {
  getXpLeaderboard,
  getTerritoryLeaderboard,
  getDistanceLeaderboard,
  getWeeklyLeaderboard,
  getLeaderboardSummary,
  getTerritoryKing,
} from '@/features/leaderboards/services/leaderboards'
import type {
  LeaderboardUser,
  XpStanding,
  DistanceContribution,
  CellOwnership,
  WeeklyXpEvent,
} from '@/features/leaderboards/types'

// Stable, well-spaced fixtures. Usernames carry the expected rank for clarity.
const users: LeaderboardUser[] = [
  { userId: 'u-alice', username: 'alice', createdAt: '2026-01-01T00:00:00Z' },
  { userId: 'u-bob', username: 'bob', createdAt: '2026-01-02T00:00:00Z' },
  { userId: 'u-carol', username: 'carol', createdAt: '2026-01-03T00:00:00Z' },
  { userId: 'u-dave', username: 'dave', createdAt: '2026-01-04T00:00:00Z' },
]

describe('getXpLeaderboard', () => {
  const standings: XpStanding[] = [
    { userId: 'u-alice', totalXp: 100, updatedAt: '2026-06-01T00:00:00Z' },
    { userId: 'u-bob', totalXp: 500, updatedAt: '2026-06-02T00:00:00Z' },
    { userId: 'u-carol', totalXp: 250, updatedAt: '2026-06-03T00:00:00Z' },
  ]

  it('ranks users by total XP, highest first', () => {
    const board = getXpLeaderboard(users, standings, 'u-carol')
    expect(board.map((e) => e.username)).toEqual(['bob', 'carol', 'alice'])
    expect(board.map((e) => e.rank)).toEqual([1, 2, 3])
    expect(board.map((e) => e.value)).toEqual([500, 250, 100])
  })

  it('flags the current user', () => {
    const board = getXpLeaderboard(users, standings, 'u-carol')
    expect(board.find((e) => e.isCurrentUser)?.username).toBe('carol')
    expect(board.filter((e) => e.isCurrentUser)).toHaveLength(1)
  })

  it('excludes users with zero XP and unknown users', () => {
    const board = getXpLeaderboard(users, standings, null)
    // dave has no standing; nobody has zero — only 3 entries.
    expect(board.map((e) => e.username)).not.toContain('dave')
    expect(board).toHaveLength(3)
  })

  it('returns an empty board when there are no standings', () => {
    expect(getXpLeaderboard(users, [], null)).toEqual([])
  })
})

describe('getTerritoryLeaderboard', () => {
  const cells: CellOwnership[] = [
    { ownerUserId: 'u-alice', updatedAt: '2026-06-01T00:00:00Z' },
    { ownerUserId: 'u-alice', updatedAt: '2026-06-02T00:00:00Z' },
    { ownerUserId: 'u-alice', updatedAt: '2026-06-03T00:00:00Z' },
    { ownerUserId: 'u-bob', updatedAt: '2026-06-04T00:00:00Z' },
  ]

  it('ranks users by owned-cell count, highest first', () => {
    const board = getTerritoryLeaderboard(users, cells, null)
    expect(board.map((e) => e.username)).toEqual(['alice', 'bob'])
    expect(board.map((e) => e.value)).toEqual([3, 1])
  })

  it('returns an empty board when no cells are owned', () => {
    expect(getTerritoryLeaderboard(users, [], null)).toEqual([])
  })
})

describe('getDistanceLeaderboard', () => {
  const contributions: DistanceContribution[] = [
    { userId: 'u-alice', distanceM: 5000, startedAt: '2026-06-01T00:00:00Z' },
    { userId: 'u-alice', distanceM: 3000, startedAt: '2026-06-02T00:00:00Z' },
    { userId: 'u-bob', distanceM: 10000, startedAt: '2026-06-01T00:00:00Z' },
  ]

  it('ranks users by summed distance, highest first', () => {
    const board = getDistanceLeaderboard(users, contributions, null)
    expect(board.map((e) => e.username)).toEqual(['bob', 'alice'])
    expect(board.map((e) => e.value)).toEqual([10000, 8000])
  })
})

describe('getWeeklyLeaderboard', () => {
  // Reference "now": Wed 2026-06-10. ISO week starts Mon 2026-06-08 00:00 UTC.
  const now = new Date('2026-06-10T12:00:00Z')
  const events: WeeklyXpEvent[] = [
    { userId: 'u-alice', xpAwarded: 50, createdAt: '2026-06-09T00:00:00Z' }, // in week
    { userId: 'u-alice', xpAwarded: 30, createdAt: '2026-06-10T00:00:00Z' }, // in week
    { userId: 'u-bob', xpAwarded: 100, createdAt: '2026-06-09T00:00:00Z' }, // in week
    { userId: 'u-carol', xpAwarded: 999, createdAt: '2026-06-07T23:59:59Z' }, // BEFORE week start
  ]

  it('ranks users by XP earned in the current week only', () => {
    const board = getWeeklyLeaderboard(users, events, null, now)
    expect(board.map((e) => e.username)).toEqual(['bob', 'alice'])
    expect(board.map((e) => e.value)).toEqual([100, 80])
    // carol's only event is before the week start → excluded.
    expect(board.map((e) => e.username)).not.toContain('carol')
  })
})

describe('tie-break rules', () => {
  // Three users with identical XP. Determinism must come from the tie-breakers:
  //   1) earlier achievement date (user_xp.updatedAt) wins
  //   2) earlier account creation date wins
  //   3) ascending userId
  it('breaks ties by earlier achievement date first', () => {
    const tie: XpStanding[] = [
      { userId: 'u-alice', totalXp: 200, updatedAt: '2026-06-03T00:00:00Z' },
      { userId: 'u-bob', totalXp: 200, updatedAt: '2026-06-01T00:00:00Z' },
      { userId: 'u-carol', totalXp: 200, updatedAt: '2026-06-02T00:00:00Z' },
    ]
    const board = getXpLeaderboard(users, tie, null)
    expect(board.map((e) => e.username)).toEqual(['bob', 'carol', 'alice'])
  })

  it('falls back to earlier account creation when achievement dates tie', () => {
    const sameDate = '2026-06-01T00:00:00Z'
    const tie: XpStanding[] = [
      { userId: 'u-carol', totalXp: 200, updatedAt: sameDate },
      { userId: 'u-alice', totalXp: 200, updatedAt: sameDate },
      { userId: 'u-bob', totalXp: 200, updatedAt: sameDate },
    ]
    // alice created 01-01, bob 01-02, carol 01-03 → alice, bob, carol.
    const board = getXpLeaderboard(users, tie, null)
    expect(board.map((e) => e.username)).toEqual(['alice', 'bob', 'carol'])
  })

  it('falls back to ascending userId when all dates tie', () => {
    const d = '2026-06-01T00:00:00Z'
    const twins: LeaderboardUser[] = [
      { userId: 'u-zed', username: 'zed', createdAt: d },
      { userId: 'u-amy', username: 'amy', createdAt: d },
    ]
    const tie: XpStanding[] = [
      { userId: 'u-zed', totalXp: 200, updatedAt: d },
      { userId: 'u-amy', totalXp: 200, updatedAt: d },
    ]
    const board = getXpLeaderboard(twins, tie, null)
    expect(board.map((e) => e.userId)).toEqual(['u-amy', 'u-zed'])
  })
})

describe('getLeaderboardSummary', () => {
  const standings: XpStanding[] = [
    { userId: 'u-alice', totalXp: 100, updatedAt: '2026-06-01T00:00:00Z' },
    { userId: 'u-bob', totalXp: 500, updatedAt: '2026-06-02T00:00:00Z' },
    { userId: 'u-carol', totalXp: 250, updatedAt: '2026-06-03T00:00:00Z' },
  ]

  it('reports total participants and the current user rank', () => {
    const board = getXpLeaderboard(users, standings, 'u-alice')
    const summary = getLeaderboardSummary('xp', board)
    expect(summary).toEqual({ category: 'xp', totalParticipants: 3, currentUserRank: 3 })
  })

  it('omits the rank when the current user is not on the board', () => {
    const board = getXpLeaderboard(users, standings, 'u-dave')
    const summary = getLeaderboardSummary('xp', board)
    expect(summary.totalParticipants).toBe(3)
    expect(summary.currentUserRank).toBeUndefined()
  })

  it('computes a rank even when the user is outside the top 10', () => {
    const many: LeaderboardUser[] = Array.from({ length: 15 }, (_, i) => ({
      userId: `u-${String(i).padStart(2, '0')}`,
      username: `user${i}`,
      createdAt: '2026-01-01T00:00:00Z',
    }))
    // Descending XP so user14 is dead last (rank 15).
    const manyStandings: XpStanding[] = many.map((u, i) => ({
      userId: u.userId,
      totalXp: (15 - i) * 100,
      updatedAt: '2026-06-01T00:00:00Z',
    }))
    const board = getXpLeaderboard(many, manyStandings, 'u-14')
    const summary = getLeaderboardSummary('xp', board)
    expect(summary.currentUserRank).toBe(15)
  })
})

describe('getTerritoryKing', () => {
  it('returns the top territory owner', () => {
    const cells: CellOwnership[] = [
      { ownerUserId: 'u-alice', updatedAt: '2026-06-01T00:00:00Z' },
      { ownerUserId: 'u-alice', updatedAt: '2026-06-02T00:00:00Z' },
      { ownerUserId: 'u-bob', updatedAt: '2026-06-03T00:00:00Z' },
    ]
    expect(getTerritoryKing(users, cells)).toEqual({
      userId: 'u-alice',
      username: 'alice',
      territoryCount: 2,
    })
  })

  it('returns null when nobody owns territory', () => {
    expect(getTerritoryKing(users, [])).toBeNull()
  })
})
