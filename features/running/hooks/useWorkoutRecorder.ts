import { useCallback, useEffect, useRef, useState } from 'react'
import {
  useGeolocation,
  type GeolocationError,
  type GeolocationPermission,
} from '@/features/running/hooks/useGeolocation'
import { filterSamples, type SampleFilterConfig } from '@/features/running/services/sample-filter'
import {
  createSampleBuffer,
  type SampleBuffer,
  type SampleBufferConfig,
  type UploadBatch,
} from '@/features/running/services/sample-buffer'
import { haversineMeters } from '@/features/running/services/distance'
import type { GpsSample } from '@/features/running/types'

/** Explicit recorder lifecycle (FR-GPS-4): `stopped` is terminal. */
export type RecorderStatus = 'idle' | 'recording' | 'paused' | 'stopped'

export type UseWorkoutRecorderOptions = {
  /** The 02B-07 ingest seam, injected. The recorder never builds the upload itself. */
  upload: UploadBatch
  geolocationOptions?: PositionOptions
  filterConfig?: SampleFilterConfig
  bufferConfig?: Partial<SampleBufferConfig>
}

export type UseWorkoutRecorderResult = {
  status: RecorderStatus
  /** Live, **non-authoritative** distance estimate in metres (FR-GPS-5, arch §3.3). */
  distanceMeters: number
  /** `true` once the first GPS fix has survived the accuracy/distance/speed filter. */
  hasFix: boolean
  permission: GeolocationPermission
  error: GeolocationError | null
  /** idle → recording. Binds the workout the buffer batches for. No-op otherwise. */
  start: (workoutId: string) => void
  /** recording → paused: stop the watch, flush pending samples. No-op otherwise. */
  pause: () => void
  /** paused → recording: open a fresh watch, reset the anchor. No-op otherwise. */
  resume: () => void
  /** recording|paused → stopped: stop the watch, await the buffer's final flush. */
  stop: () => Promise<void>
}

/**
 * Composes `useGeolocation` + `filterSamples` + `createSampleBuffer` into the
 * workout recorder state machine (arch §2.1, task 02B-06). It owns no GPS,
 * filtering, or upload logic of its own — it wires the existing parts together
 * and tracks the lifecycle.
 *
 * Samples are filtered incrementally by replaying the pure batch filter over
 * `[anchor, candidate]`: the previously accepted point re-passes the accuracy gate,
 * the candidate is tested against it exactly as the offline filter would, and a
 * surviving candidate is the array's last element (same object reference). This
 * keeps the filter rules in one place rather than reimplementing them here.
 *
 * Distance is a running sum of accepted-segment lengths. `resume()` resets the
 * anchor so the pause gap is never stitched into a phantom segment; accumulated
 * distance is preserved. The estimate is non-authoritative — the server recomputes
 * it at finalize.
 */
export function useWorkoutRecorder({
  upload,
  geolocationOptions,
  filterConfig,
  bufferConfig,
}: UseWorkoutRecorderOptions): UseWorkoutRecorderResult {
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [distanceMeters, setDistanceMeters] = useState(0)
  const [hasFix, setHasFix] = useState(false)

  const statusRef = useRef<RecorderStatus>('idle')
  const anchorRef = useRef<GpsSample | null>(null)
  const bufferRef = useRef<SampleBuffer | null>(null)
  const uploadRef = useRef(upload)
  const filterConfigRef = useRef(filterConfig)
  const bufferConfigRef = useRef(bufferConfig)

  useEffect(() => {
    uploadRef.current = upload
    filterConfigRef.current = filterConfig
    bufferConfigRef.current = bufferConfig
  }, [upload, filterConfig, bufferConfig])

  const enter = useCallback((next: RecorderStatus) => {
    statusRef.current = next
    setStatus(next)
  }, [])

  // Fires once per accepted GPS fix (read through a ref by useGeolocation, so a
  // stable identity is not required — but keeping it stable avoids churn). Gated on
  // `recording` to ignore any fix in flight across a pause/stop edge.
  const handleSample = useCallback((candidate: GpsSample) => {
    const recStatus = statusRef.current
    if (recStatus !== 'recording') {
      console.log('[GPS-DIAG:recorder] handleSample SKIPPED (status=%s)', recStatus)
      return
    }
    const anchor = anchorRef.current
    const cfg = filterConfigRef.current
    const accuracyGate = cfg?.accuracyMaxM ?? 30
    const accepted = filterSamples(anchor ? [anchor, candidate] : [candidate], cfg)
    const survived = accepted[accepted.length - 1] === candidate

    // Determine the specific rejection reason
    let rejectionReason = 'n/a'
    if (!survived) {
      if (candidate.accuracy > accuracyGate) {
        rejectionReason = `ACCURACY: ${candidate.accuracy.toFixed(1)}m > ${accuracyGate}m gate`
      } else {
        rejectionReason = 'minDistance or speed gate'
      }
    }

    console.log('[GPS-DIAG:recorder] handleSample:', {
      accuracy: candidate.accuracy.toFixed(1) + 'm',
      accuracyGate: accuracyGate + 'm',
      passesAccuracyGate: candidate.accuracy <= accuracyGate,
      hasAnchor: !!anchor,
      survived,
      rejectionReason,
      hasFixBefore: false, // logged before setHasFix
    })

    if (!survived) return
    console.log('[GPS-DIAG:recorder] ✅ hasFix transitioning to TRUE')
    setHasFix(true)
    if (anchor) {
      const segment = haversineMeters(anchor, candidate)
      setDistanceMeters((total) => total + segment)
    }
    anchorRef.current = candidate
    bufferRef.current?.add(candidate)
  }, [])

  const { permission, error, start: startWatch, stop: stopWatch } = useGeolocation(
    geolocationOptions,
    handleSample,
  )

  const start = useCallback(
    (workoutId: string) => {
      if (statusRef.current !== 'idle') return
      anchorRef.current = null
      setDistanceMeters(0)
      setHasFix(false)
      bufferRef.current = createSampleBuffer(workoutId, uploadRef.current, bufferConfigRef.current)
      enter('recording')
      startWatch()
    },
    [enter, startWatch],
  )

  const pause = useCallback(() => {
    if (statusRef.current !== 'recording') return
    enter('paused')
    stopWatch()
    void bufferRef.current?.flush()
  }, [enter, stopWatch])

  const resume = useCallback(() => {
    if (statusRef.current !== 'paused') return
    anchorRef.current = null // segment break: do not bridge the pause gap
    enter('recording')
    startWatch()
  }, [enter, startWatch])

  const stop = useCallback(async () => {
    if (statusRef.current !== 'recording' && statusRef.current !== 'paused') return
    enter('stopped')
    stopWatch()
    await bufferRef.current?.stop()
  }, [enter, stopWatch])

  // Tear down the buffer's interval on unmount. useGeolocation cleans its own watch.
  useEffect(() => {
    return () => {
      void bufferRef.current?.stop()
    }
  }, [])

  return { status, distanceMeters, hasFix, permission, error, start, pause, resume, stop }
}
