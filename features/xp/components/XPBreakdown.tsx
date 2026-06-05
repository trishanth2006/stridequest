import type { WorkoutXpBreakdown } from '@/features/xp/services/profile'

type Props = {
  breakdown: WorkoutXpBreakdown
}

export function XPBreakdown({ breakdown }: Props) {
  if (breakdown.totalXp === 0) {
    return (
      <div className="text-center text-muted-foreground text-sm py-4">
        No XP earned this session.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 w-full text-sm bg-black/20 rounded-xl p-4 border border-white/[0.04]">
      {breakdown.workoutXp > 0 && (
        <div className="flex justify-between items-center text-foreground/80" data-testid="xp-workout">
          <span>Workout XP</span>
          <span className="font-medium text-primary">+{breakdown.workoutXp}</span>
        </div>
      )}
      {breakdown.captureXp > 0 && (
        <div className="flex justify-between items-center text-foreground/80" data-testid="xp-capture">
          <span>Capture XP</span>
          <span className="font-medium text-primary">+{breakdown.captureXp}</span>
        </div>
      )}
      {breakdown.stealXp > 0 && (
        <div className="flex justify-between items-center text-foreground/80" data-testid="xp-steal">
          <span>Steal XP</span>
          <span className="font-medium text-primary">+{breakdown.stealXp}</span>
        </div>
      )}
      
      <div className="flex justify-between items-center mt-1 pt-3 border-t border-white/10 font-bold text-foreground" data-testid="xp-total">
        <span>Total XP</span>
        <span className="text-primary text-base">+{breakdown.totalXp}</span>
      </div>
    </div>
  )
}
