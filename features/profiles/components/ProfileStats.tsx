import { Activity, Map, Route, Medal } from 'lucide-react'
import type { RunnerProfile } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDistance } from '@/features/achievements/utils/formatters'

interface ProfileStatsProps {
  profile: RunnerProfile
}

export function ProfileStats({ profile }: ProfileStatsProps) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-bold tracking-tight text-foreground">Stats</h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Workouts
            </CardTitle>
            <Activity className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums" data-testid="stat-workouts">
              {profile.totalWorkouts}
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Distance
            </CardTitle>
            <Route className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums" data-testid="stat-distance">
              {formatDistance(profile.totalDistanceM)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Territories
            </CardTitle>
            <Map className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums" data-testid="stat-territories">
              {profile.territoriesOwned}
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex flex-col gap-0.5">
              <span>{profile.territoriesCaptured} Captured</span>
              <span>{profile.territoriesStolen} Stolen</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Achievements
            </CardTitle>
            <Medal className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums" data-testid="stat-achievements">
              {profile.achievementCount}
            </div>
          </CardContent>
        </Card>

      </div>
    </section>
  )
}
