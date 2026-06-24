import React from 'react'
import { View, Text } from 'react-native'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { useChartTouch, type ChartPoint } from './useChartTouch'

const TOOLTIP_WIDTH = 96
const TOOLTIP_HEIGHT = 26

interface ChartCursorProps {
  data: ChartPoint[]
  width: number
  height: number
  /** Hex color string (e.g. "#10b981") — used for cursor line and tooltip border */
  color: string
  /** Receives the active data point and returns the string shown in the tooltip */
  formatTooltip: (point: ChartPoint) => string
  children: React.ReactNode
}

/**
 * Drop-in wrapper that adds touch-to-scrub interactivity to any SVG chart.
 * Usage: wrap <LineChart /> or <AreaChart /> with this component.
 */
export function ChartCursor({
  data,
  width,
  height,
  color,
  formatTooltip,
  children,
}: ChartCursorProps) {
  const { cursorX, activeIdx, panResponder } = useChartTouch(data, width)

  const tooltipText = activeIdx >= 0 && activeIdx < data.length
    ? formatTooltip(data[activeIdx])
    : ''

  // Cursor line: translates to cursorX, hidden when cursorX = -1
  const cursorLineStyle = useAnimatedStyle(() => ({
    opacity: cursorX.value < 0 ? 0 : 0.7,
    transform: [{ translateX: cursorX.value < 0 ? 0 : cursorX.value - 0.5 }],
  }))

  // Tooltip: follows cursor X, clamped to chart width
  const tooltipStyle = useAnimatedStyle(() => {
    const x = cursorX.value < 0
      ? 0
      : Math.min(Math.max(0, cursorX.value - TOOLTIP_WIDTH / 2), width - TOOLTIP_WIDTH)
    return {
      opacity: cursorX.value < 0 ? 0 : 1,
      transform: [{ translateX: x }],
    }
  })

  return (
    <View style={{ width, height, position: 'relative', overflow: 'visible' }}>
      {/* Chart SVG */}
      {children}

      {/* Touch-capture layer + cursor overlay */}
      <View
        style={{ position: 'absolute', top: 0, left: 0, width, height, zIndex: 10 }}
        {...panResponder.panHandlers}
      >
        {/* Vertical cursor line */}
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              width: 1,
              height,
              backgroundColor: color,
            },
            cursorLineStyle,
          ]}
        />

        {/* Tooltip pill — positioned above the chart area */}
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: -(TOOLTIP_HEIGHT + 6),
              left: 0,
              width: TOOLTIP_WIDTH,
              height: TOOLTIP_HEIGHT,
              backgroundColor: 'rgba(10,10,14,0.92)',
              borderRadius: 8,
              borderWidth: 1,
              borderColor: `${color}50`,
              alignItems: 'center',
              justifyContent: 'center',
            },
            tooltipStyle,
          ]}
        >
          <Text
            numberOfLines={1}
            style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}
          >
            {tooltipText}
          </Text>
        </Animated.View>
      </View>
    </View>
  )
}
