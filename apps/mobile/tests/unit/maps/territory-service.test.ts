import { fetchTerritory } from '@/features/maps/services/territory'

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}))

jest.mock('h3-js', () => ({
  cellToBoundary: jest.fn(() => [
    [37.77, -122.42],
    [37.78, -122.42],
    [37.78, -122.41],
    [37.77, -122.41],
    [37.76, -122.41],
    [37.76, -122.42],
  ]),
  latLngToCell: jest.fn(() => 'mock-cell'),
  gridPathCells: jest.fn((f: string, t: string) => [f, t]),
  isValidCell: jest.fn(() => true),
}))

import { supabase } from '@/lib/supabase'
const mockFrom = supabase.from as jest.Mock

type MockResult = { data: unknown; error: { message: string } | null }

function makeChain(result: MockResult) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    then: (resolve: (val: MockResult) => unknown) => Promise.resolve(result).then(resolve),
  }
  mockFrom.mockReturnValue(chain)
  return chain
}

describe('fetchTerritory', () => {
  it('returns a FeatureCollection with one feature per owned cell', async () => {
    makeChain({ data: [{ cell_id: 'cell-aaa' }, { cell_id: 'cell-bbb' }], error: null })
    const result = await fetchTerritory({ scope: 'me' })
    expect(result.type).toBe('FeatureCollection')
    expect(result.features).toHaveLength(2)
  })

  it('returns empty FeatureCollection when user owns no cells', async () => {
    makeChain({ data: [], error: null })
    const result = await fetchTerritory({ scope: 'me' })
    expect(result.type).toBe('FeatureCollection')
    expect(result.features).toHaveLength(0)
  })

  it('returns empty FeatureCollection on Supabase error', async () => {
    makeChain({ data: null, error: { message: 'rls violation' } })
    const result = await fetchTerritory({ scope: 'me' })
    expect(result.features).toHaveLength(0)
  })
})
