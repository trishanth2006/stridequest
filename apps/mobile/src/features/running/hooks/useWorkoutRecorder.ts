import { useCallback, useEffect, useRef, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  filterSamples,
  createSampleBuffer,
  haversineMeters,
} from '@stridequest/shared/running'
import type {
  GpsSample,
  SampleFilterConfig,
  SampleBufferConfig,
  SampleBuffer,
  UploadBatch,
} from '@stridequest/shared/running'
import { useLocation } from './useLocation'
import { supabase } from '@/lib/supabase'

export type RecorderStatus = 'idle' | 'recording' | 'paused' | 'stopped' | 'discarded'

export const RECORDER_STORAGE_KEY = '@stridequest/active-recorder'

export type PersistedRecorderState = {
  workoutId: string
  startedAt: string
  elapsedBeforePauseMs: number
}

export type UseWorkoutRecorderOptions = {
  filterConfig?: SampleFilterConfig
  bufferConfig?: Partial<SampleBufferConfig>
}

export type UseWorkoutRecorderResult = {
  status: RecorderStatus
  distanceMeters: number
  elapsedSeconds: number
  hasFix: boolean
  permissionStatus: 'prompt' | 'granted' | 'denied'
  workoutId: string | null
  start: (workoutId: string) => void
  restore: (workoutId: string, elapsedBeforePauseMs: number) => void
  pause: () => void
  resume: () => void
  stop: () => Promise<void>
  discard: () => void
  requestPermission: () => Promise<void>
}

function buildMobileUpload(workoutId: string): UploadBatch {
  return async (batch) => {
    const rows = batch.samples.map((s, idx) => ({
      workout_id: workoutId,
      lat: s.lat,
      lng: s.lng,
      accuracy_m: s.accuracy,
      altitude_m: s.altitude ?? null,
      speed_mps: s.speed ?? null,
      heading_deg: s.heading ?? null,
      recorded_at: new Date(s.recordedAt).toISOString(),
      batch_seq: batch.batchSeq,
      point_seq: idx,
    }))

    const { error } = await supabase.from('route_points').insert(rows)
    if (error) throw new Error(error.message)
  }
}

