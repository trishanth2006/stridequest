import { render, screen } from '@testing-library/react'
import { LeaderboardTable } from '@/features/leaderboards/components/LeaderboardTable'
import type { LeaderboardEntry } from '@/features/leaderboards/types'

function makeEntries(count: number, currentUserRank?: number): LeaderboardEntry[] {
  return Array.from({ length: count }, (_, i) => {
    const rank = i + 1
    return {
      rank,
      userId: `u-${rank}`,
      username: `user${rank}`,
      value: (count - i) * 100,
      isCurrentUser: rank === currentUserRank,
    }
  })
}

function rowCount(container: HTMLElement): number {
  return container.querySelectorAll('[data-testid^="leaderboard-row"]').length
}

describe('LeaderboardTable', () => {
  it('renders only the top 10 rows when nobody is outside it', () => {
    const { container } = render(
      <LeaderboardTable entries={makeEntries(12, 1)} category="xp" />,
    )
    expect(rowCount(container)).toBe(10)
    expect(screen.queryByText('user11')).not.toBeInTheDocument()
    expect(screen.queryByTestId('leaderboard-overflow-separator')).not.toBeInTheDocument()
  })

  it('appends the current user row when they are outside the top 10', () => {
    const { container } = render(
      <LeaderboardTable entries={makeEntries(15, 13)} category="xp" />,
    )
    // 10 top rows + 1 appended current-user row.
    expect(rowCount(container)).toBe(11)
    expect(screen.getByTestId('leaderboard-overflow-separator')).toBeInTheDocument()
    expect(screen.getByText('user13')).toBeInTheDocument()
    expect(screen.getByTestId('leaderboard-row-current')).toHaveTextContent('user13')
  })

  it('does not duplicate the current user when they are already in the top 10', () => {
    const { container } = render(
      <LeaderboardTable entries={makeEntries(15, 4)} category="xp" />,
    )
    expect(rowCount(container)).toBe(10)
    expect(screen.queryByTestId('leaderboard-overflow-separator')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('leaderboard-row-current')).toHaveLength(1)
  })

  it('shows an empty state when there are no entries', () => {
    render(<LeaderboardTable entries={[]} category="xp" />)
    expect(screen.getByTestId('leaderboard-empty')).toBeInTheDocument()
  })
})
