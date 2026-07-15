import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import type { LeaderboardEntry, MyRank } from '@stridequest/shared'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}))

jest.mock('@/features/auth/providers/SessionProvider', () => ({
  useSession: () => ({ session: { user: { id: 'u2' } } }),
}))

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

// Reanimated entrance wrappers + skeleton pulse are irrelevant to behavior here.
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native')
  const entering = { delay: () => entering, duration: () => entering }
  return {
    __esModule: true,
    default: { View },
    FadeInDown: entering,
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withRepeat: (v: unknown) => v,
    withTiming: (v: unknown) => v,
  }
})

const mockFetchLeaderboard = jest.fn()
const mockFetchMyRank = jest.fn()
jest.mock('@/features/leaderboards/services/leaderboards', () => ({
  fetchLeaderboard: (...args: unknown[]) => mockFetchLeaderboard(...args),
  fetchMyRank: (...args: unknown[]) => mockFetchMyRank(...args),
}))

const makeEntry = (rank: number, userId: string, username: string): LeaderboardEntry => ({
  rank,
  userId,
  username,
  value: 100 - rank,
  isCurrentUser: userId === 'u2',
})

const entries = [
  makeEntry(1, 'u1', 'alice'),
  makeEntry(2, 'u2', 'bob'),
  makeEntry(3, 'u3', 'carol'),
  makeEntry(4, 'u4', 'dave'),
]

const myRank: MyRank = { rank: 2, value: 98, totalUsers: 10, percentile: 80, nextRankValue: 99 }

const LeaderboardsScreen = require('../../../app/(protected)/leaderboards/index').default

describe('LeaderboardsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchLeaderboard.mockResolvedValue(entries)
    mockFetchMyRank.mockResolvedValue(myRank)
  })

  it('renders the ranked list without throwing', async () => {
    await render(<LeaderboardsScreen />)
    // 'dave' is a non-podium row rendered by the memoized EntryRow.
    expect(await screen.findByText('dave')).toBeTruthy()
  })

  it('navigates to a runner profile with the username when a row is pressed', async () => {
    await render(<LeaderboardsScreen />)
    const row = await screen.findByText('dave')
    fireEvent.press(row)
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('dave'))
    })
  })
})
