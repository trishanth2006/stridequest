/**
 * @jest-environment node
 *
 * Unit tests for the stopWorkout server action, updated for the 02D-05 trust
 * boundary (ADR Option A). The action now:
 *   1. verifies identity with the user-scoped client via auth.getUser(),
 *   2. preflights the workout (RLS-scoped) on the user-scoped client,
 *   3. switches to the service-role client to fetch route_points,
 *   4. derives the canonical cell set with captureCells() (pure TS),
 *   5. invokes the service-role-only finalize_workout RPC with cellIds + userId.
 */
import { stopWorkout } from '@/features/running/actions'

jest.mock('@/infrastructure/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/infrastructure/supabase/service-role', () => ({
  createServiceRoleClient: jest.fn(),
}))

jest.mock('@/features/running/services/finalize', () => ({
  finalizeWorkout: jest.fn(),
}))

jest.mock('@/features/territory/capture', () => ({
  captureCells: jest.fn(),
}))

import { createClient } from '@/infrastructure/supabase/server'
import { createServiceRoleClient } from '@/infrastructure/supabase/service-role'
import { finalizeWorkout } from '@/features/running/services/finalize'
import { captureCells } from '@/features/territory/capture'

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>
const mockCreateServiceRoleClient = createServiceRoleClient as jest.MockedFunction<typeof createServiceRoleClient>
const mockFinalizeWorkout = finalizeWorkout as jest.MockedFunction<typeof finalizeWorkout>
const mockCaptureCells = captureCells as jest.MockedFunction<typeof captureCells>

const initialState = { status: 'idle' as const }
const validId = '123e4567-e89b-12d3-a456-426614174000'
const userId = '987e6543-e21b-12d3-a456-426614174999'

type Workout = { id: string; status: string } | null
type RawPoint = { lat: number; lng: number; recorded_at: string; batch_seq: number; point_seq: number }

const samplePoints: RawPoint[] = [
  { lat: 51.5, lng: -0.1, recorded_at: '1970-01-01T00:00:01.000Z', batch_seq: 0, point_seq: 0 },
  { lat: 51.501, lng: -0.1, recorded_at: '1970-01-01T00:00:03.000Z', batch_seq: 0, point_seq: 1 },
]

const sampleMetrics = {
  workoutId: validId,
  status: 'completed' as const,
  distanceM: 5000,
  durationS: 1800,
  avgPaceSPerKm: 360,
  xpAwarded: null,
  cellsClaimed: 2,
  cellsStolen: 0,
  cellsDefended: 0,
}

function formData(workoutId: string): FormData {
  const fd = new FormData()
  fd.set('workoutId', workoutId)
  return fd
}

/** User-scoped client: auth.getUser() + a workouts preflight select. */
function mockUserClient(opts: {
  user?: { id: string } | null
  authError?: { message: string } | null
  workout?: Workout
  fetchError?: { code: string } | null
}) {
  const maybeSingle = jest.fn().mockResolvedValue({ data: opts.workout ?? null, error: opts.fetchError ?? null })
  const eq = jest.fn().mockReturnValue({ maybeSingle })
  const select = jest.fn().mockReturnValue({ eq })
  const from = jest.fn().mockReturnValue({ select })
  const getUser = jest.fn().mockResolvedValue({
    data: { user: opts.user === undefined ? { id: userId } : opts.user },
    error: opts.authError ?? null,
  })
  return { auth: { getUser }, from }
}

/**
 * Service-role client: only route_points is read. The action awaits the end of
 * a `.select().eq().order().order().order()` chain, so the builder is a
 * thenable that resolves to { data, error } when awaited.
 */
function mockAdminClient(opts: { points?: RawPoint[]; pointsError?: { message: string } | null }) {
  const result = { data: opts.points ?? [], error: opts.pointsError ?? null }
  const builder: Record<string, unknown> = {}
  builder.select = jest.fn().mockReturnValue(builder)
  builder.eq = jest.fn().mockReturnValue(builder)
  builder.order = jest.fn().mockReturnValue(builder)
  builder.then = (resolve: (v: typeof result) => unknown) => resolve(result)
  const from = jest.fn().mockReturnValue(builder)
  return { from }
}

/** Wire all four collaborators for a given scenario. */
function arrange(opts: {
  user?: { id: string } | null
  authError?: { message: string } | null
  workout?: Workout
  fetchError?: { code: string } | null
  points?: RawPoint[]
  pointsError?: { message: string } | null
  cells?: string[]
}) {
  const userClient = mockUserClient(opts)
  const adminClient = mockAdminClient(opts)
  mockCreateClient.mockResolvedValue(userClient as never)
  mockCreateServiceRoleClient.mockReturnValue(adminClient as never)
  mockCaptureCells.mockReturnValue(opts.cells ?? ['cellA', 'cellB'])
  return { userClient, adminClient }
}

