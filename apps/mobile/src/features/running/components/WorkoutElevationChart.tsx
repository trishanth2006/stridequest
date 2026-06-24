import { View, Text, useWindowDimensions } from 'react-native'
import { AreaChart } from '@/components/charts/AreaChart'
import { ChartCursor } from '@/components/charts/ChartCursor'
import { Card, SectionLabel, ChartAxis } from './shared'
import type { WorkoutChartPoint, WorkoutElevation } from '@stridequest/shared/analytics'

interface WorkoutElevationChartProps {
  chartSeries: WorkoutChartPoint[]
  elevation: WorkoutElevation
}

function ElevStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color }}>{value}</Text>
      <Text style={{ fontSize: 9, fontWeight: '600', color: '#71717a', textTransform: 'uppercase' }}>
        {label}
      </Text>
    </View>
  )
}

export function WorkoutElevationChart({ chartSeries, elevation }: WorkoutElevationChartProps) {
  const { width } = useWindowDimensions()
  const CHART_W = width - 40 - 40
  const CHART_H = 120

  if (!elevation.hasData) return null

  const elevData = chartSeries
    .filter((p) => p.altitude != null)
    .map((p) => ({ x: p.distanceKm, y: p.altitude! }))

  return (
    <Card>
      <SectionLabel>Elevation</SectionLabel>
      <View className="flex-row" style={{ gap: 8, marginTop: 12 }}>
        <ElevStat label="Gain" value={`+${elevation.gainM}m`} color="#10b981" />
        <ElevStat label="Loss" value={`-${elevation.lossM}m`} color="#ef4444" />
        <ElevStat label="High" value={`${elevation.highestM}m`} color="#a3a3a3" />
        <ElevStat label="Low" value={`${elevation.lowestM}m`} color="#a3a3a3" />
      </View>
      {elevData.length >= 2 && (
        <View style={{ marginTop: 12, paddingTop: 32 }}>
          <ChartCursor
            data={elevData}
            width={CHART_W}
            height={CHART_H}
            color="#6366f1"
            formatTooltip={(p) => `${Math.round(p.y)}m alt`}
          >
            <AreaChart data={elevData} width={CHART_W} height={CHART_H} color="#6366f1" />
          </ChartCursor>
          <ChartAxis label="Altitude (m) over distance" />
        </View>
      )}
    </Card>
  )
}
