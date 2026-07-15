/**
 * @jest-environment node
 */
import {
  bestKmPaceSPerKm,
  evaluateQuestProgress,
  type ActiveQuest,
  type QuestRoutePoint,
  type QuestWorkoutContext,
} from '@stridequest/shared/gamification'

// ── Fixture helpers ───────────────────────────────────────────────────────────

// Metres per degree of latitude along a meridian (exact for haversine when lng is constant).
const M_PER_DEG_LAT = 6_371_000 * (Math.PI / 180)

const BASE_LAT = 40
const BASE_LNG = -74
const BASE_TS = Date.parse('2026-06-24T06:00:00.000Z')

/**
 * Build a route moving purely north (lng constant) so haversine collapses to R*Δlat.
 * `steps` segments of `stepMeters` each, with per-segment durations `stepDurationsS`.
 */
function buildRoute(stepMeters: number, stepDurationsS: number[]): QuestRoutePoint[] {
  const dLat = stepMeters / M_PER_DEG_LAT
  const points: QuestRoutePoint[] = [
    { lat: BASE_LAT, lng: BASE_LNG, timestamp: new Date(BASE_TS).toISOString() },
  ]
  let t = BASE_TS
  for (let i = 0; i < stepDurationsS.length; i++) {
    t += stepDurationsS[i] * 1000
    points.push({
      lat: BASE_LAT + dLat * (i + 1),
      lng: BASE_LNG,
      timestamp: new Date(t).toISOString(),
    })
  }
  return points
}

/**
 * Build a single straight segment (TWO points) of `totalMeters` over
 * `totalDurationS`, moving purely north. Forces the inner bucket `while` loop to
 * iterate multiple times for one point pair when totalMeters spans >1 km.
 */
function buildSegment(totalMeters: number, totalDurationS: number): QuestRoutePoint[] {
  const dLat = totalMeters / M_PER_DEG_LAT
  return [
    { lat: BASE_LAT, lng: BASE_LNG, timestamp: new Date(BASE_TS).toISOString() },
    {
      lat: BASE_LAT + dLat,
      lng: BASE_LNG,
      timestamp: new Date(BASE_TS + totalDurationS * 1000).toISOString(),
    },
  ]
}

function makeContext(overrides: Partial<QuestWorkoutContext> = {}): QuestWorkoutContext {
  return {
    distanceM: 0,
    durationS: 0,
    avgPaceSPerKm: null,
    bestKmPaceSPerKm: null,
    cellsClaimed: 0,
    cellsStolen: 0,
    cellsDefended: 0,
    completedAtHourUTC: 12,
    ...overrides,
  }
}

const Q_USER = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const Q_QUEST = '9c5b94b1-35ad-49bb-b118-8e8fc24abf80'
const Q_USER_2 = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const Q_QUEST_2 = '6ec0bd7f-11c0-43da-975e-2a8ad9ebae0b'

function makeQuest(overrides: Partial<ActiveQuest> = {}): ActiveQuest {
  return {
    userQuestId: Q_USER,
    questId: Q_QUEST,
    slug: 'daily-distance',
    title: 'Daily Distance',
    description: 'Run a target distance today.',
    type: 'distance_total',
    targetValue: 3000,
    rewardXp: 50,
    durationType: 'daily',
    rewardBadgeIcon: null,
    rewardBadgeLabel: null,
    windowEndHour: null,
    status: 'active',
    currentValue: 0,
    expiresAt: '2026-06-25T00:00:00.000Z',
    ...overrides,
  }
}

// ── bestKmPaceSPerKm ──────────────────────────────────────────────────────────

