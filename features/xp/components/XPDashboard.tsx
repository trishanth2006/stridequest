import { Calendar, Clock3, Sparkles, Target, TrendingUp, Zap } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { XPCard } from '@/features/xp/components/XPCard'
import { LevelBadge } from '@/features/xp/components/LevelBadge'
import { XPProgressBar } from '@/features/xp/components/XPProgressBar'
import { XPEventList } from '@/features/xp/components/XPEventList'
import { getXpProgress } from '@/features/xp/services/xp'
import type { UserXp, XpEvent, WorkoutXpHistoryEntry } from '@/features/xp/types'

type XPDashboardProps = {
  userXp: UserXp
  recentEvents: readonly XpEvent[]
  workoutHistory: readonly WorkoutXpHistoryEntry[]
}

function formatWorkoutDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDistance(distanceM: number | null): string {
  if (distanceM === null || distanceM <= 0) return '0 m'
  if (distanceM < 1000) return `${Math.round(distanceM)} m`
  return `${(distanceM / 1000).toFixed(2)} km`
}

function formatDuration(durationS: number | null): string {
  if (durationS === null || durationS <= 0) return '0:00'
  const minutes = Math.floor(durationS / 60)
  const seconds = durationS % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function XPDashboard({ userXp, recentEvents, workoutHistory }: XPDashboardProps) {
  const progress = getXpProgress(userXp.totalXp)

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <XPCard
          title="Current Level"
          detail="Your current progression tier"
          icon={<Sparkles className="h-4 w-4" />}
          value={<LevelBadge level={userXp.level} />}
          testId="xp-current-level"
        />
        <XPCard
          title="Total XP"
          detail="Lifetime experience earned"
          icon={<Zap className="h-4 w-4" />}
          value={userXp.totalXp.toLocaleString()}
          testId="xp-total"
        />
        <XPCard
          title="Next Milestone"
          detail={progress.nextLevel === null ? 'Top MVP tier reached' : `XP still needed for Level ${progress.nextLevel}`}
          icon={<Target className="h-4 w-4" />}
          value={progress.nextLevel === null ? 'Max' : progress.xpNeededToNextLevel.toLocaleString()}
          testId="xp-needed"
        />
      </section>

      <section>
        <Card className="border-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <CardContent className="pt-4">
            <XPProgressBar progress={progress} />
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <XPEventList events={recentEvents} />

        <div className="flex flex-col gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Workout XP History
            </p>
            <h2 className="text-xl font-semibold text-foreground">Recent runs</h2>
          </div>

          {workoutHistory.length === 0 ? (
            <div
              data-testid="xp-workout-history-empty"
              className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] px-6 text-center"
            >
              <Calendar className="mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-base font-semibold text-foreground">No XP workouts yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your completed runs with awarded XP will show up here.
              </p>
            </div>
          ) : (
            <ul data-testid="xp-workout-history-list" className="flex flex-col gap-2">
              {workoutHistory.map((workout) => (
                <li
                  key={workout.workoutId}
                  data-testid="xp-workout-history-item"
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{formatWorkoutDate(workout.startedAt)}</p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <TrendingUp className="h-3.5 w-3.5" />
                          {formatDistance(workout.distanceM)}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 className="h-3.5 w-3.5" />
                          {formatDuration(workout.durationS)}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-bold tabular-nums text-primary">+{workout.xpAwarded} XP</p>
                      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                        Workout
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
