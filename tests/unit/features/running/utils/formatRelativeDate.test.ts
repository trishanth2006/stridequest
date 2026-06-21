/**
 * @jest-environment node
 */
import { formatRelativeDate } from '../../../../../apps/mobile/src/features/running/utils/formatRelativeDate'

const DAY_MS = 24 * 60 * 60 * 1000

function isoAt(offsetDays: number): string {
  return new Date(Date.now() - offsetDays * DAY_MS).toISOString()
}

describe('formatRelativeDate', () => {
  it('returns "Today" for a timestamp from earlier today', () => {
    const result = formatRelativeDate(isoAt(0))
    expect(result).toBe('Today')
  })

  it('returns "Yesterday" for a timestamp from ~1 day ago', () => {
    const result = formatRelativeDate(isoAt(1))
    expect(result).toBe('Yesterday')
  })

  it('returns a locale date string for timestamps older than yesterday', () => {
    const twoWeeksAgo = isoAt(14)
    const result = formatRelativeDate(twoWeeksAgo)
    expect(result).not.toBe('Today')
    expect(result).not.toBe('Yesterday')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns a locale date string for a specific older date', () => {
    const ts = '2026-01-15T10:00:00Z'
    const result = formatRelativeDate(ts)
    expect(result).not.toBe('Today')
    expect(result).not.toBe('Yesterday')
    expect(typeof result).toBe('string')
  })
})