describe('stopWorkout (02D-05: service-role trust boundary)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rejects an invalid workoutId before touching the database', async () => {
    const result = await stopWorkout(initialState, formData('not-a-uuid'))
    expect(result.status).toBe('error')
    expect(mockCreateClient).not.toHaveBeenCalled()
    expect(mockCreateServiceRoleClient).not.toHaveBeenCalled()
  })

  it('returns "Not authenticated" when getUser yields no user (no preflight, no RPC)', async () => {
    const { userClient } = arrange({ user: null, workout: { id: validId, status: 'recording' } })

    const result = await stopWorkout(initialState, formData(validId))

    expect(userClient.auth.getUser).toHaveBeenCalled()
    expect(result).toEqual({ status: 'error', error: 'Not authenticated' })
    expect(mockCreateServiceRoleClient).not.toHaveBeenCalled()
    expect(mockFinalizeWorkout).not.toHaveBeenCalled()
  })

  it('FR-WL-3: recording workout — fetches points, derives cells, calls the service-role RPC, returns metrics', async () => {
    const cells = ['cellA', 'cellB']
    const { adminClient } = arrange({
      workout: { id: validId, status: 'recording' },
      points: samplePoints,
      cells,
    })
    mockFinalizeWorkout.mockResolvedValue(sampleMetrics)

    const result = await stopWorkout(initialState, formData(validId))

    // route_points fetched on the service-role client
    expect(mockCreateServiceRoleClient).toHaveBeenCalledTimes(1)
    expect(adminClient.from).toHaveBeenCalledWith('route_points')

    // captureCells invoked with the mapped (camelCase) route points
    expect(mockCaptureCells).toHaveBeenCalledWith([
      { lat: 51.5, lng: -0.1, recordedAt: '1970-01-01T00:00:01.000Z', batchSeq: 0, pointSeq: 0 },
      { lat: 51.501, lng: -0.1, recordedAt: '1970-01-01T00:00:03.000Z', batchSeq: 0, pointSeq: 1 },
    ])

    // RPC invoked via the service-role client with derived cells + verified uid
    expect(mockFinalizeWorkout).toHaveBeenCalledWith(adminClient, validId, cells, userId)

    expect(result).toEqual({ status: 'success', workoutId: validId, metrics: sampleMetrics })
  })

  it('passes the verified getUser id (not a client-supplied value) as the RPC userId', async () => {
    const { adminClient } = arrange({
      user: { id: userId },
      workout: { id: validId, status: 'recording' },
      points: samplePoints,
      cells: ['c1'],
    })
    mockFinalizeWorkout.mockResolvedValue(sampleMetrics)

    await stopWorkout(initialState, formData(validId))

    expect(mockFinalizeWorkout).toHaveBeenCalledWith(adminClient, validId, ['c1'], userId)
  })

  it('returns server-computed distance and duration from the RPC metrics', async () => {
    arrange({ workout: { id: validId, status: 'recording' }, points: samplePoints })
    mockFinalizeWorkout.mockResolvedValue({ ...sampleMetrics, distanceM: 3456, durationS: 1234, avgPaceSPerKm: 357 })

    const result = await stopWorkout(initialState, formData(validId))

    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.metrics?.distanceM).toBe(3456)
      expect(result.metrics?.durationS).toBe(1234)
      expect(result.metrics?.avgPaceSPerKm).toBe(357)
    }
  })

  it('FR-RP-4: a completed workout still finalizes (RPC returns the stored record)', async () => {
    const { adminClient } = arrange({
      workout: { id: validId, status: 'completed' },
      points: samplePoints,
      cells: ['cellA', 'cellB'],
    })
    mockFinalizeWorkout.mockResolvedValue(sampleMetrics)

    const result = await stopWorkout(initialState, formData(validId))

    expect(mockFinalizeWorkout).toHaveBeenCalledWith(adminClient, validId, ['cellA', 'cellB'], userId)
    expect(result).toEqual({
      status: 'success',
      workoutId: validId,
      metrics: expect.objectContaining({ status: 'completed', distanceM: 5000 }),
    })
  })

  it('rejects a discarded workout without switching to the service-role client', async () => {
    arrange({ workout: { id: validId, status: 'discarded' } })

    const result = await stopWorkout(initialState, formData(validId))

    expect(result.status).toBe('error')
    expect(mockCreateServiceRoleClient).not.toHaveBeenCalled()
    expect(mockCaptureCells).not.toHaveBeenCalled()
    expect(mockFinalizeWorkout).not.toHaveBeenCalled()
  })

  it('returns a not-found error when the workout is invisible (RLS) or missing', async () => {
    arrange({ workout: null })

    const result = await stopWorkout(initialState, formData(validId))

    expect(result.status).toBe('error')
    expect(result.status === 'error' && result.error).toMatch(/not found/i)
    expect(mockCreateServiceRoleClient).not.toHaveBeenCalled()
    expect(mockFinalizeWorkout).not.toHaveBeenCalled()
  })

  it('returns a generic error when the preflight fetch fails', async () => {
    arrange({ workout: null, fetchError: { code: '42P01' } })

    const result = await stopWorkout(initialState, formData(validId))

    expect(result.status).toBe('error')
    expect(mockCreateServiceRoleClient).not.toHaveBeenCalled()
    expect(mockFinalizeWorkout).not.toHaveBeenCalled()
  })

  it('returns a generic error when the route_points fetch fails (no capture, no RPC)', async () => {
    arrange({
      workout: { id: validId, status: 'recording' },
      pointsError: { message: 'boom' },
    })

    const result = await stopWorkout(initialState, formData(validId))

    expect(result.status).toBe('error')
    expect(result.status === 'error' && result.error).toMatch(/could not stop/i)
    expect(mockCaptureCells).not.toHaveBeenCalled()
    expect(mockFinalizeWorkout).not.toHaveBeenCalled()
  })

  it('returns a generic error (no internal leak) when the RPC throws', async () => {
    arrange({ workout: { id: validId, status: 'recording' }, points: samplePoints })
    mockFinalizeWorkout.mockRejectedValue(new Error('connection refused'))

    const result = await stopWorkout(initialState, formData(validId))

    expect(result.status).toBe('error')
    expect(result.status === 'error' && result.error).toMatch(/could not stop/i)
  })
})
