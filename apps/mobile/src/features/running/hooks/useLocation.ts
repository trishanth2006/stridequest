import { useCallback, useRef, useState } from 'react'
import * as Location from 'expo-location'
import type { GpsSample } from '@stridequest/shared/running'

export type LocationPermissionStatus = 'prompt' | 'granted' | 'denied'

export type UseLocationResult = {
  permissionStatus: LocationPermissionStatus
  hasFix: boolean
  requestPermission: () => Promise<void>
  startWatch: (onSample: (sample: GpsSample) => void) => Promise<void>
  stopWatch: () => void
}

export function useLocation(): UseLocationResult {
  const [permissionStatus, setPermissionStatus] = useState<LocationPermissionStatus>('prompt')
  const [hasFix, setHasFix] = useState(false)
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null)

  const requestPermission = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync()
    setPermissionStatus(status === 'granted' ? 'granted' : 'denied')
  }, [])

  const startWatch = useCallback(async (onSample: (sample: GpsSample) => void) => {
    if (permissionStatus !== 'granted') return

    subscriptionRef.current?.remove()
    subscriptionRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 2000,
        distanceInterval: 5,
      },
      (location) => {
        setHasFix(true)
        const sample: GpsSample = {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          accuracy: location.coords.accuracy ?? 999,
          recordedAt: location.timestamp,
          altitude: location.coords.altitude ?? undefined,
          speed: location.coords.speed ?? undefined,
          heading: location.coords.heading ?? undefined,
        }
        onSample(sample)
      }
    )
  }, [permissionStatus])

  const stopWatch = useCallback(() => {
    subscriptionRef.current?.remove()
    subscriptionRef.current = null
  }, [])

  return { permissionStatus, hasFix, requestPermission, startWatch, stopWatch }
}
