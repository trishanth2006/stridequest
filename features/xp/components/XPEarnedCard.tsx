import { XPBreakdown } from './XPBreakdown'
import type { WorkoutXpBreakdown } from '@/features/xp/services/profile'
import type { XpProgress } from '@/features/xp/services/xp'

type Props = {
  breakdown: WorkoutXpBreakdown
  progress: XpProgress
}

export function XPEarnedCard({ breakdown, progress }: Props) {
  return (
    <div className="flex flex-col gap-6 w-full max-w-sm mx-auto bg-card rounded-2xl border border-white/10 p-6 shadow-xl" data-testid="xp-earned-card">
      <div className="text-center space-y-1">
        <h3 className="text-lg font-bold text-foreground">XP Earned</h3>
        <p className="text-4xl font-black text-primary">+{breakdown.totalXp}</p>
      </div>

      <XPBreakdown breakdown={breakdown} />

      <div className="bg-black/20 rounded-xl p-4 border border-white/[0.04] space-y-3">
        <div className="flex justify-between items-end">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-0.5">Current Level</div>
            <div className="text-xl font-bold text-foreground">Level {progress.currentLevel}</div>
          </div>
          {progress.nextLevel && (
            <div className="text-right">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-0.5">Next Level</div>
              <div className="text-sm font-medium text-foreground/80">{progress.xpNeededToNextLevel} XP needed</div>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-2.5 w-full bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-1000 ease-out rounded-full"
            style={{ width: `${progress.progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  )
}
