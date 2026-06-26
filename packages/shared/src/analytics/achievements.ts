export type AchievementCategory = 'running' | 'territory' | 'xp'

export type Achievement = {
  id: string
  title: string
  description: string
  icon: string
  unlocked: boolean
  progress: number
  target: number
  category: AchievementCategory
  unlockedAt?: string
}

export type AchievementWorkoutRow = {
  id: string
  started_at: string
  distance_m: number | null
  xp_awarded: number | null
  status: string
}

export type CaptureRow = {
  cell_id: string
  captured_at: string
  action: string
}

export type XpEventRow = {
  xp_awarded: number | null
  created_at: string
  workout_id?: string
}

function getDistanceMilestoneDate(workouts: AchievementWorkoutRow[], threshold: number): string | undefined {
  let cumulative = 0
  const sorted = [...workouts].sort(
    (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
  )
  for (const w of sorted) {
    cumulative += w.distance_m ?? 0
    if (cumulative >= threshold) return w.started_at
  }
  return undefined
}

function getXpMilestoneDate(
  xpEvents: XpEventRow[],
  workouts: AchievementWorkoutRow[],
  threshold: number,
): string | undefined {
  if (xpEvents.length > 0) {
    const sorted = [...xpEvents].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )
    let cumulative = 0
    for (const e of sorted) {
      cumulative += e.xp_awarded ?? 0
      if (cumulative >= threshold) return e.created_at
    }
  }
  let cumulative = 0
  for (const w of [...workouts].sort(
    (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
  )) {
    cumulative += w.xp_awarded ?? 0
    if (cumulative >= threshold) return w.started_at
  }
  return undefined
}

function computeLevel(totalXp: number): number {
  // Matches getLevelFromXP on web — simple thresholds
  const thresholds = [0, 100, 250, 500, 1000, 2000, 4000, 8000, 16000, 32000]
  let level = 1
  for (let i = 1; i < thresholds.length; i++) {
    if (totalXp >= thresholds[i]) level = i + 1
  }
  return level
}

export function computeAchievements(
  workouts: AchievementWorkoutRow[],
  captures: CaptureRow[],
  totalXp: number,
  xpEvents: XpEventRow[],
): Achievement[] {
  const completed = workouts
    .filter((w) => w.status === 'completed')
    .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())

  const sortedCaptures = [...captures].sort(
    (a, b) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime(),
  )

  const workoutCount = completed.length
  const cumulativeDistance = completed.reduce((sum, w) => sum + (w.distance_m ?? 0), 0)
  const captureCount = captures.length
  const level = computeLevel(totalXp)

  const defs: Omit<Achievement, 'unlocked' | 'unlockedAt'>[] = [
    { id: 'first-run', title: 'First Run', description: 'Complete your first workout', icon: '🏃', progress: workoutCount, target: 1, category: 'running' },
    { id: 'runner', title: 'Runner', description: 'Complete 10 workouts', icon: '🔥', progress: workoutCount, target: 10, category: 'running' },
    { id: 'marathoner', title: 'Marathoner', description: 'Run 42 km cumulative', icon: '🏅', progress: cumulativeDistance, target: 42000, category: 'running' },
    { id: 'distance-beast', title: 'Distance Beast', description: 'Run 100 km cumulative', icon: '💯', progress: cumulativeDistance, target: 100000, category: 'running' },
    { id: 'first-territory', title: 'First Territory', description: 'Capture your first territory cell', icon: '🌍', progress: captureCount, target: 1, category: 'territory' },
    { id: 'explorer', title: 'Explorer', description: 'Capture 50 territory cells', icon: '🗺️', progress: captureCount, target: 50, category: 'territory' },
    { id: 'xp-hunter', title: 'XP Hunter', description: 'Earn 100 XP cumulative', icon: '⭐', progress: totalXp, target: 100, category: 'xp' },
    { id: 'xp-master', title: 'XP Master', description: 'Earn 500 XP cumulative', icon: '⚡', progress: totalXp, target: 500, category: 'xp' },
    { id: 'rising-star', title: 'Rising Star', description: 'Reach Level 3', icon: '🚀', progress: level, target: 3, category: 'xp' },
    { id: 'elite-runner', title: 'Elite Runner', description: 'Reach Level 5', icon: '👑', progress: level, target: 5, category: 'xp' },
  ]

  return defs.map((item) => {
    const unlocked = item.progress >= item.target
    let unlockedAt: string | undefined = undefined
    if (unlocked) {
      if (item.id === 'first-run') unlockedAt = completed[0]?.started_at
      else if (item.id === 'runner') unlockedAt = completed[9]?.started_at
      else if (item.id === 'marathoner') unlockedAt = getDistanceMilestoneDate(completed, 42000)
      else if (item.id === 'distance-beast') unlockedAt = getDistanceMilestoneDate(completed, 100000)
      else if (item.id === 'first-territory') unlockedAt = sortedCaptures[0]?.captured_at
      else if (item.id === 'explorer') unlockedAt = sortedCaptures[49]?.captured_at
      else if (item.id === 'xp-hunter') unlockedAt = getXpMilestoneDate(xpEvents, completed, 100)
      else if (item.id === 'xp-master') unlockedAt = getXpMilestoneDate(xpEvents, completed, 500)
      else if (item.id === 'rising-star') unlockedAt = getXpMilestoneDate(xpEvents, completed, 250)
      else if (item.id === 'elite-runner') unlockedAt = getXpMilestoneDate(xpEvents, completed, 1000)
    }
    return { ...item, unlocked, unlockedAt }
  })
}

export function sortAchievements(achievements: Achievement[]): Achievement[] {
  return [...achievements].sort((a, b) => {
    if (a.unlocked && !b.unlocked) return -1
    if (!a.unlocked && b.unlocked) return 1
    const pctA = a.target > 0 ? a.progress / a.target : 0
    const pctB = b.target > 0 ? b.progress / b.target : 0
    if (pctB !== pctA) return pctB - pctA
    return a.id.localeCompare(b.id)
  })
}
