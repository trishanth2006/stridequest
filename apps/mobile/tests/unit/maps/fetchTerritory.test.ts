import { fetchTerritory } from '@/features/maps/services/territory'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'user-123' } },
      }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({
        data: [{ cell_id: '8928308280fffff' }],
        error: null,
      }),
    }),
  },
}))

jest.mock('@stridequest/shared/territory', () => ({
  cellsToFeatureCollection: (ids: string[]) => ({
    type: 'FeatureCollection',
    features: ids.map((id) => ({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[]] },
      properties: { cellId: id },
    })),
  }),
}))

describe('fetchTerritory', () => {
  it('passes owner_user_id filter to cell_ownership query', async () => {
    const { supabase } = jest.requireMock('@/lib/supabase') as {
      supabase: { from: jest.Mock }
    }
    await fetchTerritory({ scope: 'me' })
    const chainedEq = supabase.from('cell_ownership').select('cell_id').eq as jest.Mock
    expect(chainedEq.mock.calls).toContainEqual(['owner_user_id', 'user-123'])
  })

  it('returns empty collection when unauthenticated', async () => {
    const { supabase } = jest.requireMock('@/lib/supabase') as {
      supabase: { auth: { getUser: jest.Mock } }
    }
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: null } })
    const result = await fetchTerritory({ scope: 'me' })
    expect(result.features).toHaveLength(0)
  })
})
