import { useEffect, useRef } from 'react'
import * as Haptics from 'expo-haptics'
import type { TerritoryCollection } from '../types'

/**
 * Fires a Success haptic whenever the number of territory
 * features increases — indicating new cells have been captured.
 * Uses a ref to track the previous count so the haptic fires
 * only on genuine count increases, not on every re-render.
 */
export function useHapticTerritoryCapture(data: TerritoryCollection) {
  const prevCount = useRef<number | null>(null)

  useEffect(() => {
    const count = data.features.length

    // Skip the initial mount — only fire on subsequent increases
    if (prevCount.current !== null && count > prevCount.current) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    }

    prevCount.current = count
  }, [data])
}
