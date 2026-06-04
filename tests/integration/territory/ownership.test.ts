/**
 * @jest-environment node
 *
 * Integration tests for the read-side territory ownership service (02D-06)
 * against live Postgres. Exercises the real service functions through user-
 * scoped JWT clients so RLS is in force, plus an anonymous client to confirm the
 * board is closed to unauthenticated callers (02D-02 design).
 *
 * Ownership rows are seeded with the service-role client because clients cannot
 * write cell_ownership (writes happen only in finalize_workout). The service
 * under test is read-only.
 *
 * Skipped when service-role credentials are absent so `npm test` stays green in
 * environments with no DB connection.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database, TablesInsert } from '@/infrastructure/supabase/database.types'
import {
  getOwnedCells,
  getCellOwnership,
  getOwnershipStats,
} from '@/features/territory/services/ownership'

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const anonKey =
  process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ''

const describeDb = url && serviceKey ? describe : describe.skip

type AdminClient = SupabaseClient<Database>

async function createTestUser(
  admin: AdminClient,
  tag: string,
): Promise<{ client: SupabaseClient<Database>; userId: string }> {
  const email = `ownership-${tag}-${Date.now()}@example.com`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: 'password123!',
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`createTestUser (${tag}): ${error?.message}`)

  const { data: signIn, error: signInErr } = await admin.auth.signInWithPassword({
    email,
    password: 'password123!',
  })
  if (signInErr || !signIn.session) throw new Error(`signIn (${tag}): ${signInErr?.message}`)

  const client = createClient<Database>(url, signIn.session.access_token, {
    global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } },
    auth: { persistSession: false },
  })
  return { client, userId: data.user.id }
}

async function createWorkout(admin: AdminClient, userId: string): Promise<string> {
  const { data, error } = await admin
    .from('workouts')
    .insert({ user_id: userId })
    .select('id')
    .single()
  if (error || !data) throw new Error(`createWorkout: ${error?.message}`)
  return data.id
}

describeDb('Territory ownership service (02D-06)', () => {
  let admin: AdminClient
  let user1: SupabaseClient<Database>
  let user2: SupabaseClient<Database>
  let userId1: string
  let userId2: string

  const stamp = Date.now()
  const cellA = `own-A-${stamp}`
  const cellB = `own-B-${stamp}`
  const cellC = `own-C-${stamp}`

  beforeAll(async () => {
    admin = createClient<Database>(url, serviceKey)
    ;({ client: user1, userId: userId1 } = await createTestUser(admin, 'u1'))
    ;({ client: user2, userId: userId2 } = await createTestUser(admin, 'u2'))

    const w1 = await createWorkout(admin, userId1)
    const w2 = await createWorkout(admin, userId2)

    // Seed the board via service-role (clients cannot write cell_ownership).
    // user1 owns A + B; user2 owns C.
    const seed: TablesInsert<'cell_ownership'>[] = [
      { cell_id: cellA, owner_user_id: userId1, owned_since_workout_id: w1 },
      { cell_id: cellB, owner_user_id: userId1, owned_since_workout_id: w1 },
      { cell_id: cellC, owner_user_id: userId2, owned_since_workout_id: w2 },
    ]
    const { error } = await admin.from('cell_ownership').insert(seed)
    if (error) throw new Error(`seed cell_ownership: ${error.message}`)
  })

  afterAll(async () => {
    // cell_ownership FKs do not cascade — delete it before workouts/users.
    await admin.from('cell_ownership').delete().in('cell_id', [cellA, cellB, cellC])
    await admin.from('workouts').delete().in('user_id', [userId1, userId2])
    await admin.auth.admin.deleteUser(userId1)
    await admin.auth.admin.deleteUser(userId2)
  })

  it('getOwnedCells: a user sees the cells they own (scoped by owner_user_id)', async () => {
    const owned = await getOwnedCells(user1, userId1)
    expect(owned.map((o) => o.cellId).sort()).toEqual([cellA, cellB].sort())
    expect(owned.every((o) => o.ownerUserId === userId1)).toBe(true)
  })

  it('getOwnershipStats: totalCells matches the number of cells the user owns', async () => {
    expect(await getOwnershipStats(user1, userId1)).toEqual({ totalCells: 2 })
    expect(await getOwnershipStats(user2, userId2)).toEqual({ totalCells: 1 })
  })

  it('FR-OW-1: the board is world-readable — any authenticated user can read another user\'s cells', async () => {
    // user2 queries user1's owned cells and the mixed cell set.
    const otherOwned = await getOwnedCells(user2, userId1)
    expect(otherOwned.map((o) => o.cellId).sort()).toEqual([cellA, cellB].sort())

    const mixed = await getCellOwnership(user2, [cellA, cellB, cellC])
    expect(mixed).toHaveLength(3)
    const byCell = Object.fromEntries(mixed.map((o) => [o.cellId, o.ownerUserId]))
    expect(byCell[cellA]).toBe(userId1)
    expect(byCell[cellC]).toBe(userId2) // user2 sees their own and others' alike
  })

  it('getCellOwnership: unowned cells are absent from the result (no row)', async () => {
    const result = await getCellOwnership(user1, [cellA, `unowned-${stamp}`])
    expect(result.map((o) => o.cellId)).toEqual([cellA])
  })

  // RLS (02D-02): cell_ownership SELECT is granted to `authenticated` only.
  // An anonymous caller therefore sees zero rows (silently filtered, no error).
  ;(anonKey ? it : it.skip)('RLS 02D-02: an anonymous caller reads no ownership rows', async () => {
    const anon = createClient<Database>(url, anonKey)
    const result = await getCellOwnership(anon, [cellA, cellB, cellC])
    expect(result).toEqual([])
  })
})
