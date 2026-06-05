import { render, screen } from '@testing-library/react'
import { ProfileHeader } from '@/features/profiles/components/ProfileHeader'
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
  topAchievements: [
    { id: '1', title: 'Marathoner', icon: '🏅', description: '', progress: 100, target: 100, category: 'running', unlocked: true },
    { id: '2', title: 'Explorer', icon: '🌍', description: '', progress: 50, target: 50, category: 'territory', unlocked: true },
    { id: '3', title: 'XP Master', icon: '⚡', description: '', progress: 500, target: 500, category: 'xp', unlocked: true },
  ],
  profileCompletion: 72,
}

describe('ProfileHeader', () => {
  it('renders correctly', () => {
    render(<ProfileHeader profile={mockProfile} />)
    expect(screen.getByTestId('profile-username')).toHaveTextContent('Trishanth')
    expect(screen.getByTestId('profile-level')).toHaveTextContent('Level 5')
    expect(screen.getByTestId('profile-xp')).toHaveTextContent('875 XP')
    expect(screen.getByTestId('profile-rank')).toHaveTextContent('Rank #12')
    expect(screen.getByTestId('profile-completion')).toHaveTextContent('72%')
    
    const badges = screen.getByTestId('profile-badges')
    expect(badges).toHaveTextContent('Marathoner')
    expect(badges).toHaveTextContent('Explorer')
    expect(badges).toHaveTextContent('XP Master')
  })
})
