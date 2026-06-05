import type { WorkoutDetail } from '../types/workout-detail'

export function WorkoutAchievementStrip({ workout }: { workout: WorkoutDetail }) {
  if (workout.achievementsUnlocked.length === 0) return null

  return (
    <div className="bg-card rounded-2xl border border-amber-500/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] overflow-hidden flex flex-col group relative">
      <div className="absolute inset-0 bg-amber-500/5" />
      <div className="p-6 relative z-10 flex flex-col gap-4">
        <h3 className="text-[11px] font-semibold tracking-widest text-amber-500 uppercase px-1 flex items-center gap-2">
          <span>🏆</span> Achievements Unlocked
        </h3>
        
        <div className="flex flex-wrap gap-3">
          {workout.achievementsUnlocked.map(ach => (
            <div key={ach.id} className="flex items-center gap-3 bg-black/40 rounded-xl p-3 border border-amber-500/10 hover:border-amber-500/30 transition-colors">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-xl">
                {ach.icon}
              </div>
              <div className="flex flex-col pr-2">
                <span className="text-sm font-bold text-foreground leading-tight">{ach.title}</span>
                <span className="text-xs text-muted-foreground">{ach.description}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
