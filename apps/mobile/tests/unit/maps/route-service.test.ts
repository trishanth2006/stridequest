import { fetchRoutePoints } from '@/features/maps/services/route'

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}))

import { supabase } from '@/lib/supabase'
const mockFrom = supabase.from as jest.Mock

type MockResult = { data: unknown; error: { message: string } | null }

function makeChain(result: MockResult) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    then: (resolve: (val: MockResult) => unknown) => Promise.resolve(result).then(resolve),
  }
  mockFrom.mockReturnValue(chain)
  return chain
}

describe('fetchRoutePoints', () => {
  it('returns lat/lng pairs for a workout with route data', async () => {
    makeChain({
      data: [
        { lat: 37.77, lng: -122.42 },
        { lat: 37.78, lng: -122.41 },
      ],
      error: null,
    })
    const result = await fetchRoutePoints('workout-123')
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ lat: 37.77, lng: -122.42 })
  })

  it('returns empty array when no route data exists', async () => {
    makeChain({ data: [], error: null })
    const result = await fetchRoutePoints('workout-no-gps')
    expect(result).toEqual([])
  })

  it('returns empty array on Supabase error', async () => {
    makeChain({ data: null, error: { message: 'permission denied' } })
    const result = await fetchRoutePoints('workout-err')
    expect(result).toEqual([])
  })
})
