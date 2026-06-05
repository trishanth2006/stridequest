import { render } from '@testing-library/react'
import { WorkoutMetricsGrid } from '@/features/running/components/WorkoutMetricsGrid'
import type { WorkoutDetail } from '@/features/running/types/workout-detail'

const mockWorkout: WorkoutDetail = {
  id: 'w1', status: 'completed', startedAt: '2025-01-01', endedAt: '2025-01-01', distanceM: 5000, durationS: 1800, avgPaceSPerKm: 360, routePoints: [], territoryCaptures: [], territoryBreakdown: { claimed: 1, stolen: 0, defended: 0, totalImpact: 1 }, xpBreakdown: { baseXp: 25, captureXp: 10, stealXp: 0, totalXp: 35, levelReached: 2, progressPct: 50 }, achievementsUnlocked: [], prFlags: { fastest1k: false, fastest5k: true, fastest10k: false, longestRun: false, mostXp: false, mostTerritory: false, mostEfficient: false, territoryEfficiency: false, records: [] }
}

describe('WorkoutMetricsGrid', () => {
  it('renders without crashing', () => {
    const { container } = render(<WorkoutMetricsGrid workout={mockWorkout} />)
    expect(container).toBeTruthy()
  })
})
