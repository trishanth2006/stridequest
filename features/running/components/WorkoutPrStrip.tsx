import type { WorkoutDetail } from '../types/workout-detail'

export function WorkoutPrStrip({ workout }: { workout: WorkoutDetail }) {
  if (workout.prFlags.records.length === 0) return null

  return (
    <div className="bg-card rounded-2xl border border-indigo-500/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] overflow-hidden flex flex-col group relative">
      <div className="absolute inset-0 bg-indigo-500/5" />
      <div className="p-6 relative z-10 flex flex-col gap-4">
        <h3 className="text-[11px] font-semibold tracking-widest text-indigo-400 uppercase px-1 flex items-center gap-2">
          <span>🏅</span> Personal Records Set
        </h3>
        
        <div className="flex flex-wrap gap-3">
          {workout.prFlags.records.map(pr => (
            <div key={pr.id} className="flex items-center gap-3 bg-black/40 rounded-xl p-3 border border-indigo-500/10 hover:border-indigo-500/30 transition-colors">
              <div className="flex flex-col px-2">
                <span className="text-sm font-bold text-foreground leading-tight">{pr.title}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
