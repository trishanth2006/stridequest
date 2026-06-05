import { Trophy, Star, Hash, Activity } from 'lucide-react'
import type { RunnerProfile } from '../types'
import { Card, CardContent } from '@/components/ui/card'

interface ProfileHeaderProps {
  profile: RunnerProfile
}

export function ProfileHeader({ profile }: ProfileHeaderProps) {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tighter text-foreground md:text-5xl" data-testid="profile-username">
            {profile.username}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm font-medium">
            <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md" data-testid="profile-level">
              <Star className="h-4 w-4" />
              Level {profile.level}
            </span>
            <span className="flex items-center gap-1.5 text-amber-400 bg-amber-400/10 px-2 py-1 rounded-md" data-testid="profile-xp">
              <Trophy className="h-4 w-4" />
              {profile.totalXp} XP
            </span>
            <span className="flex items-center gap-1.5 text-blue-400 bg-blue-400/10 px-2 py-1 rounded-md" data-testid="profile-rank">
              <Hash className="h-4 w-4" />
              {profile.leaderboardRank ? `Rank #${profile.leaderboardRank}` : 'Unranked'}
            </span>
          </div>
        </div>

        <Card className="border-white/[0.06] bg-white/[0.02] min-w-[200px]">
          <CardContent className="p-4 flex flex-col items-center justify-center gap-1">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Activity className="h-3 w-3" />
              Profile Completion
            </span>
            <span className="text-3xl font-bold tracking-tight text-foreground tabular-nums" data-testid="profile-completion">
              {profile.profileCompletion}%
            </span>
          </CardContent>
        </Card>
      </div>

      {profile.topAchievements.length > 0 && (
        <div className="flex flex-wrap gap-2" data-testid="profile-badges">
          {profile.topAchievements.map((ach) => (
            <div
              key={ach.id}
              className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-1.5 text-sm font-medium shadow-sm transition-colors hover:bg-white/[0.08]"
              title={ach.title}
            >
              <span>{ach.icon}</span>
              <span className="text-foreground">{ach.title}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
