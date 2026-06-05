import { render, screen } from '@testing-library/react'
import { XPBreakdown } from '@/features/xp/components/XPBreakdown'
import type { WorkoutXpBreakdown } from '@/features/xp/services/profile'

describe('XPBreakdown', () => {
  it('renders zero categories hidden and non-zero visible', () => {
    const mockBreakdown: WorkoutXpBreakdown = {
      workoutXp: 50,
      captureXp: 0,
      stealXp: 25,
      totalXp: 75,
    }

    render(<XPBreakdown breakdown={mockBreakdown} />)

    expect(screen.getByTestId('xp-workout')).toBeInTheDocument()
    expect(screen.queryByTestId('xp-capture')).not.toBeInTheDocument()
    expect(screen.getByTestId('xp-steal')).toBeInTheDocument()
    expect(screen.getByTestId('xp-total')).toHaveTextContent('+75')
  })

  it('renders empty state when total is 0', () => {
    const mockBreakdown: WorkoutXpBreakdown = {
      workoutXp: 0,
      captureXp: 0,
      stealXp: 0,
      totalXp: 0,
    }

    render(<XPBreakdown breakdown={mockBreakdown} />)

    expect(screen.getByText('No XP earned this session.')).toBeInTheDocument()
    expect(screen.queryByTestId('xp-total')).not.toBeInTheDocument()
  })
})
