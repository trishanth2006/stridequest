'use client'

import Link from 'next/link'
import { useActionState, useEffect, useState, useRef, useCallback, startTransition } from 'react'
import { Button } from '@/components/ui/button'
import { startWorkout, stopWorkout, discardWorkout } from '@/features/running/actions'
import { useWorkoutRecorder } from '@/features/running/hooks/useWorkoutRecorder'
import { uploadBatch } from '@/features/running/services/upload-batch'
import { RecordingPanel } from '@/features/running/components/RecordingPanel'
import type { GeolocationError, GeolocationPermission } from '@/features/running/hooks/useGeolocation'
import type { WorkoutActionResult } from '@/features/running/types'
import { MapPin, Play, X, CheckCircle, Signal } from 'lucide-react'

import { createClient } from '@/infrastructure/supabase/client'
import { getWorkoutXpBreakdown, getUserXP } from '@/features/xp/services/profile'
import { getLevelUpResult, getXpProgress } from '@/features/xp/services/xp'
import type { WorkoutXpBreakdown } from '@/features/xp/services/profile'
import type { UserXp } from '@/features/xp/types'
import { LevelUpModal } from '@/features/xp/components/LevelUpModal'
import { getWorkoutSummary } from '@/features/running/services/workouts'
import { WorkoutSummary } from '@/features/running/components/WorkoutSummary'
import type { WorkoutSummary as WorkoutSummaryType } from '@/features/running/types/workout-summary'

const initialState: WorkoutActionResult = { status: 'idle' }

// Live estimate only (FR-GPS-5): never authoritative. Sub-km shows metres so the
// value visibly ticks early in a run; ≥1 km switches to two-decimal kilometres.
function formatDistanceEstimate(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(2)} km`
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`
  return `${pad(m)}:${pad(s)}`
}

// Recorder/GPS health surfaced as one line. Denied is actionable and wins; a live
// error (timeout/unavailable) is informational — the run keeps recording; before
// the first accepted fix we tell the user we're still acquiring one.
function gpsStatusMessage(
  permission: GeolocationPermission,
  error: GeolocationError | null,
  hasFix: boolean,
): string | null {
  if (permission === 'denied') return 'Location access is required to record your route.'
  if (error) return 'Weak GPS signal — still recording.'
  if (!hasFix) return 'Acquiring GPS…'
  return null
}

function gpsQualityLabel(
  permission: GeolocationPermission,
  error: GeolocationError | null,
  hasFix: boolean,
): { label: string; color: string } {
  if (permission === 'denied') return { label: 'Denied', color: 'text-destructive' }
  if (error) return { label: 'Weak', color: 'text-amber-500' }
  if (!hasFix) return { label: 'Acquiring', color: 'text-amber-500' }
  return { label: 'Locked', color: 'text-primary' }
}

