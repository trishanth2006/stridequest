import { act, renderHook } from '@testing-library/react'
import { useWorkoutRecorder } from '@/features/running/hooks/useWorkoutRecorder'
import {
  cumulativeDistanceMeters,
  haversineMeters,
} from '@/features/running/services/distance'
import type { SampleBatch, UploadBatch } from '@/features/running/services/sample-buffer'
import type { LatLng } from '@/features/running/types'

// jsdom ships no navigator.geolocation, so each test installs a controllable mock
// whose watchPosition captures the success/error callbacks for the test to fire on
// demand; clearWatch is a spy. A fresh mock is installed before every test. This
// mirrors the useGeolocation suite — the recorder composes the real useGeolocation.
const makeGeolocation = () => {
  let successCb: PositionCallback | null = null
  let errorCb: PositionErrorCallback | null = null
  let nextId = 1
  const watchPosition = jest.fn(
    (success: PositionCallback, onError?: PositionErrorCallback | null) => {
      successCb = success
      errorCb = onError ?? null
      return nextId++
    },
  )
  const clearWatch = jest.fn()
  return {
    geolocation: { watchPosition, clearWatch } as unknown as Geolocation,
    fireSuccess: (position: GeolocationPosition) => act(() => successCb?.(position)),
    fireError: (error: GeolocationPositionError) => act(() => errorCb?.(error)),
    watchPosition,
    clearWatch,
  }
}

const installGeolocation = (geolocation: Geolocation | undefined): void => {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    writable: true,
    value: geolocation,
  })
}

const LAT = 12.34
const at = (lng: number): LatLng => ({ lat: LAT, lng })

const makePosition = (
  coords: Partial<GeolocationCoordinates> = {},
  timestamp = 1_000,
): GeolocationPosition =>
  ({
    coords: {
      latitude: LAT,
      longitude: 56.78,
      accuracy: 5,
      altitude: 100,
      altitudeAccuracy: 10,
      heading: 90,
      speed: 3,
      ...coords,
    },
    timestamp,
  }) as GeolocationPosition

// A GPS fix at a given longitude/timestamp (lat fixed); accuracy defaults to a
// value inside the 30 m gate. recordedAt (= timestamp) is each sample's identity.
const pos = (lng: number, t: number, accuracy = 5): GeolocationPosition =>
  makePosition({ longitude: lng, accuracy }, t)

const makeError = (code: number, message = 'gps error'): GeolocationPositionError =>
  ({ code, message, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }) as GeolocationPositionError

// An uploader that resolves immediately and records every batch it received. This
// is the 02B-07 ingest seam, injected here as a fake (the recorder never builds it).
const makeUploader = () => {
  const upload = jest.fn<Promise<void>, [SampleBatch]>(() => Promise.resolve())
  const batches = (): SampleBatch[] => upload.mock.calls.map(([batch]) => batch)
  const timestamps = (): number[] => batches().flatMap((b) => b.samples.map((s) => s.recordedAt))
  return { upload, batches, timestamps }
}

// Flush the microtask queue so the buffer's single-flight drain advances between
// batches. Fake timers do not fake promises, so plain awaits still resolve.
const settle = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

// Large flushSize + interval: batches are cut only by pause()/stop(), never by the
// size trigger or an interval tick, so each recording leg maps to one batch.
const render = (upload: UploadBatch) =>
  renderHook(() =>
    useWorkoutRecorder({ upload, bufferConfig: { flushSize: 100, flushIntervalMs: 1_000_000 } }),
  )

let geo: ReturnType<typeof makeGeolocation>
let setIntervalSpy: jest.SpyInstance
let clearIntervalSpy: jest.SpyInstance

// The buffer's setInterval is the only setInterval in this code path (React's
// scheduler uses MessageChannel/clearTimeout, never setInterval), so the first
// recorded result is the buffer's handle — the precise thing teardown must clear.
const bufferHandle = () => setIntervalSpy.mock.results[0].value