describe('bestKmPaceSPerKm', () => {
  it('returns null for an empty route', () => {
    expect(bestKmPaceSPerKm([])).toBeNull()
  })

  it('returns null for a single point', () => {
    expect(
      bestKmPaceSPerKm([
        { lat: BASE_LAT, lng: BASE_LNG, timestamp: new Date(BASE_TS).toISOString() },
      ]),
    ).toBeNull()
  })

  it('returns null when the route is shorter than 1 km', () => {
    // 8 steps * 100 m = 800 m < 1000 m
    const route = buildRoute(100, Array(8).fill(30))
    expect(bestKmPaceSPerKm(route)).toBeNull()
  })

  it('returns ~constant pace for a steady ~2 km route', () => {
    // 20 steps * 100 m = 2000 m; 30 s/step => 10 steps/km => 300 s/km
    const route = buildRoute(100, Array(20).fill(30))
    const pace = bestKmPaceSPerKm(route)
    expect(pace).not.toBeNull()
    expect(pace as number).toBeCloseTo(300, 0)
    expect(Math.abs((pace as number) - 300)).toBeLessThanOrEqual(2)
  })

  it('returns the faster km when the 2nd km is clearly faster', () => {
    // km1: 10 * 30 s = 300 s/km ; km2: 10 * 15 s = 150 s/km ; min = 150
    const durations = [...Array(10).fill(30), ...Array(10).fill(15)]
    const route = buildRoute(100, durations)
    const pace = bestKmPaceSPerKm(route)
    expect(pace).not.toBeNull()
    expect(pace as number).toBeCloseTo(150, 0)
    expect(Math.abs((pace as number) - 150)).toBeLessThanOrEqual(2)
  })

  it('handles a single GPS segment spanning multiple km boundaries (inner while iterates)', () => {
    // ONE segment of 2000 m over 600 s at constant speed => 300 s/km for both km.
    // The inner bucket loop must cross boundaries at 1000 m AND 2000 m for one i.
    const route = buildSegment(2000, 600)
    expect(route).toHaveLength(2)
    const pace = bestKmPaceSPerKm(route)
    expect(pace).not.toBeNull()
    expect(pace as number).toBeCloseTo(300, 0)
    expect(Math.abs((pace as number) - 300)).toBeLessThanOrEqual(2)
  })

  it('accepts a route of exactly 1000 m (strict < 1000 boundary lets it through)', () => {
    // Exactly one full km over 330 s => 330 s/km; total === FULL_KM_M must NOT be null.
    const route = buildSegment(1000, 330)
    const pace = bestKmPaceSPerKm(route)
    expect(pace).not.toBeNull()
    expect(pace as number).toBeCloseTo(330, 0)
    expect(Math.abs((pace as number) - 330)).toBeLessThanOrEqual(2)
  })

  it('returns the minimum (faster) km across two distinct segments', () => {
    // km1: 10 * 36 s = 360 s/km ; km2: 10 * 18 s = 180 s/km ; min = 180.
    const durations = [...Array(10).fill(36), ...Array(10).fill(18)]
    const route = buildRoute(100, durations)
    const pace = bestKmPaceSPerKm(route)
    expect(pace).not.toBeNull()
    expect(pace as number).toBeCloseTo(180, 0)
    expect(Math.abs((pace as number) - 180)).toBeLessThanOrEqual(2)
  })
})

// ── evaluateQuestProgress ─────────────────────────────────────────────────────

