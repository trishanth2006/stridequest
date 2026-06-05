import { render, screen } from '@testing-library/react'
import { AchievementGrid } from '@/features/achievements/components/AchievementGrid'
import type { Achievement } from '@/features/achievements/types'

describe('AchievementGrid', () => {
  it('renders empty state correctly', () => {
    render(<AchievementGrid achievements={[]} />)
    expect(screen.getByTestId('achievements-empty-state')).toBeInTheDocument()
    expect(screen.getByText('No achievements unlocked yet. Complete your first workout to start earning achievements.')).toBeInTheDocument()
  })

  it('renders category summaries and groups achievements', () => {
    const achievements: Achievement[] = [
      { id: 'first-run', title: 'First Run', description: 'Complete your first workout', icon: '🏃', unlocked: true, progress: 1, target: 1, category: 'running' },
      { id: 'runner', title: 'Runner', description: 'Complete 10 workouts', icon: '🔥', unlocked: false, progress: 5, target: 10, category: 'running' },
      { id: 'first-territory', title: 'First Territory', description: 'Capture first cell', icon: '🌍', unlocked: true, progress: 1, target: 1, category: 'territory' },
      { id: 'xp-hunter', title: 'XP Hunter', description: 'Earn 100 XP', icon: '⭐', unlocked: false, progress: 50, target: 100, category: 'xp' }
    ]

    render(<AchievementGrid achievements={achievements} />)

    // Check summaries
    expect(screen.getByTestId('category-summary-running')).toHaveTextContent('1 / 2')
    expect(screen.getByTestId('category-summary-territory')).toHaveTextContent('1 / 1')
    expect(screen.getByTestId('category-summary-xp')).toHaveTextContent('0 / 1')

    // Check headings
    expect(screen.getByText('Running Achievements')).toBeInTheDocument()
    expect(screen.getByText('Territory Achievements')).toBeInTheDocument()
    expect(screen.getByText('XP Achievements')).toBeInTheDocument()
  })

  it('sorts achievements within categories (unlocked first, then highest progress)', () => {
    const achievements: Achievement[] = [
      // Running category: runner (5/10 = 50%), distance-beast (90k/100k = 90%), first-run (unlocked).
      // Order should be: first-run (unlocked), distance-beast (90%), runner (50%).
      { id: 'runner', title: 'Runner', description: 'Complete 10 workouts', icon: '🔥', unlocked: false, progress: 5, target: 10, category: 'running' },
      { id: 'distance-beast', title: 'Distance Beast', description: 'Run 100 km', icon: '💯', unlocked: false, progress: 90000, target: 100000, category: 'running' },
      { id: 'first-run', title: 'First Run', description: 'Complete your first workout', icon: '🏃', unlocked: true, progress: 1, target: 1, category: 'running', unlockedAt: '2026-06-01T08:00:00Z' }
    ]

    render(<AchievementGrid achievements={achievements} />)

    const cards = screen.getAllByTestId('achievement-progress-text')
    expect(cards).toHaveLength(3)
    // Verify sorting in running category:
    // W1 = first-run (1 / 1 workout)
    // W2 = distance-beast (90 / 100 km)
    // W3 = runner (5 / 10 workouts)
    expect(cards[0]).toHaveTextContent('1 / 1 workout')
    expect(cards[1]).toHaveTextContent('90 / 100 km')
    expect(cards[2]).toHaveTextContent('5 / 10 workouts')
  })
})
