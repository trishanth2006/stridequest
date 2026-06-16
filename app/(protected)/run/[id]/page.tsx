import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/infrastructure/supabase/server'
import { getWorkoutDetail } from '@/features/running/services/workout-detail'
import { WorkoutDetailHeader } from '@/features/running/components/WorkoutDetailHeader'
import { WorkoutRouteMap } from '@/features/running/components/WorkoutRouteMap'
import { WorkoutCharts } from '@/features/running/components/WorkoutCharts'
import { WorkoutElevationChart } from '@/features/running/components/WorkoutElevationChart'
import { WorkoutInsights } from '@/features/running/components/WorkoutInsights'
import { WorkoutComparisonCard } from '@/features/running/components/WorkoutComparisonCard'
import { TerritoryBattleReport } from '@/features/running/components/TerritoryBattleReport'
import { WorkoutSplitsTable } from '@/features/running/components/WorkoutSplitsTable'
import { WorkoutAchievementStrip } from '@/features/running/components/WorkoutAchievementStrip'
import { WorkoutPrStrip } from '@/features/running/components/WorkoutPrStrip'
import { WorkoutDetailActions } from '@/features/running/components/WorkoutDetailActions'
import { ArrowLeft } from 'lucide-react'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  void params
  return { title: 'Workout Detail — StrideQuest' }
}

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const workout = await getWorkoutDetail(supabase, id)

  if (!workout) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-8 pb-24 pt-24 max-w-4xl mx-auto w-full px-4">
      
      {/* Top Nav */}
      <div className="flex items-center gap-4">
        <Link
          href="/run/history"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] text-muted-foreground hover:text-foreground hover:bg-white/[0.08] transition-all duration-200"
          aria-label="Back to History"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {new Date(workout.startedAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </h1>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">
            {new Date(workout.startedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} • {workout.status}
          </p>
        </div>
      </div>

      {/* Hero Summary */}
      <WorkoutDetailHeader workout={workout} />

      {/* Territory Battle Report */}
      <TerritoryBattleReport workout={workout} />

      {/* Hero Route Map */}
      <WorkoutRouteMap
        routePoints={workout.routePoints}
        capturedCellIds={workout.territoryCaptures.map(c => c.cellId)}
      />

      {/* Historical Comparison */}
      <WorkoutComparisonCard comparison={workout.comparison} />

      {/* Deterministic Insights */}
      <WorkoutInsights insights={workout.insights} />

      {/* Splits */}
      <WorkoutSplitsTable splits={workout.splits} />

      {/* Pace + Speed Charts */}
      <WorkoutCharts chartSeries={workout.chartSeries} />

      {/* Elevation Analytics */}
      <WorkoutElevationChart chartSeries={workout.chartSeries} elevation={workout.elevation} />

      {/* Achievements & PRs */}
      <div className="flex flex-col gap-4 w-full">
        <WorkoutPrStrip workout={workout} />
        <WorkoutAchievementStrip workout={workout} />
      </div>

      {/* Actions */}
      <div className="mt-8 flex justify-center">
        <WorkoutDetailActions workout={workout} />
      </div>
    </div>
  )
}
