import { formatDistance, formatDuration, formatPace } from '../utils/formatters'
import type { WorkoutSummary } from '../types/workout-summary'

type Props = {
  summary: WorkoutSummary
}

export function WorkoutSummaryCard({ summary }: Props) {
  return (
    <div className="bg-card rounded-2xl border border-white/10 p-6 shadow-xl" data-testid="workout-summary-card">
      <h3 className="text-lg font-bold text-foreground mb-4 text-center">Workout Complete</h3>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-black/20 rounded-xl p-4 border border-white/[0.04] text-center">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Distance</div>
          <div className="text-2xl font-black text-foreground" data-testid="summary-distance">
            {formatDistance(summary.distanceM)}
          </div>
        </div>
        
        <div className="bg-black/20 rounded-xl p-4 border border-white/[0.04] text-center">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Duration</div>
          <div className="text-2xl font-black text-foreground" data-testid="summary-duration">
            {formatDuration(summary.durationS)}
          </div>
        </div>
        
        <div className="bg-black/20 rounded-xl p-4 border border-white/[0.04] text-center">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Avg Pace</div>
          <div className="text-2xl font-black text-foreground" data-testid="summary-pace">
            {formatPace(summary.avgPaceSPerKm)}
          </div>
        </div>
        
        <div className="bg-primary/20 rounded-xl p-4 border border-primary/30 text-center">
          <div className="text-xs text-primary/80 uppercase tracking-wider font-bold mb-1">XP Earned</div>
          <div className="text-2xl font-black text-primary" data-testid="summary-xp">
            +{summary.xpEarned}
          </div>
        </div>
      </div>
    </div>
  )
}
