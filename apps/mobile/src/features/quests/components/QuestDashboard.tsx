import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, Pressable } from 'react-native'
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
import { colors, withAlpha } from '@/theme'

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

export function QuestDashboard({ userId }: QuestDashboardProps) {
  const { quests, loading, error, refresh } = useQuests(userId)
  useHapticQuestCompletion(quests)
  const [duration, setDuration] = useState<'daily' | 'weekly'>('daily')

  const visible = quests.filter((q) => q.durationType === duration)

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.white }}>Quests</Text>
        <Text style={{ fontSize: 13, color: colors.fgMuted, marginTop: 2 }}>
          Complete objectives, earn XP & badges
        </Text>
      </View>

      {/* Segmented control */}
      <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
        <QuestSegmentedControl value={duration} onChange={setDuration} />
      </View>

      {/* Body */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <>
            <QuestCardSkeleton />
            <QuestCardSkeleton />
            <QuestCardSkeleton />
          </>
        ) : error ? (
          <View style={{ alignItems: 'center', paddingTop: 48, gap: 14 }}>
            <Text style={{ fontSize: 14, color: colors.fgMuted, textAlign: 'center' }}>{error}</Text>
            <Pressable
              onPress={refresh}
              style={{
                backgroundColor: withAlpha(colors.primary, 0.15),
                borderRadius: 10,
                paddingHorizontal: 20,
                paddingVertical: 10,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>Try again</Text>
            </Pressable>
          </View>
        ) : visible.length === 0 ? (
          <Text style={{ fontSize: 14, color: colors.fgMuted, textAlign: 'center', marginTop: 48 }}>
            No {duration} quests right now. Check back soon!
          </Text>
        ) : (
          visible.map((q, i) => (
            <QuestCardEntrance key={q.userQuestId} index={i}>
              <QuestCard quest={q} index={i} />
            </QuestCardEntrance>
          ))
        )}
      </ScrollView>
    </View>
  )
}
