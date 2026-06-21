const DAY_MS = 24 * 60 * 60 * 1000

export function formatRelativeDate(isoString: string): string {
  const date = new Date(isoString)
  const nowDate = new Date()

  const todayStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate())
  const yesterdayStart = new Date(todayStart.getTime() - DAY_MS)

  const inputStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (inputStart.getTime() === todayStart.getTime()) return 'Today'
  if (inputStart.getTime() === yesterdayStart.getTime()) return 'Yesterday'

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
