import Link from 'next/link'
import { createClient } from '@/infrastructure/supabase/server'
import { getWorkoutHistory } from '@/features/running/services/history'
import { RunHistory } from '@/features/running/components/RunHistory'
import {
  ArrowLeft, Calendar, Play,
} from 'lucide-react'

export const metadata = { title: 'Run History — StrideQuest' }

export default async function HistoryPage() {
  const supabase = await createClient()
  const { data: workouts, error } = await getWorkoutHistory(supabase)

  return (
    <div className="flex flex-col gap-6 pb-12 pt-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/run"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] text-muted-foreground hover:text-foreground hover:bg-white/[0.08] transition-all duration-200"
            aria-label="Back to run"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Run History
            </h1>
            <p className="text-xs text-muted-foreground">
              Your completed runs
            </p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          role="alert"
          data-testid="history-error"
          className="rounded-xl border border-destructive/60 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Could not load workout history. Please try again later.
        </div>
      )}

      {/* Empty state */}
      {!error && (!workouts || workouts.length === 0) && (
        <div
          data-testid="history-empty"
          className="bg-card rounded-2xl border border-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] p-12 flex flex-col items-center justify-center text-center min-h-[240px]"
        >
          <Calendar className="w-10 h-10 text-muted-foreground/30 mb-4" />
          <p className="text-lg font-semibold text-foreground mb-1">
            No runs yet
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Complete your first run to see it here
          </p>
          <Link
            href="/run"
            className="inline-flex items-center gap-2 rounded-xl bg-primary/10 px-5 py-2.5 text-sm font-bold text-primary hover:bg-primary/20 transition-colors"
          >
            <Play className="w-4 h-4" fill="currentColor" />
            Start a run
          </Link>
        </div>
      )}

      {/* Workout list */}
      {workouts && workouts.length > 0 && (
        <RunHistory workouts={workouts} />
      )}
    </div>
  )
}
