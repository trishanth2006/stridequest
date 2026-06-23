import { redirect } from 'next/navigation'
import { Trophy, Hash, Users } from 'lucide-react'
import { createClient } from '@/infrastructure/supabase/server'
import { loadLeaderboardEntries, loadMyRank } from '@/features/leaderboards/data/load-leaderboards'
import {
  getLeaderboardSummary,
  getTerritoryKing,
} from '@/features/leaderboards/services/leaderboards'
import {
  LeaderboardTabs,
  type LeaderboardBoard,
} from '@/features/leaderboards/components/LeaderboardTabs'
import { TerritoryKingCard } from '@/features/leaderboards/components/TerritoryKingCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata = { title: 'Leaderboards - StrideQuest' }

export default async function LeaderboardsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [xpEntries, territoryEntries, distanceEntries, weeklyEntries, xpMyRank] =
    await Promise.all([
      loadLeaderboardEntries('xp', user.id),
      loadLeaderboardEntries('territory', user.id),
      loadLeaderboardEntries('distance', user.id),
      loadLeaderboardEntries('weekly', user.id),
      loadMyRank('xp'),
    ])

  const king = getTerritoryKing(territoryEntries)
  const xpSummary    = getLeaderboardSummary('xp',       xpEntries)
  const terrSummary  = getLeaderboardSummary('territory', territoryEntries)
  const distSummary  = getLeaderboardSummary('distance',  distanceEntries)
  const weeklySummary = getLeaderboardSummary('weekly',   weeklyEntries)

  const boards: LeaderboardBoard[] = [
    { category: 'xp',        label: 'XP',        summary: xpSummary,      entries: xpEntries },
    { category: 'territory', label: 'Territory',  summary: terrSummary,    entries: territoryEntries },
    { category: 'distance',  label: 'Distance',   summary: distSummary,    entries: distanceEntries },
    { category: 'weekly',    label: 'Weekly',     summary: weeklySummary,  entries: weeklyEntries },
  ]

  return (
    <div
      className="relative flex flex-col gap-8 pb-12 pt-12 md:pt-24"
      data-testid="leaderboards-page-root"
    >
      {/* Header */}
      <section className="flex flex-col gap-1">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
          <Trophy className="h-3 w-3" />
          Compete
        </p>
        <h1 className="text-4xl font-extrabold tracking-tighter text-foreground md:text-5xl">
          Leaderboards & Territory Rankings
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          See how you stack up against every athlete — ranked live by XP,
          territory, distance, and this week&apos;s grind.
        </p>
      </section>

      {/* Header stats */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Your Global Rank
            </CardTitle>
            <Hash className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div
              className="text-3xl font-bold tracking-tight text-foreground tabular-nums"
              data-testid="header-current-user-rank"
            >
              {xpMyRank.rank > 0 ? `#${xpMyRank.rank}` : 'Unranked'}
            </div>
            <p className="text-xs text-muted-foreground">by total XP earned</p>
          </CardContent>
        </Card>

        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Total Participants
            </CardTitle>
            <Users className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div
              className="text-3xl font-bold tracking-tight text-foreground tabular-nums"
              data-testid="header-total-participants"
            >
              {xpMyRank.totalUsers}
            </div>
            <p className="text-xs text-muted-foreground">athletes with XP</p>
          </CardContent>
        </Card>
      </div>

      {/* Territory King */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Reigning Champion
        </h2>
        <TerritoryKingCard king={king} />
      </section>

      {/* Tabs */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Rankings
        </h2>
        <LeaderboardTabs boards={boards} />
      </section>
    </div>
  )
}
