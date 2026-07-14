/**
 * Display typography tokens — Barlow Condensed, reserved exclusively for
 * hero numerals (run distance, streak counts, rank numbers, stat values).
 * Body text stays on the system font for readability.
 *
 * The family name encodes the weight, so styles using these must NOT also
 * set fontWeight (Android ignores it and can fake-bold the glyphs).
 * Pair with fontVariant: ['tabular-nums'] for stable ticking layouts.
 */
export const fonts = {
  display: 'BarlowCondensed_700Bold',
  displayHeavy: 'BarlowCondensed_800ExtraBold',
} as const
