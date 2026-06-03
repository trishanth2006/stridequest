/**
 * @jest-environment node
 *
 * Integration test: exercises the live `workouts` table through real Supabase
 * clients. It runs only when service-role credentials are supplied; without
 * them the suite is skipped so `npm test` stays green in environments with no
 * DB connection (mirrors tests/integration/db/migration-verification.test.ts).
 *
 * These assertions prove FR-WL-1 (row created on start) and FR-WL-2 (at most
 * one active workout per user) against the real partial-unique index, which
 * the unit tests can only simulate.
 */
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/infrastructure/supabase/database.types'

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

const describeDb = url && serviceKey ? describe : describe.skip

describeDb('FR-WL: workout lifecycle (start)', () => {
  let admin: ReturnType<typeof createClient<Database>>
  let userId: string

  beforeAll(async () => {
    admin = createClient<Database>(url, serviceKey)
    const email = `wl-${Date.now()}@example.com`
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: 'password123',
      email_confirm: true,
    })
    if (error || !data.user) {
      throw new Error(`failed to create test user: ${error?.message}`)
    }
    userId = data.user.id
  })

  afterAll(async () => {
    if (userId) {
      await admin.from('workouts').delete().eq('user_id', userId)
      await admin.auth.admin.deleteUser(userId)
    }
  })

  it('FR-WL-1: starting creates a recording workout owned by the user', async () => {
    const { data, error } = await admin
      .from('workouts')
      .insert({ user_id: userId })
      .select('id, status, user_id')
      .single()

    expect(error).toBeNull()
    expect(data?.status).toBe('recording')
    expect(data?.user_id).toBe(userId)
  })

  it('FR-WL-2: a second active workout is rejected by the unique index', async () => {
    const { error } = await admin.from('workouts').insert({ user_id: userId }).select('id').single()

    expect(error).not.toBeNull()
    expect(error?.code).toBe('23505')
  })
})