beforeEach(() => {
  jest.useFakeTimers()
  setIntervalSpy = jest.spyOn(global, 'setInterval')
  clearIntervalSpy = jest.spyOn(global, 'clearInterval')
  geo = makeGeolocation()
  installGeolocation(geo.geolocation)
})

afterEach(() => {
  jest.clearAllTimers()
  jest.useRealTimers()
  jest.restoreAllMocks()
})

describe('useWorkoutRecorder — state machine', () => {
  it('starts idle with a zero distance estimate and hasFix false', () => {
    const { result } = render(makeUploader().upload)

    expect(result.current.status).toBe('idle')
    expect(result.current.distanceMeters).toBe(0)
    expect(result.current.hasFix).toBe(false)
  })

  it('start(workoutId) enters recording, opens a watch, and creates the buffer', () => {
    const { result } = render(makeUploader().upload)

    act(() => result.current.start('w1'))

    expect(result.current.status).toBe('recording')
    expect(geo.watchPosition).toHaveBeenCalledTimes(1)
    expect(setIntervalSpy).toHaveBeenCalledTimes(1) // buffer interval created
  })

  it('pause() enters paused and clears the watch', () => {
    const { result } = render(makeUploader().upload)

    act(() => result.current.start('w1'))
    act(() => result.current.pause())

    expect(result.current.status).toBe('paused')
    expect(geo.clearWatch).toHaveBeenCalledTimes(1)
  })

  it('resume() re-enters recording and opens a fresh watch', () => {
    const { result } = render(makeUploader().upload)

    act(() => result.current.start('w1'))
    act(() => result.current.pause())
    act(() => result.current.resume())

    expect(result.current.status).toBe('recording')
    expect(geo.watchPosition).toHaveBeenCalledTimes(2)
  })

  it('stop() enters stopped, clears the watch, and tears down the buffer interval', async () => {
    const { result } = render(makeUploader().upload)

    act(() => result.current.start('w1'))
    await act(async () => {
      await result.current.stop()
    })

    expect(result.current.status).toBe('stopped')
    expect(geo.clearWatch).toHaveBeenCalled()
    expect(clearIntervalSpy).toHaveBeenCalledWith(bufferHandle()) // interval cleared
  })

  it('stop() works from paused', async () => {
    const { result } = render(makeUploader().upload)

    act(() => result.current.start('w1'))
    act(() => result.current.pause())
    await act(async () => {
      await result.current.stop()
    })

    expect(result.current.status).toBe('stopped')
  })

  it('rejects transitions that do not match the current state (no-ops)', async () => {
    const { result } = render(makeUploader().upload)

    await act(async () => {
      await result.current.stop() // stop from idle
    })
    act(() => result.current.pause()) // pause from idle
    expect(result.current.status).toBe('idle')
    expect(geo.clearWatch).not.toHaveBeenCalled()

    act(() => result.current.start('w1'))
    act(() => result.current.resume()) // resume while recording
    act(() => result.current.start('w2')) // start while recording
    expect(result.current.status).toBe('recording')
    expect(geo.watchPosition).toHaveBeenCalledTimes(1)
  })

  it('is terminal once stopped', async () => {
    const { result } = render(makeUploader().upload)

    act(() => result.current.start('w1'))
    await act(async () => {
      await result.current.stop()
    })
    act(() => result.current.start('w2'))
    act(() => result.current.resume())

    expect(result.current.status).toBe('stopped')
    expect(geo.watchPosition).toHaveBeenCalledTimes(1)
  })
})

