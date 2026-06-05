import { render, screen } from '@testing-library/react'
import { TerritoryImpactCard } from '@/features/running/components/TerritoryImpactCard'
import type { WorkoutSummary } from '@/features/running/types/workout-summary'

describe('TerritoryImpactCard', () => {
  it('renders all impacts when present', () => {
    const summary: WorkoutSummary = {
      workoutId: '123',
      distanceM: 5200,
      durationS: 1860,
      avgPaceSPerKm: 357,
      cellsClaimed: 2,
      cellsStolen: 1,
      cellsDefended: 3,
      xpEarned: 150,
      completedAt: '2023-01-01T00:00:00Z'
    }

    render(<TerritoryImpactCard summary={summary} />)

    expect(screen.getByTestId('impact-claimed')).toHaveTextContent('Claimed2')
    expect(screen.getByTestId('impact-stolen')).toHaveTextContent('Stolen1')
    expect(screen.getByTestId('impact-defended')).toHaveTextContent('Defended3')
  })

  it('renders only non-zero impacts', () => {
    const summary: WorkoutSummary = {
      workoutId: '123',
      distanceM: 5200,
      durationS: 1860,
      avgPaceSPerKm: 357,
      cellsClaimed: 5,
      cellsStolen: 0,
      cellsDefended: 0,
      xpEarned: 150,
      completedAt: '2023-01-01T00:00:00Z'
    }

    render(<TerritoryImpactCard summary={summary} />)

    expect(screen.getByTestId('impact-claimed')).toBeInTheDocument()
    expect(screen.queryByTestId('impact-stolen')).not.toBeInTheDocument()
    expect(screen.queryByTestId('impact-defended')).not.toBeInTheDocument()
  })

  it('renders zero state gracefully', () => {
    const summary: WorkoutSummary = {
      workoutId: '123',
      distanceM: 5200,
      durationS: 1860,
      avgPaceSPerKm: 357,
      cellsClaimed: 0,
      cellsStolen: 0,
      cellsDefended: 0,
      xpEarned: 150,
      completedAt: '2023-01-01T00:00:00Z'
    }

    render(<TerritoryImpactCard summary={summary} />)

    expect(screen.getByText('No territory captured this session.')).toBeInTheDocument()
    expect(screen.queryByTestId('impact-claimed')).not.toBeInTheDocument()
  })
})
