'use client'

import { Button } from '@/components/ui/button'
import { MapPin, Square, X, Navigation, Clock, Gauge, Footprints } from 'lucide-react'

type RecordingPanelProps = {
  distParts: string[]
  durationLabel: string
  gpsQuality: { label: string; color: string }
  gpsStatus: string | null
  workoutId: string | null
  recordingBusy: boolean
  stopPending: boolean
  discardPending: boolean
  stopAction: (e: React.FormEvent<HTMLFormElement>) => void
  discardAction: (e: React.FormEvent<HTMLFormElement>) => void
}

// Presentational recording view, extracted verbatim from WorkoutControls (02B-08
// cleanup) so that file stays under the 300-line rule. Pure UI: it owns no recorder,
// lifecycle, or formatting logic — every value is computed in WorkoutControls and
// passed in. No behaviour, styling, or prop semantics changed in the move.
export function RecordingPanel({
  distParts,
  durationLabel,
  gpsQuality,
  gpsStatus,
  workoutId,
  recordingBusy,
  stopPending,
  discardPending,
  stopAction,
  discardAction,
}: RecordingPanelProps) {
  return (
    <div className="flex flex-col bg-card rounded-3xl p-6 md:p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_12px_40px_rgba(0,0,0,0.4)] border border-white/[0.04] relative overflow-hidden">

      {/* Watermark */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 opacity-[0.03] pointer-events-none">
        <Navigation className="w-72 h-72 text-primary" />
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between mb-8 relative z-10">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
          <span className="text-[11px] font-bold tracking-widest uppercase text-foreground">Live Run</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin className={`w-3.5 h-3.5 ${gpsQuality.color}`} />
          <span className={`text-[11px] font-semibold uppercase tracking-widest ${gpsQuality.color}`}>
            GPS: {gpsQuality.label}
          </span>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-3 gap-4 mb-8 relative z-10">
        {/* Distance — primary */}
        <div
          data-testid="live-distance"
          className="col-span-3 flex flex-col items-center justify-center py-6"
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
            <Footprints className="w-3.5 h-3.5" />
            Live estimate
          </p>
          <p
            data-testid="live-distance-value"
            className="text-7xl md:text-8xl font-mono font-bold tracking-tighter text-foreground leading-none tabular-nums"
          >
            {distParts[0]}
          </p>
          <p className="text-lg font-medium text-muted-foreground mt-1">
            {distParts[1]}
          </p>
        </div>

        {/* Duration */}
        <div className="bg-white/[0.03] rounded-xl p-4 flex flex-col items-center gap-1 border border-white/[0.04]">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Duration
          </span>
          <span className="text-2xl font-mono font-bold text-foreground tabular-nums">
            {durationLabel}
          </span>
        </div>

        {/* Pace (preview — authoritative pace is computed server-side at finalize, 02C) */}
        <div className="bg-white/[0.03] rounded-xl p-4 flex flex-col items-center gap-1 border border-white/[0.04]">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1">
            <Gauge className="w-3 h-3" />
            Est. Pace
          </span>
          <span className="text-2xl font-mono font-bold text-muted-foreground/40 tabular-nums">
            --:--
          </span>
        </div>

        {/* Status */}
        <div className="bg-white/[0.03] rounded-xl p-4 flex flex-col items-center gap-1 border border-white/[0.04]">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Status
          </span>
          <span className="text-sm font-bold text-primary uppercase tracking-wider">
            Recording
          </span>
        </div>
      </div>

      {gpsStatus && (
        <div className="flex justify-center mb-6 relative z-10">
          <p role="status" className="text-xs font-medium text-amber-500 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20">
            {gpsStatus}
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="grid grid-cols-2 gap-3 relative z-10">
        <form onSubmit={discardAction} className="w-full">
          <input type="hidden" name="workoutId" value={workoutId ?? ''} />
          <Button
            type="submit"
            disabled={recordingBusy}
            size="lg"
            className="w-full h-14 rounded-xl bg-white/[0.04] text-foreground hover:bg-destructive/90 hover:text-white transition-all duration-300 hover:scale-102 flex items-center justify-center gap-2 border border-white/[0.06] hover:border-destructive/50"
          >
            <X className="w-4 h-4" />
            {discardPending ? 'Discarding…' : 'Discard run'}
          </Button>
        </form>
        <form onSubmit={stopAction} className="w-full">
          <input type="hidden" name="workoutId" value={workoutId ?? ''} />
          <Button
            type="submit"
            disabled={recordingBusy}
            size="lg"
            className="w-full h-14 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary transition-all duration-300 hover:scale-102 shadow-[0_0_15px_rgba(16,185,129,0.12)] flex items-center justify-center gap-2"
          >
            <Square className="w-4 h-4" fill="currentColor" />
            {stopPending ? 'Stopping…' : 'Stop run'}
          </Button>
        </form>
      </div>
    </div>
  )
}