describe('useWorkoutRecorder — hasFix signal', () => {
  it('is false before any GPS fix is received', () => {
    const { result } = render(makeUploader().upload)

    act(() => result.current.start('w1'))

    expect(result.current.hasFix).toBe(false)
    expect(result.current.distanceMeters).toBe(0)
  })

  it('becomes true on the first accepted fix (distance still 0)', () => {
    const { result } = render(makeUploader().upload)

    act(() => result.current.start('w1'))
    geo.fireSuccess(pos(56.78, 1_000)) // first fix → anchor, distance stays 0

    expect(result.current.hasFix).toBe(true)
    expect(result.current.distanceMeters).toBe(0) // the key scenario: fix but no distance
  })

  it('stays true when subsequent fixes are rejected (stationary user)', () => {
    const { result } = render(makeUploader().upload)

    act(() => result.current.start('w1'))
    geo.fireSuccess(pos(56.78, 1_000))      // accepted → anchor
    geo.fireSuccess(pos(56.78001, 3_000))    // ~1 m → jitter → rejected
    geo.fireSuccess(pos(56.780005, 5_000))   // ~0.5 m → jitter → rejected

    expect(result.current.hasFix).toBe(true)
    expect(result.current.distanceMeters).toBe(0) // no movement passed the 5 m gate
  })

  it('stays true when accuracy-rejected fixes arrive after an accepted one', () => {
    const { result } = render(makeUploader().upload)

    act(() => result.current.start('w1'))
    geo.fireSuccess(pos(56.78, 1_000, 5))    // good accuracy → accepted
    geo.fireSuccess(pos(56.79, 3_000, 50))   // bad accuracy → rejected

    expect(result.current.hasFix).toBe(true)
    expect(result.current.distanceMeters).toBe(0) // second fix didn't pass
  })

  it('remains false when all fixes fail the accuracy gate', () => {
    const { result } = render(makeUploader().upload)

    act(() => result.current.start('w1'))
    geo.fireSuccess(pos(56.78, 1_000, 50))   // accuracy 50 m > 30 m gate → rejected
    geo.fireSuccess(pos(56.79, 3_000, 40))   // accuracy 40 m > 30 m gate → rejected

    expect(result.current.hasFix).toBe(false)
    expect(result.current.distanceMeters).toBe(0)
  })
})

describe('useWorkoutRecorder — sample filtering', () => {
  it('forwards an accepted sample to the upload seam on flush', async () => {
    const up = makeUploader()
    const { result } = render(up.upload)

    act(() => result.current.start('w1'))
    geo.fireSuccess(pos(56.78, 1_000))
    act(() => result.current.pause())
    await settle()

    expect(up.timestamps()).toEqual([1_000])
  })

  it('drops a sample worse than the accuracy gate', async () => {
    const up = makeUploader()
    const { result } = render(up.upload)

    act(() => result.current.start('w1'))
    geo.fireSuccess(pos(56.78, 1_000, 50)) // accuracy 50 m > 30 m gate
    act(() => result.current.pause())
    await settle()

    expect(up.batches()).toHaveLength(0)
    expect(result.current.distanceMeters).toBe(0)
  })

  it('drops a jitter sample but keeps a later distinct one', async () => {
    const up = makeUploader()
    const { result } = render(up.upload)

    act(() => result.current.start('w1'))
    geo.fireSuccess(pos(56.78, 1_000)) // P1 accepted (anchor)
    geo.fireSuccess(pos(56.78001, 3_000)) // ~1 m from P1 → jitter, dropped
    geo.fireSuccess(pos(56.7802, 5_000)) // ~22 m from P1 → accepted
    act(() => result.current.pause())
    await settle()

    expect(up.timestamps()).toEqual([1_000, 5_000])
    expect(result.current.distanceMeters).toBeCloseTo(haversineMeters(at(56.78), at(56.7802)), 5)
  })

  it('ignores a GPS fix that arrives while paused', async () => {
    const up = makeUploader()
    const { result } = render(up.upload)

    act(() => result.current.start('w1'))
    geo.fireSuccess(pos(56.78, 1_000)) // accepted while recording
    act(() => result.current.pause())
    geo.fireSuccess(pos(56.7802, 3_000)) // stray fix while paused → ignored
    await act(async () => {
      await result.current.stop()
    })
    await settle()

    expect(up.timestamps()).toEqual([1_000])
  })
})

