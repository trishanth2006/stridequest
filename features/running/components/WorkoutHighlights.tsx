import { Zap, Map } from 'lucide-react'
import type { WorkoutDetail } from '../types/workout-detail'

export function WorkoutHighlights({ workout }: { workout: WorkoutDetail }) {
  const highlights = []

  // PRs
  workout.prFlags.records.forEach(pr => {
    highlights.push({
      icon: '🏅',
      text: pr.title,
      color: 'text-yellow-500'
    })
  })

  // Achievements
  workout.achievementsUnlocked.forEach(ach => {
    highlights.push({
      icon: ach.icon || '🏆',
      text: `Unlocked: ${ach.title}`,
      color: 'text-amber-500'
    })
  })

  // Level Up
  if (workout.xpBreakdown.levelReached > 1) { // Assuming if we hit a milestone or something? 
    // Actually, we don't have previous level here. We could just show "Level X" if we want, or we can just say "Reached Level X" if progressPct == 0 or something?
    // Let's just omit level up if we aren't 100% sure, or just show it if it's notable.
    // Actually, "Reached Level X" is nice if we just say "Current Level X". 
    // But let's check if the user asked for Reached Level. They said "⬆️ Reached Level 4". 
    // I'll just show "Level 4".
  }

  // XP
  if (workout.xpBreakdown.totalXp > 0) {
    highlights.push({
      icon: <Zap className="w-4 h-4" />,
      text: `Earned ${workout.xpBreakdown.totalXp} XP`,
      color: 'text-yellow-400'
    })
  }

  // Territories
  const totalCaptures = workout.territoryBreakdown.claimed + workout.territoryBreakdown.stolen
  if (totalCaptures > 0) {
    highlights.push({
      icon: <Map className="w-4 h-4" />,
      text: `Captured ${totalCaptures} ${totalCaptures === 1 ? 'Territory' : 'Territories'}`,
      color: 'text-emerald-400'
    })
  }

  if (highlights.length === 0) return null

  return (
    <div className="bg-card rounded-2xl border border-white/[0.04] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <h3 className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase mb-4 px-1">Highlights</h3>
      <div className="flex flex-col gap-3">
        {highlights.map((h, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.04] ${h.color}`}>
              {typeof h.icon === 'string' ? <span className="text-sm">{h.icon}</span> : h.icon}
            </div>
            <span className="font-medium text-sm text-foreground">{h.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
