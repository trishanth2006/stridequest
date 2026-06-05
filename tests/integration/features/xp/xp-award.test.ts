/**
 * @jest-environment node
 *
 * Integration tests for XP award via the finalize_workout RPC v3 (02E-01).
 * Exercises the live SECURITY DEFINER RPC through the service-role client and
 * asserts the SQL award equals the pure TS calculation (parity guard), that
 * xp_events + user_xp are written, that XP accumulates, and that re-finalizing
 * awards nothing extra (duplicate prevention).
 *
 * Creates users WITH a username in metadata (the handle_new_user trigger
 * requires it), so this suite runs cleanly when DB creds are present.
 *
 * Skipped when service-role credentials are absent.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/infrastructure/supabase/database.types'
import {
  calculateTotalXP,
  calculateWorkoutXP,
  getLevelFromXP,
} from '@/features/xp/services/xp'

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const describeDb = url && serviceKey ? describe : describe.skip

type AdminClient = SupabaseClient<Database>

function uniqueUsername(tag: string): string {
  return ('xp' + tag + Date.now().toString(36) + Math.random().toString(36).slice(2, 6))
    .toLowerCase()
    .slice(0, 30)
}

async function createTestUser(admin: AdminClient, tag: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email: `xp-${tag}-${Date.now()}@example.com`,
    password: 'password123!',
    email_confirm: true,
    user_metadata: { username: uniqueUsername(tag) },
  })
  if (error || !data.user) throw new Error(`createTestUser (${tag}): ${error?.message}`)
  return data.user.id
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
  if (error) throw new Error(`insertPoints: ${error.message}`)
}

function finalize(admin: AdminClient, workoutId: string, cellIds: string[], userId: string) {
  return admin.rpc('finalize_workout', {
    p_workout_id: workoutId,
    p_cell_ids: cellIds,
    p_user_id: userId,
  })
}

describeDb('XP award via finalize_workout v3 (02E-01)', () => {
  let admin: AdminClient
  let userId1: string
  let userId2: string

  const stamp = Date.now()
  const cellA = `xp-cell-a-${stamp}`
  const cellB = `xp-cell-b-${stamp}`
  const contested = [cellA, cellB]

  // Short ~222m line (floors to 0 km) and a ~1.1km line (floors to 1 km).
  const shortLine = [
    { lat: 51.5, lng: -0.1 },
    { lat: 51.501, lng: -0.1 },
    { lat: 51.502, lng: -0.1 },
  ]
  const longLine = [
    { lat: 51.5, lng: -0.1 },
    { lat: 51.51, lng: -0.1 },
  ]

  let w1Xp = 0
  let w2Xp = 0

  beforeAll(async () => {
    admin = createClient<Database>(url, serviceKey)
    userId1 = await createTestUser(admin, 'a')
    userId2 = await createTestUser(admin, 'b')
  })

  afterAll(async () => {
    await admin.from('cell_ownership').delete().in('cell_id', contested)
    await admin.from('xp_events').delete().in('user_id', [userId1, userId2])
    await admin.from('user_xp').delete().in('user_id', [userId1, userId2])
    await admin.from('workouts').delete().in('user_id', [userId1, userId2]) // cascades territory_captures
    await admin.auth.admin.deleteUser(userId1)
    await admin.auth.admin.deleteUser(userId2)
  })

  it('first finalize: xp_awarded equals calculateTotalXP (parity) and writes events + user_xp', async () => {
    const w1 = await createWorkout(admin, userId1)
    await insertPoints(admin, w1, shortLine)

    const { data, error } = await finalize(admin, w1, contested, userId1)
    expect(error).toBeNull()
    expect(data?.cells_claimed).toBe(2)
    expect(data?.cells_stolen).toBe(0)

    // PARITY: the SQL award must equal the pure TS calc for the same inputs.
    const expected = calculateTotalXP({
      distanceM: data?.distance_m ?? 0,
      cellsClaimed: 2,
      cellsStolen: 0,
    })
    expect(data?.xp_awarded).toBe(expected) // 25 completion + 0 distance + 20 capture = 45
    w1Xp = expected

    // xp_events: a 'workout' row + a 'capture' row.
    const { data: events } = await admin
      .from('xp_events')
      .select('event_type, xp_awarded')
      .eq('workout_id', w1)
      .order('event_type')
    const byType = Object.fromEntries((events ?? []).map((e) => [e.event_type, e.xp_awarded]))
    expect(byType.workout).toBe(calculateWorkoutXP(data?.distance_m ?? 0))
    expect(byType.capture).toBe(20)
    expect(byType.steal).toBeUndefined() // no steal event when none stolen

    // user_xp: total + derived level.
    const { data: ux } = await admin
      .from('user_xp')
      .select('total_xp, level')
      .eq('user_id', userId1)
      .single()
    expect(ux?.total_xp).toBe(expected)
    expect(ux?.level).toBe(getLevelFromXP(expected))
  })

  it('distance XP: a >=1km workout adds floor(km) * 5', async () => {
    const w2 = await createWorkout(admin, userId1)
    await insertPoints(admin, w2, longLine)

    const { data, error } = await finalize(admin, w2, [], userId1)
    expect(error).toBeNull()
    expect(data?.distance_m).toBeGreaterThan(1000)

    const expected = calculateWorkoutXP(data?.distance_m ?? 0) // 25 + 5 = 30
    expect(data?.xp_awarded).toBe(expected)
    w2Xp = expected

    const { data: events } = await admin
      .from('xp_events')
      .select('event_type, xp_awarded')
      .eq('workout_id', w2)
    expect(events).toHaveLength(1) // workout only (no cells)
    expect(events?.[0].event_type).toBe('workout')
    expect(events?.[0].xp_awarded).toBe(expected)
  })

  it('XP aggregation: user_xp.total_xp accumulates across workouts', async () => {
    const { data: ux } = await admin
      .from('user_xp')
      .select('total_xp, level')
      .eq('user_id', userId1)
      .single()
    expect(ux?.total_xp).toBe(w1Xp + w2Xp)
    expect(ux?.level).toBe(getLevelFromXP(w1Xp + w2Xp))
  })

  it('steal XP: stealing another user\'s cells awards +25 each', async () => {
    // user1 owns cellA/cellB (from test 1). user2 runs through them => steal.
    const w3 = await createWorkout(admin, userId2)
    await insertPoints(admin, w3, shortLine)

    const { data, error } = await finalize(admin, w3, contested, userId2)
    expect(error).toBeNull()
    expect(data?.cells_stolen).toBe(2)
    expect(data?.cells_claimed).toBe(0)

    const expected = calculateTotalXP({
      distanceM: data?.distance_m ?? 0,
      cellsClaimed: 0,
      cellsStolen: 2,
    })
    expect(data?.xp_awarded).toBe(expected) // 25 + 0 + 50 = 75

    const { data: events } = await admin
      .from('xp_events')
      .select('event_type, xp_awarded')
      .eq('workout_id', w3)
    const byType = Object.fromEntries((events ?? []).map((e) => [e.event_type, e.xp_awarded]))
    expect(byType.steal).toBe(50)
  })

  it('duplicate prevention: re-finalizing a completed workout awards no extra XP', async () => {
    // Re-finalize user1's first workout (now completed).
    const { data: w1Row } = await admin
      .from('workouts')
      .select('id, xp_awarded')
      .eq('user_id', userId1)
      .eq('status', 'completed')
      .order('created_at')
      .limit(1)
      .single()
    const w1 = w1Row!.id

    const before = await admin.from('user_xp').select('total_xp').eq('user_id', userId1).single()
    const beforeEvents = await admin
      .from('xp_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId1)

    const { data, error } = await finalize(admin, w1, contested, userId1)
    expect(error).toBeNull()
    // Idempotent: returns the stored xp_awarded, awards nothing new.
    expect(data?.xp_awarded).toBe(w1Row?.xp_awarded)

    const after = await admin.from('user_xp').select('total_xp').eq('user_id', userId1).single()
    const afterEvents = await admin
      .from('xp_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId1)

    expect(after.data?.total_xp).toBe(before.data?.total_xp) // no change
    expect(afterEvents.count).toBe(beforeEvents.count) // no new events
  })
})
