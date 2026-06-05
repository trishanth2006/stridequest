export interface Size {
  w: number
  h: number
}

/**
 * Returns the scale factor that fits a card of `card` dimensions entirely
 * within `area`, preserving aspect ratio. Caps at 1 (never upscales beyond
 * native) is intentionally NOT applied — the preview may upscale small cards
 * to fill the area; the export always uses native dimensions regardless.
 */
export function computeFitScale(area: Size, card: Size): number {
  if (card.w <= 0 || card.h <= 0) return 1
  return Math.min(area.w / card.w, area.h / card.h)
}
