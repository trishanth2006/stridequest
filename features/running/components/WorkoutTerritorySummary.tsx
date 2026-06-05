import { MapPin } from 'lucide-react'
import type { WorkoutDetail } from '../types/workout-detail'

export function WorkoutTerritorySummary({ workout }: { workout: WorkoutDetail }) {
  const { claimed, stolen, defended, totalImpact } = workout.territoryBreakdown

  return (
    <div className="bg-card rounded-2xl border border-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] overflow-hidden flex flex-col group transition-all duration-300 hover:border-white/10">
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">Territory Impact</span>
          <MapPin className="w-4 h-4 text-muted-foreground/60 group-hover:text-emerald-400 transition-colors" />
        </div>
        <div className="text-3xl font-mono font-bold text-foreground">{totalImpact} Cells</div>
      </div>
      
      <div className="bg-black/20 p-6 pt-4 flex-1 flex flex-col justify-end gap-3 border-t border-white/[0.04]">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-muted-foreground">Captured</span>
          </div>
          <span className="font-mono text-foreground">{claimed}</span>
        </div>
        
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-muted-foreground">Stolen</span>
          </div>
          <span className="font-mono text-foreground">{stolen}</span>
        </div>
        
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-500" />
            <span className="text-muted-foreground">Defended</span>
          </div>
          <span className="font-mono text-foreground">{defended}</span>
        </div>
      </div>
    </div>
  )
}
