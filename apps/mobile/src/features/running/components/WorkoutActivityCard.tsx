import { Pressable, View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { formatDistance, formatDuration, formatPace } from '@stridequest/shared/running'
import { formatRelativeDate } from '@/features/running/utils/formatRelativeDate'
import type { RecentWorkout } from '@/features/running/services/history'
import { colors } from '@/theme'

interface WorkoutActivityCardProps {
  workout: RecentWorkout
  onPress: () => void
}

export function WorkoutActivityCard({ workout, onPress }: WorkoutActivityCardProps) {
  const hasXp = workout.xp_awarded !== null && workout.xp_awarded > 0

  return (
    <Pressable onPress={onPress} className="rounded-2xl bg-neutral-900 p-4 gap-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <View className="rounded-full bg-emerald-500/15 p-2">
            <Ionicons name="walk" size={18} color={colors.primary} />
          </View>
          <Text className="text-base font-semibold text-white">
            Run {'•'} {formatRelativeDate(workout.started_at)}
          </Text>
        </View>

        {hasXp && (
          <View className="rounded-full bg-emerald-500/15 px-2.5 py-1">
            <Text className="text-xs font-bold text-emerald-400">
              +{workout.xp_awarded} XP
            </Text>
          </View>
        )}
      </View>

      <View className="flex-row gap-4">
        <View className="gap-0.5">
          <Text className="text-xs text-neutral-400">Distance</Text>
          <Text className="text-sm font-semibold text-white">
            {formatDistance(workout.distance_m ?? 0)}
          </Text>
        </View>
        <View className="gap-0.5">
          <Text className="text-xs text-neutral-400">Duration</Text>
          <Text className="text-sm font-semibold text-white">
            {formatDuration(workout.duration_s ?? 0)}
          </Text>
        </View>
        <View className="gap-0.5">
          <Text className="text-xs text-neutral-400">Pace</Text>
          <Text className="text-sm font-semibold text-white">
            {formatPace(workout.avg_pace_s_per_km ?? 0)}
          </Text>
        </View>
      </View>
    </Pressable>
  )
}
