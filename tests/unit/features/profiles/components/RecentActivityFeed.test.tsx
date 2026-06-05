import { render, screen } from '@testing-library/react'
import { RecentActivityFeed } from '@/features/profiles/components/RecentActivityFeed'
import type { RecentActivity } from '@/features/profiles/types'

const mockActivities: RecentActivity[] = [
  { id: '1', type: 'achievement', title: '🏆 Unlocked XP Master', createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: '2', type: 'capture', title: '🌍 Captured 3 territories', createdAt: new Date(Date.now() - 7200000).toISOString() },
  { id: '3', type: 'workout', title: '🏃 Completed 7.4 km run', createdAt: new Date(Date.now() - 86400000).toISOString() },
]

describe('RecentActivityFeed', () => {
  it('renders correctly', () => {
    render(<RecentActivityFeed activities={mockActivities} />)
    expect(screen.getByText('🏆 Unlocked XP Master')).toBeInTheDocument()
    expect(screen.getByText('🌍 Captured 3 territories')).toBeInTheDocument()
    expect(screen.getByText('🏃 Completed 7.4 km run')).toBeInTheDocument()
  })

  it('renders empty state', () => {
    render(<RecentActivityFeed activities={[]} />)
    expect(screen.getByText(/No recent activity yet/i)).toBeInTheDocument()
  })
})
