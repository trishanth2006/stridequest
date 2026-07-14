import { useState, useCallback, useEffect, useRef } from 'react'
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useWorkoutRecorder, RECORDER_STORAGE_KEY } from '@/features/running/hooks/useWorkoutRecorder'
import type { PersistedRecorderState } from '@/features/running/hooks/useWorkoutRecorder'
import { startWorkout, discardWorkout, finalizeWorkout } from '@/features/running/services/workout'
import type { FinalizeResult } from '@/features/running/services/workout'
import { useSession } from '@/features/auth/providers/SessionProvider'
import { invalidateAfterRun } from '@/lib/cacheKeys'
import { formatDistance, formatDuration, formatPace } from '@stridequest/shared/running'
import { colors } from '@/theme'
import * as NotificationManager from '@/features/notifications/NotificationManager'
import { RunHUD } from '@/features/running/components/RunHUD'
import { RunLiveMap } from '@/features/running/components/RunLiveMap'
import { PostRunSummary } from '@/features/running/screens/PostRunSummary'
import { WorkoutSelector } from '@/features/running/components/WorkoutSelector'
import type { WorkoutTarget } from '@/features/running/types/workout'

async function dispatchPostRunEvents(result: FinalizeResult): Promise<void> {
  if ((result.cellsClaimed ?? 0) > 0) {
    NotificationManager.enqueueTerritoryCapture(result.cellsClaimed!)
  }
  for (const quest of result.questsCompleted ?? []) {
    if (quest.title) {
      await NotificationManager.enqueueQuestComplete(quest.questId, quest.title)
    }
  }
  if ((result.xpAwarded ?? 0) > 0) {
    await NotificationManager.enqueueXpMilestone(result.xpAwarded!)
  }
}

