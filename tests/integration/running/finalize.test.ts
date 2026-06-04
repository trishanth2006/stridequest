/**
 * @jest-environment node
 *
 * Integration tests for the finalize_workout RPC v2 (02D-05).
 * Exercises the real SECURITY DEFINER RPC against live Postgres through
 * the service-role admin client (required since 02D-05 revoked EXECUTE from
 * `authenticated`). Identity (p_user_id) is supplied explicitly; the auth.uid()
 * context is unavailable for service-role calls.
 *
 * Scope (02D-05):
 *   - geometry + derived metrics preserved from v1 (FR-RP-1/2)
 *   - idempotency preserved (FR-RP-4): re-finalizing returns stored record + recounted cells
 *   - ownership enforced via p_user_id parameter (FR-RP-3)
 *   - territory_captures written for each cell
 *   - cell_ownership upserted (last-writer-wins)
 *   - cells_claimed / cells_stolen / cells_defended populated
 *
 * Skipped when service-role credentials are absent so `npm test` stays green in
 * environments with no DB connection.
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
): Promise<{ userId: string }> {
  const email = `finalize-v2-${tag}-${Date.now()}@example.com`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: 'password123!',
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`Failed to create test user (${tag}): ${error?.message}`)
  return { userId: data.user.id }
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

/**
 * Call the v2 RPC via the service-role client (as the server action does).
 * p_user_id carries the verified caller identity.
 */
async function finalizeViaAdmin(
  admin: AdminClient,
  workoutId: string,
  cellIds: string[],
  userId: string,
) {
  return admin.rpc('finalize_workout', {
    p_workout_id: workoutId,
    p_cell_ids: cellIds,
    p_user_id: userId,
  })
}

