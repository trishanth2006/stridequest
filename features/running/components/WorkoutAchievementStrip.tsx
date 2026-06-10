import type { WorkoutDetail } from '../types/workout-detail'

export function WorkoutAchievementStrip({ workout }: { workout: WorkoutDetail }) {
  if (workout.achievementsUnlocked.length === 0) return null

  return (
    <div className="bg-card rounded-3xl border border-amber-500/30 shadow-lg overflow-hidden flex flex-col group relative w-full mt-4">
      <div className="absolute inset-0 bg-amber-500/5 pointer-events-none" />
      <div className="p-8 relative z-10 flex flex-col gap-6">
        <h3 className="text-xl font-bold text-amber-500 flex items-center gap-3">
          <span className="text-2xl">🏆</span> Achievements Earned
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {workout.achievementsUnlocked.map(ach => (
            <div key={ach.id} className="flex items-center gap-4 bg-black/40 rounded-2xl p-4 border border-amber-500/20 hover:border-amber-500/40 hover:bg-black/60 transition-all cursor-default">
              <div className="w-14 h-14 shrink-0 rounded-full bg-amber-500/10 flex items-center justify-center text-3xl shadow-[inset_0_0_15px_rgba(245,158,11,0.2)]">
                {ach.icon}
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold text-foreground leading-tight mb-1">{ach.title}</span>
                <span className="text-sm text-muted-foreground">{ach.description}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
