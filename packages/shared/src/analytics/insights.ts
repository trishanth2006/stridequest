/**
 * Pure insights builder for mobile — mirrors features/running/utils/insights.ts.
 * Will be consolidated into packages/shared/src/analytics/insights.ts in Sprint 5.
 */
import type { WorkoutSplit } from './telemetry'

const PUSH_WINDOW_M = 1000

export type WorkoutInsight = {
  id: string
  label: string
  value: string
  detail: string | null
}

export type InsightInput = {
  splits: WorkoutSplit[]
  distanceM: number
  totalXp: number
  cellsCaptured: number
  captureDistancesM: number[]
}

function formatPaceStr(secondsPerKm: number): string {
  const mins = Math.floor(secondsPerKm / 60)
  const secs = Math.round(secondsPerKm % 60)
  return `${mins}:${String(secs).padStart(2, '0')}/km`
}

function strongestPush(
  captureDistancesM: number[],
): { count: number; spanM: number } | null {
  if (captureDistancesM.length < 2) return null
  const sorted = [...captureDistancesM].sort((a, b) => a - b)
  let best = { count: 1, spanM: 0 }
  let left = 0
  for (let right = 0; right < sorted.length; right++) {
    while (sorted[right] - sorted[left] > PUSH_WINDOW_M) left++
    const count = right - left + 1
    if (count > best.count) best = { count, spanM: sorted[right] - sorted[left] }
  }
  return best.count >= 2 ? best : null
}

function paceVariationPct(splits: WorkoutSplit[]): number | null {
  const paces = splits.filter((s) => s.paceSPerKm > 0).map((s) => s.paceSPerKm)
  if (paces.length < 2) return null
  const mean = paces.reduce((a, b) => a + b, 0) / paces.length
  if (mean <= 0) return null
  const variance = paces.reduce((a, p) => a + (p - mean) ** 2, 0) / paces.length
  return Math.round((Math.sqrt(variance) / mean) * 100)
}

export function buildInsights(input: InsightInput): WorkoutInsight[] {
  const { splits, distanceM, totalXp, cellsCaptured, captureDistancesM } = input
  const insights: WorkoutInsight[] = []
  const km = distanceM / 1000

  const push = strongestPush(captureDistancesM)
  if (push) {
    insights.push({
      id: 'strongest-push',
      label: 'Strongest Push',
      value: `${push.count} cells`,
      detail: `within ${Math.round(push.spanM)} m`,
    })
  }

  const fastest = splits.find((s) => s.isFastest) ?? null
  if (fastest) {
    insights.push({
      id: 'best-segment',
      label: 'Best Segment',
      value: `Split ${fastest.index}`,
      detail: formatPaceStr(fastest.paceSPerKm),
    })
  }

  if (km > 0 && totalXp > 0) {
    insights.push({
      id: 'efficiency',
      label: 'Efficiency',
      value: `${Math.round(totalXp / km)} XP/km`,
      detail: null,
    })
  }

  const variation = paceVariationPct(splits)
  if (variation !== null) {
    insights.push({
      id: 'consistency',
      label: 'Consistency',
      value: `${variation}% variation`,
      detail: null,
    })
  }

  if (km > 0 && cellsCaptured > 0) {
    insights.push({
      id: 'territory-efficiency',
      label: 'Territory Efficiency',
      value: `${(cellsCaptured / km).toFixed(1)} cells/km`,
      detail: null,
    })
  }

  return insights
}
