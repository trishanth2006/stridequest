import { Target } from 'lucide-react'
import type { WorkoutDetail } from '../types/workout-detail'

export function WorkoutTerritorySummary({ workout }: { workout: WorkoutDetail }) {
  const { claimed, stolen, defended, totalImpact } = workout.territoryBreakdown

  return (
    <div className="bg-card rounded-3xl border border-white/[0.04] shadow-xl overflow-hidden flex flex-col w-full mt-4">
      <div className="p-8 border-b border-white/[0.04] flex items-center justify-between bg-gradient-to-r from-white/[0.02] to-transparent">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-xl">
            <Target className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">Territory Impact</h3>
            <span className="text-sm text-muted-foreground">Cells affected during this activity</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-4xl font-black tabular-nums tracking-tight">{totalImpact}</div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mt-1">Total Cells</div>
        </div>
      </div>
      
      <div className="grid grid-cols-3 divide-x divide-white/[0.04] bg-black/20">
        <div className="p-8 flex flex-col items-center justify-center gap-3">
          <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
             <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
             Captured
          </div>
          <span className="text-5xl font-mono font-bold text-foreground">{claimed}</span>
        </div>
        
        <div className="p-8 flex flex-col items-center justify-center gap-3">
          <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
             <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
             Stolen
          </div>
          <span className="text-5xl font-mono font-bold text-foreground">{stolen}</span>
        </div>
        
        <div className="p-8 flex flex-col items-center justify-center gap-3">
          <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
             <div className="w-3 h-3 rounded-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]" />
             Defended
          </div>
          <span className="text-5xl font-mono font-bold text-foreground">{defended}</span>
        </div>
      </div>
    </div>
  )
}
