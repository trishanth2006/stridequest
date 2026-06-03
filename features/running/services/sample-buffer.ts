import type { GpsSample } from '@/features/running/types'

/**
 * One ordered group of samples uploaded in a single request. `batchSeq` is a
 * per-workout monotonic counter — the client half of the idempotency contract.
 * The server enforces the other half at ingest via `ON CONFLICT DO NOTHING` on
 * the per-sample `UNIQUE (workout_id, batch_seq, point_seq)` grain (02B-07), so
 * replaying a batch with the same seq and samples is a no-op (FR-RR-2 / risk R-12).
 */
export type SampleBatch = {
  workoutId: string
  batchSeq: number
  samples: GpsSample[]
}

/** Flush triggers for the buffer (architecture §2.4). */
export type SampleBufferConfig = {
  /** Cut a batch once this many samples are pending. */
  flushSize: number
  /** Cut pending samples — and retry stranded batches — on this cadence (ms). */
  flushIntervalMs: number
}

/**
 * Defaults: 60-sample batches (matching the NFR-P-1 batch reference) flushed at
 * least every 10 s. Tunable per instance; the size trigger bounds batch size
 * under fast sampling, the interval bounds latency and drives retries.
 */
export const DEFAULT_SAMPLE_BUFFER_CONFIG: SampleBufferConfig = {
  flushSize: 60,
  flushIntervalMs: 10_000,
}

/**
 * Delivers one batch, rejecting on failure. The buffer retries a failed batch
 * with the *same* `batchSeq`, so the implementation must be safe to call
 * repeatedly. This is the seam the 02B-07 ingest client implements; the buffer
 * itself never touches HTTP.
 */
export type UploadBatch = (batch: SampleBatch) => Promise<void>

export type SampleBuffer = {
  /** Queue a (already-filtered) sample; cuts a batch when `flushSize` is reached. */
  add(sample: GpsSample): void
  /** Cut any pending samples now and attempt delivery (e.g. on pause). */
  flush(): Promise<void>
  /**
   * Stop the interval, cut the remainder, and await one final delivery pass.
   * Resolves when the queue drains or stalls on a failure; inspect
   * `queuedBatches` afterward for any undelivered remainder.
   */
  stop(): Promise<void>
  /** Samples not yet cut into a batch. */
  readonly pendingCount: number
  /** Cut batches awaiting (or retrying) delivery. */
  readonly queuedBatches: number
}

/**
 * In-memory buffer + batcher for one workout's GPS stream (architecture §2.4).
 *
 * Batching ("cut") is decoupled from delivery ("drain"). Cutting is synchronous
 * and triggered by size, interval, `flush()`, or `stop()`. Delivery is a
 * single-flight FIFO drain: one upload in flight at a time, so order is
 * preserved and a failed head simply stays put (same `batchSeq`) to be retried.
 * Crucially, every interval tick attempts the drain even with nothing new to
 * cut — that is what retries a batch stranded by a disconnect that outlasts
 * sampling (NFR-R-4).
 *
 * Out of scope by design: backoff/jitter, max-retry-then-drop, and IndexedDB
 * persistence (the latter deferred per risk R-10).
 */
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

  // Cut all pending samples into one batch. No-op when empty, so idle interval
  // ticks never consume a batchSeq. The batch takes ownership of the cut array
  // and `pending` restarts fresh, so an in-flight batch is never mutated.
  function cut(): void {
    if (pending.length === 0) return
    queue.push({ workoutId, batchSeq: batchSeq++, samples: pending })
    pending = []
  }

  // Single-flight FIFO delivery. The loop re-checks the queue after each success,
  // so batches cut mid-flight are picked up in order. A rejected upload leaves
  // its batch at the head for a later trigger to retry — never dropped.
  async function runDrain(): Promise<void> {
    draining = true
    try {
      while (queue.length > 0) {
        await upload(queue[0])
        queue.shift()
      }
    } catch {
      // Leave the failed batch at the head; the next tick/flush/stop retries it.
    } finally {
      draining = false
    }
  }

  // Start a drain only when one is not already running, so concurrent triggers
  // never run two uploads at once and `drainPromise` always tracks the live pass.
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