export default function RecordScreen() {
  const router = useRouter()
  const { session } = useSession()
  const [finalization, setFinalization] = useState<FinalizeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)

  // Tracking state for Workout Configuration
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutTarget | null>(null)
  const [isTracking, setIsTracking] = useState(false)

  const recorder = useWorkoutRecorder()
  const liveRunStarted = useRef(false)

  // Mirror live run stats to the foreground notification (internal 5s throttle prevents spam).
  useEffect(() => {
    if (recorder.status !== 'recording') return
    const pace =
      recorder.elapsedSeconds > 0 && recorder.distanceMeters > 0
        ? (recorder.elapsedSeconds * 1000) / recorder.distanceMeters
        : 0
    void NotificationManager.updateLiveRunStats(recorder.distanceMeters, recorder.elapsedSeconds, pace)
  }, [recorder.status, recorder.elapsedSeconds, recorder.distanceMeters])

  // Keep the foreground notification in sync with pause/resume transitions.
  useEffect(() => {
    if (recorder.status === 'paused') {
      void NotificationManager.pauseLiveRun()
    } else if (recorder.status === 'recording' && liveRunStarted.current) {
      void NotificationManager.resumeLiveRun()
    }
  }, [recorder.status])

  // Recovery: on mount, check AsyncStorage for an interrupted run.
  // If found, restore the recorder into paused state with the correct elapsed time.
  useEffect(() => {
    AsyncStorage.getItem(RECORDER_STORAGE_KEY).then((json) => {
      if (!json) return
      try {
        const state = JSON.parse(json) as PersistedRecorderState
        recorder.restore(state.workoutId, state.elapsedBeforePauseMs)
      } catch {
        // Corrupt state — ignore and let user start fresh
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleStart = useCallback(async (workout: WorkoutTarget) => {
    setError(null)
    setSelectedWorkout(workout)
    
    // [PHASE 3 INJECTION POINT]:
    // The MotionEngine will hook into the injected WorkoutTarget config here.
    // e.g. recorder.engine?.setWorkoutTarget(workout);
    // Ensure startTrackingService() (triggered by recorder.start) is only 
    // called after the workout configuration is securely loaded into the active state.
    
    try {
      const { workoutId } = await startWorkout()
      recorder.start(workoutId)
      setIsTracking(true)
      liveRunStarted.current = true
      void NotificationManager.startLiveRun()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start run')
    }
  }, [recorder])

  const handleStop = useCallback(async () => {
    if (!recorder.workoutId) return
    const id = recorder.workoutId
    const activeDurationS = recorder.elapsedSeconds  // capture before stop clears timer
    await recorder.stop()
    liveRunStarted.current = false
    setIsTracking(false)
    setSelectedWorkout(null)
    try {
      const result = await finalizeWorkout(id, activeDurationS)
      setFinalization(result)
      if (session?.user.id) invalidateAfterRun(session.user.id)
      void NotificationManager.stopLiveRunWithSummary(result.distanceM ?? 0, result.durationS ?? 0)
      void dispatchPostRunEvents(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save run')
      void NotificationManager.cancelLiveRun()
    }
  }, [recorder])

  const handleDiscardConfirm = useCallback(async () => {
    const id = recorder.workoutId
    recorder.discard()
    liveRunStarted.current = false
    setIsTracking(false)
    setSelectedWorkout(null)
    void NotificationManager.cancelLiveRun()
    if (id) {
      await discardWorkout(id).catch(() => {})
    }
    setConfirmingDiscard(false)
  }, [recorder])

  const handleDone = useCallback(() => {
    router.back()
  }, [router])

  // --- Phase: idle ---
  if (recorder.status === 'idle') {
    if (recorder.permissionStatus === 'denied') {
      return (
        <SafeAreaView className="flex-1 bg-background items-center justify-center px-6 gap-6">
          <Text className="text-3xl font-extrabold text-white">Ready to Run?</Text>
          <Text className="text-sm text-danger text-center">
            Location permission denied. Enable it in Settings to start a run.
          </Text>
          <Pressable onPress={handleDone} className="mt-4">
            <Text className="text-sm text-fgMuted">Cancel</Text>
          </Pressable>
        </SafeAreaView>
      )
    }

    if (recorder.permissionStatus === 'prompt') {
      return (
        <SafeAreaView className="flex-1 bg-background items-center justify-center px-6 gap-6">
          <Text className="text-3xl font-extrabold text-white">Ready to Run?</Text>
          <Pressable
            onPress={() => void recorder.requestPermission()}
            className="bg-surfaceMuted rounded-full px-6 py-3"
          >
            <Text className="text-white font-semibold">Enable Location</Text>
          </Pressable>
          <Pressable onPress={handleDone} className="mt-4">
            <Text className="text-sm text-fgMuted">Cancel</Text>
          </Pressable>
        </SafeAreaView>
      )
    }

    if (!isTracking) {
      return (
        <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
          <WorkoutSelector onStartWorkout={(config) => void handleStart(config)} />
          {error && <Text className="text-sm text-danger text-center mt-2 pb-4">{error}</Text>}
          {!recorder.hasFix && (
            <View className="absolute top-12 right-6 flex-row items-center gap-2 bg-surface/80 px-3 py-1.5 rounded-full z-10">
              <View className="w-2.5 h-2.5 rounded-full bg-accentBright" />
              <Text className="text-xs text-fgSecondary font-medium">Acquiring GPS…</Text>
            </View>
          )}
          <Pressable onPress={handleDone} className="absolute top-12 left-6 z-10 bg-surface/80 px-4 py-2 rounded-full">
            <Text className="text-sm text-white font-semibold">Cancel</Text>
          </Pressable>
        </SafeAreaView>
      )
    }
  }

  // --- Phase: recording or paused ---
  if (recorder.status === 'recording' || recorder.status === 'paused') {
    return (
      <View style={styles.runScreen}>
        {/* Full-screen map rendered in the background */}
        <RunLiveMap
          routeCoordinates={recorder.routeCoordinates}
          currentPosition={recorder.currentPosition}
        />

        {/* HUD sits on top, occupying the same full-screen frame */}
        <RunHUD
          status={recorder.status}
          distanceMeters={recorder.distanceMeters}
          elapsedSeconds={recorder.elapsedSeconds}
          hasFix={recorder.hasFix}
          onPause={recorder.pause}
          onResume={recorder.resume}
          onStop={() => void handleStop()}
          onDiscardConfirm={() => void handleDiscardConfirm()}
          engine={recorder.engine}
        />
      </View>
    )
  }

  // --- Phase: stopped (saving) ---
  if (recorder.status === 'stopped' && !finalization && !error) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center gap-4">
        <ActivityIndicator color={colors.primary} size="large" />
        <Text className="text-fgSecondary text-sm">Saving your run…</Text>
      </SafeAreaView>
    )
  }

  // --- Phase: completed ---
  if (recorder.status === 'stopped' && finalization) {
    return (
      <View className="flex-1 bg-background relative">
        <PostRunSummary
          samples={recorder.rawSamples}
          totalDistanceMeters={finalization.distanceM ?? 0}
          movingTimeMs={(finalization.durationS ?? 0) * 1000}
          averageSpeedMps={finalization.avgPaceSPerKm ? (1000 / finalization.avgPaceSPerKm) : 0}
          rewards={{
            xpAwarded: finalization.xpAwarded ?? 0,
            cellsClaimed: finalization.cellsClaimed ?? 0,
            cellsStolen: finalization.cellsStolen ?? 0,
            questsCompleted: finalization.questsCompleted ?? [],
          }}
        />
        <Pressable
          onPress={handleDone}
          className="absolute top-12 left-6 bg-black/40 border border-white/20 rounded-full px-4 py-2 z-50 backdrop-blur-md"
        >
          <Text className="text-white font-bold text-sm">Close</Text>
        </Pressable>
      </View>
    )
  }

  // --- Phase: discarded ---
  if (recorder.status === 'discarded') {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-6 gap-6">
        <Text className="text-xl font-bold text-white">Run Discarded</Text>
        <Text className="text-fgSecondary text-sm text-center">
          Your run was not saved.
        </Text>
        <Pressable onPress={handleDone} className="bg-surfaceMuted rounded-full px-8 py-3">
          <Text className="text-white font-semibold">Back to History</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  // --- Error state ---
  return (
    <SafeAreaView className="flex-1 bg-background items-center justify-center px-6 gap-4">
      <Text className="text-danger text-base font-semibold">Something went wrong</Text>
      <Text className="text-fgSecondary text-sm text-center">{error}</Text>
      <Pressable onPress={handleDone} className="bg-surfaceMuted rounded-full px-8 py-3">
        <Text className="text-white font-semibold">Go Back</Text>
      </Pressable>
    </SafeAreaView>
  )
}

function StatRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View className="flex-row justify-between items-center">
      <Text className="text-fgSecondary text-sm">{label}</Text>
      <Text className={`font-bold text-base ${highlight ? 'text-primaryBright' : 'text-white'}`}>
        {value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  /**
   * Full-screen container for the run phase.
   * RunLiveMap uses `StyleSheet.absoluteFillObject` inside, so it expands to
   * cover this view entirely. RunHUD (flex:1) layers on top.
   */
  runScreen: {
    flex: 1,
    backgroundColor: '#000',
  },
})

