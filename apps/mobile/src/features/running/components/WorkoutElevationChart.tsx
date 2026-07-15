import { View, Text, useWindowDimensions } from 'react-native'
import { AreaChart } from '@/components/charts/AreaChart'
import { ChartCursor } from '@/components/charts/ChartCursor'
import { Card, SectionLabel, ChartAxis } from './shared'
import type { WorkoutChartPoint, WorkoutElevation } from '@stridequest/shared/analytics'
import { colors } from '@/theme'

interface WorkoutElevationChartProps {
  chartSeries: WorkoutChartPoint[]
  elevation: WorkoutElevation
}

function ElevStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View className="flex-1 items-center gap-0.5">
      <Text className="text-[15px] font-bold" style={{ color }}>{value}</Text>
      <Text className="text-[9px] font-semibold text-fgMuted uppercase">
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
      <View className="flex-row gap-2 mt-3">
        <ElevStat label="Gain" value={`+${elevation.gainM}m`} color={colors.primary} />
        <ElevStat label="Loss" value={`-${elevation.lossM}m`} color={colors.danger} />
        <ElevStat label="High" value={`${elevation.highestM}m`} color={colors.fgSecondary} />
        <ElevStat label="Low" value={`${elevation.lowestM}m`} color={colors.fgSecondary} />
      </View>
      {elevData.length >= 2 && (
        <View className="mt-3 pt-8">
          <ChartCursor
            data={elevData}
            width={CHART_W}
            height={CHART_H}
            color={colors.indigo}
            formatTooltip={(p) => `${Math.round(p.y)}m alt`}
          >
            <AreaChart data={elevData} width={CHART_W} height={CHART_H} color={colors.indigo} />
          </ChartCursor>
          <ChartAxis label="Altitude (m) over distance" />
        </View>
      )}
    </Card>
  )
}
