import { useCallback, useEffect, useRef, useState } from 'react'
import type { GpsSample } from '@/features/running/types'

/** Typed geolocation failure, decoupled from the DOM `GeolocationPositionError`. */
export type GeolocationErrorCode =
  | 'permission_denied'
  | 'position_unavailable'
  | 'timeout'
  | 'unsupported'

export type GeolocationError = {
  code: GeolocationErrorCode
  message: string
}

/**
 * Last *observed* permission, inferred from watch callbacks — not a proactive
 * Permissions API query. Starts `'prompt'` (unknown) and only becomes accurate
 * after tracking begins: a successful fix implies `'granted'`, a PERMISSION_DENIED
 * error implies `'denied'`.
 */
export type GeolocationPermission = 'prompt' | 'granted' | 'denied'

export type UseGeolocationResult = {
  /** The most recent accepted fix, or `null` before the first one. */
  sample: GpsSample | null
  permission: GeolocationPermission
  error: GeolocationError | null
  isTracking: boolean
  /** Begin watching. Idempotent; a no-op while already tracking. */
  start: () => void
  /** Stop watching. Idempotent; a no-op when not tracking. */
  stop: () => void
}

const DEFAULT_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 10_000,
}

// DOM error code (1/2/3) → typed code. Code 2 (POSITION_UNAVAILABLE) is the default.
function toErrorCode(code: number): GeolocationErrorCode {
  switch (code) {
    case 1:
      return 'permission_denied'
    case 3:
      return 'timeout'
    default:
      return 'position_unavailable'
  }
}

// Map a browser position onto the app's GpsSample. `position.timestamp` is the
// device clock (architecture §2.2 — never re-stamped here); null optionals from
// the DOM coords collapse to undefined.
function toSample(position: GeolocationPosition): GpsSample {
  const { coords, timestamp } = position
  return {
    lat: coords.latitude,
    lng: coords.longitude,
    accuracy: coords.accuracy,
    altitude: coords.altitude ?? undefined,
    speed: coords.speed ?? undefined,
    heading: coords.heading ?? undefined,
    recordedAt: timestamp,
  }
}

/**
 * Thin wrapper over `navigator.geolocation.watchPosition` (architecture §2.1,
 * task 02B-05). It owns no buffering, filtering, or upload — it only surfaces the
 * raw stream, permission, and errors, and cleans up its watch on unmount.
 *
 * `onSample` (optional) fires once per accepted fix, after the `sample` state
 * update and with the same object — the seam the 02B-06 recorder feeds into its
 * filter/buffer pipeline. It is read through a ref so a changing callback identity
 * never restarts the watch.
 */
export function useGeolocation(
  options?: PositionOptions,
  onSample?: (sample: GpsSample) => void,
): UseGeolocationResult {
  const [sample, setSample] = useState<GpsSample | null>(null)
  const [permission, setPermission] = useState<GeolocationPermission>('prompt')
  const [error, setError] = useState<GeolocationError | null>(null)
  const [isTracking, setIsTracking] = useState(false)

  const watchIdRef = useRef<number | null>(null)
  const onSampleRef = useRef(onSample)
  const optionsRef = useRef(options)

  useEffect(() => {
    onSampleRef.current = onSample
    optionsRef.current = options
  }, [onSample, options])

  const stop = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setIsTracking(false)
  }, [])

  const start = useCallback(() => {
    if (watchIdRef.current !== null) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError({ code: 'unsupported', message: 'Geolocation is not supported in this environment.' })
      return
    }
    setError(null)
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const next = toSample(position)
        console.log('[GPS-DIAG:geolocation] watchPosition fix:', {
          lat: next.lat.toFixed(6),
          lng: next.lng.toFixed(6),
          accuracy: next.accuracy,
          accuracyGate: '30m',
          wouldPassAccuracyGate: next.accuracy <= 30,
        })
        setSample(next)
        setPermission('granted')
        setError(null)
        onSampleRef.current?.(next)
      },
      (positionError) => {
        console.log('[GPS-DIAG:geolocation] watchPosition ERROR:', {
          code: positionError.code,
          message: positionError.message,
        })
        const code = toErrorCode(positionError.code)
        if (code === 'permission_denied') setPermission('denied')
        setError({ code, message: positionError.message })
      },
      { ...DEFAULT_OPTIONS, ...optionsRef.current },
    )
    setIsTracking(true)
  }, [])

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [])

  return { sample, permission, error, isTracking, start, stop }
}
