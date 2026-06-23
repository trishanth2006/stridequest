/**
 * @jest-environment node
 *
 * Tests for the simplified leaderboard service after Phase 4.
 * The DB owns ranking; these test only the two helper functions
 * that derive UI summary data from an already-ranked entry list.
 */
import { getLeaderboardSummary, getTerritoryKing } from '@/features/leaderboards/services/leaderboards'
import type { LeaderboardEntry } from '@stridequest/shared'

function entry(overrides: {
  rank: number
  userId: string
  username: string
  value: number
  isCurrentUser?: boolean
}): LeaderboardEntry {
  return { isCurrentUser: false, ...overrides }
}

describe('getLeaderboardSummary', () => {
  it('counts all entries as total participants', () => {
    const entries = [
      entry({ rank: 1, userId: 'u1', username: 'alice', value: 500 }),
      entry({ rank: 2, userId: 'u2', username: 'bob',   value: 250 }),
    ]
    const summary = getLeaderboardSummary('xp', entries)
    expect(summary.totalParticipants).toBe(2)
    expect(summary.category).toBe('xp')
  })

  it('sets currentUserRank from the isCurrentUser entry', () => {
    const entries = [
      entry({ rank: 1, userId: 'u1', username: 'alice', value: 500 }),
      entry({ rank: 2, userId: 'u2', username: 'bob',   value: 250, isCurrentUser: true }),
    ]
    expect(getLeaderboardSummary('xp', entries).currentUserRank).toBe(2)
  })

  it('returns undefined currentUserRank when current user is not on this page', () => {
    const entries = [entry({ rank: 1, userId: 'u1', username: 'alice', value: 500 })]
    expect(getLeaderboardSummary('xp', entries).currentUserRank).toBeUndefined()
  })

  it('handles empty board', () => {
    const s = getLeaderboardSummary('weekly', [])
    expect(s.totalParticipants).toBe(0)
    expect(s.currentUserRank).toBeUndefined()
  })
})

describe('getTerritoryKing', () => {
  it('returns rank-1 entry as TerritoryKing', () => {
    const entries = [
      entry({ rank: 1, userId: 'u1', username: 'alice', value: 42 }),
      entry({ rank: 2, userId: 'u2', username: 'bob',   value: 20 }),
    ]
    expect(getTerritoryKing(entries)).toEqual({
      userId: 'u1', username: 'alice', territoryCount: 42,
    })
  })

  it('returns null for empty entry list', () => {
    expect(getTerritoryKing([])).toBeNull()
  })
})
