import { render, screen } from '@testing-library/react'
import { WorkoutSummaryCard } from '@/features/running/components/WorkoutSummaryCard'
import type { WorkoutSummary } from '@/features/running/types/workout-summary'

describe('WorkoutSummaryCard', () => {
  it('renders correctly with filled data', () => {
    const summary: WorkoutSummary = {
      workoutId: '123',
      distanceM: 5200,
      durationS: 1860,
      avgPaceSPerKm: 357, // 5:57
      cellsClaimed: 0,
      cellsStolen: 0,
      cellsDefended: 0,
      xpEarned: 150,
      completedAt: '2023-01-01T00:00:00Z'
    }

    render(<WorkoutSummaryCard summary={summary} />)

    expect(screen.getByTestId('summary-distance')).toHaveTextContent('5.20 km')
    expect(screen.getByTestId('summary-duration')).toHaveTextContent('31:00')
    expect(screen.getByTestId('summary-pace')).toHaveTextContent('5:57 /km')
    expect(screen.getByTestId('summary-xp')).toHaveTextContent('+150')
  })

  it('renders correctly with zero/null data', () => {
    const summary: WorkoutSummary = {
      workoutId: '123',
      distanceM: 0,
      durationS: 0,
      avgPaceSPerKm: null,
      cellsClaimed: 0,
      cellsStolen: 0,
      cellsDefended: 0,
      xpEarned: 0,
      completedAt: null
    }

    render(<WorkoutSummaryCard summary={summary} />)

    expect(screen.getByTestId('summary-distance')).toHaveTextContent('0.00 km')
    expect(screen.getByTestId('summary-duration')).toHaveTextContent('00:00')
    expect(screen.getByTestId('summary-pace')).toHaveTextContent('--:-- /km')
    expect(screen.getByTestId('summary-xp')).toHaveTextContent('+0')
  })
})
