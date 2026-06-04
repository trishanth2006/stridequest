/**
 * @jest-environment node
 *
 * Unit tests for the read-side territory ownership service (02D-06).
 * The service is pure query logic over an injected Supabase client; these tests
 * mock the client and assert the queries issued + the domain mapping. No DB.
 */
import {
  getOwnedCells,
  getCellOwnership,
  getOwnershipStats,
} from '@/features/territory/services/ownership'

const userId = '987e6543-e21b-12d3-a456-426614174999'

// Raw cell_ownership rows (snake_case), as PostgREST returns them.
const rows = [
  { cell_id: '8928308280fffff', owner_user_id: userId, owned_since_workout_id: 'w1', updated_at: '2026-06-04T10:00:00Z' },
  { cell_id: '8928308281fffff', owner_user_id: userId, owned_since_workout_id: 'w2', updated_at: '2026-06-04T11:00:00Z' },
]

// Expected camelCase domain shapes (TerritoryOwnership).
const domain = [
  { cellId: '8928308280fffff', ownerUserId: userId, ownedSinceWorkoutId: 'w1', updatedAt: '2026-06-04T10:00:00Z' },
  { cellId: '8928308281fffff', ownerUserId: userId, ownedSinceWorkoutId: 'w2', updatedAt: '2026-06-04T11:00:00Z' },
]

type ListResult = { data: typeof rows | null; error: { message: string } | null }
type CountResult = { count: number | null; error: { message: string } | null }

/**
 * A chainable, thenable Supabase mock. Every builder method returns the same
 * builder; awaiting the builder (at any chain end) resolves to `result`. This
 * covers all three query shapes (select→eq→order, select→in→order,
 * select(count,head)→eq).
 */
function mockSupabase(result: ListResult | CountResult) {
  const builder: Record<string, unknown> = {}
  builder.select = jest.fn(() => builder)
  builder.eq = jest.fn(() => builder)
  builder.in = jest.fn(() => builder)
  builder.order = jest.fn(() => builder)
  builder.then = (resolve: (v: ListResult | CountResult) => unknown) => resolve(result)
  const from = jest.fn(() => builder)
  return { client: { from }, from, builder }
}

describe('getOwnedCells (02D-06)', () => {
  it('returns an empty array when the user owns no cells', async () => {
    const { client } = mockSupabase({ data: [], error: null })
    const result = await getOwnedCells(client as never, userId)
    expect(result).toEqual([])
  })

  it('returns owned cells mapped to TerritoryOwnership, filtered by owner_user_id', async () => {
    const { client, from, builder } = mockSupabase({ data: rows, error: null })

    const result = await getOwnedCells(client as never, userId)

    expect(from).toHaveBeenCalledWith('cell_ownership')
    expect(builder.eq).toHaveBeenCalledWith('owner_user_id', userId)
    expect(result).toEqual(domain)
  })

  it('propagates a DB error by throwing', async () => {
    const { client } = mockSupabase({ data: null, error: { message: 'connection failed' } })
    await expect(getOwnedCells(client as never, userId)).rejects.toThrow('connection failed')
  })
})

describe('getCellOwnership (02D-06)', () => {
  it('returns ownership for the requested cells, queried with an IN filter', async () => {
    const { client, from, builder } = mockSupabase({ data: rows, error: null })
    const cellIds = ['8928308280fffff', '8928308281fffff']

    const result = await getCellOwnership(client as never, cellIds)

    expect(from).toHaveBeenCalledWith('cell_ownership')
    expect(builder.in).toHaveBeenCalledWith('cell_id', cellIds)
    expect(result).toEqual(domain)
  })

  it('returns unowned cells as simply absent from the result (no row, no error)', async () => {
    // Only one of the two requested cells is owned.
    const { client } = mockSupabase({ data: [rows[0]], error: null })
    const result = await getCellOwnership(client as never, ['8928308280fffff', 'unowned-cell'])
    expect(result).toEqual([domain[0]])
  })

  it('short-circuits to [] for an empty cell list without querying', async () => {
    const { client, from } = mockSupabase({ data: rows, error: null })
    const result = await getCellOwnership(client as never, [])
    expect(result).toEqual([])
    expect(from).not.toHaveBeenCalled()
  })

  it('propagates a DB error by throwing', async () => {
    const { client } = mockSupabase({ data: null, error: { message: 'boom' } })
    await expect(getCellOwnership(client as never, ['8928308280fffff'])).rejects.toThrow('boom')
  })
})

describe('getOwnershipStats (02D-06)', () => {
  it('returns the total owned-cell count for the user', async () => {
    const { client, from, builder } = mockSupabase({ count: 7, error: null })

    const result = await getOwnershipStats(client as never, userId)

    expect(from).toHaveBeenCalledWith('cell_ownership')
    expect(builder.eq).toHaveBeenCalledWith('owner_user_id', userId)
    expect(result).toEqual({ totalCells: 7 })
  })

  it('returns zero when the user owns no cells (null count)', async () => {
    const { client } = mockSupabase({ count: null, error: null })
    const result = await getOwnershipStats(client as never, userId)
    expect(result).toEqual({ totalCells: 0 })
  })

  it('propagates a DB error by throwing', async () => {
    const { client } = mockSupabase({ count: null, error: { message: 'count failed' } })
    await expect(getOwnershipStats(client as never, userId)).rejects.toThrow('count failed')
  })
})
