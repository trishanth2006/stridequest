import React from 'react'
import { render, screen } from '@testing-library/react-native'

jest.mock('@/features/running/components/RunReplayMap', () => ({
  RunReplayMap: () => null,
}))

jest.mock('@/features/running/components/BadgeCard', () => ({
  BadgeCard: () => null,
}))

jest.mock('expo-blur', () => {
  const { View } = require('react-native')
  return { BlurView: View }
})

jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn(),
}))

const { PostRunSummary } = require('@/features/running/screens/PostRunSummary')

const baseProps = {
  samples: [],
  totalDistanceMeters: 5000,
  movingTimeMs: 1_800_000,
  averageSpeedMps: 2.78,
}

describe('PostRunSummary rewards', () => {
  it('renders XP, territory, and quest rewards when earned', async () => {
    await render(
      <PostRunSummary
        {...baseProps}
        rewards={{
          xpAwarded: 120,
          cellsClaimed: 3,
          cellsStolen: 1,
          questsCompleted: [{ questId: 'q1', title: 'Morning 5K', rewardXp: 50 }],
        }}
      />,
    )
    expect(screen.getByTestId('run-rewards')).toBeTruthy()
    expect(screen.getByText(/\+120 XP/)).toBeTruthy()
    expect(screen.getByText(/3 cells captured/)).toBeTruthy()
    expect(screen.getByText(/1 stolen/)).toBeTruthy()
    expect(screen.getByText(/Morning 5K/)).toBeTruthy()
    expect(screen.getByText(/\+50 XP/)).toBeTruthy()
  })

  it('omits the rewards section when nothing was earned', async () => {
    await render(
      <PostRunSummary
        {...baseProps}
        rewards={{ xpAwarded: 0, cellsClaimed: 0, cellsStolen: 0, questsCompleted: [] }}
      />,
    )
    expect(screen.queryByTestId('run-rewards')).toBeNull()
  })

  it('omits the rewards section when rewards are not provided', async () => {
    await render(<PostRunSummary {...baseProps} />)
    expect(screen.queryByTestId('run-rewards')).toBeNull()
  })
})
