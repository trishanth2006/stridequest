import { WorkoutSummaryCard } from './WorkoutSummaryCard'
import { TerritoryImpactCard } from './TerritoryImpactCard'
import { XPEarnedCard } from '@/features/xp/components/XPEarnedCard'
import type { WorkoutSummary as WorkoutSummaryType } from '../types/workout-summary'
import type { WorkoutXpBreakdown } from '@/features/xp/services/profile'
import type { XpProgress } from '@/features/xp/services/xp'
import { ShareDialog } from '@/features/share/components/ShareDialog'
import { buildWorkoutShareCard } from '@/features/share/services/share-card'

type Props = {
  summary: WorkoutSummaryType
  xpBreakdown: WorkoutXpBreakdown
  xpProgress: XpProgress
}

export function WorkoutSummary({ summary, xpBreakdown, xpProgress }: Props) {
  const shareCardData = buildWorkoutShareCard({
    distance: summary.distanceM,
    duration: summary.durationS,
    pace: summary.avgPaceSPerKm || 0,
    xp: xpBreakdown.totalXp,
    level: xpProgress.currentLevel,
    territoriesCaptured: summary.cellsClaimed,
    territoriesStolen: summary.cellsStolen,
    date: summary.completedAt || new Date().toISOString(),
    routeData: [], // Default to empty if not provided in summary type
    territoryMarkers: [],
    hasPr: false, // We'd need to fetch PR status to set this
  })

  return (
    <div className="flex flex-col gap-6 w-full max-w-sm mx-auto animate-in slide-in-from-bottom-4 duration-500 fade-in" data-testid="workout-summary">
      <WorkoutSummaryCard summary={summary} />
      <TerritoryImpactCard summary={summary} />
      <XPEarnedCard breakdown={xpBreakdown} progress={xpProgress} />
      
      <div className="flex justify-center mt-4">
        <ShareDialog cardData={shareCardData} />
      </div>
    </div>
  )
}
