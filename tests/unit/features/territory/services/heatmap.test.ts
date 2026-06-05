/**
 * @jest-environment node
 *
 * Unit tests for the read-side territory heatmap service (02D-07B).
 * Aggregates the signed-in user's own `territory_captures` rows (RLS-scoped) by
 * cell into capture-frequency counts. Pure query logic over an injected client;
 * no DB. Read-only — no captures, ownership, XP, or mutations are touched.
 */
import {
  getCellCaptureCounts,
  getUserHeatmap,
  heatmapSummary,
} from '@/features/territory/services/heatmap'

const userId = '987e6543-e21b-12d3-a456-426614174999'

/** Raw territory_captures rows (only cell_id is selected by the service). */
function captureRows(cells: string[]) {
  return cells.map((cell_id) => ({ cell_id }))
}

/**
 * Chainable thenable Supabase mock: from→select→eq resolves to `result`.
 * `eq` is exposed so tests can assert the owner filter.
 */
function mockSupabase(result: { data: { cell_id: string }[] | null; error: { message: string } | null }) {
  const builder: Record<string, unknown> = {}
  builder.select = jest.fn(() => builder)
  builder.eq = jest.fn(() => builder)
  builder.then = (resolve: (v: typeof result) => unknown) => resolve(result)
  const from = jest.fn(() => builder)
  return { client: { from }, from, builder }
}

describe('getCellCaptureCounts (02D-07B)', () => {
  it('returns [] when the user has no captures', async () => {
    const { client } = mockSupabase({ data: [], error: null })
    expect(await getCellCaptureCounts(client as never, userId)).toEqual([])
  })

  it('aggregates capture rows into per-cell counts, scoped to the user', async () => {
    // cellA x3, cellB x1, cellC x2 (interleaved to prove grouping, not row order).
    const rows = captureRows(['cellA', 'cellB', 'cellA', 'cellC', 'cellA', 'cellC'])
    const { client, from, builder } = mockSupabase({ data: rows, error: null })

    const result = await getCellCaptureCounts(client as never, userId)

    expect(from).toHaveBeenCalledWith('territory_captures')
    expect(builder.eq).toHaveBeenCalledWith('user_id', userId)
    // Sorted by captures desc, then cellId asc for stable ties.
    expect(result).toEqual([
      { cellId: 'cellA', captures: 3 },
      { cellId: 'cellC', captures: 2 },
      { cellId: 'cellB', captures: 1 },
    ])
  })

  it('sorts ties by cellId ascending for deterministic output', async () => {
    const rows = captureRows(['z', 'a', 'm']) // all count 1
    const { client } = mockSupabase({ data: rows, error: null })
    const result = await getCellCaptureCounts(client as never, userId)
    expect(result.map((c) => c.cellId)).toEqual(['a', 'm', 'z'])
  })

  it('propagates a DB error by throwing', async () => {
    const { client } = mockSupabase({ data: null, error: { message: 'boom' } })
    await expect(getCellCaptureCounts(client as never, userId)).rejects.toThrow('boom')
  })
})

describe('getUserHeatmap (02D-07B)', () => {
  it('returns the user capture-frequency heatmap (delegates to getCellCaptureCounts)', async () => {
    const rows = captureRows(['cellA', 'cellA', 'cellB'])
    const { client, from } = mockSupabase({ data: rows, error: null })

    const result = await getUserHeatmap(client as never, userId)

    expect(from).toHaveBeenCalledWith('territory_captures')
    expect(result).toEqual([
      { cellId: 'cellA', captures: 2 },
      { cellId: 'cellB', captures: 1 },
    ])
  })
})

describe('heatmapSummary (02D-07B)', () => {
  it('returns zero totals and no top cell for an empty heatmap', () => {
    expect(heatmapSummary([])).toEqual({ totalCaptures: 0, mostCapturedCell: null })
  })

  it('sums captures and identifies the most-captured cell', () => {
    const cells = [
      { cellId: 'cellA', captures: 3 },
      { cellId: 'cellC', captures: 2 },
      { cellId: 'cellB', captures: 1 },
    ]
    expect(heatmapSummary(cells)).toEqual({
      totalCaptures: 6,
      mostCapturedCell: { cellId: 'cellA', captures: 3 },
    })
  })
})
