/**
 * @jest-environment node
 */
import { computeDashboardStats } from '@/features/running/utils/dashboard-stats'
import type { DashboardActivityRow } from '@/features/running/services/history'

// 2026-06-21 (Sunday). Week: Mon 2026-06-15 → Sun 2026-06-21.
const NOW = new Date('2026-06-21T12:00:00Z')

let _id = 0
function row(started_at: string, overrides: Partial<DashboardActivityRow> = {}): DashboardActivityRow {
  return {
    id: `w${++_id}`,
    started_at,
    distance_m: 5000,
    duration_s: 1800,
    xp_awarded: 50,
    ...overrides,
  }
}

describe('computeDashboardStats — today stats', () => {
  it('sums distance and duration only for workouts on the current UTC date', () => {
    const rows = [
      row('2026-06-21T09:00:00Z', { distance_m: 3000, duration_s: 900, xp_awarded: 30 }),
      row('2026-06-21T17:00:00Z', { distance_m: 2000, duration_s: 600, xp_awarded: 20 }),
      row('2026-06-20T23:59:00Z', { distance_m: 9999, duration_s: 9999, xp_awarded: 999 }),
    ]
    const stats = computeDashboardStats(rows, NOW)
    expect(stats.today.distanceM).toBe(5000)
    expect(stats.today.durationS).toBe(1500)
    expect(stats.today.runCount).toBe(2)
    expect(stats.today.xpAwarded).toBe(50)
  })

  it('returns zeros when no workouts today', () => {
    const stats = computeDashboardStats([row('2026-06-20T10:00:00Z')], NOW)
    expect(stats.today.distanceM).toBe(0)
    expect(stats.today.durationS).toBe(0)
    expect(stats.today.runCount).toBe(0)
    expect(stats.today.xpAwarded).toBe(0)
  })

  it('treats null distance_m and xp_awarded as 0', () => {
    const stats = computeDashboardStats(
      [row('2026-06-21T10:00:00Z', { distance_m: null, xp_awarded: null })],
      NOW,
    )
    expect(stats.today.distanceM).toBe(0)
    expect(stats.today.xpAwarded).toBe(0)
  })
})

describe('computeDashboardStats — streak', () => {
  it('counts consecutive days ending today when today has a workout', () => {
    const rows = [
      row('2026-06-21T10:00:00Z'), // today (Sun)
      row('2026-06-20T10:00:00Z'), // yesterday
      row('2026-06-19T10:00:00Z'), // day before
    ]
    expect(computeDashboardStats(rows, NOW).streakDays).toBe(3)
  })

  it('does not reset streak if today has no workout yet (counts from yesterday)', () => {
    const rows = [
      row('2026-06-20T10:00:00Z'), // yesterday
      row('2026-06-19T10:00:00Z'), // day before
    ]
    expect(computeDashboardStats(rows, NOW).streakDays).toBe(2)
  })

  it('returns 0 when no workouts exist', () => {
    expect(computeDashboardStats([], NOW).streakDays).toBe(0)
  })

  it('returns 0 when last workout was two days ago (gap breaks streak)', () => {
    const rows = [row('2026-06-19T10:00:00Z')] // two days ago, no yesterday
    expect(computeDashboardStats(rows, NOW).streakDays).toBe(0)
  })

  it('returns 1 when only yesterday had a workout', () => {
    const rows = [row('2026-06-20T10:00:00Z')]
    expect(computeDashboardStats(rows, NOW).streakDays).toBe(1)
  })
})

describe('computeDashboardStats — weekly bar', () => {
  it('returns 7 booleans, all false for empty input', () => {
    const stats = computeDashboardStats([], NOW)
    expect(stats.thisWeekActiveDays).toHaveLength(7)
    expect(stats.thisWeekActiveDays.every(d => d === false)).toBe(true)
  })

  it('marks index 6 (Sunday) active for a Sunday workout', () => {
    const stats = computeDashboardStats([row('2026-06-21T10:00:00Z')], NOW)
    expect(stats.thisWeekActiveDays[6]).toBe(true) // Sunday
    expect(stats.thisWeekActiveDays[0]).toBe(false) // Monday
  })

  it('marks index 0 (Monday) active for a Monday workout', () => {
    const stats = computeDashboardStats([row('2026-06-15T10:00:00Z')], NOW)
    expect(stats.thisWeekActiveDays[0]).toBe(true)
    expect(stats.thisWeekActiveDays[6]).toBe(false)
  })

  it('does not mark days from the previous week', () => {
    const stats = computeDashboardStats([row('2026-06-14T10:00:00Z')], NOW) // previous Sunday
    expect(stats.thisWeekActiveDays.every(d => d === false)).toBe(true)
  })
})

describe('computeDashboardStats — thisWeekRunCount', () => {
  it('counts runs from Monday through today', () => {
    const rows = [
      row('2026-06-15T10:00:00Z'), // Mon
      row('2026-06-17T10:00:00Z'), // Wed
      row('2026-06-21T10:00:00Z'), // Sun
      row('2026-06-14T10:00:00Z'), // previous Sun — not counted
    ]
    expect(computeDashboardStats(rows, NOW).thisWeekRunCount).toBe(3)
  })
})

describe('computeDashboardStats — recentWorkouts', () => {
  it('returns first 5 rows of input (input must already be newest-first)', () => {
    const rows = Array.from({ length: 8 }, (_, i) =>
      row(`2026-06-${String(21 - i).padStart(2, '0')}T10:00:00Z`)
    )
    const stats = computeDashboardStats(rows, NOW)
    expect(stats.recentWorkouts).toHaveLength(5)
    expect(stats.recentWorkouts[0].started_at).toBe('2026-06-21T10:00:00Z')
  })

  it('returns all rows when fewer than 5', () => {
    const rows = [row('2026-06-21T10:00:00Z'), row('2026-06-20T10:00:00Z')]
    expect(computeDashboardStats(rows, NOW).recentWorkouts).toHaveLength(2)
  })

  it('returns empty array for empty input', () => {
    expect(computeDashboardStats([], NOW).recentWorkouts).toEqual([])
  })
})
