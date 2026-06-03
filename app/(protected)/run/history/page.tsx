import Link from 'next/link'
import { createClient } from '@/infrastructure/supabase/server'
import { getWorkoutHistory } from '@/features/running/services/history'
import type { WorkoutHistoryRow } from '@/features/running/services/history'
import {
  ArrowLeft, Calendar, Clock, MapPin, Gauge, Play,
} from 'lucide-react'

export const metadata = { title: 'Run History — StrideQuest' }

/** Format distance: sub-km → metres, ≥1 km → X.XX km. */
function formatDistance(meters: number | null): string {
  if (meters === null || meters === 0) return '0 m'
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(2)} km`
}

/** Format seconds into H:MM:SS or MM:SS. */
function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === 0) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`
  return `${m}:${pad(s)}`
}

/** Format pace as M:SS /km. */
function formatPace(paceSecsPerKm: number | null): string {
  if (paceSecsPerKm === null || paceSecsPerKm === 0) return '—'
  const m = Math.floor(paceSecsPerKm / 60)
  const s = paceSecsPerKm % 60
  return `${m}:${String(s).padStart(2, '0')} /km`
}

/** Format ISO timestamp into a human-friendly date + time. */
function formatDate(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    }),
    time: d.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true,
    }),
  }
}

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
        <div data-testid="history-list" className="flex flex-col gap-3">
          {workouts.map((workout: WorkoutHistoryRow) => {
            const { date, time } = formatDate(workout.started_at)
            return (
              <div
                key={workout.id}
                data-testid="history-item"
                className="bg-card rounded-2xl border border-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/10 group"
              >
                {/* Date header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground/60" />
                    <span className="font-medium text-foreground">
                      {date}
                    </span>
                    <span className="text-muted-foreground/60">
                      {time}
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-primary/70">
                    Completed
                  </span>
                </div>

                {/* Metrics row */}
                <div className="grid grid-cols-3 gap-4">
                  <MetricCell
                    icon={<MapPin className="w-3 h-3" />}
                    label="Distance"
                    value={formatDistance(workout.distance_m)}
                  />
                  <MetricCell
                    icon={<Clock className="w-3 h-3" />}
                    label="Duration"
                    value={formatDuration(workout.duration_s)}
                  />
                  <MetricCell
                    icon={<Gauge className="w-3 h-3" />}
                    label="Pace"
                    value={formatPace(workout.avg_pace_s_per_km)}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MetricCell({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-muted-foreground/60">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-widest">
          {label}
        </span>
      </div>
      <span className="text-base font-mono font-bold text-foreground tabular-nums">
        {value}
      </span>
    </div>
  )
}
