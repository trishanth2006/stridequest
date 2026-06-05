import type { Achievement } from '../types'
import { getAchievementProgress } from '../utils/formatters'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ShareDialog } from '@/features/share/components/ShareDialog'
import { buildAchievementCard } from '@/features/share/services/share-card'
import { Share } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function AchievementCard({ achievement }: { achievement: Achievement }) {
  const { progress, target, percentage } = getAchievementProgress(achievement.progress, achievement.target);
  
  let progressText = `${progress} / ${target}`;
  if (achievement.id === 'marathoner' || achievement.id === 'distance-beast') {
    progressText = `${(progress / 1000).toFixed(1).replace(/\.0$/, '')} / ${(target / 1000).toFixed(1).replace(/\.0$/, '')} km`;
  } else if (achievement.id === 'xp-hunter' || achievement.id === 'xp-master') {
    progressText = `${progress} / ${target} XP`;
  } else if (achievement.id === 'rising-star' || achievement.id === 'elite-runner') {
    progressText = `Level ${progress} / ${target}`;
  } else if (achievement.id === 'first-territory' || achievement.id === 'explorer') {
    progressText = `${progress} / ${target} ${target === 1 ? 'capture' : 'captures'}`;
  } else {
    progressText = `${progress} / ${target} ${target === 1 ? 'workout' : 'workouts'}`;
  }

  let dateStr = '';
  if (achievement.unlocked && achievement.unlockedAt) {
    try {
      dateStr = new Date(achievement.unlockedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      dateStr = '';
    }
  }

  const showAlmostThere = !achievement.unlocked && percentage >= 80;

  const shareCardData = achievement.unlocked ? buildAchievementCard({
    achievementTitle: achievement.title,
    achievementDescription: achievement.description,
    achievementCategory: 'general', // You could infer this if it was in the type
  }) : null;

  return (
    <Card className={`overflow-hidden border-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] bg-white/[0.02] transition-colors duration-200 flex flex-col ${achievement.unlocked ? 'border-emerald-500/20 bg-emerald-500/[0.01]' : ''}`}>
      <CardHeader className="flex flex-row items-center gap-4 pb-2">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl shadow-inner ${achievement.unlocked ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/[0.04] grayscale opacity-60'}`}>
          {achievement.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className={`text-base font-semibold truncate ${achievement.unlocked ? 'text-foreground' : 'text-foreground/80'}`}>
              {achievement.title}
            </CardTitle>
            {achievement.unlocked && (
              <span data-testid="badge-unlocked" className="shrink-0 inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                ✓ Unlocked
              </span>
            )}
            {showAlmostThere && (
              <span data-testid="badge-almost-there" className="shrink-0 inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400">
                Almost There
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-1">{achievement.description}</p>
        </div>
      </CardHeader>
      <CardContent className="pt-2 flex-grow flex flex-col justify-end">
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span data-testid="achievement-progress-text">{progressText}</span>
            {!achievement.unlocked && (
              <span data-testid="achievement-percentage" className="font-medium tabular-nums">{percentage}%</span>
            )}
            {achievement.unlocked && dateStr && (
              <span data-testid="achievement-unlocked-date" className="font-medium">{dateStr}</span>
            )}
          </div>
          
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              data-testid="achievement-progress-fill"
              className={`h-full rounded-full transition-[width] duration-300 ${achievement.unlocked ? 'bg-emerald-500' : 'bg-primary'}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {achievement.unlocked && shareCardData && (
          <div className="mt-4 flex justify-end">
             <ShareDialog cardData={shareCardData} trigger={
               <Button variant="ghost" size="sm" className="h-8 gap-2 text-muted-foreground hover:text-foreground">
                 <Share className="w-3.5 h-3.5" /> Share
               </Button>
             } />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
