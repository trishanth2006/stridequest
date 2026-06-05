import { Zap } from 'lucide-react'
import type { WorkoutDetail } from '../types/workout-detail'

export function WorkoutXpSummary({ workout }: { workout: WorkoutDetail }) {
  const { baseXp, captureXp, stealXp, totalXp, levelReached, progressPct } = workout.xpBreakdown

  return (
    <div className="bg-card rounded-2xl border border-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] overflow-hidden flex flex-col group transition-all duration-300 hover:border-white/10">
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">XP Earned</span>
          <Zap className="w-4 h-4 text-muted-foreground/60 group-hover:text-yellow-400 transition-colors" />
        </div>
        <div className="text-3xl font-mono font-bold text-foreground">+{totalXp}</div>
      </div>
      
      <div className="bg-black/20 p-6 pt-4 flex-1 flex flex-col justify-end gap-3 border-t border-white/[0.04]">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Base Run</span>
          <span className="font-mono text-foreground">+{baseXp}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Captures</span>
          <span className="font-mono text-foreground">+{captureXp}</span>
        </div>
        {stealXp > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground text-amber-400">Steals</span>
            <span className="font-mono text-amber-400">+{stealXp}</span>
          </div>
        )}
        
        <div className="mt-4 flex flex-col gap-1.5">
          <div className="flex justify-between text-[10px] font-semibold tracking-widest uppercase">
            <span className="text-primary">Level {levelReached}</span>
            <span className="text-muted-foreground">{progressPct}%</span>
          </div>
          <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-1000 ease-out" 
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
