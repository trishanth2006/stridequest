import { WorkoutSummaryCard } from './WorkoutSummaryCard'
import { TerritoryImpactCard } from './TerritoryImpactCard'
import { XPEarnedCard } from '@/features/xp/components/XPEarnedCard'
import type { WorkoutSummary as WorkoutSummaryType } from '../types/workout-summary'
import type { WorkoutXpBreakdown } from '@/features/xp/services/profile'
import type { XpProgress } from '@/features/xp/services/xp'

type Props = {
  summary: WorkoutSummaryType
  xpBreakdown: WorkoutXpBreakdown
  xpProgress: XpProgress
}

export function WorkoutSummary({ summary, xpBreakdown, xpProgress }: Props) {
  return (
    <div className="flex flex-col gap-6 w-full max-w-sm mx-auto animate-in slide-in-from-bottom-4 duration-500 fade-in" data-testid="workout-summary">
      <WorkoutSummaryCard summary={summary} />
      <TerritoryImpactCard summary={summary} />
      <XPEarnedCard breakdown={xpBreakdown} progress={xpProgress} />
    </div>
  )
}
