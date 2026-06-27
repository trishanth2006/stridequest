import { useState, useCallback, useEffect } from 'react'
import { View, Text, Pressable, ActivityIndicator } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useWorkoutRecorder, RECORDER_STORAGE_KEY } from '@/features/running/hooks/useWorkoutRecorder'
import type { PersistedRecorderState } from '@/features/running/hooks/useWorkoutRecorder'
import { startWorkout, discardWorkout, finalizeWorkout } from '@/features/running/services/workout'
import type { FinalizeResult } from '@/features/running/services/workout'
import { formatDistance, formatDuration, formatPace } from '@stridequest/shared/running'
import { colors } from '@/theme'

export default function RecordScreen() {
  const router = useRouter()
  const [finalization, setFinalization] = useState<FinalizeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)

  const recorder = useWorkoutRecorder()

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

  const handleStart = useCallback(async () => {
    setError(null)
    try {
      const { workoutId } = await startWorkout()
      recorder.start(workoutId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start run')
    }
  }, [recorder])

  const handleStop = useCallback(async () => {
    if (!recorder.workoutId) return
    const id = recorder.workoutId
    await recorder.stop()
    try {
      const result = await finalizeWorkout(id)
      setFinalization(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save run')
    }
  }, [recorder])

  const handleDiscardConfirm = useCallback(async () => {
    const id = recorder.workoutId
    recorder.discard()
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
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-6 gap-6">
        <Text className="text-3xl font-extrabold text-white">Ready to Run?</Text>

        {recorder.permissionStatus === 'denied' && (
          <Text className="text-sm text-danger text-center">
            Location permission denied. Enable it in Settings to start a run.
          </Text>
        )}

        {recorder.permissionStatus === 'prompt' && (
          <Pressable
            onPress={() => void recorder.requestPermission()}
            className="bg-surfaceMuted rounded-full px-6 py-3"
          >
            <Text className="text-white font-semibold">Enable Location</Text>
          </Pressable>
        )}

        {recorder.permissionStatus === 'granted' && (
          <>
            <View className="flex-row items-center gap-2">
              <View
                className={`w-2.5 h-2.5 rounded-full ${recorder.hasFix ? 'bg-primaryBright' : 'bg-accentBright'}`}
              />
              <Text className="text-sm text-fgSecondary">
                {recorder.hasFix ? 'GPS locked' : 'Acquiring GPS…'}
              </Text>
            </View>

            <Pressable
              onPress={() => void handleStart()}
              className="bg-primary rounded-full w-28 h-28 items-center justify-center"
            >
              <Text className="text-white font-bold text-lg">START</Text>
            </Pressable>
          </>
        )}

        {error && <Text className="text-sm text-danger text-center">{error}</Text>}

        <Pressable onPress={handleDone} className="mt-4">
          <Text className="text-sm text-fgMuted">Cancel</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  // --- Phase: recording ---
  if (recorder.status === 'recording') {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-6 gap-8">
        {!recorder.hasFix && (
          <View className="flex-row items-center gap-2 bg-accent/20 px-4 py-2 rounded-full">
            <ActivityIndicator color={colors.accentBright} size="small" />
            <Text className="text-accentBright text-xs font-medium">Waiting for GPS…</Text>
          </View>
        )}

        <View className="items-center gap-1">
          <Text className="text-5xl font-extrabold text-white tabular-nums">
            {formatDistance(recorder.distanceMeters)}
          </Text>
          <Text className="text-fgSecondary text-sm">distance</Text>
        </View>

        <View className="flex-row gap-10">
          <View className="items-center gap-1">
            <Text className="text-2xl font-bold text-white tabular-nums">
              {formatDuration(recorder.elapsedSeconds)}
            </Text>
            <Text className="text-fgSecondary text-xs">time</Text>
          </View>
          <View className="items-center gap-1">
            <Text className="text-2xl font-bold text-white">
              {recorder.elapsedSeconds > 0 && recorder.distanceMeters > 0
                ? formatPace((recorder.elapsedSeconds * 1000) / recorder.distanceMeters)
                : '--:--'}
            </Text>
            <Text className="text-fgSecondary text-xs">pace /km</Text>
          </View>
        </View>

        <View className="flex-row gap-4">
          <Pressable
            onPress={recorder.pause}
            className="bg-borderStrong rounded-full px-8 py-4"
          >
            <Text className="text-white font-semibold text-base">Pause</Text>
          </Pressable>

          {!confirmingDiscard ? (
            <Pressable
              onPress={() => setConfirmingDiscard(true)}
              className="bg-surfaceMuted rounded-full px-6 py-4"
            >
              <Text className="text-fgSecondary font-semibold text-base">Discard</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => void handleDiscardConfirm()}
              className="bg-danger rounded-full px-6 py-4"
            >
              <Text className="text-white font-semibold text-base">Confirm Discard</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    )
  }

  // --- Phase: paused ---
  if (recorder.status === 'paused') {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-6 gap-8">
        <Text className="text-fgSecondary text-sm tracking-widest uppercase">Paused</Text>

        <View className="items-center gap-1">
          <Text className="text-5xl font-extrabold text-white tabular-nums">
            {formatDistance(recorder.distanceMeters)}
          </Text>
          <Text className="text-fgSecondary text-sm">distance</Text>
        </View>

        <Text className="text-2xl font-bold text-white tabular-nums">
          {formatDuration(recorder.elapsedSeconds)}
        </Text>

        <View className="flex-row gap-4">
          <Pressable
            onPress={recorder.resume}
            className="bg-primary rounded-full px-8 py-4"
          >
            <Text className="text-white font-semibold text-base">Resume</Text>
          </Pressable>

          <Pressable
            onPress={() => void handleStop()}
            className="bg-borderStrong rounded-full px-6 py-4"
          >
            <Text className="text-white font-semibold text-base">End Run</Text>
          </Pressable>
        </View>

        {!confirmingDiscard ? (
          <Pressable onPress={() => setConfirmingDiscard(true)}>
            <Text className="text-fgMuted text-sm">Discard run</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => void handleDiscardConfirm()}>
            <Text className="text-danger text-sm font-semibold">Tap to confirm discard</Text>
          </Pressable>
        )}
      </SafeAreaView>
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
      <SafeAreaView className="flex-1 bg-background px-6 items-center justify-center gap-8">
        <Text className="text-2xl font-extrabold text-white">Run Complete</Text>

        <View className="bg-surface rounded-2xl p-6 w-full gap-4">
          <StatRow label="Distance" value={formatDistance(finalization.distanceM ?? 0)} />
          <StatRow label="Time" value={formatDuration(finalization.durationS ?? 0)} />
          {finalization.avgPaceSPerKm && (
            <StatRow label="Avg Pace" value={formatPace(finalization.avgPaceSPerKm)} />
          )}
          {(finalization.xpAwarded ?? 0) > 0 && (
            <StatRow label="XP Earned" value={`+${finalization.xpAwarded}`} highlight />
          )}
          {(finalization.cellsClaimed ?? 0) > 0 && (
            <StatRow label="Cells Claimed" value={String(finalization.cellsClaimed)} />
          )}
          {(finalization.cellsStolen ?? 0) > 0 && (
            <StatRow label="Cells Stolen" value={String(finalization.cellsStolen)} />
          )}
        </View>

        <Pressable
          onPress={handleDone}
          className="bg-primary rounded-full px-12 py-4"
        >
          <Text className="text-white font-bold text-base">Done</Text>
        </Pressable>
      </SafeAreaView>
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
