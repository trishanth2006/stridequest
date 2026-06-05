import { render, screen } from '@testing-library/react'
import { ProfileRecords } from '@/features/profiles/components/ProfileRecords'
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
  fastest1K: 240, // 4 mins
  fastest5K: 1458, // 24:18
  fastest10K: 3062, // 51:02
  longestRunM: 18400, // 18.4 km
}

describe('ProfileRecords', () => {
  it('renders correctly', () => {
    render(<ProfileRecords profile={mockProfile} />)
    expect(screen.getByTestId('record-1k')).toHaveTextContent('4:00')
    expect(screen.getByTestId('record-5k')).toHaveTextContent('24:18')
    expect(screen.getByTestId('record-10k')).toHaveTextContent('51:02')
    expect(screen.getByTestId('record-longest')).toHaveTextContent('18.4 km')
  })

  it('renders empty states', () => {
    const emptyProfile = { ...mockProfile, fastest1K: undefined, fastest5K: undefined, fastest10K: undefined, longestRunM: undefined }
    render(<ProfileRecords profile={emptyProfile} />)
    expect(screen.getAllByText('--:--').length).toBe(3)
    expect(screen.getByText('0.0 km')).toBeInTheDocument() // Assuming formatDistance returns '0 km' or '0.0 km'
  })
})
