import React, { useEffect, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { useQuests } from '../hooks/useQuests'
import { useHapticQuestCompletion } from '../hooks/useHapticQuestCompletion'
import { QuestSegmentedControl } from './QuestSegmentedControl'
import { QuestCard } from './QuestCard'
import { QuestCardSkeleton } from './QuestCardSkeleton'

function QuestCardEntrance({ index, children }: { index: number; children: React.ReactNode }) {
  const translateY = useSharedValue(16)
  const opacity = useSharedValue(0)

  useEffect(() => {
    translateY.value = withDelay(index * 80, withTiming(0, { duration: 320 }))
    opacity.value = withDelay(index * 80, withTiming(1, { duration: 320 }))
  }, [index, translateY, opacity])

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }))

  return <Animated.View style={style}>{children}</Animated.View>
}

interface QuestDashboardProps {
  userId: string
}

/**
 * Embeddable quests section (no own scroll/header) — the host screen provides
 * the section label and scrolling context.
 */
export function QuestDashboard({ userId }: QuestDashboardProps) {
  const { quests, loading, error, refresh } = useQuests(userId)
  useHapticQuestCompletion(quests)
  const [duration, setDuration] = useState<'daily' | 'weekly'>('daily')

  const visible = quests.filter((q) => q.durationType === duration)

  return (
    <View className="gap-3">
      <QuestSegmentedControl value={duration} onChange={setDuration} />

      {loading ? (
        <View>
          <QuestCardSkeleton />
          <QuestCardSkeleton />
        </View>
      ) : error ? (
        <View className="items-center py-4 gap-3">
          <Text className="text-sm text-fgMuted text-center">{error}</Text>
          <Pressable
            onPress={refresh}
            className="rounded-[10px] bg-primary/15 px-5 py-2.5"
          >
            <Text className="text-[13px] font-bold text-primary">Try again</Text>
          </Pressable>
        </View>
      ) : visible.length === 0 ? (
        <View className="bg-surface rounded-2xl p-5 items-center">
          <Text className="text-sm text-fgMuted text-center">
            No {duration} quests right now. Check back soon!
          </Text>
        </View>
      ) : (
        <View>
          {visible.map((q, i) => (
            <QuestCardEntrance key={q.userQuestId} index={i}>
              <QuestCard quest={q} index={i} />
            </QuestCardEntrance>
          ))}
        </View>
      )}
    </View>
  )
}
