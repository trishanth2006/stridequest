import { render, screen } from '@testing-library/react'
import { LeaderboardCard } from '@/features/leaderboards/components/LeaderboardCard'
import type { LeaderboardEntry } from '@/features/leaderboards/types'

const entry: LeaderboardEntry = {
  rank: 2,
  userId: 'u-bob',
  username: 'bob',
  value: 500,
  isCurrentUser: false,
}

describe('LeaderboardCard', () => {
  it('renders rank, username and value', () => {
    render(<LeaderboardCard entry={entry} category="xp" />)
    expect(screen.getByTestId('leaderboard-rank')).toHaveTextContent('#2')
    expect(screen.getByTestId('leaderboard-username')).toHaveTextContent('bob')
    expect(screen.getByTestId('leaderboard-value')).toHaveTextContent('500 XP')
  })

  it('formats distance values as kilometres', () => {
    render(
      <LeaderboardCard
        entry={{ ...entry, value: 8000 }}
        category="distance"
      />,
    )
    expect(screen.getByTestId('leaderboard-value')).toHaveTextContent('8 km')
  })

  it('formats territory values as cells', () => {
    render(
      <LeaderboardCard entry={{ ...entry, value: 3 }} category="territory" />,
    )
    expect(screen.getByTestId('leaderboard-value')).toHaveTextContent('3 cells')
  })

  it('does not highlight or badge a non-current user', () => {
    render(<LeaderboardCard entry={entry} category="xp" />)
    expect(screen.queryByTestId('leaderboard-row-current')).not.toBeInTheDocument()
    expect(screen.queryByTestId('leaderboard-you-badge')).not.toBeInTheDocument()
  })

  it('highlights and badges the current user', () => {
    render(
      <LeaderboardCard
        entry={{ ...entry, isCurrentUser: true }}
        category="xp"
      />,
    )
    expect(screen.getByTestId('leaderboard-row-current')).toBeInTheDocument()
    expect(screen.getByTestId('leaderboard-you-badge')).toHaveTextContent('You')
  })
})
