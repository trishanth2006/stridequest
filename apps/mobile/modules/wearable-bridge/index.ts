export type WearableDataEvent = {
  hr: number | null
  steps: number | null
  ts: number
}

// Stub implementation for uncommitted WIP
export function addWearableDataListener(listener: (event: WearableDataEvent) => void) {
  return {
    remove: () => {}
  }
}
