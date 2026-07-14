import { useEffect, memo } from 'react'
import { View, Text } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
} from 'react-native-reanimated'
import type { ActiveQuest } from '@stridequest/shared'
import { colors, withAlpha } from '@/theme'

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
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: completed ? withAlpha(colors.accent, 0.25) : withAlpha(colors.white, 0.06),
      }}
    >
      {/* Top row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {/* Badge bubble */}
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: withAlpha(colors.primary, 0.15),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 20 }}>{quest.rewardBadgeIcon ?? '🎯'}</Text>
        </View>

        {/* Title + description */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: colors.white, flexShrink: 1 }} numberOfLines={1}>
              {quest.title}
            </Text>
            {hourLabel && (
              <View
                style={{
                  backgroundColor: withAlpha(colors.accent, 0.1),
                  borderRadius: 6,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.accent }}>
                  ⏰ before {hourLabel}
                </Text>
              </View>
            )}
          </View>
          <Text style={{ fontSize: 12, color: colors.fgMuted, marginTop: 2 }} numberOfLines={2}>
            {quest.description}
          </Text>
        </View>

        {/* Reward pill */}
        <View
          style={{
            backgroundColor: withAlpha(colors.accent, 0.1),
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 6,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '800', color: colors.accent }}>
            +{quest.rewardXp} XP
          </Text>
        </View>
      </View>

      {/* Completed chip */}
      {completed && (
        <View style={{ flexDirection: 'row', marginTop: 12 }}>
          <View
            style={{
              backgroundColor: withAlpha(colors.accent, 0.25),
              borderRadius: 6,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: '800', color: colors.accent, letterSpacing: 0.5 }}>
              ✓ DONE
            </Text>
          </View>
        </View>
      )}

      {/* Progress section */}
      <View style={{ marginTop: 14 }}>
        <View
          style={{
            height: 8,
            borderRadius: 4,
            backgroundColor: withAlpha(colors.white, 0.08),
            overflow: 'hidden',
          }}
        >
          <Animated.View
            style={[{ height: 8, borderRadius: 4, backgroundColor: accent }, fillStyle]}
          />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          <Text style={{ fontSize: 11, color: colors.fgSecondary }}>{progressLabel(quest)}</Text>
          <Text style={{ fontSize: 11, color: colors.fgMuted, fontWeight: '600' }}>
            {Math.round(fraction * 100)}%
          </Text>
        </View>
      </View>
    </View>
  )
})
