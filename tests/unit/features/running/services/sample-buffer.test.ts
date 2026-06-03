import {
  createSampleBuffer,
  DEFAULT_SAMPLE_BUFFER_CONFIG,
  type SampleBatch,
  type UploadBatch,
} from '@/features/running/services/sample-buffer'
import type { GpsSample } from '@/features/running/types'

// A fresh sample at a given client timestamp. lat/lng/accuracy are irrelevant to
// buffering (the filter already ran upstream); recordedAt gives each sample a
// distinct identity so order assertions are meaningful.
const s = (recordedAt: number): GpsSample => ({
  lat: 0,
  lng: 0,
  accuracy: 5,
  recordedAt,
})

type Deferred = {
  promise: Promise<void>
  resolve: () => void
  reject: (reason?: unknown) => void
}

const deferred = (): Deferred => {
  let resolve!: () => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

// A controllable uploader: records every batch it was handed and hands back a
// deferred per call so a test can resolve/reject delivery on demand. This is the
// upload seam the future 02B-07 ingest client will implement.
const makeUploader = () => {
  const calls: SampleBatch[] = []
  const deferreds: Deferred[] = []
  const upload: UploadBatch = (batch) => {
    calls.push(batch)
    const d = deferred()
    deferreds.push(d)
    return d.promise
  }
  return { upload, calls, deferreds }
}

// Flush the microtask queue so an awaited upload resolution lets the single-flight
// drain advance to the next batch. Fake timers do not fake promises, so plain
// `await Promise.resolve()` still works here.
const settle = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.clearAllTimers()
  jest.useRealTimers()
})

describe('createSampleBuffer — size trigger', () => {
  it('cuts and uploads one batch once flushSize samples are pending', () => {
    const { upload, calls } = makeUploader()
    const buf = createSampleBuffer('w1', upload, { flushSize: 3, flushIntervalMs: 100_000 })
    const a = s(0)
    const b = s(1)
    const c = s(2)

    buf.add(a)
    buf.add(b)
    expect(calls).toHaveLength(0) // below threshold → no upload

    buf.add(c)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toEqual({ workoutId: 'w1', batchSeq: 0, samples: [a, b, c] })
  })

  it('does not upload per-sample below the threshold (coalesces — NFR-B-3)', async () => {
    const { upload, calls } = makeUploader()
    const buf = createSampleBuffer('w1', upload, { flushSize: 100, flushIntervalMs: 5_000 })

    buf.add(s(0))
    buf.add(s(1))
    buf.add(s(2))
    expect(calls).toHaveLength(0)
    expect(buf.pendingCount).toBe(3)

    await jest.advanceTimersByTimeAsync(5_000)
    expect(calls).toHaveLength(1)
    expect(calls[0].samples).toHaveLength(3)
    expect(buf.pendingCount).toBe(0)
  })
})

describe('createSampleBuffer — interval trigger', () => {
  it('flushes pending samples when the interval elapses', async () => {
    const { upload, calls } = makeUploader()
    const buf = createSampleBuffer('w1', upload, { flushSize: 100, flushIntervalMs: 5_000 })
    const a = s(0)
    const b = s(1)

    buf.add(a)
    buf.add(b)
    expect(calls).toHaveLength(0)

    await jest.advanceTimersByTimeAsync(5_000)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toEqual({ workoutId: 'w1', batchSeq: 0, samples: [a, b] })
  })

  it('an empty interval tick is a no-op and does not consume a batchSeq', async () => {
    const { upload, calls } = makeUploader()
    const buf = createSampleBuffer('w1', upload, { flushSize: 100, flushIntervalMs: 5_000 })

    await jest.advanceTimersByTimeAsync(15_000) // three idle ticks
    expect(calls).toHaveLength(0)

    buf.add(s(0))
    await jest.advanceTimersByTimeAsync(5_000)
    expect(calls).toHaveLength(1)
    expect(calls[0].batchSeq).toBe(0) // first real batch is still seq 0
  })
})

describe('createSampleBuffer — ordering and batch sequencing', () => {
  it('preserves push order across batches and numbers batches monotonically', async () => {
    const { upload, calls, deferreds } = makeUploader()
    const buf = createSampleBuffer('w1', upload, { flushSize: 2, flushIntervalMs: 100_000 })
    const samples = [s(0), s(1), s(2), s(3)]

    buf.add(samples[0])
    buf.add(samples[1]) // cuts batch 0, delivery in flight
    buf.add(samples[2])
    buf.add(samples[3]) // cuts batch 1, queued behind batch 0 (single-flight)

    expect(calls).toHaveLength(1) // only batch 0 is in flight

    deferreds[0].resolve()
    await settle()
    expect(calls).toHaveLength(2) // batch 1 delivered after batch 0 settled

    deferreds[1].resolve()
    await settle()

    expect(calls.map((c) => c.batchSeq)).toEqual([0, 1])
    expect(calls.flatMap((c) => c.samples)).toEqual(samples)
  })

  it('never resets batchSeq across many batches', async () => {
    const { upload, calls, deferreds } = makeUploader()
    const buf = createSampleBuffer('w1', upload, { flushSize: 1, flushIntervalMs: 100_000 })

    for (let i = 0; i < 3; i++) {
      buf.add(s(i))
      deferreds[i].resolve()
      await settle()
    }

    expect(calls.map((c) => c.batchSeq)).toEqual([0, 1, 2])
  })
})

