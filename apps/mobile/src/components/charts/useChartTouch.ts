import { useRef, useState } from 'react'
import { PanResponder } from 'react-native'
import { useSharedValue } from 'react-native-reanimated'
import type { ChartPoint } from './LineChart'

export type { ChartPoint }

// Must match the PAD_X constant in LineChart.tsx and AreaChart.tsx
const CHART_PAD_X = 8

// ── Pure coordinate utilities (module-level, no stale-closure risk) ──────────

export function chartFindClosest(
  pixelX: number,
  data: ChartPoint[],
  chartWidth: number,
): number {
  if (data.length < 2) return -1
  const minX = Math.min(...data.map((p) => p.x))
  const maxX = Math.max(...data.map((p) => p.x))
  const rangeX = maxX - minX || 1
  const drawW = chartWidth - CHART_PAD_X * 2
  const t = Math.max(0, Math.min(1, (pixelX - CHART_PAD_X) / drawW))
  const dataX = minX + t * rangeX
  let closest = 0
  let minDist = Infinity
  data.forEach((p, i) => {
    const dist = Math.abs(p.x - dataX)
    if (dist < minDist) { minDist = dist; closest = i }
  })
  return closest
}

export function chartIndexToPixelX(
  idx: number,
  data: ChartPoint[],
  chartWidth: number,
): number {
  if (idx < 0 || idx >= data.length) return CHART_PAD_X
  const minX = Math.min(...data.map((p) => p.x))
  const maxX = Math.max(...data.map((p) => p.x))
  const rangeX = maxX - minX || 1
  const drawW = chartWidth - CHART_PAD_X * 2
  return CHART_PAD_X + ((data[idx].x - minX) / rangeX) * drawW
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Wires touch tracking for a chart of given data + pixel width.
 *
 * Returns:
 *  - cursorX  — Reanimated shared value: pixel X of cursor, -1 when hidden
 *  - activeIdx — React state: index into `data[]`, -1 when hidden
 *  - panResponder — attach via {...panResponder.panHandlers} to the touch overlay View
 */
export function useChartTouch(data: ChartPoint[], chartWidth: number) {
  const cursorX = useSharedValue(-1)
  const [activeIdx, setActiveIdx] = useState(-1)

  // Stable ref so PanResponder closure always reads latest props
  const stateRef = useRef({ data, chartWidth, cursorX, setActiveIdx })
  stateRef.current = { data, chartWidth, cursorX, setActiveIdx }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { data: d, chartWidth: w, cursorX: cx, setActiveIdx: set } = stateRef.current
        const idx = chartFindClosest(evt.nativeEvent.locationX, d, w)
        if (idx >= 0) { cx.value = chartIndexToPixelX(idx, d, w); set(idx) }
      },
      onPanResponderMove: (evt) => {
        const { data: d, chartWidth: w, cursorX: cx, setActiveIdx: set } = stateRef.current
        const idx = chartFindClosest(evt.nativeEvent.locationX, d, w)
        if (idx >= 0) { cx.value = chartIndexToPixelX(idx, d, w); set(idx) }
      },
      onPanResponderRelease: () => {
        const { cursorX: cx, setActiveIdx: set } = stateRef.current
        cx.value = -1; set(-1)
      },
      onPanResponderTerminate: () => {
        const { cursorX: cx, setActiveIdx: set } = stateRef.current
        cx.value = -1; set(-1)
      },
    }),
  ).current

  return { cursorX, activeIdx, panResponder }
}
