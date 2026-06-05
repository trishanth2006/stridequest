import { render, screen } from '@testing-library/react'
import { XPDashboard } from '@/features/xp/components/XPDashboard'
import type { UserXp, XpEvent, WorkoutXpHistoryEntry } from '@/features/xp/types'

const userXp: UserXp = {
  userId: 'u1',
  totalXp: 300,
  level: 3,
  updatedAt: '2026-06-05T10:00:00Z',
}

const recentEvents: XpEvent[] = [
  {
    id: 'e1',
    userId: 'u1',
    workoutId: 'w1',
    eventType: 'steal',
    xpAwarded: 50,
    createdAt: '2026-06-05T10:00:00Z',
  },
]

const workoutHistory: WorkoutXpHistoryEntry[] = [
  {
    workoutId: 'w1',
    startedAt: '2026-06-05T10:00:00Z',
    xpAwarded: 45,
    distanceM: 850,
    durationS: 360,
  },
]

describe('XPDashboard', () => {
  it('renders level, total xp, and next-level progress details', () => {
    render(
      <XPDashboard
        userXp={userXp}
        recentEvents={recentEvents}
        workoutHistory={workoutHistory}
      />,
    )

    expect(screen.getByTestId('xp-current-level')).toHaveTextContent('Level3')
    expect(screen.getByTestId('xp-total')).toHaveTextContent('300')
    expect(screen.getByTestId('xp-needed')).toHaveTextContent('200')
    expect(screen.getByText('Current XP')).toBeInTheDocument()
    expect(screen.getByText('Next Level XP')).toBeInTheDocument()
    expect(screen.getByTestId('xp-progress-percent')).toHaveTextContent('20%')
  })

  it('shows an empty state when workout xp history is empty', () => {
    render(
      <XPDashboard
        userXp={userXp}
        recentEvents={recentEvents}
        workoutHistory={[]}
      />,
    )

    expect(screen.getByTestId('xp-workout-history-empty')).toBeInTheDocument()
    expect(screen.getByText('No XP workouts yet')).toBeInTheDocument()
  })
})
