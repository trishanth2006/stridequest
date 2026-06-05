import type { LeaderboardCategory, LeaderboardEntry } from '@/features/leaderboards/types'
import { LeaderboardCard } from './LeaderboardCard'

const TOP_N = 10

/**
 * Renders the top 10 ranked rows. If the current user falls outside the top 10,
 * their row is appended below a separator so they can always see their standing.
 */
export function LeaderboardTable({
  entries,
  category,
  emptyMessage = 'No rankings yet. Be the first to get on the board!',
}: {
  entries: LeaderboardEntry[]
  category: LeaderboardCategory
  emptyMessage?: string
}) {
  if (entries.length === 0) {
    return (
      <div
        data-testid="leaderboard-empty"
        className="flex flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center"
      >
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  const top = entries.slice(0, TOP_N)
  const currentUser = entries.find((e) => e.isCurrentUser)
  const currentUserOutside =
    currentUser !== undefined && currentUser.rank > TOP_N

  return (
    <div className="flex flex-col gap-2" data-testid="leaderboard-table">
      {top.map((entry) => (
        <LeaderboardCard key={entry.userId} entry={entry} category={category} />
      ))}

      {currentUserOutside && (
        <>
          <div
            data-testid="leaderboard-overflow-separator"
            className="px-4 py-1 text-center text-xs text-muted-foreground"
          >
            ···
          </div>
          <LeaderboardCard entry={currentUser} category={category} />
        </>
      )}
    </div>
  )
}