describe('evaluateQuestProgress', () => {
  it('distance_total partial: accumulates without completing', () => {
    const quest = makeQuest({ targetValue: 3000, currentValue: 0 })
    const result = evaluateQuestProgress(makeContext({ distanceM: 2000 }), [quest])
    expect(result).toEqual([
      { userQuestId: Q_USER, questId: Q_QUEST, valueAdded: 2000, newValue: 2000, completed: false },
    ])
  })

  it('distance_total overshoot clamps to remaining target', () => {
    const quest = makeQuest({ targetValue: 3000, currentValue: 0 })
    const result = evaluateQuestProgress(makeContext({ distanceM: 4000 }), [quest])
    expect(result).toEqual([
      { userQuestId: Q_USER, questId: Q_QUEST, valueAdded: 3000, newValue: 3000, completed: true },
    ])
  })

  it('distance_total resume + complete', () => {
    const quest = makeQuest({ targetValue: 3000, currentValue: 2000 })
    const result = evaluateQuestProgress(makeContext({ distanceM: 2000 }), [quest])
    expect(result).toEqual([
      { userQuestId: Q_USER, questId: Q_QUEST, valueAdded: 1000, newValue: 3000, completed: true },
    ])
  })

  it('territory_claim complete', () => {
    const quest = makeQuest({ type: 'territory_claim', targetValue: 3, currentValue: 0 })
    const result = evaluateQuestProgress(makeContext({ cellsClaimed: 3 }), [quest])
    expect(result).toEqual([
      { userQuestId: Q_USER, questId: Q_QUEST, valueAdded: 3, newValue: 3, completed: true },
    ])
  })

  it('pace_best_km success: threshold met emits binary 1 and completes', () => {
    const quest = makeQuest({ type: 'pace_best_km', targetValue: 360, currentValue: 0 })
    const result = evaluateQuestProgress(makeContext({ bestKmPaceSPerKm: 330 }), [quest])
    expect(result).toEqual([
      { userQuestId: Q_USER, questId: Q_QUEST, valueAdded: 1, newValue: 1, completed: true },
    ])
  })

  it('pace_best_km miss: threshold not met emits nothing', () => {
    const quest = makeQuest({ type: 'pace_best_km', targetValue: 360, currentValue: 0 })
    const result = evaluateQuestProgress(makeContext({ bestKmPaceSPerKm: 400 }), [quest])
    expect(result).toEqual([])
  })

  it('pace_best_km with null bestKmPaceSPerKm emits nothing', () => {
    const quest = makeQuest({ type: 'pace_best_km', targetValue: 360, currentValue: 0 })
    const result = evaluateQuestProgress(makeContext({ bestKmPaceSPerKm: null }), [quest])
    expect(result).toEqual([])
  })

  it('window gate pass: finishing before the cutoff hour qualifies', () => {
    const quest = makeQuest({ targetValue: 5000, currentValue: 0, windowEndHour: 8 })
    const result = evaluateQuestProgress(
      makeContext({ distanceM: 5000, completedAtHourUTC: 7 }),
      [quest],
    )
    expect(result).toEqual([
      { userQuestId: Q_USER, questId: Q_QUEST, valueAdded: 5000, newValue: 5000, completed: true },
    ])
  })

  it('window gate fail: finishing at/after the cutoff hour emits nothing', () => {
    const quest = makeQuest({ targetValue: 5000, currentValue: 0, windowEndHour: 8 })
    const result = evaluateQuestProgress(
      makeContext({ distanceM: 5000, completedAtHourUTC: 9 }),
      [quest],
    )
    expect(result).toEqual([])
  })

  it('window gate boundary: completedAtHourUTC equal to windowEndHour does not qualify', () => {
    const quest = makeQuest({ targetValue: 5000, currentValue: 0, windowEndHour: 8 })
    const result = evaluateQuestProgress(
      makeContext({ distanceM: 5000, completedAtHourUTC: 8 }),
      [quest],
    )
    expect(result).toEqual([])
  })

  it('multiple quests: returns only those with progress, in input order', () => {
    const distance = makeQuest({
      userQuestId: Q_USER,
      questId: Q_QUEST,
      type: 'distance_total',
      targetValue: 3000,
      currentValue: 0,
    })
    const paceMiss = makeQuest({
      userQuestId: Q_USER_2,
      questId: Q_QUEST_2,
      type: 'pace_best_km',
      targetValue: 300,
      currentValue: 0,
    })
    const territory = makeQuest({
      userQuestId: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed',
      questId: 'c9bf9e57-1685-4c89-bafb-ff5af830be8a',
      type: 'territory_claim',
      targetValue: 2,
      currentValue: 0,
    })
    const ctx = makeContext({ distanceM: 1500, bestKmPaceSPerKm: 400, cellsClaimed: 2 })
    const result = evaluateQuestProgress(ctx, [distance, paceMiss, territory])
    // paceMiss filtered out (400 > 300); distance + territory kept, in order.
    expect(result).toEqual([
      { userQuestId: Q_USER, questId: Q_QUEST, valueAdded: 1500, newValue: 1500, completed: false },
      {
        userQuestId: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed',
        questId: 'c9bf9e57-1685-4c89-bafb-ff5af830be8a',
        valueAdded: 2,
        newValue: 2,
        completed: true,
      },
    ])
  })

  it('already-met quest (currentValue >= target) emits nothing', () => {
    const quest = makeQuest({ targetValue: 3000, currentValue: 3000 })
    const result = evaluateQuestProgress(makeContext({ distanceM: 2000 }), [quest])
    expect(result).toEqual([])
  })

  it('never emits negative valueAdded and does not mutate inputs', () => {
    const quest = makeQuest({ targetValue: 3000, currentValue: 0 })
    const frozen = Object.freeze({ ...quest })
    const ctx = makeContext({ distanceM: 500 })
    const frozenCtx = Object.freeze({ ...ctx })
    const result = evaluateQuestProgress(frozenCtx, [frozen])
    expect(result[0].valueAdded).toBeGreaterThan(0)
    // Inputs untouched.
    expect(frozen.currentValue).toBe(0)
    expect(frozenCtx.distanceM).toBe(500)
  })
})
