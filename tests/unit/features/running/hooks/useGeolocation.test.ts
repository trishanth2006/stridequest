import { act, renderHook } from '@testing-library/react'
import { useGeolocation } from '@/features/running/hooks/useGeolocation'
import type { GpsSample } from '@/features/running/types'

// jsdom ships no navigator.geolocation, so each test installs a controllable
// mock whose watchPosition captures the success/error callbacks (and options)
// for the test to fire on demand; clearWatch is a spy. A fresh mock is installed
// before every test so teardown's cleanup effect always finds a valid object.
const makeGeolocation = () => {
  let successCb: PositionCallback | null = null
  let errorCb: PositionErrorCallback | null = null
  let lastOptions: PositionOptions | undefined
  let nextId = 1
  const watchPosition = jest.fn(
    (success: PositionCallback, onError?: PositionErrorCallback | null, options?: PositionOptions) => {
      successCb = success
      errorCb = onError ?? null
      lastOptions = options
      return nextId++
    },
  )
  const clearWatch = jest.fn()
  return {
    geolocation: { watchPosition, clearWatch } as unknown as Geolocation,
    fireSuccess: (position: GeolocationPosition) => act(() => successCb?.(position)),
    fireError: (error: GeolocationPositionError) => act(() => errorCb?.(error)),
    getOptions: () => lastOptions,
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

const makePosition = (
  coords: Partial<GeolocationCoordinates> = {},
  timestamp = 1_000,
): GeolocationPosition =>
  ({
    coords: {
      latitude: 12.34,
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

const makeError = (code: number, message = 'gps error'): GeolocationPositionError =>
  ({ code, message, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }) as GeolocationPositionError

let geo: ReturnType<typeof makeGeolocation>

beforeEach(() => {
  geo = makeGeolocation()
  installGeolocation(geo.geolocation)
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('useGeolocation — start/stop lifecycle', () => {
  it('start() begins a high-accuracy watch and sets isTracking', () => {
    const { result } = renderHook(() => useGeolocation())

    act(() => result.current.start())

    expect(geo.watchPosition).toHaveBeenCalledTimes(1)
    expect(geo.getOptions()).toEqual({ enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 })
    expect(result.current.isTracking).toBe(true)
  })

  it('merges caller PositionOptions over the high-accuracy defaults', () => {
    const { result } = renderHook(() => useGeolocation({ timeout: 5_000 }))

    act(() => result.current.start())

    expect(geo.getOptions()).toEqual({ enableHighAccuracy: true, maximumAge: 0, timeout: 5_000 })
  })

  it('start() is idempotent — a second call does not open a second watch', () => {
    const { result } = renderHook(() => useGeolocation())

    act(() => result.current.start())
    act(() => result.current.start())

    expect(geo.watchPosition).toHaveBeenCalledTimes(1)
  })

  it('stop() clears the active watch and resets isTracking', () => {
    const { result } = renderHook(() => useGeolocation())

    act(() => result.current.start())
    act(() => result.current.stop())

    expect(geo.clearWatch).toHaveBeenCalledWith(1)
    expect(result.current.isTracking).toBe(false)
  })

  it('clears the watch on unmount', () => {
    const { result, unmount } = renderHook(() => useGeolocation())

    act(() => result.current.start())
    unmount()

    expect(geo.clearWatch).toHaveBeenCalledWith(1)
  })
})

describe('useGeolocation — sample mapping', () => {
  it('maps a position into a typed GpsSample and marks permission granted', () => {
    const { result } = renderHook(() => useGeolocation())
    act(() => result.current.start())

    geo.fireSuccess(makePosition())

    expect(result.current.sample).toEqual({
      lat: 12.34,
      lng: 56.78,
      accuracy: 5,
      altitude: 100,
      speed: 3,
      heading: 90,
      recordedAt: 1_000,
    })
    expect(result.current.permission).toBe('granted')
    expect(result.current.error).toBeNull()
  })

  it('maps null altitude/speed/heading to undefined', () => {
    const { result } = renderHook(() => useGeolocation())
    act(() => result.current.start())

    geo.fireSuccess(makePosition({ altitude: null, speed: null, heading: null }))

    expect(result.current.sample).toEqual({
      lat: 12.34,
      lng: 56.78,
      accuracy: 5,
      recordedAt: 1_000,
    })
  })

  it('uses the device timestamp for recordedAt, not the wall clock', () => {
    const { result } = renderHook(() => useGeolocation())
    act(() => result.current.start())

    geo.fireSuccess(makePosition({}, 1_717_000_000_000))

    expect(result.current.sample?.recordedAt).toBe(1_717_000_000_000)
  })
})

describe('useGeolocation — onSample callback', () => {
  it('invokes onSample after the sample state update with the same object', () => {
    const onSample = jest.fn<void, [GpsSample]>()
    const { result } = renderHook(() => useGeolocation(undefined, onSample))
    act(() => result.current.start())

    geo.fireSuccess(makePosition())

    expect(onSample).toHaveBeenCalledTimes(1)
    expect(onSample.mock.calls[0][0]).toBe(result.current.sample)
  })
})

describe('useGeolocation — error handling', () => {
  it('treats PERMISSION_DENIED as denied permission', () => {
    const { result } = renderHook(() => useGeolocation())
    act(() => result.current.start())

    geo.fireError(makeError(1))

    expect(result.current.permission).toBe('denied')
    expect(result.current.error).toEqual({ code: 'permission_denied', message: 'gps error' })
  })

  it('reports POSITION_UNAVAILABLE without changing a granted permission', () => {
    const { result } = renderHook(() => useGeolocation())
    act(() => result.current.start())
    geo.fireSuccess(makePosition())

    geo.fireError(makeError(2))

    expect(result.current.error).toEqual({ code: 'position_unavailable', message: 'gps error' })
    expect(result.current.permission).toBe('granted')
  })

  it('reports TIMEOUT', () => {
    const { result } = renderHook(() => useGeolocation())
    act(() => result.current.start())

    geo.fireError(makeError(3))

    expect(result.current.error).toEqual({ code: 'timeout', message: 'gps error' })
  })

  it('clears a prior error when tracking is restarted', () => {
    const { result } = renderHook(() => useGeolocation())
    act(() => result.current.start())
    geo.fireError(makeError(2))
    act(() => result.current.stop())

    act(() => result.current.start())

    expect(result.current.error).toBeNull()
    expect(geo.watchPosition).toHaveBeenCalledTimes(2)
  })

  it('reports unsupported when navigator.geolocation is absent', () => {
    installGeolocation(undefined)
    const { result } = renderHook(() => useGeolocation())

    act(() => result.current.start())
    act(() => result.current.stop())

    expect(result.current.error).toEqual({
      code: 'unsupported',
      message: 'Geolocation is not supported in this environment.',
    })
    expect(result.current.isTracking).toBe(false)
    expect(geo.clearWatch).not.toHaveBeenCalled()
  })
})
