import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/infrastructure/supabase/server'
import { getWorkoutDetail } from '@/features/running/services/workout-detail'
import { WorkoutDetailHeader } from '@/features/running/components/WorkoutDetailHeader'
import { WorkoutRouteReplay } from '@/features/running/components/WorkoutRouteReplay'
import { WorkoutHighlights } from '@/features/running/components/WorkoutHighlights'
import { WorkoutMetricsGrid } from '@/features/running/components/WorkoutMetricsGrid'
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
    <div className="flex flex-col gap-6 pb-24 pt-24 max-w-7xl mx-auto w-full">
      
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

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Column: Route Replay (40-50% width) */}
        <div className="w-full lg:w-[45%] shrink-0 flex flex-col gap-4">
          <WorkoutRouteReplay 
            routePoints={workout.routePoints} 
            territoryCaptures={workout.territoryCaptures} 
          />
          <WorkoutDetailActions workout={workout} />
        </div>

        {/* Right Column: Details & Stats */}
        <div className="w-full lg:flex-1 flex flex-col gap-6">
          <WorkoutHighlights workout={workout} />
          <WorkoutMetricsGrid workout={workout} />
          
          <div className="flex flex-col gap-4">
            <WorkoutPrStrip workout={workout} />
            <WorkoutAchievementStrip workout={workout} />
          </div>
        </div>
      </div>
    </div>
  )
}
