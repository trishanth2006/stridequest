import { render } from '@testing-library/react'
import { WorkoutDetailHeader } from '@/features/running/components/WorkoutDetailHeader'
import type { WorkoutDetail } from '@/features/running/types/workout-detail'

const mockWorkout: WorkoutDetail = {
  id: 'w1',
  status: 'completed',
  startedAt: '2025-01-01',
  endedAt: '2025-01-01',
  distanceM: 5000,
  durationS: 1800,
  avgPaceSPerKm: 360,
  routePoints: [],
  territoryCaptures: [],
  territoryBreakdown: { claimed: 1, stolen: 0, defended: 0, totalImpact: 1 },
  xpBreakdown: { baseXp: 25, captureXp: 10, stealXp: 0, totalXp: 35, levelReached: 2, progressPct: 50 },
  achievementsUnlocked: [],
  prFlags: { fastest1k: false, fastest5k: true, fastest10k: false, longestRun: false, mostXp: false, mostTerritory: false, mostEfficient: false, territoryEfficiency: false, records: [{ id: 'fastest-5k', title: 'Fastest 5K', value: 1800, workoutId: 'w1', achievedAt: '2025-01-01' }] },
  splits: [],
  elevation: { hasData: false, gainM: 0, lossM: 0, highestM: null, lowestM: null },
  insights: [],
  comparison: { hasHistory: false, entries: [], routeMatch: null },
  chartSeries: []
}

describe('WorkoutDetailHeader', () => {
  it('renders distance and stats correctly', () => {
    const { getByText } = render(<WorkoutDetailHeader workout={mockWorkout} />)
    expect(getByText('5.00 km')).toBeTruthy()
    expect(getByText('+35')).toBeTruthy()
    expect(getByText('1 Captured')).toBeTruthy()
    expect(getByText('Fastest 5K')).toBeTruthy()
  })
})
