/**
 * @jest-environment node
 *
 * Integration tests for territory capture contention (02D-05).
 * Tests last-writer-wins semantics when two users finalize workouts that
 * overlap the same H3 cells, and verifies the full audit log is preserved.
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
  const email = `contention-${tag}-${Date.now()}@example.com`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: 'password123!',
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`Failed to create test user (${tag}): ${error?.message}`)
  return { userId: data.user.id }
}

async function createWorkout(admin: AdminClient, userId: string): Promise<string> {
  const startedAt = new Date(Date.now() - 600_000).toISOString()
  const { data, error } = await admin
    .from('workouts')
    .insert({ user_id: userId, status: 'recording', started_at: startedAt })
    .select('id')
    .single()
  if (error || !data) throw new Error(`Failed to create workout: ${error?.message}`)
  return data.id
}

async function insertMinimalPoints(admin: AdminClient, workoutId: string): Promise<void> {
  const rows = [
    { workout_id: workoutId, lat: 51.5, lng: -0.1, accuracy_m: 5, recorded_at: new Date(1000).toISOString(), batch_seq: 0, point_seq: 0 },
    { workout_id: workoutId, lat: 51.501, lng: -0.1, accuracy_m: 5, recorded_at: new Date(3000).toISOString(), batch_seq: 0, point_seq: 1 },
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

describeDb('Territory: contention — last-writer-wins (02D-05)', () => {
  let admin: AdminClient
  let userId1: string
  let userId2: string
  // Two synthetic cells that both users will contest.
  const contestedCells = [`contention-cell-a-${Date.now()}`, `contention-cell-b-${Date.now()}`]

  beforeAll(async () => {
    admin = createClient<Database>(url, serviceKey)
    ;({ userId: userId1 } = await createTestUser(admin, 'cont1'))
    ;({ userId: userId2 } = await createTestUser(admin, 'cont2'))
  })

  afterAll(async () => {
    await admin.from('cell_ownership').delete().in('cell_id', contestedCells)
    await admin.from('workouts').delete().in('user_id', [userId1, userId2])
    await admin.auth.admin.deleteUser(userId1)
    await admin.auth.admin.deleteUser(userId2)
  })

  it('user1 claims cells first, user2 steals them — last-writer-wins', async () => {
    // -- User 1 finalizes first --
    const w1 = await createWorkout(admin, userId1)
    await insertMinimalPoints(admin, w1)
    const { data: d1, error: e1 } = await finalizeViaAdmin(admin, w1, contestedCells, userId1)
    expect(e1).toBeNull()
    expect(d1?.cells_claimed).toBe(contestedCells.length)
    expect(d1?.cells_stolen).toBe(0)
    expect(d1?.cells_defended).toBe(0)

    // cell_ownership after first finalize: all cells owned by user1.
    const { data: after1 } = await admin
      .from('cell_ownership')
      .select('cell_id, owner_user_id')
      .in('cell_id', contestedCells)
    expect(after1?.every((r) => r.owner_user_id === userId1)).toBe(true)

    // -- User 2 finalizes second (same cells) --
    const w2 = await createWorkout(admin, userId2)
    await insertMinimalPoints(admin, w2)
    const { data: d2, error: e2 } = await finalizeViaAdmin(admin, w2, contestedCells, userId2)
    expect(e2).toBeNull()
    expect(d2?.cells_stolen).toBe(contestedCells.length)
    expect(d2?.cells_claimed).toBe(0)
    expect(d2?.cells_defended).toBe(0)

    // cell_ownership after second finalize: all cells now owned by user2 (last-writer-wins).
    const { data: after2 } = await admin
      .from('cell_ownership')
      .select('cell_id, owner_user_id, owned_since_workout_id')
      .in('cell_id', contestedCells)
    expect(after2?.every((r) => r.owner_user_id === userId2)).toBe(true)
    expect(after2?.every((r) => r.owned_since_workout_id === w2)).toBe(true)
  })

  it('audit log preserved — territory_captures has entries for both finalizes', async () => {
    // Query captures for both contested cells, both workouts.
    const { data, error } = await admin
      .from('territory_captures')
      .select('cell_id, action, user_id')
      .in('cell_id', contestedCells)
      .order('captured_at')
    expect(error).toBeNull()
    // 2 cells × 2 finalizes = 4 capture rows.
    expect(data).toHaveLength(contestedCells.length * 2)
    // First two rows: user1 claims.
    const user1Rows = data?.filter((r) => r.user_id === userId1)
    expect(user1Rows?.every((r) => r.action === 'claim')).toBe(true)
    // Last two rows: user2 steals.
    const user2Rows = data?.filter((r) => r.user_id === userId2)
    expect(user2Rows?.every((r) => r.action === 'steal')).toBe(true)
  })

  it('defending: re-claiming already-owned cells increments cells_defended', async () => {
    // user2 already owns contestedCells. Create a new workout for user2 over the same cells.
    const w3 = await createWorkout(admin, userId2)
    await insertMinimalPoints(admin, w3)
    const { data, error } = await finalizeViaAdmin(admin, w3, contestedCells, userId2)
    expect(error).toBeNull()
    expect(data?.cells_defended).toBe(contestedCells.length)
    expect(data?.cells_stolen).toBe(0)
    expect(data?.cells_claimed).toBe(0)
  })
})
