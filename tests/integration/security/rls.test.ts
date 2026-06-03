/**
 * @jest-environment node
 *
 * RLS integration tests for Phase 02A (workouts), 02B-01 (route_points), and
 * 02D-02 (territory_captures, cell_ownership).
 *
 * Tests authenticate as real users via Supabase Auth admin API and assert that
 * row-level security policies enforce ownership on every table. The service-
 * role client is used only for setup and teardown; all assertions use
 * user-scoped JWT clients.
 *
 * Skipped when service-role credentials are absent so `npm test` stays green
 * in environments with no DB connection.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database, TablesInsert } from '@/infrastructure/supabase/database.types'

// ---------------------------------------------------------------------------
// Env / skip guard
// ---------------------------------------------------------------------------

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

const describeDb = url && serviceKey ? describe : describe.skip

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AdminClient = SupabaseClient<Database>

/** Create a disposable test user and return a JWT-scoped client for them. */
async function createTestUser(
  admin: AdminClient,
  tag: string,
): Promise<{ client: SupabaseClient<Database>; userId: string }> {
  const email = `rls-${tag}-${Date.now()}@example.com`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: 'password123!',
    email_confirm: true,
  })
  if (error || !data.user) {
    throw new Error(`Failed to create test user (${tag}): ${error?.message}`)
  }

  const { data: signIn, error: signInErr } = await admin.auth.signInWithPassword({
    email,
    password: 'password123!',
  })
  if (signInErr || !signIn.session) {
    throw new Error(`Failed to sign in test user (${tag}): ${signInErr?.message}`)
  }

  const client = createClient<Database>(url, signIn.session.access_token, {
    global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } },
    auth: { persistSession: false },
  })

  return { client, userId: data.user.id }
}

/** Insert a workout owned by userId via the service-role client. */
async function createWorkout(admin: AdminClient, userId: string): Promise<string> {
  const { data, error } = await admin
    .from('workouts')
    .insert({ user_id: userId })
    .select('id')
    .single()
  if (error || !data) throw new Error(`Failed to create workout: ${error?.message}`)
  return data.id
}

// ---------------------------------------------------------------------------
// workouts RLS (02A-03)
// ---------------------------------------------------------------------------

