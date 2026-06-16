import { Flame, Footprints, Zap, Target, Map as MapIcon, type LucideIcon } from 'lucide-react'
import type { WorkoutInsight } from '../types/workout-detail'

interface WorkoutInsightsProps {
  insights: WorkoutInsight[]
}

/** Per-insight icon + accent. Falls back to a neutral style for unknown ids. */
const STYLES: Record<string, { icon: LucideIcon; tint: string; text: string }> = {
  'strongest-push': { icon: Flame, tint: 'bg-amber-500/20', text: 'text-amber-500' },
  'best-segment': { icon: Footprints, tint: 'bg-blue-500/20', text: 'text-blue-500' },
  efficiency: { icon: Zap, tint: 'bg-yellow-500/20', text: 'text-yellow-500' },
  consistency: { icon: Target, tint: 'bg-emerald-500/20', text: 'text-emerald-500' },
  'territory-efficiency': { icon: MapIcon, tint: 'bg-primary/20', text: 'text-primary' },
}

const FALLBACK = { icon: Zap, tint: 'bg-white/10', text: 'text-foreground' }

export function WorkoutInsights({ insights }: WorkoutInsightsProps) {
  if (insights.length === 0) return null

  return (
    <div className="w-full">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <Flame className="w-5 h-5 text-amber-500" /> Insights
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {insights.map((insight) => {
          const style = STYLES[insight.id] ?? FALLBACK
          const Icon = style.icon
          return (
            <div
              key={insight.id}
              className="bg-card rounded-2xl border border-white/[0.04] p-4 flex flex-col items-start shadow-sm"
            >
              <div className={`${style.tint} p-2 rounded-lg mb-3`}>
                <Icon className={`w-5 h-5 ${style.text}`} />
              </div>
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                {insight.label}
              </span>
              <span className="text-lg font-bold text-foreground leading-tight">{insight.value}</span>
              {insight.detail && (
                <span className="text-xs text-muted-foreground mt-0.5">{insight.detail}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
