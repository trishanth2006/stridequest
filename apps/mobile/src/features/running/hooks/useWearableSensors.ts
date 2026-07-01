import { useEffect, useState } from 'react'
import { addWearableDataListener } from '../../../../modules/wearable-bridge'
import type { WearableDataEvent } from '../../../../modules/wearable-bridge'

export type UseWearableSensorsOptions = {
  enabled: boolean
}

export type WearableSensorsState = {
  heartRateBpm: number | null
  stepCount: number | null
  ts: number
}

export function useWearableSensors({ enabled }: UseWearableSensorsOptions): WearableSensorsState {
  const [state, setState] = useState<WearableSensorsState>({
    heartRateBpm: null,
    stepCount: null,
    ts: 0,
  })

  useEffect(() => {
    if (!enabled) return

    const subscription = addWearableDataListener((event: WearableDataEvent) => {
      setState({
        heartRateBpm: event.hr,
        stepCount: event.steps,
        ts: event.ts,
      })
    })

    return () => {
      subscription.remove()
    }
  }, [enabled])

  return state
}
