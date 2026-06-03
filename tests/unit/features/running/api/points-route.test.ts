/**
 * @jest-environment node
 */
import { POST } from '@/app/api/workouts/[id]/points/route'
import { ingestBatch } from '@/features/running/services/ingest'
import { createClient } from '@/infrastructure/supabase/server'

jest.mock('@/infrastructure/supabase/server')
jest.mock('@/features/running/services/ingest')

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>
const mockIngestBatch = ingestBatch as jest.MockedFunction<typeof ingestBatch>

const VALID_ID = '123e4567-e89b-12d3-a456-426614174000'
const validBody = { batchSeq: 0, samples: [{ lat: 12.34, lng: 56.78, accuracy: 5, recordedAt: 1_000 }] }

const setUser = (user: { id: string } | null): void => {
  mockCreateClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) },
  } as unknown as Awaited<ReturnType<typeof createClient>>)
}

const post = (body: unknown, id = VALID_ID) =>
  POST(
    new Request(`http://localhost/api/workouts/${id}/points`, {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  )

beforeEach(() => {
  jest.clearAllMocks()
  setUser({ id: 'u1' })
  mockIngestBatch.mockResolvedValue({ status: 'ok', inserted: 1 })
})

describe('POST /api/workouts/[id]/points', () => {
  it('rejects an invalid workout id with 400', async () => {
    const res = await post(validBody, 'not-a-uuid')
    expect(res.status).toBe(400)
    expect(mockIngestBatch).not.toHaveBeenCalled()
  })

  it('rejects malformed JSON with 400', async () => {
    const res = await post('{ not json', VALID_ID)
    expect(res.status).toBe(400)
    expect(mockIngestBatch).not.toHaveBeenCalled()
  })

  it('rejects a Zod-invalid payload with 400', async () => {
    const res = await post({ batchSeq: -1, samples: [] })
    expect(res.status).toBe(400)
    expect(mockIngestBatch).not.toHaveBeenCalled()
  })

  it('returns 401 when unauthenticated', async () => {
    setUser(null)
    const res = await post(validBody)
    expect(res.status).toBe(401)
    expect(mockIngestBatch).not.toHaveBeenCalled()
  })

  it('returns 201 with the inserted count on a fresh batch', async () => {
    mockIngestBatch.mockResolvedValue({ status: 'ok', inserted: 1 })
    const res = await post(validBody)
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ ok: true, inserted: 1 })
  })

  it('returns 200 for an idempotent replay (inserted 0)', async () => {
    mockIngestBatch.mockResolvedValue({ status: 'ok', inserted: 0 })
    const res = await post(validBody)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, inserted: 0 })
  })

  it('maps a forbidden result to 403', async () => {
    mockIngestBatch.mockResolvedValue({ status: 'forbidden' })
    const res = await post(validBody)
    expect(res.status).toBe(403)
  })

  it('maps a service error to 500', async () => {
    mockIngestBatch.mockResolvedValue({ status: 'error' })
    const res = await post(validBody)
    expect(res.status).toBe(500)
  })

  it('passes the validated batch and workout id to the service', async () => {
    await post(validBody)
    expect(mockIngestBatch).toHaveBeenCalledWith(expect.anything(), VALID_ID, validBody)
  })
})
