import { useEffect, memo } from 'react'
import { View, Text } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
} from 'react-native-reanimated'
import type { ActiveQuest } from '@stridequest/shared'
import { colors } from '@/theme'

interface QuestCardProps {
  quest: ActiveQuest
  index?: number
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

function fmtPace(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

function progressLabel(quest: ActiveQuest): string {
  const completed = quest.status === 'completed'
  switch (quest.type) {
    case 'distance_total':
      return `${(quest.currentValue / 1000).toFixed(1)} / ${(quest.targetValue / 1000).toFixed(1)} km`
    case 'territory_claim':
      return `${Math.floor(quest.currentValue)} / ${Math.floor(quest.targetValue)} cells`
    case 'pace_best_km':
      return completed ? '✓ Achieved' : `Target ${fmtPace(quest.targetValue)}/km`
    default: {
      const _exhaustive: never = quest.type
      return String(_exhaustive)
    }
  }
}

export const QuestCard = memo(function QuestCard({ quest, index }: QuestCardProps) {
  const completed = quest.status === 'completed'
  const accent = completed ? colors.accent : colors.primary

  const targetForDisplay = quest.type === 'pace_best_km' ? 1 : quest.targetValue
  const fraction = targetForDisplay > 0 ? clamp(quest.currentValue / targetForDisplay, 0, 1) : 0

  const w = useSharedValue(0)
  useEffect(() => {
    w.value = withDelay(
      (index ?? 0) * 80,
      withSpring(fraction, { damping: 15, stiffness: 150, mass: 0.8 }),
    )
  }, [fraction, index, w])

  const fillStyle = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }))

  const hourLabel = quest.windowEndHour != null ? `${quest.windowEndHour}:00` : null

  return (
    <View
      className={`rounded-2xl bg-surface p-4 mb-3 border ${completed ? 'border-accent/25' : 'border-white/[0.06]'}`}
    >
      {/* Top row */}
      <View className="flex-row items-center gap-3">
        {/* Badge bubble */}
        <View className="w-10 h-10 rounded-full bg-primary/15 items-center justify-center">
          <Text className="text-xl">{quest.rewardBadgeIcon ?? '🎯'}</Text>
        </View>

        {/* Title + description */}
        <View className="flex-1">
          <View className="flex-row items-center gap-1.5">
            <Text className="text-[15px] font-extrabold text-white shrink" numberOfLines={1}>
              {quest.title}
            </Text>
            {hourLabel && (
              <View className="rounded-md bg-accent/10 px-1.5 py-0.5">
                <Text className="text-[10px] font-bold text-accent">
                  ⏰ before {hourLabel}
                </Text>
              </View>
            )}
          </View>
          <Text className="text-xs text-fgMuted mt-0.5" numberOfLines={2}>
            {quest.description}
          </Text>
        </View>

        {/* Reward pill */}
        <View className="rounded-lg bg-accent/10 px-2.5 py-1.5">
          <Text className="text-xs font-extrabold text-accent">
            +{quest.rewardXp} XP
          </Text>
        </View>
      </View>

      {/* Completed chip */}
      {completed && (
        <View className="flex-row mt-3">
          <View className="rounded-md bg-accent/25 px-2 py-[3px]">
            <Text className="text-[10px] font-extrabold text-accent tracking-[0.5px]">
              ✓ DONE
            </Text>
          </View>
        </View>
      )}

      {/* Progress section */}
      <View className="mt-3.5">
        <View className="h-2 rounded bg-white/[0.08] overflow-hidden">
          <Animated.View
            style={[{ height: 8, borderRadius: 4, backgroundColor: accent }, fillStyle]}
          />
        </View>
        <View className="flex-row justify-between mt-1.5">
          <Text className="text-[11px] text-fgSecondary">{progressLabel(quest)}</Text>
          <Text className="text-[11px] font-semibold text-fgMuted">
            {Math.round(fraction * 100)}%
          </Text>
        </View>
      </View>
    </View>
  )
})
