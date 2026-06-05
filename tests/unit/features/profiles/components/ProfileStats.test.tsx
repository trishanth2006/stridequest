import { render, screen } from '@testing-library/react'
import { ProfileStats } from '@/features/profiles/components/ProfileStats'
import type { RunnerProfile } from '@/features/profiles/types'

const mockProfile: RunnerProfile = {
  userId: '123',
  username: 'Trishanth',
  level: 5,
  totalXp: 875,
  territoriesOwned: 37,
  territoriesCaptured: 84,
  territoriesStolen: 12,
  totalDistanceM: 118000,
  totalWorkouts: 23,
  achievementCount: 6,
  leaderboardRank: 12,
  topAchievements: [],
  profileCompletion: 72,
}

describe('ProfileStats', () => {
  it('renders correctly', () => {
    render(<ProfileStats profile={mockProfile} />)
    expect(screen.getByTestId('stat-workouts')).toHaveTextContent('23')
    expect(screen.getByTestId('stat-distance')).toHaveTextContent('118 km')
    expect(screen.getByTestId('stat-territories')).toHaveTextContent('37')
    expect(screen.getByTestId('stat-achievements')).toHaveTextContent('6')
    expect(screen.getByText('84 Captured')).toBeInTheDocument()
    expect(screen.getByText('12 Stolen')).toBeInTheDocument()
  })
})
