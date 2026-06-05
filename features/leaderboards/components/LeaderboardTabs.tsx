'use client'

import { useState } from 'react'
import type {
  LeaderboardCategory,
  LeaderboardEntry,
  LeaderboardSummary,
} from '@/features/leaderboards/types'
import { LeaderboardTable } from './LeaderboardTable'

export type LeaderboardBoard = {
  category: LeaderboardCategory
  label: string
  summary: LeaderboardSummary
  entries: LeaderboardEntry[]
}

const EMPTY_MESSAGES: Record<LeaderboardCategory, string> = {
  xp: 'No XP earned yet. Complete a workout to climb the ranks.',
  territory: 'No territory claimed yet. Capture cells to appear here.',
  distance: 'No distance logged yet. Record a run to join the board.',
  weekly: 'No XP earned this week yet. Get moving to rank up!',
}

/** Client-side tab switcher over the four pre-computed category boards. */
export function LeaderboardTabs({ boards }: { boards: LeaderboardBoard[] }) {
  const [active, setActive] = useState<LeaderboardCategory>(
    boards[0]?.category ?? 'xp',
  )
  const board = boards.find((b) => b.category === active) ?? boards[0]

  return (
    <div className="flex flex-col gap-5" data-testid="leaderboard-tabs">
      {/* Tab buttons */}
      <div
        role="tablist"
        className="flex flex-wrap gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1"
      >
        {boards.map((b) => {
          const selected = b.category === active
          return (
            <button
              key={b.category}
              role="tab"
              aria-selected={selected}
              data-testid={`leaderboard-tab-${b.category}`}
              onClick={() => setActive(b.category)}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                selected
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {b.label}
            </button>
          )
        })}
      </div>

      {/* Active board summary */}
      {board && (
        <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
          <span data-testid="leaderboard-tab-participants">
            {board.summary.totalParticipants}{' '}
            {board.summary.totalParticipants === 1 ? 'athlete' : 'athletes'}
          </span>
          <span data-testid="leaderboard-tab-user-rank">
            {board.summary.currentUserRank
              ? `You're ranked #${board.summary.currentUserRank}`
              : 'You are not ranked here yet'}
          </span>
        </div>
      )}

      {/* Active board table */}
      {board && (
        <LeaderboardTable
          entries={board.entries}
          category={board.category}
          emptyMessage={EMPTY_MESSAGES[board.category]}
        />
      )}
    </div>
  )
}
