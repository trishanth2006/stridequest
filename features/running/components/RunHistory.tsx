"use client"

import Link from 'next/link'
import { Calendar, Clock, MapPin, Gauge, Share } from 'lucide-react'
import type { WorkoutHistoryRow } from '@/features/running/services/history'
import { ShareDialog } from '@/features/share/components/ShareDialog'
import { generateShareHeadline } from '@/features/share/services/share-card'
import type { WorkoutShareCard } from '@/features/share/types'

interface RunHistoryProps {
  workouts: WorkoutHistoryRow[]
}

/** Format distance: sub-km → metres, ≥1 km → X.XX km. */
function formatDistance(meters: number | null): string {
  if (meters === null || meters === 0) return '0 m'
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(2)} km`
}

/** Format seconds into H:MM:SS or MM:SS. */
function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === 0) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`
  return `${m}:${pad(s)}`
}

/** Format pace as M:SS /km. */
function formatPace(paceSecsPerKm: number | null): string {
  if (paceSecsPerKm === null || paceSecsPerKm === 0) return '—'
  const m = Math.floor(paceSecsPerKm / 60)
  const s = paceSecsPerKm % 60
  return `${m}:${String(s).padStart(2, '0')} /km`
}

/** Format ISO timestamp into a human-friendly date + time. */
function formatDate(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    }),
    time: d.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true,
    }),
  }
}

export function RunHistory({ workouts }: RunHistoryProps) {
  if (!workouts || workouts.length === 0) {
    return null
  }

  return (
    <div data-testid="history-list" className="flex flex-col gap-3">
      {workouts.map((workout: WorkoutHistoryRow) => {
        const { date, time } = formatDate(workout.started_at)
        
        // Basic share card for history row
        const shareCardData: WorkoutShareCard = {
          type: 'workout',
          metadata: {
            generatedAt: new Date().toISOString(),
            strideQuestVersion: '0.1.0'
          },
          headline: generateShareHeadline('workout', { 
            distance: workout.distance_m || 0,
          }),
          distance: workout.distance_m || 0,
          duration: workout.duration_s || 0,
          pace: workout.avg_pace_s_per_km || 0,
          date: workout.started_at
        }

        return (
          <div
            key={workout.id}
            data-testid="history-item"
            className="bg-card rounded-2xl border border-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/10 group flex flex-col md:flex-row gap-4 md:items-center relative"
          >
            {/* Make the entire row clickable to the detail page, except the share button */}
            <Link href={`/run/${workout.id}`} className="absolute inset-0 z-0" aria-label="View Run Details" />

            <div className="flex-1">
              {/* Date header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground/60" />
                  <span className="font-medium text-foreground">
                    {date}
                  </span>
                  <span className="text-muted-foreground/60">
                    {time}
                  </span>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-primary/70">
                  Completed
                </span>
              </div>

              {/* Metrics row */}
              <div className="grid grid-cols-3 gap-4 relative z-10">
                <MetricCell
                  icon={<MapPin className="w-3 h-3" />}
                  label="Distance"
                  value={formatDistance(workout.distance_m)}
                />
                <MetricCell
                  icon={<Clock className="w-3 h-3" />}
                  label="Duration"
                  value={formatDuration(workout.duration_s)}
                />
                <MetricCell
                  icon={<Gauge className="w-3 h-3" />}
                  label="Pace"
                  value={formatPace(workout.avg_pace_s_per_km)}
                />
              </div>
            </div>

            <div className="md:border-l md:pl-4 md:ml-2 flex items-center justify-center relative z-10 pt-4 md:pt-0 border-t border-white/[0.04] md:border-t-0">
               <ShareDialog 
                 cardData={shareCardData} 
                 trigger={
                   <button className="text-xs font-bold uppercase tracking-widest text-primary/80 hover:text-primary transition-colors flex items-center gap-1.5 py-2 px-3 rounded-lg hover:bg-primary/10">
                     <Share className="w-3.5 h-3.5" />
                     Quick Share
                   </button>
                 }
               />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MetricCell({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-muted-foreground/60">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-widest">
          {label}
        </span>
      </div>
      <span className="text-base font-mono font-bold text-foreground tabular-nums">
        {value}
      </span>
    </div>
  )
}
