import { buildRoutePointRows, ingestBatch } from '@/features/running/services/ingest'
import type { IngestBatchInput } from '@/features/running/schemas'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/infrastructure/supabase/database.types'

const WORKOUT_ID = '123e4567-e89b-12d3-a456-426614174000'

const batch = (overrides: Partial<IngestBatchInput> = {}): IngestBatchInput => ({
  batchSeq: 3,
  samples: [
    { lat: 12.34, lng: 56.78, accuracy: 5, recordedAt: 1_000 },
    { lat: 12.35, lng: 56.79, accuracy: 4, recordedAt: 3_000, altitude: 100, speed: 3, heading: 90 },
  ],
  ...overrides,
})

describe('buildRoutePointRows', () => {
  it('assigns point_seq from sample order', () => {
    const rows = buildRoutePointRows(WORKOUT_ID, batch())
    expect(rows.map((r) => r.point_seq)).toEqual([0, 1])
  })

  it('maps fields and converts recordedAt ms to an ISO timestamp', () => {
    const [first] = buildRoutePointRows(WORKOUT_ID, batch())
    expect(first).toEqual({
      workout_id: WORKOUT_ID,
      lat: 12.34,
      lng: 56.78,
      accuracy_m: 5,
      altitude_m: null,
      speed_mps: null,
      heading_deg: null,
      recorded_at: new Date(1_000).toISOString(),
      batch_seq: 3,
      point_seq: 0,
    })
  })

  it('carries optional altitude/speed/heading when present', () => {
    const [, second] = buildRoutePointRows(WORKOUT_ID, batch())
    expect(second).toMatchObject({ altitude_m: 100, speed_mps: 3, heading_deg: 90 })
  })

  it('omits received_at so the DB default stamps server time (FR-RR-3)', () => {
    const [first] = buildRoutePointRows(WORKOUT_ID, batch())
    expect('received_at' in first).toBe(false)
  })
})

describe('ingestBatch', () => {
  const makeSupabase = (result: { data: unknown; error: unknown }) => {
    const select = jest.fn().mockResolvedValue(result)
    const upsert = jest.fn(() => ({ select }))
    const from = jest.fn(() => ({ upsert }))
    return { client: { from } as unknown as SupabaseClient<Database>, from, upsert, select }
  }

  it('upserts on the (workout_id, batch_seq, point_seq) grain, ignoring duplicates', async () => {
    const sb = makeSupabase({ data: [{ id: 1 }, { id: 2 }], error: null })

    await ingestBatch(sb.client, WORKOUT_ID, batch())

    expect(sb.from).toHaveBeenCalledWith('route_points')
    expect(sb.upsert).toHaveBeenCalledWith(expect.any(Array), {
      onConflict: 'workout_id,batch_seq,point_seq',
      ignoreDuplicates: true,
    })
  })

  it('returns the inserted count on success', async () => {
    const sb = makeSupabase({ data: [{ id: 1 }, { id: 2 }], error: null })
    expect(await ingestBatch(sb.client, WORKOUT_ID, batch())).toEqual({ status: 'ok', inserted: 2 })
  })

  it('treats an idempotent replay (no rows inserted) as success with inserted 0', async () => {
    const sb = makeSupabase({ data: [], error: null })
    expect(await ingestBatch(sb.client, WORKOUT_ID, batch())).toEqual({ status: 'ok', inserted: 0 })
  })

  it('maps an RLS denial (42501) to forbidden', async () => {
    const sb = makeSupabase({ data: null, error: { code: '42501' } })
    expect(await ingestBatch(sb.client, WORKOUT_ID, batch())).toEqual({ status: 'forbidden' })
  })

  it('maps a missing-workout FK violation (23503) to forbidden', async () => {
    const sb = makeSupabase({ data: null, error: { code: '23503' } })
    expect(await ingestBatch(sb.client, WORKOUT_ID, batch())).toEqual({ status: 'forbidden' })
  })

  it('maps any other DB error to a generic error', async () => {
    const sb = makeSupabase({ data: null, error: { code: '08006' } })
    expect(await ingestBatch(sb.client, WORKOUT_ID, batch())).toEqual({ status: 'error' })
  })

  it('treats a null success payload as inserted 0', async () => {
    const sb = makeSupabase({ data: null, error: null })
    expect(await ingestBatch(sb.client, WORKOUT_ID, batch())).toEqual({ status: 'ok', inserted: 0 })
  })
})
