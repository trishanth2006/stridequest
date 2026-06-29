import { useMemo } from 'react'
import { View } from 'react-native'
import Svg, { Path, Polyline, Line, Circle } from 'react-native-svg'
import { colors } from '../../theme/colors'

export type ChartPoint = { x: number; y: number }

type Props = {
  data: ChartPoint[]
  width: number
  height: number
  color?: string
  strokeWidth?: number
}

function buildPolylinePoints(
  data: ChartPoint[],
  width: number,
  height: number,
  padX: number,
  padY: number,
): string {
  if (data.length === 0) return ''

  const minX = Math.min(...data.map((d) => d.x))
  const maxX = Math.max(...data.map((d) => d.x))
  const minY = Math.min(...data.map((d) => d.y))
  const maxY = Math.max(...data.map((d) => d.y))

  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1
  const drawW = width - padX * 2
  const drawH = height - padY * 2

  return data
    .map((p) => {
      const px = padX + ((p.x - minX) / rangeX) * drawW
      const py = padY + ((1 - (p.y - minY) / rangeY) * drawH)
      return `${px.toFixed(1)},${py.toFixed(1)}`
    })
    .join(' ')
}

/**
 * Lightweight SVG line chart. Uses react-native-svg Polyline.
 * Renders a smooth line over an arbitrary [x, y] dataset.
 */
export function LineChart({ data, width, height, color = colors.primary, strokeWidth = 2 }: Props) {
  const PAD_X = 8
  const PAD_Y = 8

  const points = useMemo(
    () => buildPolylinePoints(data, width, height, PAD_X, PAD_Y),
    [data, width, height],
  )

  if (data.length < 2) return <View style={{ width, height }} />

  return (
    <Svg width={width} height={height}>
      <Polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}
