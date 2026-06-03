/**
 * @jest-environment node
 *
 * Integration tests for GPS batch ingest (02B-07, FR-RR). Exercises the real
 * `ingestBatch` service against live Postgres through user-scoped JWT clients, so
 * RLS ownership and the ON CONFLICT idempotency are tested for real (not mocked).
 * The service-role client is used only for setup/teardown and row counts.
 *
 * Skipped when service-role credentials are absent so `npm test` stays green in
 * environments with no DB connection (mirrors start-workout.test.ts / rls.test.ts).
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/infrastructure/supabase/database.types'
import { ingestBatch } from '@/features/running/services/ingest'
import type { IngestBatchInput } from '@/features/running/schemas'

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const describeDb = url && serviceKey ? describe : describe.skip

type AdminClient = SupabaseClient<Database>

async function createTestUser(
  admin: AdminClient,
  tag: string,
): Promise<{ client: SupabaseClient<Database>; userId: string }> {
  const email = `ingest-${tag}-${Date.now()}@example.com`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: 'password123!',
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`Failed to create test user (${tag}): ${error?.message}`)

  const { data: signIn, error: signInErr } = await admin.auth.signInWithPassword({
    email,
    password: 'password123!',
  })
  if (signInErr || !signIn.session) throw new Error(`Failed to sign in (${tag}): ${signInErr?.message}`)

  const client = createClient<Database>(url, signIn.session.access_token, {
    global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } },
    auth: { persistSession: false },
  })
  return { client, userId: data.user.id }
}

async function createWorkout(admin: AdminClient, userId: string): Promise<string> {
  const { data, error } = await admin.from('workouts').insert({ user_id: userId }).select('id').single()
  if (error || !data) throw new Error(`Failed to create workout: ${error?.message}`)
  return data.id
}

// A three-sample batch (distinct client timestamps); all share one batch_seq.
const batch = (batchSeq: number): IngestBatchInput => ({
  batchSeq,
  samples: [
    { lat: 51.5, lng: -0.1, accuracy: 5, recordedAt: 1_000 },
    { lat: 51.501, lng: -0.1, accuracy: 5, recordedAt: 3_000 },
    { lat: 51.502, lng: -0.1, accuracy: 5, recordedAt: 5_000 },
  ],
})

describeDb('FR-RR: GPS batch ingest (02B-07)', () => {
  let admin: AdminClient
  let user1: SupabaseClient<Database>
  let user2: SupabaseClient<Database>
  let userId1: string
  let userId2: string
  let workoutId1: string

  const countPoints = async (): Promise<number> => {
    const { count } = await admin
      .from('route_points')
      .select('id', { count: 'exact', head: true })
      .eq('workout_id', workoutId1)
    return count ?? 0
  }

  beforeAll(async () => {
    admin = createClient<Database>(url, serviceKey)
    ;({ client: user1, userId: userId1 } = await createTestUser(admin, 'u1'))
    ;({ client: user2, userId: userId2 } = await createTestUser(admin, 'u2'))
    workoutId1 = await createWorkout(admin, userId1)
  })

  afterAll(async () => {
    await admin.from('route_points').delete().eq('workout_id', workoutId1)
    await admin.from('workouts').delete().in('user_id', [userId1, userId2])
    await admin.auth.admin.deleteUser(userId1)
    await admin.auth.admin.deleteUser(userId2)
  })

  it('FR-RR-1/3: persists a multi-sample batch in order, server-stamping received_at', async () => {
    const result = await ingestBatch(user1, workoutId1, batch(0))
    expect(result).toEqual({ status: 'ok', inserted: 3 })

    const { data, error } = await user1
      .from('route_points')
      .select('recorded_at, received_at, point_seq, batch_seq')
      .eq('workout_id', workoutId1)
      .order('point_seq')
    expect(error).toBeNull()
    expect(data?.map((r) => r.point_seq)).toEqual([0, 1, 2])
    expect(data?.every((r) => r.batch_seq === 0)).toBe(true)
    expect(data?.[0].received_at).not.toBeNull() // server clock (FR-RR-3)
    expect(new Date(data?.[0].recorded_at ?? '').getTime()).toBe(1_000) // client clock preserved
  })

  it('FR-RR-2 / NFR-R-1: resending the same batch is an idempotent no-op', async () => {
    const before = await countPoints()
    const result = await ingestBatch(user1, workoutId1, batch(0))
    expect(result).toEqual({ status: 'ok', inserted: 0 })
    expect(await countPoints()).toBe(before)
  })

  it('FR-RR-5: a user cannot ingest into another user’s workout', async () => {
    const before = await countPoints()
    const result = await ingestBatch(user2, workoutId1, batch(7))
    expect(result).toEqual({ status: 'forbidden' })
    expect(await countPoints()).toBe(before) // nothing written
  })
})
