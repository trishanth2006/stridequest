import { redirect } from 'next/navigation'
import { Zap } from 'lucide-react'
import { createClient } from '@/infrastructure/supabase/server'
import {
  getRecentXPEvents,
  getUserXP,
  getWorkoutXpHistory,
} from '@/features/xp/services/profile'
import { XPDashboard } from '@/features/xp/components/XPDashboard'

export const metadata = { title: 'XP - StrideQuest' }

export default async function XPPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [userXp, recentEvents, workoutHistory] = await Promise.all([
    getUserXP(supabase, user.id),
    getRecentXPEvents(supabase, user.id, 8),
    getWorkoutXpHistory(supabase, user.id, 8),
  ])

  return (
    <div className="relative flex flex-col gap-6 pb-12 pt-12 md:pt-24">
      <section className="flex flex-col gap-1">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
          <Zap className="h-3 w-3" />
          XP Profile
        </p>
        <h1 className="text-4xl font-extrabold tracking-tighter text-foreground md:text-5xl">
          Progress
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Track your level, recent XP gains, and the runs that moved you forward.
        </p>
      </section>

      <XPDashboard
        userXp={userXp}
        recentEvents={recentEvents}
        workoutHistory={workoutHistory}
      />
    </div>
  )
}
