// Single source of truth for color tokens.
// Must remain CommonJS .js so tailwind.config.js can require() it (Node cannot require .ts).
module.exports = {
  background: '#0b0b0f',
  backgroundDeep: '#0a0a0e',

  surface: '#171717',
  surfaceAlt: '#1f1f1f',
  surfaceSunken: '#111111',
  surfaceMuted: '#262626',

  border: '#27272a',
  borderStrong: '#3f3f46',

  tint900: '#0f2219',
  tint950: '#0c1a10',
  tint975: '#0a1610',

  white: '#ffffff',
  black: '#000000',

  fg: '#ffffff',
  fgBright: '#e5e5e5',
  fgNeutral: '#d4d4d8',
  fgSecondary: '#a3a3a3',
  fgMuted: '#71717a',
  fgFaint: '#52525b',

  stone: '#78716c',
  gray: '#6b7280',
  silver: '#9ca3af',
  bronze: '#cd7c3a',

  primary: '#10b981',
  primaryDark: '#059669',
  primaryBright: '#34d399',
  primarySoft: '#6ee7b7',

  accent: '#f59e0b',
  accentBright: '#fbbf24',
  yellow: '#eab308',

  danger: '#ef4444',

  indigo: '#6366f1',
  indigoLight: '#818cf8',
  blue: '#3b82f6',

  instagram: '#E1306C',
  twitter: '#1DA1F2',
}
