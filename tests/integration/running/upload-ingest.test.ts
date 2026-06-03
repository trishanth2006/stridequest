/**
 * @jest-environment node
 */
import { createSampleBuffer } from '@/features/running/services/sample-buffer'
import { uploadBatch } from '@/features/running/services/upload-batch'
import type { GpsSample } from '@/features/running/types'

// 02B-08 seam test: the REAL sample buffer driving the REAL client uploader, with
// only the network boundary (`fetch`) stubbed. This proves the integration the
// recorder relies on — a cut batch becomes a POST to the ingest route with the
// right shape, and a failed delivery is retried with the SAME batchSeq/samples
// (FR-RR-2 / FR-RR-6). It deliberately does NOT re-test the route handler or DB
// (covered by ingest.test.ts / points-route.test.ts).

const WORKOUT_ID = '123e4567-e89b-12d3-a456-426614174000'

const s = (recordedAt: number): GpsSample => ({ lat: 1, lng: recordedAt / 1000, accuracy: 5, recordedAt })

const mockFetch = jest.fn<Promise<Response>, [string | URL | Request, RequestInit?]>()
const respond = (status: number): Response => ({ ok: status >= 200 && status < 300, status }) as Response

// Decode a captured fetch call into the URL and parsed JSON body.
const callAt = (i: number): { url: string; body: { batchSeq: number; samples: GpsSample[] } } => {
  const [url, init] = mockFetch.mock.calls[i]
  return { url: String(url), body: JSON.parse(String(init?.body)) }
}

const settle = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

beforeEach(() => {
  jest.useFakeTimers()
  mockFetch.mockReset()
  global.fetch = mockFetch as unknown as typeof fetch
})

afterEach(() => {
  jest.clearAllTimers()
  jest.useRealTimers()
})

describe('sample buffer → uploadBatch → ingest route (client seam)', () => {
  it('delivers a cut batch as a POST to the workout points endpoint', async () => {
    mockFetch.mockResolvedValue(respond(201))
    const buffer = createSampleBuffer(WORKOUT_ID, uploadBatch, { flushSize: 2, flushIntervalMs: 100_000 })
    const a = s(1_000)
    const b = s(2_000)

    buffer.add(a)
    buffer.add(b) // cuts batch 0
    await settle()

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const { url, body } = callAt(0)
    expect(url).toBe(`/api/workouts/${WORKOUT_ID}/points`)
    expect(body).toEqual({ batchSeq: 0, samples: [a, b] })
    expect(buffer.queuedBatches).toBe(0)
  })

  it('retries a failed batch with the same batchSeq and samples (FR-RR-6)', async () => {
    const buffer = createSampleBuffer(WORKOUT_ID, uploadBatch, { flushSize: 2, flushIntervalMs: 5_000 })
    const a = s(1_000)
    const b = s(2_000)

    mockFetch.mockResolvedValueOnce(respond(503)) // first delivery fails
    buffer.add(a)
    buffer.add(b) // cuts batch 0, first attempt rejects (non-2xx → throw)
    await settle()

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(buffer.queuedBatches).toBe(1) // retained for retry

    mockFetch.mockResolvedValue(respond(201)) // network recovers
    await jest.advanceTimersByTimeAsync(5_000) // interval tick retries the stranded batch

    expect(mockFetch).toHaveBeenCalledTimes(2)
    const retry = callAt(1)
    expect(retry.body).toEqual({ batchSeq: 0, samples: [a, b] }) // identical replay
    expect(buffer.queuedBatches).toBe(0)
  })
})
