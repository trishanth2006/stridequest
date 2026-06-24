import { View, useWindowDimensions } from 'react-native'
import { LineChart } from '@/components/charts/LineChart'
import { ChartCursor } from '@/components/charts/ChartCursor'
import { Card, SectionLabel, ChartAxis } from './shared'
import { formatPace } from '@stridequest/shared/running'
import type { WorkoutChartPoint } from '@stridequest/shared/analytics'

interface WorkoutChartsProps {
  chartSeries: WorkoutChartPoint[]
}

export function WorkoutCharts({ chartSeries }: WorkoutChartsProps) {
  const { width } = useWindowDimensions()
  const CHART_W = width - 40 - 40
  const CHART_H = 120

  if (chartSeries.length === 0) return null

  const paceData = chartSeries.map((p) => ({ x: p.distanceKm, y: p.pace }))
  const speedData = chartSeries.map((p) => ({ x: p.distanceKm, y: p.speed }))

  return (
    <View style={{ gap: 16 }}>
      {paceData.length >= 2 && (
        <Card>
          <SectionLabel>Pace</SectionLabel>
          <View style={{ marginTop: 12, paddingTop: 32 }}>
            <ChartCursor
              data={paceData}
              width={CHART_W}
              height={CHART_H}
              color="#3b82f6"
              formatTooltip={(p) => formatPace(p.y)}
            >
              <LineChart data={paceData} width={CHART_W} height={CHART_H} color="#3b82f6" />
            </ChartCursor>
            <ChartAxis label="Distance (km)" />
          </View>
        </Card>
      )}

      {speedData.length >= 2 && (
        <Card>
          <SectionLabel>Speed</SectionLabel>
          <View style={{ marginTop: 12, paddingTop: 32 }}>
            <ChartCursor
              data={speedData}
              width={CHART_W}
              height={CHART_H}
              color="#10b981"
              formatTooltip={(p) => `${p.y.toFixed(1)} km/h`}
            >
              <LineChart data={speedData} width={CHART_W} height={CHART_H} color="#10b981" />
            </ChartCursor>
            <ChartAxis label="km/h over distance" />
          </View>
        </Card>
      )}
    </View>
  )
}
