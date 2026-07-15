import { colors, withAlpha } from '@/theme'

describe('color tokens', () => {
  it('exposes every token at its exact original hex', () => {
    expect(colors.background).toBe('#0b0b0f')
    expect(colors.backgroundDeep).toBe('#0a0a0e')

    expect(colors.surface).toBe('#171717')
    expect(colors.surfaceAlt).toBe('#1f1f1f')
    expect(colors.surfaceSunken).toBe('#111111')
    expect(colors.surfaceMuted).toBe('#262626')

    expect(colors.border).toBe('#27272a')
    expect(colors.borderStrong).toBe('#3f3f46')

    expect(colors.tint900).toBe('#0f2219')
    expect(colors.tint950).toBe('#0c1a10')
    expect(colors.tint975).toBe('#0a1610')

    expect(colors.white).toBe('#ffffff')
    expect(colors.black).toBe('#000000')

    expect(colors.fg).toBe('#ffffff')
    expect(colors.fgBright).toBe('#e5e5e5')
    expect(colors.fgNeutral).toBe('#d4d4d8')
    expect(colors.fgSecondary).toBe('#a3a3a3')
    expect(colors.fgMuted).toBe('#71717a')
    expect(colors.fgFaint).toBe('#52525b')

    expect(colors.stone).toBe('#78716c')
    expect(colors.gray).toBe('#6b7280')
    expect(colors.silver).toBe('#9ca3af')
    expect(colors.bronze).toBe('#cd7c3a')

    expect(colors.primary).toBe('#10b981')
    expect(colors.primaryDark).toBe('#059669')
    expect(colors.primaryBright).toBe('#34d399')
    expect(colors.primarySoft).toBe('#6ee7b7')

    expect(colors.accent).toBe('#f59e0b')
    expect(colors.accentBright).toBe('#fbbf24')
    expect(colors.yellow).toBe('#eab308')

    expect(colors.danger).toBe('#ef4444')

    expect(colors.indigo).toBe('#6366f1')
    expect(colors.indigoLight).toBe('#818cf8')
    expect(colors.blue).toBe('#3b82f6')

    expect(colors.instagram).toBe('#E1306C')
    expect(colors.twitter).toBe('#1DA1F2')
  })

  it('formats rgba strings exactly as used across the codebase', () => {
    expect(withAlpha(colors.primary, 0.15)).toBe('rgba(16,185,129,0.15)')
    expect(withAlpha(colors.white, 0.06)).toBe('rgba(255,255,255,0.06)')
    expect(withAlpha(colors.black, 0.5)).toBe('rgba(0,0,0,0.5)')
    expect(withAlpha(colors.accent, 0.25)).toBe('rgba(245,158,11,0.25)')
    expect(withAlpha(colors.primary, 0)).toBe('rgba(16,185,129,0)')
    expect(withAlpha(colors.background, 0.85)).toBe('rgba(11,11,15,0.85)')
  })
})