describe('createSampleBuffer — retry on tick (NFR-R-4 / R-12)', () => {
  it('retries a failed batch on the next tick with the same batchSeq, and no new samples', async () => {
    const { upload, calls, deferreds } = makeUploader()
    const buf = createSampleBuffer('w1', upload, { flushSize: 2, flushIntervalMs: 5_000 })
    const a = s(0)
    const b = s(1)

    buf.add(a)
    buf.add(b) // cuts batch 0
    expect(calls).toHaveLength(1)

    deferreds[0].reject(new Error('network down'))
    await settle()
    expect(calls).toHaveLength(1) // failed batch retained, not yet retried
    expect(buf.queuedBatches).toBe(1)

    // The decisive assertion: advance the timer with NO new samples — the stranded
    // batch must still be retried, identically.
    await jest.advanceTimersByTimeAsync(5_000)
    expect(calls).toHaveLength(2)
    expect(calls[1]).toEqual(calls[0])
    expect(calls[1].batchSeq).toBe(0)

    deferreds[1].resolve()
    await settle()
    expect(buf.queuedBatches).toBe(0)

    // Once delivered, further ticks do not resend it.
    await jest.advanceTimersByTimeAsync(10_000)
    expect(calls).toHaveLength(2)
  })

  it('holds later batches behind a failing one until it succeeds (FIFO under failure)', async () => {
    const { upload, calls, deferreds } = makeUploader()
    const buf = createSampleBuffer('w1', upload, { flushSize: 2, flushIntervalMs: 5_000 })

    buf.add(s(0))
    buf.add(s(1)) // batch 0, in flight
    buf.add(s(2))
    buf.add(s(3)) // batch 1, queued behind batch 0

    deferreds[0].reject(new Error('network down'))
    await settle()
    expect(calls).toHaveLength(1) // batch 1 NOT delivered ahead of batch 0

    await jest.advanceTimersByTimeAsync(5_000) // retry batch 0
    expect(calls.map((c) => c.batchSeq)).toEqual([0, 0])

    deferreds[1].resolve() // batch 0 finally succeeds
    await settle()

    expect(calls.map((c) => c.batchSeq)).toEqual([0, 0, 1]) // only now does batch 1 go
  })
})

describe('createSampleBuffer — flush()', () => {
  it('cuts pending samples immediately and resolves once delivered', async () => {
    const { upload, calls, deferreds } = makeUploader()
    const buf = createSampleBuffer('w1', upload, { flushSize: 100, flushIntervalMs: 100_000 })
    const a = s(0)
    const b = s(1)

    buf.add(a)
    buf.add(b)
    const flushed = buf.flush()
    expect(calls).toHaveLength(1)
    expect(calls[0].samples).toEqual([a, b])

    deferreds[0].resolve()
    await flushed
    expect(buf.queuedBatches).toBe(0)
  })

  it('is a no-op when nothing is pending', async () => {
    const { upload, calls } = makeUploader()
    const buf = createSampleBuffer('w1', upload, { flushSize: 100, flushIntervalMs: 100_000 })

    await buf.flush()
    expect(calls).toHaveLength(0)
  })
})

describe('createSampleBuffer — stop()', () => {
  it('flushes the remainder, awaits final delivery, and stops the interval', async () => {
    const { upload, calls, deferreds } = makeUploader()
    const buf = createSampleBuffer('w1', upload, { flushSize: 100, flushIntervalMs: 5_000 })
    const a = s(0)
    const b = s(1)

    buf.add(a)
    buf.add(b)

    const stopped = buf.stop()
    expect(calls).toHaveLength(1) // final batch cut and sent
    expect(calls[0].samples).toEqual([a, b])

    deferreds[0].resolve()
    await stopped
    expect(buf.queuedBatches).toBe(0)

    // Interval is cleared: advancing time fires nothing further.
    await jest.advanceTimersByTimeAsync(20_000)
    expect(calls).toHaveLength(1)
  })

  it('resolves even when a final delivery stalls, leaving the batch queued', async () => {
    const { upload, deferreds } = makeUploader()
    const buf = createSampleBuffer('w1', upload, { flushSize: 100, flushIntervalMs: 5_000 })

    buf.add(s(0))
    const stopped = buf.stop()

    deferreds[0].reject(new Error('still offline'))
    await stopped // does not hang on a failed final flush
    expect(buf.queuedBatches).toBe(1)
  })
})

describe('DEFAULT_SAMPLE_BUFFER_CONFIG', () => {
  it('exposes tunable size and interval triggers', () => {
    expect(DEFAULT_SAMPLE_BUFFER_CONFIG.flushSize).toBeGreaterThan(0)
    expect(DEFAULT_SAMPLE_BUFFER_CONFIG.flushIntervalMs).toBeGreaterThan(0)
  })
})
