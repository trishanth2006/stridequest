import { formatRelativeDate } from '../../src/features/running/utils/formatRelativeDate'

describe('formatRelativeDate', () => {
  const todayStart = () => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }

  it('returns "Today" for a timestamp earlier today', () => {
    const d = todayStart()
    d.setHours(9, 30, 0, 0)
    expect(formatRelativeDate(d.toISOString())).toBe('Today')
  })

  it('returns "Yesterday" for a timestamp yesterday', () => {
    const d = todayStart()
    d.setDate(d.getDate() - 1)
    d.setHours(14, 0, 0, 0)
    expect(formatRelativeDate(d.toISOString())).toBe('Yesterday')
  })

  it('returns a formatted date for older timestamps', () => {
    const d = new Date(2024, 0, 15) // Jan 15 2024
    const result = formatRelativeDate(d.toISOString())
    expect(result).not.toBe('Today')
    expect(result).not.toBe('Yesterday')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})
