import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react-native'
import { WorkoutActivityCard } from '../../src/features/running/components/WorkoutActivityCard'
import type { RecentWorkout } from '../../src/features/running/services/history'

jest.mock('@stridequest/shared/running', () => ({
  formatDistance: (m: number) => `${(m / 1000).toFixed(2)} km`,
  formatDuration: (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`,
  formatPace: (s: number) => (s > 0 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} /km` : '—'),
}))

jest.mock('../../src/features/running/utils/formatRelativeDate', () => ({
  formatRelativeDate: () => 'Today',
}))

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}))

const baseWorkout: RecentWorkout = {
  id: 'workout-1',
  started_at: new Date().toISOString(),
  distance_m: 5000,
  duration_s: 1800,
  avg_pace_s_per_km: 360,
  xp_awarded: 150,
}

describe('WorkoutActivityCard', () => {
  it('renders distance correctly', async () => {
    await render(<WorkoutActivityCard workout={baseWorkout} onPress={jest.fn()} />)
    expect(screen.getByText('5.00 km')).toBeTruthy()
  })

  it('renders duration correctly', async () => {
    await render(<WorkoutActivityCard workout={baseWorkout} onPress={jest.fn()} />)
    expect(screen.getByText('30m 0s')).toBeTruthy()
  })

  it('renders XP when xp_awarded is positive', async () => {
    await render(<WorkoutActivityCard workout={baseWorkout} onPress={jest.fn()} />)
    expect(screen.getByText('+150 XP')).toBeTruthy()
  })

  it('hides XP badge when xp_awarded is null', async () => {
    const workout = { ...baseWorkout, xp_awarded: null }
    await render(<WorkoutActivityCard workout={workout} onPress={jest.fn()} />)
    expect(screen.queryByText(/XP/)).toBeNull()
  })

  it('hides XP badge when xp_awarded is 0', async () => {
    const workout = { ...baseWorkout, xp_awarded: 0 }
    await render(<WorkoutActivityCard workout={workout} onPress={jest.fn()} />)
    expect(screen.queryByText(/XP/)).toBeNull()
  })

  it('calls onPress when tapped', async () => {
    const onPress = jest.fn()
    await render(<WorkoutActivityCard workout={baseWorkout} onPress={onPress} />)
    fireEvent.press(screen.getByText(/Run/))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('shows relative date label', async () => {
    await render(<WorkoutActivityCard workout={baseWorkout} onPress={jest.fn()} />)
    expect(screen.getByText(/Today/)).toBeTruthy()
  })
})
