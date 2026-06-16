import type { WorkoutSplit } from '../types/workout-detail'
import { formatDuration, formatPace } from '../utils/formatters'

interface WorkoutSplitsTableProps {
  splits: WorkoutSplit[]
}

/** Splits carry metres (adaptive sub-km) or whole km — show the right unit. */
function formatSplitDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(2)} km`
}

export function WorkoutSplitsTable({ splits }: WorkoutSplitsTableProps) {
  if (splits.length === 0) return null

  const paces = splits.map((s) => s.paceSPerKm).filter((p) => p > 0)
  const maxPace = paces.length > 0 ? Math.max(...paces) : 0

  return (
    <div className="bg-card rounded-2xl border border-white/[0.04] p-6 shadow-xl w-full">
      <h3 className="text-lg font-bold mb-6">Splits</h3>

      <div className="grid grid-cols-[2rem_4.5rem_4rem_1fr] gap-3 sm:gap-4 pb-2 border-b border-white/[0.04] text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        <div>Split</div>
        <div>Distance</div>
        <div>Time</div>
        <div>Pace</div>
      </div>

      <div className="flex flex-col">
        {splits.map((split) => {
          const barWidth = maxPace > 0 && split.paceSPerKm > 0 ? (split.paceSPerKm / maxPace) * 100 : 0
          const accent = split.isFastest
            ? 'bg-emerald-500'
            : split.isSlowest
              ? 'bg-amber-500'
              : 'bg-primary/40'
          const paceColor = split.isFastest
            ? 'text-emerald-400 font-bold'
            : split.isSlowest
              ? 'text-amber-400 font-bold'
              : 'text-foreground/80'

          return (
            <div
              key={split.index}
              className="grid grid-cols-[2rem_4.5rem_4rem_1fr] gap-3 sm:gap-4 items-center py-2.5 border-b border-white/[0.02] last:border-0"
            >
              <div className="font-mono font-medium text-foreground tabular-nums">{split.index}</div>
              <div className="font-mono text-foreground/80 text-sm tabular-nums">
                {formatSplitDistance(split.distanceM)}
              </div>
              <div className="font-mono text-foreground/80 text-sm tabular-nums">
                {formatDuration(Math.round(split.durationS))}
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-sm tabular-nums ${paceColor}`}>
                    {formatPace(split.paceSPerKm)}
                  </span>
                  {split.isFastest && (
                    <span className="text-[9px] uppercase tracking-wider font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">
                      Fastest
                    </span>
                  )}
                  {split.isSlowest && (
                    <span className="text-[9px] uppercase tracking-wider font-bold bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">
                      Slowest
                    </span>
                  )}
                </div>
                <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${accent}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
