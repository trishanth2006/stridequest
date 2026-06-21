import type { DashboardActivityRow } from '../services/history'

export type DashboardComputedStats = {
  today: {
    distanceM: number
    durationS: number
    runCount: number
    xpAwarded: number
  }
  thisWeekRunCount: number
  thisWeekActiveDays: boolean[] // index 0=Mon, 1=Tue, ..., 6=Sun
  streakDays: number
  recentWorkouts: DashboardActivityRow[]
}

function toUtcDateStr(iso: string): string {
  return iso.slice(0, 10)
}

function getUtcDateStr(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function getMondayUtc(date: Date): Date {
  const d = new Date(date)
  const day = d.getUTCDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/**
 * Derives all dashboard display values from a sorted (newest-first) array of
 * recent workout rows. No I/O — injecting `now` keeps it testable.
 *
 * "Today" and all date boundaries use UTC. A run at 23:50 local time may fall
 * on the next UTC day; this is an accepted MVP tradeoff.
 */
export function computeDashboardStats(
  rows: DashboardActivityRow[],
  now: Date,
): DashboardComputedStats {
  const todayStr = getUtcDateStr(now)
  const mondayStr = getUtcDateStr(getMondayUtc(now))

  // ── Today ──
  const todayRows = rows.filter((r) => toUtcDateStr(r.started_at) === todayStr)
  const today = {
    distanceM: todayRows.reduce((s, r) => s + (r.distance_m ?? 0), 0),
    durationS: todayRows.reduce((s, r) => s + (r.duration_s ?? 0), 0),
    runCount: todayRows.length,
    xpAwarded: todayRows.reduce((s, r) => s + (r.xp_awarded ?? 0), 0),
  }

  // ── This week (Mon–Sun) ──
  const weekRows = rows.filter((r) => toUtcDateStr(r.started_at) >= mondayStr)
  const thisWeekRunCount = weekRows.length

  const thisWeekActiveDays: boolean[] = [false, false, false, false, false, false, false]
  for (const r of weekRows) {
    const dayOfWeek = new Date(r.started_at).getUTCDay() // 0=Sun
    const idx = dayOfWeek === 0 ? 6 : dayOfWeek - 1     // 0=Mon ... 6=Sun
    thisWeekActiveDays[idx] = true
  }

  // ── Streak ──
  // Build a set of unique UTC date strings from the input window.
  const activeDateSet = new Set(rows.map((r) => toUtcDateStr(r.started_at)))

  const cursor = new Date(now)
  cursor.setUTCHours(0, 0, 0, 0)

  // If the user hasn't run today, start counting from yesterday so an
  // in-progress streak doesn't reset at midnight.
  if (!activeDateSet.has(getUtcDateStr(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }

  let streakDays = 0
  while (activeDateSet.has(getUtcDateStr(cursor))) {
    streakDays++
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }

  // ── Recent (first 5 of already-sorted input) ──
  const recentWorkouts = rows.slice(0, 5)

  return { today, thisWeekRunCount, thisWeekActiveDays, streakDays, recentWorkouts }
}
