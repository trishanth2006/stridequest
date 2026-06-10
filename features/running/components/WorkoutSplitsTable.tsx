"use client"

import { useMemo } from 'react'
import type { WorkoutRoutePoint } from '../types/workout-detail'
import { calculateSplits } from '../utils/telemetry'

interface WorkoutSplitsTableProps {
  routePoints: WorkoutRoutePoint[]
}

function formatPace(paceSecondsPerKm: number) {
  if (paceSecondsPerKm === 0 || !isFinite(paceSecondsPerKm)) return '--:--'
  const mins = Math.floor(paceSecondsPerKm / 60)
  const secs = Math.floor(paceSecondsPerKm % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function WorkoutSplitsTable({ routePoints }: WorkoutSplitsTableProps) {
  const splits = useMemo(() => calculateSplits(routePoints), [routePoints])

  if (splits.length === 0) return null

  // Find fastest full km split (distance >= 990)
  let fastestPace = Infinity
  let fastestSplitIndex = -1
  splits.forEach(s => {
    if (s.distanceMeters >= 990 && s.paceSecondsPerKm < fastestPace) {
      fastestPace = s.paceSecondsPerKm
      fastestSplitIndex = s.splitIndex
    }
  })

  // fallback to fastest any split if no full km exists
  if (fastestSplitIndex === -1 && splits.length > 0) {
    splits.forEach(s => {
      if (s.paceSecondsPerKm < fastestPace) {
        fastestPace = s.paceSecondsPerKm
        fastestSplitIndex = s.splitIndex
      }
    })
  }

  const maxPace = Math.max(...splits.map(s => s.paceSecondsPerKm).filter(isFinite))

  return (
    <div className="bg-card rounded-2xl border border-white/[0.04] p-6 shadow-xl w-full">
      <h3 className="text-lg font-bold mb-6">Splits</h3>
      
      <div className="w-full">
        {/* Header */}
        <div className="grid grid-cols-[3rem_1fr_4rem] gap-4 pb-2 border-b border-white/[0.04] text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          <div className="text-center">KM</div>
          <div>Pace</div>
          <div className="text-right">Elev</div>
        </div>

        {/* Rows */}
        <div className="flex flex-col gap-2">
          {splits.map((split) => {
            const isFastest = split.splitIndex === fastestSplitIndex
            const barWidth = (maxPace > 0 && isFinite(split.paceSecondsPerKm)) ? (split.paceSecondsPerKm / maxPace) * 100 : 0
            
            return (
              <div key={split.splitIndex} className="grid grid-cols-[3rem_1fr_4rem] gap-4 items-center py-2 group">
                <div className="text-center font-mono font-medium text-foreground">
                  {split.label}
                </div>
                
                <div className="flex flex-col gap-1.5 justify-center relative h-full">
                  <div className="flex items-center gap-2 relative z-10">
                    <span className={`font-mono ${isFastest ? 'text-primary font-bold' : 'text-foreground/80'}`}>
                      {formatPace(split.paceSecondsPerKm)}/km
                    </span>
                    {isFastest && (
                      <span className="text-[10px] uppercase tracking-wider font-bold bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                        Fastest
                      </span>
                    )}
                  </div>
                  {/* Visual Bar */}
                  <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${isFastest ? 'bg-primary' : 'bg-primary/40 group-hover:bg-primary/60'}`} 
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>

                <div className="text-right font-mono text-muted-foreground text-sm">
                  --
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
