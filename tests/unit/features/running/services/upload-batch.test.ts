/**
 * @jest-environment node
 */
import { uploadBatch } from '@/features/running/services/upload-batch'
import type { SampleBatch } from '@/features/running/services/sample-buffer'

// uploadBatch is the client half of the 02B-07 ingest seam: it POSTs one already
// -cut, already-filtered batch to the idempotent route and reports success purely
// by HTTP status. Retry/ordering belong to the buffer, so the only behaviour to
// pin here is the request contract and "throw on anything but 2xx".

const WORKOUT_ID = '123e4567-e89b-12d3-a456-426614174000'

const batch: SampleBatch = {
  workoutId: WORKOUT_ID,
  batchSeq: 3,
  samples: [
    { lat: 12.34, lng: 56.78, accuracy: 5, recordedAt: 1_000 },
    { lat: 12.341, lng: 56.781, accuracy: 4, recordedAt: 3_000 },
  ],
}

const mockFetch = jest.fn<Promise<Response>, [string | URL | Request, RequestInit?]>()

const respond = (status: number): Response => ({ ok: status >= 200 && status < 300, status }) as Response

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch as unknown as typeof fetch
})

describe('uploadBatch', () => {
  it('POSTs the batch to the workout points endpoint with a JSON body', async () => {
    mockFetch.mockResolvedValue(respond(201))

    await uploadBatch(batch)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe(`/api/workouts/${WORKOUT_ID}/points`)
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({
      batchSeq: 3,
      samples: batch.samples,
    })
  })

  it('resolves on 201 (fresh insert)', async () => {
    mockFetch.mockResolvedValue(respond(201))
    await expect(uploadBatch(batch)).resolves.toBeUndefined()
  })

  it('resolves on 200 (idempotent replay)', async () => {
    mockFetch.mockResolvedValue(respond(200))
    await expect(uploadBatch(batch)).resolves.toBeUndefined()
  })

  it('throws on a 4xx response so the buffer retries the same batchSeq', async () => {
    mockFetch.mockResolvedValue(respond(403))
    await expect(uploadBatch(batch)).rejects.toThrow()
  })

  it('throws on a 5xx response', async () => {
    mockFetch.mockResolvedValue(respond(500))
    await expect(uploadBatch(batch)).rejects.toThrow()
  })

  it('propagates a network error (rejected fetch) so the batch is retried', async () => {
    mockFetch.mockRejectedValue(new Error('network down'))
    await expect(uploadBatch(batch)).rejects.toThrow('network down')
  })
})
