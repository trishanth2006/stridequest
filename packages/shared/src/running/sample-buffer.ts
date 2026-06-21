import type { GpsSample } from './types'

export type SampleBatch = {
  workoutId: string
  batchSeq: number
  samples: GpsSample[]
}

export type SampleBufferConfig = {
  flushSize: number
  flushIntervalMs: number
}

export const DEFAULT_SAMPLE_BUFFER_CONFIG: SampleBufferConfig = {
  flushSize: 60,
  flushIntervalMs: 10_000,
}

export type UploadBatch = (batch: SampleBatch) => Promise<void>

export type SampleBuffer = {
  add(sample: GpsSample): void
  flush(): Promise<void>
  stop(): Promise<void>
  readonly pendingCount: number
  readonly queuedBatches: number
}

export function createSampleBuffer(
  workoutId: string,
  upload: UploadBatch,
  config: Partial<SampleBufferConfig> = {},
): SampleBuffer {
  const { flushSize, flushIntervalMs } = { ...DEFAULT_SAMPLE_BUFFER_CONFIG, ...config }

  let pending: GpsSample[] = []
  const queue: SampleBatch[] = []
  let batchSeq = 0
  let draining = false
  let drainPromise: Promise<void> = Promise.resolve()

  function cut(): void {
    if (pending.length === 0) return
    queue.push({ workoutId, batchSeq: batchSeq++, samples: pending })
    pending = []
  }

  async function runDrain(): Promise<void> {
    draining = true
    try {
      while (queue.length > 0) {
        await upload(queue[0])
        queue.shift()
      }
    } catch {
      // Leave the failed batch at the head; next tick/flush/stop retries it.
    } finally {
      draining = false
    }
  }

  function kickDrain(): Promise<void> {
    if (!draining) drainPromise = runDrain()
    return drainPromise
  }

  const handle: ReturnType<typeof setInterval> = setInterval(() => {
    cut()
    void kickDrain()
  }, flushIntervalMs)

  return {
    add(sample: GpsSample): void {
      pending.push(sample)
      if (pending.length >= flushSize) {
        cut()
        void kickDrain()
      }
    },
    flush(): Promise<void> {
      cut()
      return kickDrain()
    },
    async stop(): Promise<void> {
      clearInterval(handle)
      cut()
      kickDrain()
      await drainPromise
    },
    get pendingCount(): number {
      return pending.length
    },
    get queuedBatches(): number {
      return queue.length
    },
  }
}
