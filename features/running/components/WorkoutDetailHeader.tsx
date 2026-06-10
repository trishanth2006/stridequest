import { Clock, MapPin, Gauge, Zap, Map, Flame } from 'lucide-react'
import type { WorkoutDetail } from '../types/workout-detail'

interface WorkoutDetailHeaderProps {
  workout: WorkoutDetail
}

/** Format distance: sub-km → metres, ≥1 km → X.XX km. */
function formatDistance(meters: number): string {
  if (meters === 0) return '0 m'
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(2)} km`
}

/** Format seconds into H:MM:SS or MM:SS. */
function formatDuration(seconds: number): string {
  if (seconds === 0) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`
  return `${m}:${pad(s)}`
}

/** Format pace as M:SS /km. */
function formatPace(paceSecsPerKm: number): string {
  if (paceSecsPerKm === 0) return '—'
  const m = Math.floor(paceSecsPerKm / 60)
  const s = Math.floor(paceSecsPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')} /km`
}

export function WorkoutDetailHeader({ workout }: WorkoutDetailHeaderProps) {
  // Find top PR to show in hero (e.g., Fastest 5K)
  const topPr = workout.prFlags.records.length > 0 ? workout.prFlags.records[0] : null
  
  return (
    <div className="bg-card rounded-3xl border border-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] overflow-hidden">
      <div className="p-8 md:p-12 flex flex-col md:flex-row md:items-center justify-between gap-8 bg-gradient-to-br from-white/[0.02] to-transparent">
        
        {/* Main Stats */}
        <div className="flex flex-col gap-6">
          <div className="flex items-end gap-3">
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-foreground tabular-nums">
              {formatDistance(workout.distanceM)}
            </h1>
          </div>
          
          <div className="flex flex-wrap items-center gap-6 md:gap-12 text-muted-foreground">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-primary" />
              <span className="text-2xl font-mono font-bold text-foreground">{formatDuration(workout.durationS)}</span>
            </div>
            
            <div className="flex items-center gap-3">
              <Gauge className="w-5 h-5 text-primary" />
              <span className="text-2xl font-mono font-bold text-foreground">{formatPace(workout.avgPaceSPerKm)}</span>
            </div>
            
            <div className="flex items-center gap-3" title="Estimated Calories">
              <Flame className="w-5 h-5 text-orange-500" />
              <span className="text-2xl font-mono font-bold text-foreground">{Math.round((workout.durationS / 60) * 5)} kcal</span>
              <span className="text-xs text-muted-foreground uppercase tracking-widest hidden md:inline">Est. Calories</span>
            </div>
          </div>
        </div>

        {/* Secondary Highlights */}
        <div className="flex flex-row md:flex-col gap-4 md:gap-6 shrink-0 border-t md:border-t-0 md:border-l border-white/[0.04] pt-6 md:pt-0 md:pl-12">
          
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">XP Earned</span>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="text-xl font-bold text-foreground">+{workout.xpBreakdown.totalXp}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Territories</span>
            <div className="flex items-center gap-2">
              <Map className="w-4 h-4 text-emerald-400" />
              <span className="text-xl font-bold text-foreground">{workout.territoryBreakdown.claimed + workout.territoryBreakdown.stolen} Captured</span>
            </div>
          </div>
          
          {topPr && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Best Effort</span>
              <div className="flex items-center gap-2">
                <span className="text-lg">🏅</span>
                <span className="text-xl font-bold text-foreground">{topPr.title}</span>
              </div>
            </div>
          )}
          
        </div>
        
      </div>
    </div>
  )
}
