import { Zap, Navigation2 } from 'lucide-react'
import type { RunnerProfile } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDuration, formatDistance } from '@/features/achievements/utils/formatters'

interface ProfileRecordsProps {
  profile: RunnerProfile
}

export function ProfileRecords({ profile }: ProfileRecordsProps) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-bold tracking-tight text-foreground">Personal Records</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Fastest 5K
            </CardTitle>
            <Zap className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold tracking-tight text-foreground tabular-nums" data-testid="record-5k">
              {profile.fastest5K ? formatDuration(profile.fastest5K) : '--:--'}
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Fastest 10K
            </CardTitle>
            <Zap className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold tracking-tight text-foreground tabular-nums" data-testid="record-10k">
              {profile.fastest10K ? formatDuration(profile.fastest10K) : '--:--'}
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Longest Run
            </CardTitle>
            <Navigation2 className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold tracking-tight text-foreground tabular-nums" data-testid="record-longest">
              {profile.longestRunM ? formatDistance(profile.longestRunM) : '0.0 km'}
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Fastest 1K
            </CardTitle>
            <Zap className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold tracking-tight text-foreground tabular-nums" data-testid="record-1k">
              {profile.fastest1K ? formatDuration(profile.fastest1K) : '--:--'}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
