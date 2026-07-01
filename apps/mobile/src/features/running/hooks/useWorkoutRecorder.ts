import { useCallback, useEffect, useRef, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  createSampleBuffer,
  haversineMeters,
} from '@stridequest/shared/running'
import type {
  GpsSample,
  SampleBufferConfig,
  SampleBuffer,
  UploadBatch,
} from '@stridequest/shared/running'
import { useLocation } from './useLocation'
import { supabase } from '@/lib/supabase'
import { MotionEngine } from '../engine/MotionEngine'
import { DEFAULT_MOTION_CONFIG } from '../engine/MotionEngineConfig'
import type { SampleDecision } from '../engine/MotionTypes'
import { AudioCoach } from '../../audio/AudioCoach'

export type RecorderStatus = 'idle' | 'recording' | 'paused' | 'stopped' | 'discarded'

export const RECORDER_STORAGE_KEY = '@stridequest/active-recorder'

export type PersistedRecorderState = {
  workoutId: string
  startedAt: string
  elapsedBeforePauseMs: number
}

export type UseWorkoutRecorderOptions = {
  bufferConfig?: Partial<SampleBufferConfig>
}

export type UseWorkoutRecorderResult = {
  status: RecorderStatus
  distanceMeters: number
  elapsedSeconds: number
  hasFix: boolean
  permissionStatus: 'prompt' | 'granted' | 'denied'
  workoutId: string | null
  routeCoordinates: [number, number][]
  currentPosition: { lat: number; lng: number } | null
  start: (workoutId: string) => void
  restore: (workoutId: string, elapsedBeforePauseMs: number) => void
  pause: () => void
  resume: () => void
  stop: () => Promise<void>
  discard: () => void
  requestPermission: () => Promise<void>
  engine: MotionEngine | null
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
  const { bufferConfig } = options

  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [distanceMeters, setDistanceMeters] = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [workoutId, setWorkoutId] = useState<string | null>(null)
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([])
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | null>(null)

  const statusRef = useRef<RecorderStatus>('idle')
  const anchorRef = useRef<GpsSample | null>(null)
  const bufferRef = useRef<SampleBuffer | null>(null)
  const workoutIdRef = useRef<string | null>(null)
  const startedAtRef = useRef<number | null>(null)
  const elapsedBeforePauseRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const bufferConfigRef = useRef(bufferConfig)
  const engineRef = useRef<MotionEngine | null>(null)
  const wasManuallyPausedRef = useRef(false)
  
  const routeCoordinatesRef = useRef<[number, number][]>([])
  const lastRouteUpdateRef = useRef<number>(0)

  useEffect(() => {
    bufferConfigRef.current = bufferConfig
  }, [bufferConfig])

  const enter = useCallback((next: RecorderStatus) => {
    statusRef.current = next
    setStatus(next)
  }, [])

  const { permissionStatus, hasFix, requestPermission, startWatch, stopWatch } = useLocation()

  const startTimer = useCallback(() => {
    startedAtRef.current = Date.now()
    timerRef.current = setInterval(() => {
      const elapsed =
        elapsedBeforePauseRef.current + (Date.now() - (startedAtRef.current ?? Date.now()))
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
    const st = statusRef.current
    if (st === 'idle' || st === 'stopped' || st === 'discarded') return
    if (wasManuallyPausedRef.current) return
    engineRef.current?.processSample(candidate)
  }, [])

  useEffect(() => {
    if (permissionStatus === 'granted') void startWatch(handleSample)
  }, [permissionStatus, startWatch, handleSample])

  const start = useCallback((id: string) => {
    if (statusRef.current !== 'idle') return

    workoutIdRef.current = id
    setWorkoutId(id)
    anchorRef.current = null
    wasManuallyPausedRef.current = false
    elapsedBeforePauseRef.current = 0
    setDistanceMeters(0)
    setElapsedSeconds(0)
    setRouteCoordinates([])
    routeCoordinatesRef.current = []
    lastRouteUpdateRef.current = 0
    setCurrentPosition(null)
    bufferRef.current = createSampleBuffer(id, buildMobileUpload(id), bufferConfigRef.current)

    const engine = new MotionEngine(DEFAULT_MOTION_CONFIG)

    engine.on('validatedSample', (decision: SampleDecision) => {
      if (decision.shouldRenderRoute) {
        setCurrentPosition({ lat: decision.sample.lat, lng: decision.sample.lng })
        routeCoordinatesRef.current.push([decision.sample.lng, decision.sample.lat])
        
        const now = Date.now()
        if (now - lastRouteUpdateRef.current >= 2000) {
          setRouteCoordinates([...routeCoordinatesRef.current])
          lastRouteUpdateRef.current = now
        }
      }
      if (decision.shouldCountDistance) {
        if (anchorRef.current) {
          setDistanceMeters((total) => total + haversineMeters(anchorRef.current!, decision.sample))
        }
        anchorRef.current = decision.sample
      }
      if (decision.shouldPersist) bufferRef.current?.add(decision.sample)
    })

    engine.on('autoPause', () => {
      if (statusRef.current !== 'recording') return
      stopTimer()
      engine.setPowerMode('LOW')
      enter('paused')
      AudioCoach.speakIfEnabled('Auto-paused.')
      if (workoutIdRef.current) void persistState(workoutIdRef.current)
    })

    engine.on('autoResume', () => {
      if (statusRef.current !== 'paused' || wasManuallyPausedRef.current) return
      anchorRef.current = null
      startTimer()
      engine.setPowerMode('HIGH')
      enter('recording')
      AudioCoach.speakIfEnabled('Resumed.')
      if (workoutIdRef.current) void persistState(workoutIdRef.current)
    })

    engineRef.current = engine
    enter('recording')
    startTimer()
    void startWatch(handleSample)
    void engine.initialize().then(() => engine.start())
    void persistState(id)
  }, [enter, startWatch, handleSample, startTimer, stopTimer, persistState])

  const pause = useCallback(() => {
    if (statusRef.current !== 'recording') return
    wasManuallyPausedRef.current = true
    enter('paused')
    stopWatch()
    stopTimer()
    engineRef.current?.pause()
    void bufferRef.current?.flush()
    if (workoutIdRef.current) void persistState(workoutIdRef.current)
  }, [enter, stopWatch, stopTimer, persistState])

  const resume = useCallback(() => {
    if (statusRef.current !== 'paused') return
    wasManuallyPausedRef.current = false
    anchorRef.current = null
    enter('recording')
    startTimer()
    void startWatch(handleSample)
    engineRef.current?.resume()
    if (workoutIdRef.current) void persistState(workoutIdRef.current)
  }, [enter, startWatch, handleSample, startTimer, persistState])

  const stop = useCallback(async () => {
    if (statusRef.current !== 'recording' && statusRef.current !== 'paused') return
    enter('stopped')
    stopWatch()
    stopTimer()
    engineRef.current?.destroy()
    engineRef.current = null
    await bufferRef.current?.stop()
    await clearPersistedState()
  }, [enter, stopWatch, stopTimer, clearPersistedState])

  const discard = useCallback(() => {
    if (statusRef.current !== 'recording' && statusRef.current !== 'paused') return
    enter('discarded')
    stopWatch()
    stopTimer()
    engineRef.current?.destroy()
    engineRef.current = null
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
      engineRef.current?.destroy()
    }
  }, [])

  return {
    status,
    distanceMeters,
    elapsedSeconds,
    hasFix,
    permissionStatus,
    workoutId,
    routeCoordinates,
    currentPosition,
    start,
    restore,
    pause,
    resume,
    stop,
    discard,
    requestPermission,
    engine: engineRef.current,
  }
}
