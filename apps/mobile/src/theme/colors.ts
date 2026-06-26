import palette from './palette'

export const colors = palette

/**
 * Converts a 6-digit `#rrggbb` hex string into an rgba() string with no spaces,
 * matching the exact format already used across the codebase.
 * e.g. withAlpha('#10b981', 0.15) === 'rgba(16,185,129,0.15)'
 */
export function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
