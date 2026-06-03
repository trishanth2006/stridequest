/**
 * @jest-environment node
 *
 * Integration tests for the finalize_workout RPC v1 (02C-01, FR-RP).
 * Exercises the real SECURITY DEFINER RPC against live Postgres through
 * user-scoped JWT clients, so auth.uid() ownership and idempotency are tested
 * for real (not mocked). The service-role client is used only for setup/teardown.
 *
 * Scope (02C-01): geometry + derived metrics only. No territory capture, no XP,
 * no profile rollup — those arrive in 02D / 02E and are NOT asserted here.
 *
 * Skipped when service-role credentials are absent so `npm test` stays green in
 * environments with no DB connection (mirrors ingest.test.ts / rls.test.ts).
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/infrastructure/supabase/database.types'

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const describeDb = url && serviceKey ? describe : describe.skip

type AdminClient = SupabaseClient<Database>

async function createTestUser(
  admin: AdminClient,
  tag: string,
): Promise<{ client: SupabaseClient<Database>; userId: string }> {
  const email = `finalize-${tag}-${Date.now()}@example.com`
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

/** Insert a workout with an explicit status + start time (to exercise elapsed-duration). */
async function createWorkout(
  admin: AdminClient,
  userId: string,
  status: 'recording' | 'completed' | 'discarded',
  startedSecondsAgo: number,
): Promise<string> {
  const startedAt = new Date(Date.now() - startedSecondsAgo * 1000).toISOString()
  const { data, error } = await admin
    .from('workouts')
    .insert({ user_id: userId, status, started_at: startedAt })
    .select('id')
    .single()
  if (error || !data) throw new Error(`Failed to create workout: ${error?.message}`)
  return data.id
}

/** Insert raw route points (admin bypasses RLS) under a single batch_seq. */
async function insertPoints(
  admin: AdminClient,
  workoutId: string,
  coords: ReadonlyArray<{ lat: number; lng: number }>,
): Promise<void> {
  const rows = coords.map((c, i) => ({
    workout_id: workoutId,
    lat: c.lat,
    lng: c.lng,
    accuracy_m: 5,
    recorded_at: new Date(1_000 + i * 2_000).toISOString(),
    batch_seq: 0,
    point_seq: i,
  }))
  const { error } = await admin.from('route_points').insert(rows)
  if (error) throw new Error(`Failed to insert points: ${error.message}`)
}

describeDb('FR-RP: finalize_workout RPC v1 (02C-01)', () => {
  let admin: AdminClient
  let user1: SupabaseClient<Database>
  let user2: SupabaseClient<Database>
  let userId1: string
  let userId2: string
  let wHappy: string

  // A ~222m two-segment line in central London (0.001deg lat ~= 111m).
  const line = [
    { lat: 51.5, lng: -0.1 },
    { lat: 51.501, lng: -0.1 },
    { lat: 51.502, lng: -0.1 },
  ]

  beforeAll(async () => {
    admin = createClient<Database>(url, serviceKey)
    ;({ client: user1, userId: userId1 } = await createTestUser(admin, 'u1'))
    ;({ client: user2, userId: userId2 } = await createTestUser(admin, 'u2'))
    wHappy = await createWorkout(admin, userId1, 'recording', 600)
    await insertPoints(admin, wHappy, line)
  })

  afterAll(async () => {
    await admin.from('workouts').delete().in('user_id', [userId1, userId2])
    await admin.auth.admin.deleteUser(userId1)
    await admin.auth.admin.deleteUser(userId2)
  })

  it('FR-RP-1/2: finalizes a recording workout — geometry + derived metrics, status completed', async () => {
    const { data, error } = await user1.rpc('finalize_workout', { p_workout_id: wHappy })
    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data?.status).toBe('completed')
    // Distance is server-authoritative via PostGIS ST_Length (decision 2): ~222m.
    expect(data?.distance_m).toBeGreaterThan(150)
    expect(data?.distance_m).toBeLessThan(300)
    // Duration is elapsed wall-clock started_at -> now (decision 1): ~600s.
    expect(data?.duration_s).toBeGreaterThanOrEqual(595)
    expect(data?.duration_s).toBeLessThan(900)
    expect(data?.avg_pace_s_per_km).toBeGreaterThan(0)
    // v1 does not compute XP or capture — reserved fields are null.
    expect(data?.xp_awarded).toBeNull()
    expect(data?.cells_claimed).toBeNull()

    // The canonical path is persisted (non-null geometry).
    const { data: row } = await admin
      .from('workouts')
      .select('status, distance_m, duration_s, path, ended_at')
      .eq('id', wHappy)
      .single()
    expect(row?.status).toBe('completed')
    expect(row?.path).not.toBeNull()
    expect(row?.ended_at).not.toBeNull()
    expect(row?.distance_m).toBe(data?.distance_m)
  })

  it('FR-RP-4: re-finalizing a completed workout is an idempotent no-op', async () => {
    const { data: before } = await admin
      .from('workouts')
      .select('distance_m, duration_s, ended_at')
      .eq('id', wHappy)
      .single()

    const { data, error } = await user1.rpc('finalize_workout', { p_workout_id: wHappy })
    expect(error).toBeNull()
    expect(data?.status).toBe('completed')
    expect(data?.distance_m).toBe(before?.distance_m)

    // Stored metrics unchanged (no recompute, no re-increment).
    const { data: after } = await admin
      .from('workouts')
      .select('distance_m, duration_s, ended_at')
      .eq('id', wHappy)
      .single()
    expect(after).toEqual(before)
  })

  it('FR-RP-3: a non-owner cannot finalize another user’s workout', async () => {
    const { data, error } = await user2.rpc('finalize_workout', { p_workout_id: wHappy })
    expect(data).toBeNull()
    expect(error).not.toBeNull()
  })

  it('rejects finalizing a workout that is not recording (e.g. discarded)', async () => {
    // Inserted directly as discarded (no recording-then-update), so the test does
    // not depend on wHappy already being completed for the active-workout index.
    const wDiscarded = await createWorkout(admin, userId1, 'discarded', 10)

    const { data, error } = await user1.rpc('finalize_workout', { p_workout_id: wDiscarded })
    expect(data).toBeNull()
    expect(error).not.toBeNull()
  })

  it('finalizes a workout with fewer than two points as zero-distance, null path', async () => {
    const wEmpty = await createWorkout(admin, userId2, 'recording', 30)

    const { data, error } = await user2.rpc('finalize_workout', { p_workout_id: wEmpty })
    expect(error).toBeNull()
    expect(data?.status).toBe('completed')
    expect(data?.distance_m).toBe(0)
    expect(data?.avg_pace_s_per_km).toBeNull()

    const { data: row } = await admin.from('workouts').select('path').eq('id', wEmpty).single()
    expect(row?.path).toBeNull()
  })
})
