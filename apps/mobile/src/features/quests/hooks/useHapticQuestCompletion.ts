import { useEffect, useRef } from 'react'
import * as Haptics from 'expo-haptics'
import type { ActiveQuest } from '@stridequest/shared'

/**
 * Fires a Success haptic whenever any quest transitions from
 * a non-completed status to 'completed'. Uses a ref to track
 * previously-seen statuses so the haptic fires once per actual
 * state change, not on every re-render.
 */
export function useHapticQuestCompletion(quests: ActiveQuest[]) {
  const prevStatusMap = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    if (quests.length === 0) return

    let fired = false

    for (const quest of quests) {
      const prev = prevStatusMap.current.get(quest.userQuestId)
      if (prev && prev !== 'completed' && quest.status === 'completed') {
        fired = true
      }
      prevStatusMap.current.set(quest.userQuestId, quest.status)
    }

    if (fired) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    }
  }, [quests])
}
