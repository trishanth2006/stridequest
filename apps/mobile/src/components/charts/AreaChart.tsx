import { useMemo } from 'react'
import { View } from 'react-native'
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg'
import { colors } from '@/theme'

export type ChartPoint = { x: number; y: number }

type Props = {
  data: ChartPoint[]
  width: number
  height: number
  color?: string
  strokeWidth?: number
}

function buildPaths(
  data: ChartPoint[],
  width: number,
  height: number,
  padX: number,
  padY: number,
): { line: string; area: string } {
  if (data.length < 2) return { line: '', area: '' }

  const minX = Math.min(...data.map((d) => d.x))
  const maxX = Math.max(...data.map((d) => d.x))
  const minY = Math.min(...data.map((d) => d.y))
  const maxY = Math.max(...data.map((d) => d.y))

  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1
  const drawW = width - padX * 2
  const drawH = height - padY * 2

  const pts = data.map((p) => ({
    px: padX + ((p.x - minX) / rangeX) * drawW,
    py: padY + ((1 - (p.y - minY) / rangeY) * drawH),
  }))

  const lineParts = pts.map((p, i) =>
    i === 0 ? `M${p.px.toFixed(1)},${p.py.toFixed(1)}` : `L${p.px.toFixed(1)},${p.py.toFixed(1)}`,
  )
  const line = lineParts.join(' ')

  const bottom = height - padY
  const area =
    `${line} L${pts[pts.length - 1].px.toFixed(1)},${bottom} L${pts[0].px.toFixed(1)},${bottom} Z`

  return { line, area }
}

/**
 * SVG area chart with a gradient fill beneath the line.
 * Used for elevation and other filled metric visualizations.
 */
export function AreaChart({ data, width, height, color = colors.primary, strokeWidth = 2 }: Props) {
  const PAD_X = 8
  const PAD_Y = 8
  const gradId = 'area-grad'

  const { line, area } = useMemo(
    () => buildPaths(data, width, height, PAD_X, PAD_Y),
    [data, width, height],
  )

  if (data.length < 2) return <View style={{ width, height }} />

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <Stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </LinearGradient>
      </Defs>
      {/* Filled area */}
      <Path d={area} fill={`url(#${gradId})`} />
      {/* Line on top */}
      <Path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}
