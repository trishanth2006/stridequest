import React from 'react'
import { render, waitFor, act } from '@testing-library/react-native'
import { Text, View, Pressable } from 'react-native'
import { useQuests } from '@/features/quests/hooks/useQuests'
import { queryInvalidate, querySet } from '@/lib/queryCache'
import type { ActiveQuest } from '@stridequest/shared'

jest.mock('@/features/quests/services/quests', () => ({
  fetchActiveQuests: jest.fn(),
}))

import { fetchActiveQuests } from '@/features/quests/services/quests'
const mockFetch = fetchActiveQuests as jest.MockedFunction<typeof fetchActiveQuests>

const USER_ID = 'user-1'
const CACHE_KEY = `quests:${USER_ID}`

const QUEST: ActiveQuest = {
  userQuestId: 'uq-1',
  questId: 'q-1',
  slug: 'daily-run-3k',
  title: 'Daily 3K',
  description: 'Run 3 km today.',
  type: 'distance_total',
  targetValue: 3000,
  rewardXp: 50,
  durationType: 'daily',
  rewardBadgeIcon: '🏃',
  rewardBadgeLabel: 'Mover',
  windowEndHour: null,
  status: 'active',
  currentValue: 0,
  expiresAt: '2026-07-01T00:00:00Z',
}

describe('useQuests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    queryInvalidate(CACHE_KEY)
  })

  it('fetches and caches quests on first load', async () => {
    mockFetch.mockResolvedValue([QUEST])
    let capturedQuests: ActiveQuest[] | undefined
    let capturedLoading: boolean | undefined
    let capturedRefresh: (() => void) | undefined

    function TestComponent() {
      const result = useQuests(USER_ID)
      capturedQuests = result.quests
      capturedLoading = result.loading
      capturedRefresh = result.refresh
      return (
        <View>
          <Text testID="loading">{String(capturedLoading)}</Text>
          <Text testID="count">{capturedQuests.length}</Text>
          <Pressable testID="refresh" onPress={capturedRefresh} />
        </View>
      )
    }

    render(<TestComponent />)

    await waitFor(() => {
      expect(capturedLoading).toBe(false)
    })
    expect(capturedQuests).toHaveLength(1)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('skips the network call when a fresh cache entry exists', async () => {
    querySet(CACHE_KEY, [QUEST])
    let capturedQuests: ActiveQuest[] | undefined
    let capturedLoading: boolean | undefined

    function TestComponent() {
      const result = useQuests(USER_ID)
      capturedQuests = result.quests
      capturedLoading = result.loading
      return (
        <View>
          <Text testID="loading">{String(capturedLoading)}</Text>
          <Text testID="count">{capturedQuests.length}</Text>
        </View>
      )
    }

    render(<TestComponent />)

    await waitFor(() => {
      expect(capturedQuests).toBeDefined()
    })

    expect(capturedLoading).toBe(false)
    expect(capturedQuests).toHaveLength(1)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('refresh invalidates the cache and refetches', async () => {
    querySet(CACHE_KEY, [QUEST])
    mockFetch.mockResolvedValue([])
    let capturedQuests: ActiveQuest[] | undefined
    let capturedRefresh: (() => void) | undefined

    function TestComponent() {
      const result = useQuests(USER_ID)
      capturedQuests = result.quests
      capturedRefresh = result.refresh
      return (
        <View>
          <Text testID="count">{capturedQuests.length}</Text>
          <Pressable testID="refresh" onPress={capturedRefresh} />
        </View>
      )
    }

    render(<TestComponent />)

    await waitFor(() => {
      expect(capturedQuests).toBeDefined()
    })

    expect(capturedQuests).toHaveLength(1)

    await act(async () => {
      capturedRefresh?.()
    })

    await waitFor(() => {
      expect(capturedQuests).toHaveLength(0)
    })
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
