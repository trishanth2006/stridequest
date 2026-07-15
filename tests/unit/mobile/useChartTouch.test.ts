import {
  chartFindClosest,
  chartIndexToPixelX,
} from '../../../apps/mobile/src/components/charts/useChartTouch'
import type { ChartPoint } from '../../../apps/mobile/src/components/charts/LineChart'

// PAD_X = 8, matching the CHART_PAD_X constant in useChartTouch.ts
const PAD_X = 8

// Five evenly-spaced data points spanning x = 0..4
const DATA: ChartPoint[] = [
  { x: 0, y: 10 },
  { x: 1, y: 20 },
  { x: 2, y: 15 },
  { x: 3, y: 25 },
  { x: 4, y: 5 },
]
const CHART_WIDTH = 108 // drawW = 108 - 8*2 = 92

describe('chartFindClosest', () => {
  it('returns -1 when data has fewer than 2 points', () => {
    expect(chartFindClosest(50, [], CHART_WIDTH)).toBe(-1)
    expect(chartFindClosest(50, [{ x: 0, y: 0 }], CHART_WIDTH)).toBe(-1)
  })

  it('finds index 0 at the leftmost touch position', () => {
    // pixelX = PAD_X maps to t=0 → dataX = minX → closest to index 0
    expect(chartFindClosest(PAD_X, DATA, CHART_WIDTH)).toBe(0)
  })

  it('finds the last index at the rightmost touch position', () => {
    // pixelX = CHART_WIDTH - PAD_X maps to t=1 → dataX = maxX → last index
    expect(chartFindClosest(CHART_WIDTH - PAD_X, DATA, CHART_WIDTH)).toBe(4)
  })

  it('finds the middle index at the midpoint touch position', () => {
    // midpoint pixel = PAD_X + drawW/2 = 8 + 46 = 54
    // t=0.5 → dataX = 0 + 0.5*4 = 2 → index 2
    const mid = PAD_X + (CHART_WIDTH - PAD_X * 2) / 2
    expect(chartFindClosest(mid, DATA, CHART_WIDTH)).toBe(2)
  })

  it('clamps to nearest edge index when touch is outside chart bounds', () => {
    // pixelX < PAD_X → t clamped to 0 → index 0
    expect(chartFindClosest(0, DATA, CHART_WIDTH)).toBe(0)
    // pixelX > chartWidth → t clamped to 1 → last index
    expect(chartFindClosest(CHART_WIDTH + 20, DATA, CHART_WIDTH)).toBe(4)
  })
})

describe('chartIndexToPixelX', () => {
  it('returns PAD_X for a negative out-of-bounds index', () => {
    expect(chartIndexToPixelX(-1, DATA, CHART_WIDTH)).toBe(PAD_X)
  })

  it('returns PAD_X for an index >= data.length', () => {
    expect(chartIndexToPixelX(DATA.length, DATA, CHART_WIDTH)).toBe(PAD_X)
    expect(chartIndexToPixelX(99, DATA, CHART_WIDTH)).toBe(PAD_X)
  })

  it('maps index 0 to the leftmost pixel (PAD_X)', () => {
    expect(chartIndexToPixelX(0, DATA, CHART_WIDTH)).toBe(PAD_X)
  })

  it('maps the last index to the rightmost pixel (CHART_WIDTH - PAD_X)', () => {
    expect(chartIndexToPixelX(DATA.length - 1, DATA, CHART_WIDTH)).toBe(CHART_WIDTH - PAD_X)
  })

  it('round-trips with chartFindClosest for every data index', () => {
    for (let i = 0; i < DATA.length; i++) {
      const pixel = chartIndexToPixelX(i, DATA, CHART_WIDTH)
      expect(chartFindClosest(pixel, DATA, CHART_WIDTH)).toBe(i)
    }
  })
})