// Lifecycle phase is derived purely from the three action results. The recorder is
// wired effect-driven (02B-08): it starts once the server returns a workout id and
// stops when the run reaches a terminal phase. Flush-before-finalize ordering is
// deliberately left to 02C — nothing reads route_points until finalize exists.
export function WorkoutControls() {
  const [startState, startAction, startPending] = useActionState(startWorkout, initialState)
  const [stopState, stopAction, stopPending] = useActionState(stopWorkout, initialState)
  const [discardState, discardAction, discardPending] = useActionState(
    discardWorkout,
    initialState
  )

  const {
    status: recorderStatus,
    distanceMeters,
    hasFix,
    permission,
    error: gpsError,
    start: startRecorder,
    stop: stopRecorder,
  } = useWorkoutRecorder({ upload: uploadBatch })

  const workoutId = startState.status === 'success' ? startState.workoutId : null

  const phase = discardState.status === 'success'
    ? 'discarded'
    : stopState.status === 'success'
      ? 'completed'
      : workoutId
        ? 'recording'
        : 'idle'

  // ── Duration timer ──
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => {
    if (phase === 'recording' && !intervalRef.current) {
      setElapsed(0)
      intervalRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1)
      }, 1000)
    }
    if (phase !== 'recording') {
      clearTimer()
    }
    return clearTimer
  }, [phase, clearTimer])

  // Start GPS once the server has created the workout and returned its id. The
  // recorder's own idle-guard makes the call safe to re-evaluate.
  useEffect(() => {
    if (workoutId && recorderStatus === 'idle') {
      startRecorder(workoutId)
    }
  }, [workoutId, recorderStatus, startRecorder])

  // ── XP Feedback ──
  const [xpBreakdown, setXpBreakdown] = useState<WorkoutXpBreakdown | null>(null)
  const [userXp, setUserXp] = useState<UserXp | null>(null)
  const [workoutSummary, setWorkoutSummary] = useState<WorkoutSummaryType | null>(null)
  const [showLevelUpModal, setShowLevelUpModal] = useState(false)
  const [levelUpData, setLevelUpData] = useState<{ previousLevel: number; currentLevel: number } | null>(null)

  useEffect(() => {
    if (phase === 'completed' && workoutId) {
      let isMounted = true
      const loadXp = async () => {
        try {
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return

          const [breakdown, currentXp, summary] = await Promise.all([
            getWorkoutXpBreakdown(supabase, workoutId),
            getUserXP(supabase, user.id),
            getWorkoutSummary(supabase, workoutId)
          ])

          if (!isMounted) return

          setXpBreakdown(breakdown)
          setUserXp(currentXp)
          setWorkoutSummary(summary)

          const afterXp = currentXp.totalXp
          const beforeXp = afterXp - breakdown.totalXp
          const levelUp = getLevelUpResult(beforeXp, afterXp)

          if (levelUp.leveledUp) {
            setLevelUpData({
              previousLevel: levelUp.previousLevel,
              currentLevel: levelUp.currentLevel
            })
            setShowLevelUpModal(true)
          }
        } catch (err) {
          console.error('Failed to load XP feedback', err)
        }
      }
      loadXp()

      return () => { isMounted = false }
    }
  }, [phase, workoutId])

  // Replaced in 02C-02A: stopRecorder is now explicitly awaited before the server
  // actions are dispatched, preventing finalize from racing the buffer flush.

  // Each state reflects its latest attempt, so the first error in start→stop→
  // discard order is the one relevant to the current phase.
  const error = startState.status === 'error'
    ? startState.error
    : stopState.status === 'error'
      ? stopState.error
      : discardState.status === 'error'
        ? discardState.error
        : null

  const recordingBusy = stopPending || discardPending

  const handleStop = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    await stopRecorder()
    startTransition(() => {
      stopAction(formData)
    })
  }

  const handleDiscard = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    await stopRecorder()
    startTransition(() => {
      discardAction(formData)
    })
  }
  const gpsStatus = gpsStatusMessage(permission, gpsError, hasFix)
  const gpsQuality = gpsQualityLabel(permission, gpsError, hasFix)

  // Split distance for display
  const distStr = formatDistanceEstimate(distanceMeters)
  const distParts = distStr.split(' ')
  const durationLabel = formatDuration(elapsed)

  return (
    <div className="w-full flex flex-col gap-6">
      {error && (
        <div
          role="alert"
          data-testid="workout-error"
          className="rounded-xl border border-destructive/60 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {/* ── IDLE ── */}
      {phase === 'idle' && (
        <div className="flex flex-col items-center justify-center gap-10 py-8">
          {/* GPS readiness */}
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-card border border-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] flex items-center justify-center">
              <Signal className={`w-8 h-8 ${gpsQuality.color} transition-colors`} />
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Ready to run?</h2>
              <div className="flex items-center justify-center gap-2 text-sm">
                <MapPin className={`w-3.5 h-3.5 ${gpsQuality.color}`} />
                <span className={`font-medium ${gpsQuality.color}`}>GPS: {gpsQuality.label}</span>
              </div>
            </div>
          </div>

          {/* Start button */}
          <form action={startAction} className="w-full max-w-xs">
            <Button
              type="submit"
              disabled={startPending}
              size="lg"
              className="w-full h-16 rounded-2xl bg-primary text-lg font-bold text-primary-foreground hover:bg-primary transition-all duration-300 hover:scale-102 hover:-translate-y-0.5 shadow-[0_0_30px_rgba(16,185,129,0.15)] hover:shadow-[0_0_40px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:hover:scale-100"
            >
              <Play className="w-6 h-6" fill="currentColor" />
              {startPending ? 'Starting…' : 'Start run'}
            </Button>
          </form>
        </div>
      )}

      {/* ── RECORDING ── */}
      {phase === 'recording' && (
        <RecordingPanel
          distParts={distParts}
          durationLabel={durationLabel}
          gpsQuality={gpsQuality}
          gpsStatus={gpsStatus}
          workoutId={workoutId}
          recordingBusy={recordingBusy}
          stopPending={stopPending}
          discardPending={discardPending}
          stopAction={handleStop}
          discardAction={handleDiscard}
        />
      )}

      {/* ── COMPLETED ── */}
      {phase === 'completed' && (
        <div role="status" className="flex flex-col items-center justify-center py-8">
          <CheckCircle className="w-14 h-14 text-primary mb-5" />
          <p className="text-2xl font-bold text-foreground mb-6">Run complete</p>

          {xpBreakdown && userXp && workoutSummary ? (
            <div className="w-full mb-8">
              <WorkoutSummary 
                summary={workoutSummary}
                xpBreakdown={xpBreakdown} 
                xpProgress={getXpProgress(userXp.totalXp)} 
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mb-8 animate-pulse">Calculating XP…</p>
          )}

          <div className="flex flex-col gap-3 w-full max-w-xs px-4">
            <Link
              href="/run"
              className="flex items-center justify-center w-full h-12 rounded-xl bg-primary/10 text-primary font-bold hover:bg-primary/20 transition-colors text-sm"
            >
              Start a new run
            </Link>
            <Link
              href="/run/history"
              className="flex items-center justify-center w-full h-12 rounded-xl bg-white/[0.06] text-foreground font-medium hover:bg-white/[0.10] transition-colors text-sm"
            >
              View run history
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center justify-center w-full h-12 rounded-xl bg-white/[0.04] text-foreground/70 font-medium hover:bg-white/[0.08] hover:text-foreground transition-colors text-sm"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      )}

      {/* ── DISCARDED ── */}
      {phase === 'discarded' && (
        <div role="status" className="flex flex-col items-center justify-center py-16 bg-card rounded-3xl border border-white/[0.04]">
          <X className="w-14 h-14 text-muted-foreground mb-5" />
          <p className="text-2xl font-bold text-foreground mb-2">Run discarded</p>
          <p className="text-sm text-muted-foreground mb-8">No data was saved.</p>
          <div className="flex flex-col gap-3 w-full max-w-xs px-4">
            <Link
              href="/run"
              className="flex items-center justify-center w-full h-12 rounded-xl bg-white/[0.08] text-foreground font-medium hover:bg-white/[0.12] transition-colors text-sm"
            >
              Start a new run
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center justify-center w-full h-12 rounded-xl bg-transparent text-muted-foreground font-medium hover:text-foreground transition-colors text-sm"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      )}

      {showLevelUpModal && levelUpData && (
        <LevelUpModal 
          previousLevel={levelUpData.previousLevel}
          currentLevel={levelUpData.currentLevel}
          onClose={() => setShowLevelUpModal(false)}
        />
      )}
    </div>
  )
}


