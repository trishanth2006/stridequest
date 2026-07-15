import { queryGet, querySet, queryInvalidate } from '@/lib/queryCache'

beforeEach(() => {
  queryInvalidate('a')
  queryInvalidate('b')
  jest.restoreAllMocks()
})

describe('queryGet', () => {
  test('returns undefined for unknown key', () => {
    expect(queryGet('missing', 60_000)).toBeUndefined()
  })

  test('returns data when within stale window', () => {
    querySet('a', { score: 99 })
    expect(queryGet<{ score: number }>('a', 60_000)).toEqual({ score: 99 })
  })

  test('returns undefined when past stale window', () => {
    querySet('a', 'value')
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 61_000)
    expect(queryGet('a', 60_000)).toBeUndefined()
  })
})

describe('querySet', () => {
  test('overwrites previous value', () => {
    querySet('b', 'first')
    querySet('b', 'second')
    expect(queryGet('b', 60_000)).toBe('second')
  })
})

describe('queryInvalidate', () => {
  test('removes entry so next read returns undefined', () => {
    querySet('a', 'hello')
    queryInvalidate('a')
    expect(queryGet('a', 60_000)).toBeUndefined()
  })

  test('is a no-op for unknown key', () => {
    expect(() => queryInvalidate('ghost')).not.toThrow()
  })
})
