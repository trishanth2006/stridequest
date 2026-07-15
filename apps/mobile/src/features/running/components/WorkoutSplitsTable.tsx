import { View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { formatDuration, formatPace } from '@stridequest/shared/running'
import type { WorkoutSplit } from '@stridequest/shared/analytics'
import { Card, SectionLabel } from './shared'
import { colors } from '@/theme'

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
        <Text className="w-9 text-[10px] text-fgMuted font-semibold">#</Text>
        <Text className="flex-1 text-[10px] text-fgMuted font-semibold">Dist</Text>
        <Text className="flex-1 text-[10px] text-fgMuted font-semibold">Time</Text>
        <Text className="flex-1 text-[10px] text-fgMuted font-semibold text-right">Pace</Text>
      </View>
      <View className="h-px bg-white/10" />
      {splits.map((split) => {
        const rowBg = split.isFastest ? 'bg-primary/[0.08]' : split.isSlowest ? 'bg-danger/[0.08]' : ''
        const accentCls = split.isFastest ? 'text-primary' : split.isSlowest ? 'text-danger' : 'text-white'
        return (
          <View
            key={split.index}
            className={`flex-row items-center px-5 py-3 ${rowBg}`}
          >
            <View className="w-9 flex-row items-center gap-1">
              <Text className={`text-[13px] font-bold ${accentCls}`}>
                {split.index}
              </Text>
              {split.isFastest && <Ionicons name="flash" size={11} color={colors.primary} />}
              {split.isSlowest && <Ionicons name="hourglass" size={11} color={colors.danger} />}
            </View>
            <Text className="flex-1 text-[13px] text-fgSecondary">
              {(split.distanceM / 1000).toFixed(2)} km
            </Text>
            <Text className="flex-1 text-[13px] text-fgSecondary">
              {formatDuration(Math.round(split.durationS))}
            </Text>
            <Text className={`flex-1 text-[13px] font-semibold text-right ${accentCls}`}>
              {formatPace(split.paceSPerKm)}
            </Text>
          </View>
        )
      })}
      <View className="h-2" />
    </Card>
  )
}
