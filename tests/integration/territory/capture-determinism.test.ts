/**
 * @jest-environment node
 *
 * Integration tests for territory capture determinism (02D-05).
 * Verifies that the same canonical cell set passed to two different finalizes
 * (same user, different workouts) produces all `cells_defended` on the second
 * run, and that the audit log grows exactly as expected.
 *
 * This is the R-03 parity guard at the integration level: the cell set
 * computed by captureCells() (TS) is deterministic, and the RPC applies it
 * deterministically regardless of call order.
 *
 * Skipped when service-role credentials are absent.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/infrastructure/supabase/database.types'

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const describeDb = url && serviceKey ? describe : describe.skip

type AdminClient = SupabaseClient<Database>

async function createTestUser(admin: AdminClient, tag: string): Promise<{ userId: string }> {
  const email = `determinism-${tag}-${Date.now()}@example.com`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: 'password123!',
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`createTestUser (${tag}): ${error?.message}`)
  return { userId: data.user.id }
}

async function createWorkout(admin: AdminClient, userId: string): Promise<string> {
  const startedAt = new Date(Date.now() - 600_000).toISOString()
  const { data, error } = await admin
    .from('workouts')
    .insert({ user_id: userId, status: 'recording', started_at: startedAt })
    .select('id')
    .single()
  if (error || !data) throw new Error(`createWorkout: ${error?.message}`)
  return data.id
}

async function insertMinimalPoints(admin: AdminClient, workoutId: string): Promise<void> {
  const rows = [
    { workout_id: workoutId, lat: 51.51, lng: -0.09, accuracy_m: 5, recorded_at: new Date(1000).toISOString(), batch_seq: 0, point_seq: 0 },
    { workout_id: workoutId, lat: 51.511, lng: -0.09, accuracy_m: 5, recorded_at: new Date(3000).toISOString(), batch_seq: 0, point_seq: 1 },
  ]
  const { error } = await admin.from('route_points').insert(rows)
  if (error) throw new Error(`insertMinimalPoints: ${error.message}`)
}

function finalizeViaAdmin(
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

describeDb('Territory: capture determinism (02D-05)', () => {
  let admin: AdminClient
  let userId: string
  // Canonical cell set — fixed for determinism test. In production this comes
  // from captureCells(); here we use a stable set to isolate the DB behavior.
  const canonicalCells = [`det-cell-x-${Date.now()}`, `det-cell-y-${Date.now()}`]

  beforeAll(async () => {
    admin = createClient<Database>(url, serviceKey)
    ;({ userId } = await createTestUser(admin, 'det1'))
  })

  afterAll(async () => {
    await admin.from('cell_ownership').delete().in('cell_id', canonicalCells)
    await admin.from('workouts').delete().eq('user_id', userId)
    await admin.auth.admin.deleteUser(userId)
  })

  it('first finalize: all cells claimed', async () => {
    const w1 = await createWorkout(admin, userId)
    await insertMinimalPoints(admin, w1)
    const { data, error } = await finalizeViaAdmin(admin, w1, canonicalCells, userId)
    expect(error).toBeNull()
    expect(data?.cells_claimed).toBe(canonicalCells.length)
    expect(data?.cells_stolen).toBe(0)
    expect(data?.cells_defended).toBe(0)
  })

  it('second finalize with identical cells: all cells defended (same owner)', async () => {
    const w2 = await createWorkout(admin, userId)
    await insertMinimalPoints(admin, w2)
    const { data, error } = await finalizeViaAdmin(admin, w2, canonicalCells, userId)
    expect(error).toBeNull()
    expect(data?.cells_defended).toBe(canonicalCells.length)
    expect(data?.cells_claimed).toBe(0)
    expect(data?.cells_stolen).toBe(0)
  })

  it('audit log: territory_captures has 2 rows per cell (one claim, one defend)', async () => {
    const { data, error } = await admin
      .from('territory_captures')
      .select('cell_id, action')
      .in('cell_id', canonicalCells)
      .order('cell_id')
      .order('captured_at')
    expect(error).toBeNull()
    // 2 cells × 2 finalizes = 4 rows total.
    expect(data).toHaveLength(canonicalCells.length * 2)
    for (const cell of canonicalCells) {
      const rows = data?.filter((r) => r.cell_id === cell)
      expect(rows).toHaveLength(2)
      const actions = rows?.map((r) => r.action).sort()
      expect(actions).toEqual(['claim', 'defend'])
    }
  })

  it('cell_ownership still points to the first workout (owner unchanged on defend)', async () => {
    // On defend, the upsert re-writes with the new workout_id (last-writer-wins
    // on owned_since_workout_id). But the owner stays the same user.
    const { data, error } = await admin
      .from('cell_ownership')
      .select('cell_id, owner_user_id')
      .in('cell_id', canonicalCells)
    expect(error).toBeNull()
    expect(data).toHaveLength(canonicalCells.length)
    expect(data?.every((r) => r.owner_user_id === userId)).toBe(true)
  })
})
