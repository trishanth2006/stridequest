import React from 'react'
import { render, screen } from '@testing-library/react-native'

const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (cb: () => unknown) => {
    const { useEffect } = require('react')
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { cb() }, [])
  },
}))

jest.mock('@/features/auth/providers/SessionProvider', () => ({
  useSession: () => ({
    session: { user: { id: 'user-1', email: 'runner@test.com' } },
  }),
}))

jest.mock('@stridequest/shared/xp', () => ({
  getXpProgress: () => ({ currentLevel: 1, progressPercent: 30, xpNeededToNextLevel: 700 }),
}))

jest.mock('@stridequest/shared/running', () => ({
  formatDistance: (m: number) => `${(m / 1000).toFixed(2)} km`,
}))

jest.mock('@/features/running/components/WorkoutActivityCard', () => ({
  WorkoutActivityCard: ({ workout }: { workout: { id: string } }) => {
    const { Text } = require('react-native')
    return <Text testID={`card-${workout.id}`}>Card</Text>
  },
}))

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const mockGetRecentWorkouts = jest.fn()
jest.mock('@/features/running/services/history', () => ({
  getRecentWorkouts: (...args: unknown[]) => mockGetRecentWorkouts(...args),
}))

const makeSupabaseMock = (username = 'runner', totalXp = 500) => ({
  from: jest.fn().mockImplementation((table: string) => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: table === 'profiles' ? { username } : { total_xp: totalXp },
      error: null,
    }),
  })),
})

jest.mock('@/lib/supabase', () => ({
  supabase: makeSupabaseMock(),
}))

const HomeScreen = require('../../app/(protected)/(tabs)/index').default

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    const { supabase } = require('@/lib/supabase')
    Object.assign(supabase, makeSupabaseMock())
  })

  it('renders empty state when no recent workouts', async () => {
    mockGetRecentWorkouts.mockResolvedValue([])
    await render(<HomeScreen />)
    expect(await screen.findByText(/No runs yet/)).toBeTruthy()
  })

  it('renders workout card when recent workouts exist', async () => {
    const workout = {
      id: 'w1',
      started_at: new Date().toISOString(),
      distance_m: 5000,
      duration_s: 1800,
      avg_pace_s_per_km: 360,
      xp_awarded: 100,
    }
    mockGetRecentWorkouts.mockResolvedValue([workout])
    await render(<HomeScreen />)
    expect(await screen.findByTestId('card-w1')).toBeTruthy()
  })
})
