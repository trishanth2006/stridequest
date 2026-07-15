import type { LeaderboardCategory } from './types'

export function formatLeaderboardValue(category: LeaderboardCategory, value: number): string {
  switch (category) {
    case 'xp':
      return `${value.toLocaleString()} XP`
    case 'territory':
      return `${value.toLocaleString()} cells`
    case 'distance':
      return value >= 1000
        ? `${(value / 1000).toFixed(1)} km`
        : `${value} m`
    case 'weekly':
      return `${value.toLocaleString()} XP`
  }
}

export function formatLeaderboardLabel(category: LeaderboardCategory): string {
  switch (category) {
    case 'xp':
      return 'XP'
    case 'territory':
      return 'Territory'
    case 'distance':
      return 'Distance'
    case 'weekly':
      return 'Weekly'
  }
}