describeDb('RLS: workouts (02A)', () => {
  let admin: AdminClient
  let user1: SupabaseClient<Database>
  let user2: SupabaseClient<Database>
  let userId1: string
  let userId2: string
  let workoutId1: string

  beforeAll(async () => {
    admin = createClient<Database>(url, serviceKey)
    ;({ client: user1, userId: userId1 } = await createTestUser(admin, 'wu1'))
    ;({ client: user2, userId: userId2 } = await createTestUser(admin, 'wu2'))
    workoutId1 = await createWorkout(admin, userId1)
  })

  afterAll(async () => {
    await admin.from('workouts').delete().in('user_id', [userId1, userId2])
    await admin.auth.admin.deleteUser(userId1)
    await admin.auth.admin.deleteUser(userId2)
  })

  it('owner can SELECT their own workout', async () => {
    const { data, error } = await user1.from('workouts').select('id').eq('id', workoutId1)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('other user cannot SELECT owner workout', async () => {
    const { data, error } = await user2.from('workouts').select('id').eq('id', workoutId1)
    expect(error).toBeNull()
    expect(data).toHaveLength(0) // RLS silently filters
  })

  it('owner can INSERT their own workout', async () => {
    // Cleanup the existing 'recording' workout first (unique partial index)
    await admin.from('workouts').delete().eq('user_id', userId2)
    const { error } = await user2.from('workouts').insert({ user_id: userId2 })
    expect(error).toBeNull()
  })

  it('other user cannot INSERT a workout for user1 (RLS WITH CHECK)', async () => {
    // user2 tries to insert a workout with user_id = userId1
    const { error } = await user2.from('workouts').insert({ user_id: userId1 })
    expect(error).not.toBeNull()
  })

  it('owner can UPDATE their own workout', async () => {
    const { error } = await user1
      .from('workouts')
      .update({ source: 'web' })
      .eq('id', workoutId1)
    expect(error).toBeNull()
  })

  it('other user cannot UPDATE owner workout', async () => {
    const { error, count } = await user2
      .from('workouts')
      .update({ source: 'web' }, { count: 'exact' })
      .eq('id', workoutId1)
      .select('id')
    // RLS silently filters — no error, but 0 rows matched
    expect(error).toBeNull()
    expect(count).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// route_points RLS (02B-01)
// ---------------------------------------------------------------------------

describeDb('RLS: route_points (02B-01)', () => {
  let admin: AdminClient
  let user1: SupabaseClient<Database>
  let user2: SupabaseClient<Database>
  let userId1: string
  let userId2: string
  let workoutId1: string

  beforeAll(async () => {
    admin = createClient<Database>(url, serviceKey)
    ;({ client: user1, userId: userId1 } = await createTestUser(admin, 'rp1'))
    ;({ client: user2, userId: userId2 } = await createTestUser(admin, 'rp2'))
    workoutId1 = await createWorkout(admin, userId1)
  })

  afterAll(async () => {
    await admin.from('route_points').delete().eq('workout_id', workoutId1)
    await admin.from('workouts').delete().in('user_id', [userId1, userId2])
    await admin.auth.admin.deleteUser(userId1)
    await admin.auth.admin.deleteUser(userId2)
  })

  /** Minimal valid route point payload. point_seq is the per-sample idempotency
   *  key added in 02B-07; it defaults to 0 for single-point fixtures. */
  function validPoint(workoutId: string, seq: number, pointSeq = 0): TablesInsert<'route_points'> {
    return {
      workout_id: workoutId,
      lat: 51.5,
      lng: -0.1,
      accuracy_m: 5.0,
      recorded_at: new Date().toISOString(),
      batch_seq: seq,
      point_seq: pointSeq,
    }
  }

  it('FR-RR-5: owner can INSERT route points for their own workout', async () => {
    const { error } = await user1.from('route_points').insert(validPoint(workoutId1, 0))
    expect(error).toBeNull()
  })

  it('FR-RR-5: other user cannot INSERT route points for user1 workout', async () => {
    const { error } = await user2.from('route_points').insert(validPoint(workoutId1, 99))
    expect(error).not.toBeNull()
  })

  it('owner can SELECT their own route points', async () => {
    const { data, error } = await user1
      .from('route_points')
      .select('id')
      .eq('workout_id', workoutId1)
    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect((data ?? []).length).toBeGreaterThan(0)
  })

  it('other user cannot SELECT owner route points', async () => {
    const { data, error } = await user2
      .from('route_points')
      .select('id')
      .eq('workout_id', workoutId1)
    expect(error).toBeNull()
    expect(data).toHaveLength(0) // RLS silently filters
  })

  it('append-only: UPDATE on own route_points is silently blocked (no UPDATE policy)', async () => {
    // First insert a point to attempt updating
    await admin
      .from('route_points')
      .insert({ ...validPoint(workoutId1, 1), accuracy_m: 5.0 })

    const { error, count } = await user1
      .from('route_points')
      .update({ accuracy_m: 99.0 }, { count: 'exact' })
      .eq('workout_id', workoutId1)
      .select('id')
    // No UPDATE policy → 0 rows affected, no error (RLS silently filters)
    expect(error).toBeNull()
    expect(count).toBe(0)
  })

  it('append-only: DELETE on own route_points is silently blocked (no DELETE policy)', async () => {
    const { error, count } = await user1
      .from('route_points')
      .delete({ count: 'exact' })
      .eq('workout_id', workoutId1)
      .select('id')
    // No DELETE policy → 0 rows affected, no error
    expect(error).toBeNull()
    expect(count).toBe(0)
  })

  it('duplicate (workout_id, batch_seq, point_seq) is rejected by the unique constraint', async () => {
    // (batch_seq 0, point_seq 0) was already inserted above. Idempotency at the
    // ingest layer uses ON CONFLICT DO NOTHING (see ingest.test.ts); a raw INSERT
    // of the same per-sample key still hard-fails on the DB constraint (02B-07).
    const { error } = await user1.from('route_points').insert(validPoint(workoutId1, 0))
    expect(error).not.toBeNull()
    expect(error?.code).toBe('23505') // unique_violation
  })
})

// ---------------------------------------------------------------------------
// territory tables RLS (02D-02)
//
// territory_captures: owner-scoped SELECT, no client writes.
// cell_ownership:     world-readable to authenticated, no client writes.
// Both tables are written ONLY by the security-definer finalize_workout RPC
// (02D-05). This migration adds no write policies by design; seed rows here are
// created with the service-role client, which bypasses RLS.
// ---------------------------------------------------------------------------

describeDb('RLS: territory tables (02D-02)', () => {
  let admin: AdminClient
  let user1: SupabaseClient<Database>
  let user2: SupabaseClient<Database>
  let userId1: string
  let userId2: string
  let workoutId1: string
  const cellId = `02d02-cell-${Date.now()}`

  beforeAll(async () => {
    admin = createClient<Database>(url, serviceKey)
    ;({ client: user1, userId: userId1 } = await createTestUser(admin, 'tc1'))
    ;({ client: user2, userId: userId2 } = await createTestUser(admin, 'tc2'))
    workoutId1 = await createWorkout(admin, userId1)

    const capture: TablesInsert<'territory_captures'> = {
      workout_id: workoutId1,
      user_id: userId1,
      cell_id: cellId,
      action: 'claim',
    }
    const ownership: TablesInsert<'cell_ownership'> = {
      cell_id: cellId,
      owner_user_id: userId1,
      owned_since_workout_id: workoutId1,
    }
    const { error: capErr } = await admin.from('territory_captures').insert(capture)
    if (capErr) throw new Error(`seed territory_captures failed: ${capErr.message}`)
    const { error: ownErr } = await admin.from('cell_ownership').insert(ownership)
    if (ownErr) throw new Error(`seed cell_ownership failed: ${ownErr.message}`)
  })

  afterAll(async () => {
    // cell_ownership FKs do NOT cascade — delete it before workouts/users.
    await admin.from('cell_ownership').delete().in('owner_user_id', [userId1, userId2])
    await admin.from('territory_captures').delete().eq('workout_id', workoutId1)
    await admin.from('workouts').delete().in('user_id', [userId1, userId2])
    await admin.auth.admin.deleteUser(userId1)
    await admin.auth.admin.deleteUser(userId2)
  })

  // --- territory_captures: owner-scoped read, no client writes ---

  it('owner can SELECT their own territory_captures', async () => {
    const { data, error } = await user1
      .from('territory_captures')
      .select('id')
      .eq('workout_id', workoutId1)
    expect(error).toBeNull()
    expect((data ?? []).length).toBeGreaterThan(0)
  })

  it('other user cannot SELECT owner territory_captures', async () => {
    const { data, error } = await user2
      .from('territory_captures')
      .select('id')
      .eq('workout_id', workoutId1)
    expect(error).toBeNull()
    expect(data).toHaveLength(0) // RLS silently filters
  })

  it('FR-TC-6: direct client INSERT into territory_captures is denied (no INSERT policy)', async () => {
    const { error } = await user1.from('territory_captures').insert({
      workout_id: workoutId1,
      user_id: userId1,
      cell_id: `${cellId}-ins`,
      action: 'claim',
    })
    expect(error).not.toBeNull()
  })

  it('direct client UPDATE on territory_captures is silently blocked (no UPDATE policy)', async () => {
    const { error, count } = await user1
      .from('territory_captures')
      .update({ action: 'defend' }, { count: 'exact' })
      .eq('workout_id', workoutId1)
      .select('id')
    expect(error).toBeNull()
    expect(count).toBe(0)
  })

  it('direct client DELETE on territory_captures is silently blocked (no DELETE policy)', async () => {
    const { error, count } = await user1
      .from('territory_captures')
      .delete({ count: 'exact' })
      .eq('workout_id', workoutId1)
      .select('id')
    expect(error).toBeNull()
    expect(count).toBe(0)
  })

  // --- cell_ownership: world-readable board, no client writes ---

  it('FR-OW-1: any authenticated user can read the board', async () => {
    const { data, error } = await user2
      .from('cell_ownership')
      .select('cell_id')
      .eq('cell_id', cellId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1) // non-owner still sees the cell
  })

  it('FR-OW-2: owner can filter cell_ownership by owner_user_id', async () => {
    const { data, error } = await user1
      .from('cell_ownership')
      .select('cell_id')
      .eq('owner_user_id', userId1)
    expect(error).toBeNull()
    expect((data ?? []).map((r) => r.cell_id)).toContain(cellId)
  })

  it('NFR-Sec-2: direct client INSERT into cell_ownership is denied (no INSERT policy)', async () => {
    const { error } = await user1.from('cell_ownership').insert({
      cell_id: `${cellId}-ins`,
      owner_user_id: userId1,
      owned_since_workout_id: workoutId1,
    })
    expect(error).not.toBeNull()
  })

  it('direct client UPDATE on cell_ownership is silently blocked (no UPDATE policy)', async () => {
    const { error, count } = await user1
      .from('cell_ownership')
      .update({ owner_user_id: userId2 }, { count: 'exact' })
      .eq('cell_id', cellId)
      .select('cell_id')
    expect(error).toBeNull()
    expect(count).toBe(0)
  })

  it('direct client DELETE on cell_ownership is silently blocked (no DELETE policy)', async () => {
    const { error, count } = await user1
      .from('cell_ownership')
      .delete({ count: 'exact' })
      .eq('cell_id', cellId)
      .select('cell_id')
    expect(error).toBeNull()
    expect(count).toBe(0)
  })
})