export function useWorkoutRecorder(options: UseWorkoutRecorderOptions = {}): UseWorkoutRecorderResult {
  const { filterConfig, bufferConfig } = options

  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [distanceMeters, setDistanceMeters] = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [workoutId, setWorkoutId] = useState<string | null>(null)

  const statusRef = useRef<RecorderStatus>('idle')
  const anchorRef = useRef<GpsSample | null>(null)
  const bufferRef = useRef<SampleBuffer | null>(null)
  const workoutIdRef = useRef<string | null>(null)
  const startedAtRef = useRef<number | null>(null)
  const elapsedBeforePauseRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const filterConfigRef = useRef(filterConfig)
  const bufferConfigRef = useRef(bufferConfig)

  useEffect(() => {
    filterConfigRef.current = filterConfig
    bufferConfigRef.current = bufferConfig
  }, [filterConfig, bufferConfig])

  const enter = useCallback((next: RecorderStatus) => {
    statusRef.current = next
    setStatus(next)
  }, [])

  const { permissionStatus, hasFix, requestPermission, startWatch, stopWatch } = useLocation()

  const startTimer = useCallback(() => {
    startedAtRef.current = Date.now()
    timerRef.current = setInterval(() => {
      const elapsed = elapsedBeforePauseRef.current + (Date.now() - (startedAtRef.current ?? Date.now()))
      setElapsedSeconds(Math.floor(elapsed / 1000))
    }, 1000)
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (startedAtRef.current !== null) {
      elapsedBeforePauseRef.current += Date.now() - startedAtRef.current
      startedAtRef.current = null
    }
  }, [])

  const persistState = useCallback(async (id: string) => {
    const state: PersistedRecorderState = {
      workoutId: id,
      startedAt: new Date().toISOString(),
      elapsedBeforePauseMs: elapsedBeforePauseRef.current,
    }
    await AsyncStorage.setItem(RECORDER_STORAGE_KEY, JSON.stringify(state))
  }, [])

  const clearPersistedState = useCallback(async () => {
    await AsyncStorage.removeItem(RECORDER_STORAGE_KEY)
  }, [])

  const handleSample = useCallback((candidate: GpsSample) => {
    if (statusRef.current !== 'recording') return
    const anchor = anchorRef.current
    const accepted = filterSamples(
      anchor ? [anchor, candidate] : [candidate],
      filterConfigRef.current,
    )
    const survived = accepted[accepted.length - 1] === candidate
    if (!survived) return

    if (anchor) {
      setDistanceMeters((total) => total + haversineMeters(anchor, candidate))
    }
    anchorRef.current = candidate
    bufferRef.current?.add(candidate)
  }, [])

  // Start a passive GPS watch as soon as permission is granted so hasFix
  // updates before the user taps START. handleSample guards statusRef !== 'recording'
  // so samples are silently dropped until a run is active.
  useEffect(() => {
    if (permissionStatus === 'granted') {
      void startWatch(handleSample)
    }
  }, [permissionStatus, startWatch, handleSample])

  const start = useCallback((id: string) => {
    if (statusRef.current !== 'idle') return
    workoutIdRef.current = id
    setWorkoutId(id)
    anchorRef.current = null
    elapsedBeforePauseRef.current = 0
    setDistanceMeters(0)
    setElapsedSeconds(0)
    bufferRef.current = createSampleBuffer(id, buildMobileUpload(id), bufferConfigRef.current)
    enter('recording')
    startTimer()
    void startWatch(handleSample)
    void persistState(id)
  }, [enter, startWatch, handleSample, startTimer, persistState])

  const pause = useCallback(() => {
    if (statusRef.current !== 'recording') return
    enter('paused')
    stopWatch()
    stopTimer()
    void bufferRef.current?.flush()
    if (workoutIdRef.current) void persistState(workoutIdRef.current)
  }, [enter, stopWatch, stopTimer, persistState])

  const resume = useCallback(() => {
    if (statusRef.current !== 'paused') return
    anchorRef.current = null
    enter('recording')
    startTimer()
    void startWatch(handleSample)
    if (workoutIdRef.current) void persistState(workoutIdRef.current)
  }, [enter, startWatch, handleSample, startTimer, persistState])

  const stop = useCallback(async () => {
    if (statusRef.current !== 'recording' && statusRef.current !== 'paused') return
    enter('stopped')
    stopWatch()
    stopTimer()
    await bufferRef.current?.stop()
    await clearPersistedState()
  }, [enter, stopWatch, stopTimer, clearPersistedState])

  const discard = useCallback(() => {
    if (statusRef.current !== 'recording' && statusRef.current !== 'paused') return
    enter('discarded')
    stopWatch()
    stopTimer()
    void bufferRef.current?.stop()
    void clearPersistedState()
  }, [enter, stopWatch, stopTimer, clearPersistedState])

  const restore = useCallback((id: string, elapsedBeforePauseMs: number) => {
    if (statusRef.current !== 'idle') return
    workoutIdRef.current = id
    setWorkoutId(id)
    elapsedBeforePauseRef.current = elapsedBeforePauseMs
    setElapsedSeconds(Math.floor(elapsedBeforePauseMs / 1000))
    bufferRef.current = createSampleBuffer(id, buildMobileUpload(id), bufferConfigRef.current)
    enter('paused')
  }, [enter])

  useEffect(() => {
    return () => {
      void bufferRef.current?.stop()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  return {
    status,
    distanceMeters,
    elapsedSeconds,
    hasFix,
    permissionStatus,
    workoutId,
    start,
    restore,
    pause,
    resume,
    stop,
    discard,
    requestPermission,
  }
}
