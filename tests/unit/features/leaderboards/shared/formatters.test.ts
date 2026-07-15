/**
 * @jest-environment node
 */
import { formatLeaderboardValue, formatLeaderboardLabel } from '@stridequest/shared/leaderboards'

describe('formatLeaderboardValue', () => {
  it('xp: formats with locale separator and XP suffix', () => {
    expect(formatLeaderboardValue('xp', 1250)).toBe('1,250 XP')
  })

  it('territory: formats as "N cells"', () => {
    expect(formatLeaderboardValue('territory', 47)).toBe('47 cells')
  })

  it('distance: formats as km (1 decimal) when >= 1000m', () => {
    expect(formatLeaderboardValue('distance', 5000)).toBe('5.0 km')
  })

  it('distance: formats as meters when < 1000m', () => {
    expect(formatLeaderboardValue('distance', 800)).toBe('800 m')
  })

  it('distance: exactly 1000m formats as km', () => {
    expect(formatLeaderboardValue('distance', 1000)).toBe('1.0 km')
  })

  it('weekly: formats with locale separator and XP suffix', () => {
    expect(formatLeaderboardValue('weekly', 300)).toBe('300 XP')
  })
})

describe('formatLeaderboardLabel', () => {
  it.each([
    ['xp', 'XP'],
    ['territory', 'Territory'],
    ['distance', 'Distance'],
    ['weekly', 'Weekly'],
  ] as const)('%s → %s', (category, label) => {
    expect(formatLeaderboardLabel(category)).toBe(label)
  })
})
