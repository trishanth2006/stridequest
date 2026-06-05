import type { LeaderboardCategory, LeaderboardEntry } from '@/features/leaderboards/types'

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

/** Formats a raw leaderboard value for display, by category. */
function formatValue(category: LeaderboardCategory, value: number): string {
  if (category === 'distance') {
    const km = (value / 1000).toFixed(1).replace(/\.0$/, '')
    return `${km} km`
  }
  if (category === 'territory') {
    return `${value} ${value === 1 ? 'cell' : 'cells'}`
  }
  // xp + weekly are both XP totals.
  return `${value} XP`
}

/** One leaderboard row: rank, username, value, with current-user highlight. */
export function LeaderboardCard({
  entry,
  category,
}: {
  entry: LeaderboardEntry
  category: LeaderboardCategory
}) {
  const medal = MEDALS[entry.rank]

  return (
    <div
      data-testid={entry.isCurrentUser ? 'leaderboard-row-current' : 'leaderboard-row'}
      className={`flex items-center gap-4 rounded-xl border px-4 py-3 transition-colors ${
        entry.isCurrentUser
          ? 'border-primary/30 bg-primary/[0.06]'
          : 'border-white/[0.06] bg-white/[0.02]'
      }`}
    >
      <span
        data-testid="leaderboard-rank"
        className="w-12 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground"
      >
        {medal ? `${medal} ` : ''}#{entry.rank}
      </span>

      <span
        data-testid="leaderboard-username"
        className="flex-1 min-w-0 truncate text-sm font-medium text-foreground"
      >
        {entry.username}
        {entry.isCurrentUser && (
          <span
            data-testid="leaderboard-you-badge"
            className="ml-2 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary"
          >
            You
          </span>
        )}
      </span>

      <span
        data-testid="leaderboard-value"
        className="shrink-0 text-sm font-bold tabular-nums text-foreground"
      >
        {formatValue(category, entry.value)}
      </span>
    </div>
  )
}
