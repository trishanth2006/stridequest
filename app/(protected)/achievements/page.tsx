import { redirect } from 'next/navigation'
import { Trophy, Award, Target, Zap, Gauge } from 'lucide-react'
import { createClient } from '@/infrastructure/supabase/server'
import {
  getAchievements,
  getAchievementSummary,
  getPersonalRecords
} from '@/features/achievements/services/achievements'
import { AchievementGrid } from '@/features/achievements/components/AchievementGrid'
import { PersonalRecordsCard } from '@/features/achievements/components/PersonalRecordsCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDistance } from '@/features/achievements/utils/formatters'

export const metadata = { title: 'Achievements & Records - StrideQuest' }

export default async function AchievementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Parallel fetch from Supabase
  const [workoutsResponse, capturesResponse, xpResponse, eventsResponse] = await Promise.all([
    supabase.from('workouts').select('*').eq('user_id', user.id),
    supabase.from('territory_captures').select('*').eq('user_id', user.id),
    supabase.from('user_xp').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('xp_events').select('*').eq('user_id', user.id)
  ])

  const workouts = workoutsResponse.data || []
  const captures = capturesResponse.data || []
  const userXpRow = xpResponse.data
  const xpEvents = eventsResponse.data || []

  const totalXp = userXpRow?.total_xp || 0
  const level = userXpRow?.level || 1

  // Dynamic computations
  const achievements = getAchievements(workouts, captures, totalXp, level, xpEvents)
  const summary = getAchievementSummary(achievements)
  const records = getPersonalRecords(workouts, captures)

  const hasWorkouts = workouts.length > 0
  const hasXp = totalXp > 0

  return (
    <div className="relative flex flex-col gap-8 pb-12 pt-12 md:pt-24" data-testid="achievements-page-root">
      {/* Header section */}
      <section className="flex flex-col gap-1">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
          <Trophy className="h-3 w-3" />
          Runner Identity
        </p>
        <h1 className="text-4xl font-extrabold tracking-tighter text-foreground md:text-5xl">
          Achievements & Personal Records
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Track your unlocked badges, milestones, and personal records dynamically earned during your workouts.
        </p>
      </section>

      {/* Top Banner and Summary Metrics */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Achievements Summary Card */}
        <Card className="border-white/[0.06] bg-white/[0.02]" data-testid="summary-card-unlocked">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Achievements Unlocked
            </CardTitle>
            <Award className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-3xl font-bold tracking-tight text-foreground tabular-nums" data-testid="summary-unlocked-value">
              🏆 {summary.unlocked} / {summary.total}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.total - summary.unlocked} remaining • {summary.percentage}% Complete
            </p>
          </CardContent>
        </Card>

        {/* Near Completion Card */}
        <Card className="border-white/[0.06] bg-white/[0.02]" data-testid="summary-card-closest">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Next Achievement
            </CardTitle>
            <Target className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="space-y-1">
            {summary.closestAchievement ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <span>{summary.closestAchievement.icon}</span> {summary.closestAchievement.title}
                  </span>
                  <span className="text-xs font-medium text-primary tabular-nums" data-testid="closest-remaining-text">
                    {summary.closestAchievement.id === 'marathoner' || summary.closestAchievement.id === 'distance-beast' ? (
                      `${formatDistance(summary.closestAchievement.remaining)} remaining`
                    ) : summary.closestAchievement.id === 'xp-hunter' || summary.closestAchievement.id === 'xp-master' ? (
                      `${summary.closestAchievement.remaining} XP remaining`
                    ) : summary.closestAchievement.id === 'rising-star' || summary.closestAchievement.id === 'elite-runner' ? (
                      `${summary.closestAchievement.remaining} Levels remaining`
                    ) : summary.closestAchievement.id === 'first-territory' || summary.closestAchievement.id === 'explorer' ? (
                      `${summary.closestAchievement.remaining} captures remaining`
                    ) : (
                      `${summary.closestAchievement.remaining} workouts remaining`
                    )}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.round((summary.closestAchievement.progress / summary.closestAchievement.target) * 100)}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground py-2">
                🎉 All achievements unlocked!
              </div>
            )}
          </CardContent>
        </Card>

        {/* XP Tip/Empty State notification */}
        <Card className="border-white/[0.06] bg-white/[0.02]" data-testid="summary-card-xp">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              XP Status
            </CardTitle>
            <Zap className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-3xl font-bold tracking-tight text-foreground tabular-nums" data-testid="xp-total-value">
              ⚡ {totalXp} XP
            </div>
            {!hasXp ? (
              <p className="text-xs text-amber-400" data-testid="xp-empty-motivation">
                Earn XP by completing workouts and capturing territory.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Level {level} Runner
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Personal Records on one side, Achievement categories on the other */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Personal Records (Left / 1 column on wide screen) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Gauge className="h-5 w-5 text-amber-500" /> Personal Records
            </h2>
            <p className="text-xs text-muted-foreground">
              Your fastest paces and most intense workouts.
            </p>
          </div>
          <PersonalRecordsCard records={records} hasWorkouts={hasWorkouts} />
        </div>

        {/* Achievements (Right / 2 columns on wide screen) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Award className="h-5 w-5 text-emerald-500" /> Badge Milestones
            </h2>
            <p className="text-xs text-muted-foreground">
              Unlock badges by hitting running, territory, and XP milestones.
            </p>
          </div>
          <AchievementGrid achievements={achievements} />
        </div>
      </div>
    </div>
  )
}
