import { render, screen } from '@testing-library/react'
import { PersonalRecordsCard } from '@/features/achievements/components/PersonalRecordsCard'
import type { PersonalRecord } from '@/features/achievements/types'

describe('PersonalRecordsCard', () => {
  it('renders brand new user empty state correctly', () => {
    render(<PersonalRecordsCard records={[]} hasWorkouts={false} />)

    expect(screen.getByTestId('records-empty-state-new')).toBeInTheDocument()
    expect(screen.getByText('No personal records yet.')).toBeInTheDocument()
    expect(screen.getByText('Complete a run of at least 1 km to begin setting records.')).toBeInTheDocument()
  })

  it('renders user with workouts but no records empty state correctly', () => {
    render(<PersonalRecordsCard records={[]} hasWorkouts={true} />)

    expect(screen.getByTestId('records-empty-state-workouts')).toBeInTheDocument()
    expect(screen.getByText('Keep running.')).toBeInTheDocument()
    expect(screen.getByText('Complete longer runs to unlock personal records.')).toBeInTheDocument()
  })

  it('renders best record highlight and grid of remaining records correctly', () => {
    const records: PersonalRecord[] = [
      { id: 'fastest-10k', title: 'Fastest 10K', value: 2901, workoutId: 'w1', achievedAt: '2026-06-04T08:00:00Z', workoutDistanceM: 12400, workoutXp: 95 },
      { id: 'fastest-5k', title: 'Fastest 5K', value: 1458, workoutId: 'w2', achievedAt: '2026-06-03T08:00:00Z', workoutDistanceM: 5200, workoutXp: 45 },
      { id: 'longest-run', title: 'Longest Run', value: 15000, workoutId: 'w3', achievedAt: '2026-06-05T08:00:00Z', workoutDistanceM: 15000, workoutXp: 80 }
    ]

    render(<PersonalRecordsCard records={records} hasWorkouts={true} />)

    // Fastest 10K should be highlighted as Best Record (highest priority)
    expect(screen.getByTestId('best-record-highlight')).toBeInTheDocument()
    expect(screen.getByTestId('best-record-title')).toHaveTextContent('Fastest 10K')
    expect(screen.getByTestId('best-record-value')).toHaveTextContent('48:21') // 2901s formatted
    expect(screen.getByTestId('best-record-metadata')).toHaveTextContent('Run Distance: 12.4 km • XP Earned: 95 • Achieved Jun 4')

    // Fastest 5K and Longest Run should be in the remaining records grid
    expect(screen.getByTestId('record-card-fastest-5k')).toBeInTheDocument()
    expect(screen.getByTestId('record-value-fastest-5k')).toHaveTextContent('24:18') // 1458s formatted
    expect(screen.getByTestId('record-metadata-fastest-5k')).toHaveTextContent('Run Distance: 5.2 km • XP Earned: 45 • Achieved Jun 3')

    expect(screen.getByTestId('record-card-longest-run')).toBeInTheDocument()
    expect(screen.getByTestId('record-value-longest-run')).toHaveTextContent('15 km') // 15000m formatted
    expect(screen.getByTestId('record-metadata-longest-run')).toHaveTextContent('Run Distance: 15 km • XP Earned: 80 • Achieved Jun 5')

    // Fastest 10K should NOT be in the remaining records grid
    expect(screen.queryByTestId('record-card-fastest-10k')).not.toBeInTheDocument()
  })
})
