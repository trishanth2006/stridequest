import { Activity, Trophy, Map, Zap, CalendarDays } from 'lucide-react'
import type { RecentActivity } from '../types'
import { Card, CardContent } from '@/components/ui/card'

interface RecentActivityFeedProps {
  activities: RecentActivity[]
}

function getActivityIcon(type: RecentActivity['type']) {
  switch (type) {
    case 'workout':
      return <Activity className="h-4 w-4 text-blue-400" />
    case 'capture':
      return <Map className="h-4 w-4 text-purple-400" />
    case 'achievement':
      return <Trophy className="h-4 w-4 text-amber-400" />
    default:
      return <Zap className="h-4 w-4 text-emerald-400" />
  }
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return 'Just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  return `${Math.floor(diffInSeconds / 86400)}d ago`
}

export function RecentActivityFeed({ activities }: RecentActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-bold tracking-tight text-foreground">Recent Activity</h2>
        <Card className="border-white/[0.06] bg-white/[0.02] border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center gap-3">
            <CalendarDays className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No recent activity yet. Time to hit the pavement!</p>
          </CardContent>
        </Card>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-bold tracking-tight text-foreground">Recent Activity</h2>
      <div className="flex flex-col gap-3">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.04]"
            data-testid="activity-item"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.04] border border-white/[0.06]">
              {getActivityIcon(activity.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {activity.title}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatRelativeTime(activity.createdAt)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
