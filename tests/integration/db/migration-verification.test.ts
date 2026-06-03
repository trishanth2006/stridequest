/**
 * @jest-environment node
 *
 * Integration test: touches the live database and therefore runs only when
 * service-role credentials are supplied. Without them the suite is skipped so
 * `npm test` stays green in environments that have no DB connection.
 *
 * NOTE: authoritative migration verification (extension, columns, indexes,
 * constraints, RLS policies) is performed via MCP introspection per the Phase
 * 02 testing strategy (§5: "100% verification ... not coverage in the Jest
 * sense"). PostgREST cannot introspect the catalog, so this file asserts only
 * the behaviour reachable through the client: table reachability and that RLS
 * hides rows from the anonymous role.
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const anonKey =
  process.env.SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  ''

const describeDb = url && serviceKey ? describe : describe.skip

describeDb('02A migration verification: workouts', () => {
  // Constructed in beforeAll, not at the describe-body top level: Jest evaluates
  // a skipped describe's body but does not run its hooks, so this avoids
  // createClient() throwing when credentials are absent.
  let admin: ReturnType<typeof createClient>

  beforeAll(() => {
    admin = createClient(url, serviceKey)
  })

  it('workouts table exists and is reachable by the service role', async () => {
    const { error } = await admin.from('workouts').select('id').limit(0)
    expect(error).toBeNull()
  })

  it('RLS hides workouts from the anonymous role', async () => {
    if (!anonKey) {
      throw new Error('SUPABASE_ANON_KEY required to assert RLS behaviour')
    }
    const anon = createClient(url, anonKey)
    const { data, error } = await anon.from('workouts').select('id')
    expect(error).toBeNull()
    expect(data).toEqual([])
  })
})

describeDb('02B-01 migration verification: route_points', () => {
  let admin: ReturnType<typeof createClient>

  beforeAll(() => {
    admin = createClient(url, serviceKey)
  })

  it('route_points table exists and is reachable by the service role', async () => {
    const { error } = await admin.from('route_points').select('id').limit(0)
    expect(error).toBeNull()
  })

  it('RLS hides route_points from the anonymous role', async () => {
    if (!anonKey) {
      throw new Error('SUPABASE_ANON_KEY required to assert RLS behaviour')
    }
    const anon = createClient(url, anonKey)
    const { data, error } = await anon.from('route_points').select('id')
    expect(error).toBeNull()
    expect(data).toEqual([])
  })
})

describeDb('02D-01 migration verification: territory tables', () => {
  let admin: ReturnType<typeof createClient>

  beforeAll(() => {
    admin = createClient(url, serviceKey)
  })

  it('territory_captures table exists and is reachable by the service role', async () => {
    const { error } = await admin.from('territory_captures').select('id').limit(0)
    expect(error).toBeNull()
  })

  it('cell_ownership table exists and is reachable by the service role', async () => {
    const { error } = await admin.from('cell_ownership').select('cell_id').limit(0)
    expect(error).toBeNull()
  })
})
