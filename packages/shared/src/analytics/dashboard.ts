export type DashboardActivityRow = {
  id: string
  started_at: string
  distance_m: number | null
  duration_s: number | null
  xp_awarded: number | null
}

export type DashboardComputedStats = {
  today: {
    distanceM: number
    durationS: number
    runCount: number
    xpAwarded: number
  }
  thisWeekRunCount: number
  /** index 0=Mon, 1=Tue, ..., 6=Sun */
  thisWeekActiveDays: boolean[]
  streakDays: number
  longestStreakDays: number
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
  const day = d.getUTCDay() // 0=Sun, 1=Mon ... 6=Sat
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/**
 * Pure computation of all dashboard display values from sorted (newest-first)
 * workout rows. No I/O. Mirrors computeDashboardStats on web, with the addition
 * of longestStreakDays. Will be moved to packages/shared in Sprint 5.
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
    const dow = new Date(r.started_at).getUTCDay() // 0=Sun
    const idx = dow === 0 ? 6 : dow - 1           // 0=Mon … 6=Sun
    thisWeekActiveDays[idx] = true
  }

  // ── Build active date set ──
  const activeDateSet = new Set(rows.map((r) => toUtcDateStr(r.started_at)))

  // ── Current streak ──
  const cursorCurrent = new Date(now)
  cursorCurrent.setUTCHours(0, 0, 0, 0)
  if (!activeDateSet.has(getUtcDateStr(cursorCurrent))) {
    cursorCurrent.setUTCDate(cursorCurrent.getUTCDate() - 1)
  }
  let streakDays = 0
  const streakCursor = new Date(cursorCurrent)
  while (activeDateSet.has(getUtcDateStr(streakCursor))) {
    streakDays++
    streakCursor.setUTCDate(streakCursor.getUTCDate() - 1)
  }

  // ── Longest streak (scan all known dates) ──
  const sortedDates = [...activeDateSet].sort()
  let longestStreakDays = 0
  let currentRun = 0
  let prevDate: Date | null = null
  for (const dateStr of sortedDates) {
    const d = new Date(dateStr + 'T00:00:00Z')
    if (prevDate) {
      const diffMs = d.getTime() - prevDate.getTime()
      const diffDays = Math.round(diffMs / 86_400_000)
      if (diffDays === 1) {
        currentRun++
      } else {
        currentRun = 1
      }
    } else {
      currentRun = 1
    }
    if (currentRun > longestStreakDays) longestStreakDays = currentRun
    prevDate = d
  }

  return {
    today,
    thisWeekRunCount,
    thisWeekActiveDays,
    streakDays,
    longestStreakDays,
    recentWorkouts: rows.slice(0, 5),
  }
}
