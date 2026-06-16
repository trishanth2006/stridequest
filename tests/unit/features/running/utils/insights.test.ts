import { buildInsights } from '@/features/running/utils/insights'
import type { WorkoutSplit } from '@/features/running/types/workout-detail'

function split(index: number, paceSPerKm: number, flags: Partial<WorkoutSplit> = {}): WorkoutSplit {
  return {
    index,
    distanceM: 1000,
    durationS: paceSPerKm,
    paceSPerKm,
    isFastest: false,
    isSlowest: false,
    ...flags,
  }
}

const splits: WorkoutSplit[] = [
  split(1, 300),
  split(2, 240, { isFastest: true }),
  split(3, 360, { isSlowest: true }),
]

const byId = (insights: ReturnType<typeof buildInsights>, id: string) =>
  insights.find((i) => i.id === id)

describe('buildInsights', () => {
  it('generates the full deterministic insight set when data is present', () => {
    const insights = buildInsights({
      splits,
      distanceM: 3000,
      totalXp: 63,
      cellsCaptured: 4,
      captureDistancesM: [100, 300, 500, 700],
    })

    const push = byId(insights, 'strongest-push')
    expect(push?.value).toBe('4 cells')
    expect(push?.detail).toContain('600')

    expect(byId(insights, 'efficiency')?.value).toBe('21 XP/km')

    // paces [300,240,360] → mean 300, popn stddev ~49 → ~16%
    expect(byId(insights, 'consistency')?.value).toBe('16% variation')

    const best = byId(insights, 'best-segment')
    expect(best?.value).toBe('Split 2')
    expect(best?.detail).toBe('4:00/km')

    expect(byId(insights, 'territory-efficiency')?.value).toBe('1.3 cells/km')
  })

  it('omits territory insights when nothing was captured', () => {
    const insights = buildInsights({
      splits,
      distanceM: 3000,
      totalXp: 63,
      cellsCaptured: 0,
      captureDistancesM: [],
    })

    expect(byId(insights, 'strongest-push')).toBeUndefined()
    expect(byId(insights, 'territory-efficiency')).toBeUndefined()
    expect(byId(insights, 'efficiency')).toBeDefined()
    expect(byId(insights, 'best-segment')).toBeDefined()
  })

  it('requires at least two captures for a strongest push', () => {
    const insights = buildInsights({
      splits,
      distanceM: 3000,
      totalXp: 63,
      cellsCaptured: 1,
      captureDistancesM: [500],
    })
    expect(byId(insights, 'strongest-push')).toBeUndefined()
    // a single capture still yields a territory efficiency ratio
    expect(byId(insights, 'territory-efficiency')).toBeDefined()
  })

  it('returns an empty list when there is no usable data', () => {
    expect(
      buildInsights({ splits: [], distanceM: 0, totalXp: 0, cellsCaptured: 0, captureDistancesM: [] }),
    ).toEqual([])
  })
})