describe('useWorkoutRecorder — live distance estimate', () => {
  it('accumulates haversine distance across accepted samples', () => {
    const { result } = render(makeUploader().upload)

    act(() => result.current.start('w1'))
    geo.fireSuccess(pos(56.78, 1_000))
    geo.fireSuccess(pos(56.7801, 3_000))
    geo.fireSuccess(pos(56.7802, 5_000))

    const expected =
      haversineMeters(at(56.78), at(56.7801)) + haversineMeters(at(56.7801), at(56.7802))
    expect(result.current.distanceMeters).toBeCloseTo(expected, 5)
  })
})

describe('useWorkoutRecorder — error passthrough', () => {
  it('surfaces permission denial without changing recorder state', () => {
    const { result } = render(makeUploader().upload)

    act(() => result.current.start('w1'))
    geo.fireError(makeError(1))

    expect(result.current.permission).toBe('denied')
    expect(result.current.error).toEqual({ code: 'permission_denied', message: 'gps error' })
    expect(result.current.status).toBe('recording') // a GPS error does not stop the run
  })
})

describe('useWorkoutRecorder — cleanup', () => {
  it('clears the watch and the buffer interval on unmount', () => {
    const { result, unmount } = render(makeUploader().upload)

    act(() => result.current.start('w1'))
    geo.fireSuccess(pos(56.78, 1_000))
    unmount()

    expect(geo.clearWatch).toHaveBeenCalled()
    expect(clearIntervalSpy).toHaveBeenCalledWith(bufferHandle()) // interval torn down
  })
})

describe('useWorkoutRecorder — full pause/resume cycle', () => {
  it('recording → pause → resume → pause → resume → stop keeps samples, uploads and distance correct', async () => {
    const up = makeUploader()
    const { result } = render(up.upload)

    act(() => result.current.start('w1'))
    expect(result.current.status).toBe('recording')

    // Leg 1: P1 (anchor, +0 m), P2 (+~11 m)
    geo.fireSuccess(pos(56.78, 1_000))
    geo.fireSuccess(pos(56.7801, 3_000))
    act(() => result.current.pause())
    await settle()
    expect(result.current.status).toBe('paused')

    act(() => result.current.resume())
    expect(result.current.status).toBe('recording')

    // Leg 2: P3 (new anchor after reset, +0 m — the pause gap is NOT counted), P4 (+~11 m)
    geo.fireSuccess(pos(56.7803, 10_000))
    geo.fireSuccess(pos(56.7804, 12_000))
    act(() => result.current.pause())
    await settle()
    expect(result.current.status).toBe('paused')

    act(() => result.current.resume())

    // Leg 3: P5 (new anchor, +0 m)
    geo.fireSuccess(pos(56.7806, 20_000))
    await act(async () => {
      await result.current.stop()
    })
    expect(result.current.status).toBe('stopped')

    // No duplicate samples, none dropped, original order preserved.
    expect(up.timestamps()).toEqual([1_000, 3_000, 10_000, 12_000, 20_000])

    // No duplicate uploads: one batch per leg, monotonic seqs, no repeats.
    expect(up.batches().map((b) => b.batchSeq)).toEqual([0, 1, 2])

    // No phantom segments: distance is the sum of per-leg legs only (P1→P2, P3→P4);
    // the P2→P3 and P4→P5 pause gaps are excluded by the anchor reset.
    const expected =
      haversineMeters(at(56.78), at(56.7801)) + haversineMeters(at(56.7803), at(56.7804))
    expect(result.current.distanceMeters).toBeCloseTo(expected, 5)
    expect(result.current.distanceMeters).toBeLessThan(
      cumulativeDistanceMeters([at(56.78), at(56.7801), at(56.7803), at(56.7804), at(56.7806)]),
    )
  })
})
