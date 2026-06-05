import { render, screen } from '@testing-library/react'
import { XPEventList } from '@/features/xp/components/XPEventList'
import type { XpEvent } from '@/features/xp/types'

const events: XpEvent[] = [
  {
    id: 'e1',
    userId: 'u1',
    workoutId: 'w1',
    eventType: 'workout',
    xpAwarded: 30,
    createdAt: '2026-06-05T10:00:00Z',
  },
  {
    id: 'e2',
    userId: 'u1',
    workoutId: 'w1',
    eventType: 'capture',
    xpAwarded: 20,
    createdAt: '2026-06-05T09:55:00Z',
  },
]

describe('XPEventList', () => {
  it('renders recent event rows with mapped labels and awarded XP', () => {
    render(<XPEventList events={events} />)

    expect(screen.getByTestId('xp-events-list')).toBeInTheDocument()
    expect(screen.getAllByTestId('xp-event-item')).toHaveLength(2)
    expect(screen.getByText('Workout Complete')).toBeInTheDocument()
    expect(screen.getByText('Cells Captured')).toBeInTheDocument()
    expect(screen.getByText('+30 XP')).toBeInTheDocument()
    expect(screen.getByText('+20 XP')).toBeInTheDocument()
  })

  it('shows an empty state when there are no events yet', () => {
    render(<XPEventList events={[]} />)

    expect(screen.getByTestId('xp-events-empty')).toBeInTheDocument()
    expect(screen.getByText('No XP events yet')).toBeInTheDocument()
  })
})
