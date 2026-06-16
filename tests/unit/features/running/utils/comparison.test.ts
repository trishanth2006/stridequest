import {
  buildComparison,
  type CompletedWorkoutLite,
  type RouteAnchor,
} from '@/features/running/utils/comparison'

const current: CompletedWorkoutLite = {
  id: 'cur',
  startedAt: '2025-02-10T10:00:00Z',
  distanceM: 5000,
  durationS: 1500,
  paceSPerKm: 300,
  xp: 50,
}

const prevRun: CompletedWorkoutLite = {
  id: 'w_prev',
  startedAt: '2025-02-09T10:00:00Z',
  distanceM: 5000,
  durationS: 1560,
  paceSPerKm: 312,
  xp: 48,
}
const pbRun: CompletedWorkoutLite = {
  id: 'w_pb',
  startedAt: '2025-02-01T10:00:00Z',
  distanceM: 5000,
  durationS: 1400,
  paceSPerKm: 280,
  xp: 55,
}
const oldRun: CompletedWorkoutLite = {
  id: 'w_old',
  startedAt: '2025-01-01T10:00:00Z',
  distanceM: 4000,
  durationS: 1400,
  paceSPerKm: 350,
  xp: 40,
}

const history = [prevRun, pbRun, oldRun]

const entry = (c: ReturnType<typeof buildComparison>, key: string) =>
  c.entries.find((e) => e.key === key)

describe('buildComparison', () => {
  it('reports no history when there are no prior workouts', () => {
    const result = buildComparison(current, null, [], [])
    expect(result.hasHistory).toBe(false)
    expect(result.entries).toEqual([])
    expect(result.routeMatch).toBeNull()
  })

  it('compares against the previous run', () => {
    const prev = entry(buildComparison(current, null, history, []), 'previous')
    expect(prev?.deltas).toEqual({
      distanceDeltaM: 0,
      paceDeltaSPerKm: -12, // 12 s/km faster
      timeDeltaS: -60,
      xpDelta: 2,
    })
  })

  it('compares against the personal best (fastest pace)', () => {
    const pb = entry(buildComparison(current, null, history, []), 'personalBest')
    // current 300 vs PB 280 → 20 s/km slower
    expect(pb?.deltas.paceDeltaSPerKm).toBe(20)
  })

  it('averages the last 7 and 30 days separately', () => {
    const result = buildComparison(current, null, history, [])
    // weekly window includes only prevRun (02-09)
    expect(entry(result, 'weeklyAverage')?.deltas.paceDeltaSPerKm).toBe(-12)
    // monthly window includes prevRun + pbRun → avg pace 296 → delta +4
    expect(entry(result, 'monthlyAverage')?.deltas.paceDeltaSPerKm).toBe(4)
  })

  it('matches a prior run on the same route and reports the improvement', () => {
    const currentAnchor: RouteAnchor = {
      workoutId: 'cur',
      startLat: 0,
      startLng: 0,
      endLat: 0.01,
      endLng: 0,
    }
    const anchors: RouteAnchor[] = [
      // ~55 m from current start and end → within the 100 m radius
      { workoutId: 'w_prev', startLat: 0.0005, startLng: 0, endLat: 0.0105, endLng: 0 },
      { workoutId: 'w_pb', startLat: 1, startLng: 1, endLat: 1, endLng: 1 },
    ]

    const result = buildComparison(current, currentAnchor, history, anchors)
    expect(result.routeMatch?.matchedWorkoutId).toBe('w_prev')
    expect(result.routeMatch?.timeDeltaS).toBe(-60) // 60 s faster
    expect(result.routeMatch?.pacePctImprovement).toBeCloseTo(3.8, 1)
  })

  it('does not match when start/end are too far apart', () => {
    const currentAnchor: RouteAnchor = {
      workoutId: 'cur',
      startLat: 0,
      startLng: 0,
      endLat: 0.01,
      endLng: 0,
    }
    const anchors: RouteAnchor[] = [
      { workoutId: 'w_prev', startLat: 5, startLng: 5, endLat: 5, endLng: 5 },
    ]
    expect(buildComparison(current, currentAnchor, history, anchors).routeMatch).toBeNull()
  })
})
