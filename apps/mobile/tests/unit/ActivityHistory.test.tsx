import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import type { SortField } from '../../src/features/running/services/history'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('@/features/running/components/WorkoutActivityCard', () => ({
  WorkoutActivityCard: ({ workout, onPress }: { workout: { id: string }; onPress: (id: string) => void }) => {
    const { Pressable, Text } = require('react-native')
    return (
      <Pressable onPress={() => onPress(workout.id)} testID={`card-${workout.id}`}>
        <Text>Card</Text>
      </Pressable>
    )
  },
}))

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const mockGetWorkoutsPage = jest.fn()
jest.mock('@/features/running/services/history', () => ({
  getWorkoutsPage: (page: number, sort: SortField) => mockGetWorkoutsPage(page, sort),
}))

const ActivityHistoryScreen = require('../../app/(protected)/(tabs)/run/index').default

const makeWorkout = (id: string) => ({
  id,
  started_at: new Date().toISOString(),
  distance_m: 3000,
  duration_s: 900,
  avg_pace_s_per_km: 300,
  xp_awarded: 50,
})

describe('ActivityHistory sort behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('calls getWorkoutsPage with page 0 and started_at on mount', async () => {
    mockGetWorkoutsPage.mockResolvedValue([makeWorkout('w1')])
    await render(<ActivityHistoryScreen />)
    await waitFor(() => {
      expect(mockGetWorkoutsPage).toHaveBeenCalledWith(0, 'started_at')
    })
  })

  it('resets page to 0 when sort changes to Distance', async () => {
    mockGetWorkoutsPage.mockResolvedValue([makeWorkout('w1')])
    await render(<ActivityHistoryScreen />)
    await waitFor(() => expect(mockGetWorkoutsPage).toHaveBeenCalledWith(0, 'started_at'))

    mockGetWorkoutsPage.mockClear()
    mockGetWorkoutsPage.mockResolvedValue([makeWorkout('w2')])

    await act(async () => {
      fireEvent.press(screen.getByText('Distance'))
    })

    await waitFor(() => {
      expect(mockGetWorkoutsPage).toHaveBeenCalledWith(0, 'distance_m')
    })
  })

  it('uses distance_m as the server sort field for Distance chip', async () => {
    mockGetWorkoutsPage.mockResolvedValue([])
    await render(<ActivityHistoryScreen />)
    await waitFor(() => expect(mockGetWorkoutsPage).toHaveBeenCalled())
    mockGetWorkoutsPage.mockClear()
    mockGetWorkoutsPage.mockResolvedValue([])

    await act(async () => {
      fireEvent.press(screen.getByText('Distance'))
    })

    await waitFor(() => {
      expect(mockGetWorkoutsPage).toHaveBeenCalledWith(expect.any(Number), 'distance_m')
    })
  })

  it('uses xp_awarded as the server sort field for XP chip', async () => {
    mockGetWorkoutsPage.mockResolvedValue([])
    await render(<ActivityHistoryScreen />)
    await waitFor(() => expect(mockGetWorkoutsPage).toHaveBeenCalled())
    mockGetWorkoutsPage.mockClear()
    mockGetWorkoutsPage.mockResolvedValue([])

    await act(async () => {
      fireEvent.press(screen.getByText('XP'))
    })

    await waitFor(() => {
      expect(mockGetWorkoutsPage).toHaveBeenCalledWith(expect.any(Number), 'xp_awarded')
    })
  })

  it('renders workout cards after data loads', async () => {
    mockGetWorkoutsPage.mockResolvedValue([makeWorkout('w99')])
    await render(<ActivityHistoryScreen />)
    expect(await screen.findByTestId('card-w99')).toBeTruthy()
  })

  it('navigates to correct workout detail on card press', async () => {
    mockGetWorkoutsPage.mockResolvedValue([makeWorkout('detail-workout')])
    await render(<ActivityHistoryScreen />)
    const card = await screen.findByTestId('card-detail-workout')
    fireEvent.press(card)
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('detail-workout'),
    )
  })
})