describeDb('FR-RP: finalize_workout RPC v2 (02D-05)', () => {
  let admin: AdminClient
  let userId1: string
  let userId2: string
  let wHappy: string

  // A ~222m two-segment line in central London (0.001deg lat ~= 111m).
  const line = [
    { lat: 51.5, lng: -0.1 },
    { lat: 51.501, lng: -0.1 },
    { lat: 51.502, lng: -0.1 },
  ]

  // Stable H3 res-9 cells for a spot in central London — used as synthetic
  // cell IDs in tests. Real cells are produced by captureCells() in the action;
  // the RPC accepts whatever text[] it receives from the server action.
  const testCells = ['892830829abffff', '892830829abfffe']

  beforeAll(async () => {
    admin = createClient<Database>(url, serviceKey)
    ;({ userId: userId1 } = await createTestUser(admin, 'u1'))
    ;({ userId: userId2 } = await createTestUser(admin, 'u2'))
    wHappy = await createWorkout(admin, userId1, 'recording', 600)
    await insertPoints(admin, wHappy, line)
  })

  afterAll(async () => {
    await admin.from('cell_ownership').delete().in('owner_user_id', [userId1, userId2])
    await admin.from('workouts').delete().in('user_id', [userId1, userId2])
    await admin.auth.admin.deleteUser(userId1)
    await admin.auth.admin.deleteUser(userId2)
  })

  it('FR-RP-1/2: finalizes a recording workout — geometry + derived metrics, status completed', async () => {
    const { data, error } = await finalizeViaAdmin(admin, wHappy, testCells, userId1)
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
    // v2 populates cell capture fields (not null) when cells are provided.
    expect(data?.cells_claimed).toBe(testCells.length)
    expect(data?.cells_stolen).toBe(0)
    expect(data?.cells_defended).toBe(0)
    // v2 does not implement XP yet.
    expect(data?.xp_awarded).toBeNull()

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

  it('territory_captures written — one row per cell with correct action', async () => {
    const { data, error } = await admin
      .from('territory_captures')
      .select('cell_id, action')
      .eq('workout_id', wHappy)
      .order('cell_id')
    expect(error).toBeNull()
    expect(data).toHaveLength(testCells.length)
    expect(data?.every((r) => r.action === 'claim')).toBe(true)
  })

  it('cell_ownership upserted — owner is userId1 for each captured cell', async () => {
    const { data, error } = await admin
      .from('cell_ownership')
      .select('cell_id, owner_user_id, owned_since_workout_id')
      .in('cell_id', testCells)
    expect(error).toBeNull()
    expect(data).toHaveLength(testCells.length)
    expect(data?.every((r) => r.owner_user_id === userId1)).toBe(true)
    expect(data?.every((r) => r.owned_since_workout_id === wHappy)).toBe(true)
  })

  it('FR-RP-4: re-finalizing a completed workout is idempotent — returns stored record, no duplicate captures', async () => {
    const { data: before } = await admin
      .from('workouts')
      .select('distance_m, duration_s, ended_at')
      .eq('id', wHappy)
      .single()

    const { data, error } = await finalizeViaAdmin(admin, wHappy, testCells, userId1)
    expect(error).toBeNull()
    expect(data?.status).toBe('completed')
    expect(data?.distance_m).toBe(before?.distance_m)
    // Idempotent: cell counts are re-read from existing territory_captures, not recomputed.
    expect(data?.cells_claimed).toBe(testCells.length)

    // Stored metrics unchanged (no recompute).
    const { data: after } = await admin
      .from('workouts')
      .select('distance_m, duration_s, ended_at')
      .eq('id', wHappy)
      .single()
    expect(after).toEqual(before)

    // No duplicate territory_captures rows inserted.
    const { data: captures } = await admin
      .from('territory_captures')
      .select('id')
      .eq('workout_id', wHappy)
    expect(captures).toHaveLength(testCells.length)
  })

  it("FR-RP-3: a non-owner cannot finalize another user's workout (p_user_id mismatch)", async () => {
    // Supply userId2 as the caller, but wHappy belongs to userId1.
    const { data, error } = await finalizeViaAdmin(admin, wHappy, testCells, userId2)
    expect(data).toBeNull()
    expect(error).not.toBeNull()
    // RPC raises errcode 42501 (insufficient_privilege).
    expect(error?.code).toBe('42501')
  })

  it('rejects finalizing a workout that is not recording (e.g. discarded)', async () => {
    const wDiscarded = await createWorkout(admin, userId1, 'discarded', 10)
    const { data, error } = await finalizeViaAdmin(admin, wDiscarded, [], userId1)
    expect(data).toBeNull()
    expect(error).not.toBeNull()
  })

  it('finalizes a workout with fewer than two points as zero-distance, null path', async () => {
    const { userId: userId3 } = await createTestUser(admin, 'u3')
    try {
      const wEmpty = await createWorkout(admin, userId3, 'recording', 30)
      const { data, error } = await finalizeViaAdmin(admin, wEmpty, [], userId3)
      expect(error).toBeNull()
      expect(data?.status).toBe('completed')
      expect(data?.distance_m).toBe(0)
      expect(data?.avg_pace_s_per_km).toBeNull()
      expect(data?.cells_claimed).toBe(0)

      const { data: row } = await admin.from('workouts').select('path').eq('id', wEmpty).single()
      expect(row?.path).toBeNull()
    } finally {
      await admin.from('workouts').delete().eq('user_id', userId3)
      await admin.auth.admin.deleteUser(userId3)
    }
  })

  it('p_user_id null raises an error', async () => {
    // Simulate a bug in the caller: passing null as userId.
    // The RPC should reject this before doing any work.
    const wNew = await createWorkout(admin, userId1, 'recording', 10)
    // We need to use raw SQL since TS won't let us pass null easily via the typed RPC.
    const { data } = await admin.rpc('finalize_workout', {
      p_workout_id: wNew,
      p_cell_ids: [],
      p_user_id: null as unknown as string,
    })
    // The RPC should raise; data should be null.
    expect(data).toBeNull()
  })
})
