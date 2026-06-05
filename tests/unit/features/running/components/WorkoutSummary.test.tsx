import { render, screen } from '@testing-library/react'
import { WorkoutSummary } from '@/features/running/components/WorkoutSummary'
import type { WorkoutSummary as WorkoutSummaryType } from '@/features/running/types/workout-summary'
import type { WorkoutXpBreakdown } from '@/features/xp/services/profile'
import type { XpProgress } from '@/features/xp/services/xp'

describe('WorkoutSummary', () => {
  const summary: WorkoutSummaryType = {
    workoutId: '123',
    distanceM: 5200,
    durationS: 1860,
    avgPaceSPerKm: 357,
    cellsClaimed: 2,
    cellsStolen: 1,
    cellsDefended: 3,
    xpEarned: 150,
    completedAt: '2023-01-01T00:00:00Z'
  }

  const xpBreakdown: WorkoutXpBreakdown = {
    workoutXp: 50,
    captureXp: 50,
    stealXp: 50,
    totalXp: 150
  }

  const xpProgress: XpProgress = {
    currentXp: 150,
    currentLevel: 2,
    currentLevelXp: 100,
    nextLevel: 3,
    nextLevelXp: 250,
    xpNeededToNextLevel: 100,
    progressPercent: 33
  }

  it('composes all three cards', () => {
    render(
      <WorkoutSummary 
        summary={summary} 
        xpBreakdown={xpBreakdown} 
        xpProgress={xpProgress} 
      />
    )

    expect(screen.getByTestId('workout-summary-card')).toBeInTheDocument()
    expect(screen.getByTestId('territory-impact-card')).toBeInTheDocument()
    expect(screen.getByTestId('xp-earned-card')).toBeInTheDocument()
  })
})
