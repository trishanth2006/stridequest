import { render, screen } from '@testing-library/react'
import { AchievementCard } from '@/features/achievements/components/AchievementCard'
import type { Achievement } from '@/features/achievements/types'

describe('AchievementCard', () => {
  it('renders a locked achievement correctly', () => {
    const ach: Achievement = {
      id: 'runner',
      title: 'Runner',
      description: 'Complete 10 workouts',
      icon: '🔥',
      unlocked: false,
      progress: 5,
      target: 10,
      category: 'running'
    }

    render(<AchievementCard achievement={ach} />)

    expect(screen.getByText('Runner')).toBeInTheDocument()
    expect(screen.getByText('Complete 10 workouts')).toBeInTheDocument()
    expect(screen.getByTestId('achievement-progress-text')).toHaveTextContent('5 / 10 workouts')
    expect(screen.getByTestId('achievement-percentage')).toHaveTextContent('50%')
    expect(screen.queryByTestId('badge-unlocked')).not.toBeInTheDocument()
    expect(screen.queryByTestId('badge-almost-there')).not.toBeInTheDocument()
  })

  it('shows almost there badge at >=80% progress', () => {
    const ach: Achievement = {
      id: 'runner',
      title: 'Runner',
      description: 'Complete 10 workouts',
      icon: '🔥',
      unlocked: false,
      progress: 8,
      target: 10,
      category: 'running'
    }

    render(<AchievementCard achievement={ach} />)

    expect(screen.getByTestId('badge-almost-there')).toBeInTheDocument()
    expect(screen.getByTestId('badge-almost-there')).toHaveTextContent('Almost There')
  })

  it('hides almost there badge when unlocked', () => {
    const ach: Achievement = {
      id: 'runner',
      title: 'Runner',
      description: 'Complete 10 workouts',
      icon: '🔥',
      unlocked: true,
      progress: 10,
      target: 10,
      category: 'running',
      unlockedAt: '2026-06-01T08:00:00Z'
    }

    render(<AchievementCard achievement={ach} />)

    expect(screen.queryByTestId('badge-almost-there')).not.toBeInTheDocument()
    expect(screen.getByTestId('badge-unlocked')).toBeInTheDocument()
    expect(screen.getByTestId('achievement-unlocked-date')).toHaveTextContent('Jun 1, 2026')
  })
})
