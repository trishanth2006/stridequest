import { View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { formatDuration, formatPace } from '@stridequest/shared/running'
import type { WorkoutSplit } from '@stridequest/shared/analytics'
import { Card, SectionLabel } from './shared'
import { colors, withAlpha } from '@/theme'

interface WorkoutSplitsTableProps {
  splits: WorkoutSplit[]
}

export function WorkoutSplitsTable({ splits }: WorkoutSplitsTableProps) {
  if (splits.length === 0) return null

  return (
    <Card noPad>
      <View className="px-5 pt-5 pb-3">
        <SectionLabel>Splits</SectionLabel>
      </View>
      <View className="flex-row px-5 pb-2">
        <Text style={{ width: 36, fontSize: 10, color: colors.fgMuted, fontWeight: '600' }}>#</Text>
        <Text style={{ flex: 1, fontSize: 10, color: colors.fgMuted, fontWeight: '600' }}>Dist</Text>
        <Text style={{ flex: 1, fontSize: 10, color: colors.fgMuted, fontWeight: '600' }}>Time</Text>
        <Text style={{ flex: 1, fontSize: 10, color: colors.fgMuted, fontWeight: '600', textAlign: 'right' }}>Pace</Text>
      </View>
      <View className="h-px bg-white/10" />
      {splits.map((split) => {
        const bg = split.isFastest
          ? withAlpha(colors.primary, 0.08)
          : split.isSlowest
          ? withAlpha(colors.danger, 0.08)
          : 'transparent'
        const accent = split.isFastest ? colors.primary : split.isSlowest ? colors.danger : colors.white
        return (
          <View
            key={split.index}
            style={{ backgroundColor: bg }}
            className="flex-row items-center px-5 py-3"
          >
            <View style={{ width: 36, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: accent }}>
                {split.index}
              </Text>
              {split.isFastest && <Ionicons name="flash" size={11} color={colors.primary} />}
              {split.isSlowest && <Ionicons name="hourglass" size={11} color={colors.danger} />}
            </View>
            <Text style={{ flex: 1, fontSize: 13, color: colors.fgSecondary }}>
              {(split.distanceM / 1000).toFixed(2)} km
            </Text>
            <Text style={{ flex: 1, fontSize: 13, color: colors.fgSecondary }}>
              {formatDuration(Math.round(split.durationS))}
            </Text>
            <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: accent, textAlign: 'right' }}>
              {formatPace(split.paceSPerKm)}
            </Text>
          </View>
        )
      })}
      <View style={{ height: 8 }} />
    </Card>
  )
}
