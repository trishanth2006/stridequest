import { render } from '@testing-library/react'
import { WorkoutTerritorySummary } from '@/features/running/components/WorkoutTerritorySummary'
import { WorkoutXpSummary } from '@/features/running/components/WorkoutXpSummary'
import { WorkoutAchievementStrip } from '@/features/running/components/WorkoutAchievementStrip'
import { WorkoutPrStrip } from '@/features/running/components/WorkoutPrStrip'
import { WorkoutDetailActions } from '@/features/running/components/WorkoutDetailActions'
import type { WorkoutDetail } from '@/features/running/types/workout-detail'

const mockWorkout: WorkoutDetail = {
  id: 'w1', status: 'completed', startedAt: '2025-01-01', endedAt: '2025-01-01', distanceM: 5000, durationS: 1800, avgPaceSPerKm: 360, routePoints: [], territoryCaptures: [], territoryBreakdown: { claimed: 1, stolen: 0, defended: 0, totalImpact: 1 }, xpBreakdown: { baseXp: 25, captureXp: 10, stealXp: 0, totalXp: 35, levelReached: 2, progressPct: 50 }, achievementsUnlocked: [], prFlags: { fastest1k: false, fastest5k: true, fastest10k: false, longestRun: false, mostXp: false, mostTerritory: false, mostEfficient: false, territoryEfficiency: false, records: [] }
}

describe('Workout Summaries', () => {
  it('renders TerritorySummary', () => {
    const { getByText } = render(<WorkoutTerritorySummary workout={mockWorkout} />)
    expect(getByText('1 Cells')).toBeTruthy()
  })

  it('renders XpSummary', () => {
    const { getByText } = render(<WorkoutXpSummary workout={mockWorkout} />)
    expect(getByText('+35')).toBeTruthy()
  })

  it('renders AchievementStrip empty', () => {
    const { container } = render(<WorkoutAchievementStrip workout={mockWorkout} />)
    expect(container.firstChild).toBeNull() // should return null when empty
  })

  it('renders PrStrip empty', () => {
    const { container } = render(<WorkoutPrStrip workout={mockWorkout} />)
    expect(container.firstChild).toBeNull() // should return null when empty
  })

  it('renders DetailActions', () => {
    const { getByText } = render(<WorkoutDetailActions workout={mockWorkout} />)
    expect(getByText('Share Run')).toBeTruthy()
  })
})
