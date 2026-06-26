import { useState } from 'react'
import { View, Text, ScrollView, Pressable } from 'react-native'
import { useQuests } from '../hooks/useQuests'
import { QuestSegmentedControl } from './QuestSegmentedControl'
import { QuestCard } from './QuestCard'
import { QuestCardSkeleton } from './QuestCardSkeleton'

interface QuestDashboardProps {
  userId: string
}

export function QuestDashboard({ userId }: QuestDashboardProps) {
  const { quests, loading, error, refresh } = useQuests(userId)
  const [duration, setDuration] = useState<'daily' | 'weekly'>('daily')

  const visible = quests.filter((q) => q.durationType === duration)

  return (
    <View style={{ flex: 1, backgroundColor: '#0b0b0f' }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff' }}>Quests</Text>
        <Text style={{ fontSize: 13, color: '#71717a', marginTop: 2 }}>
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
            <Text style={{ fontSize: 14, color: '#71717a', textAlign: 'center' }}>{error}</Text>
            <Pressable
              onPress={refresh}
              style={{
                backgroundColor: 'rgba(16,185,129,0.15)',
                borderRadius: 10,
                paddingHorizontal: 20,
                paddingVertical: 10,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#10b981' }}>Try again</Text>
            </Pressable>
          </View>
        ) : visible.length === 0 ? (
          <Text style={{ fontSize: 14, color: '#71717a', textAlign: 'center', marginTop: 48 }}>
            No {duration} quests right now. Check back soon!
          </Text>
        ) : (
          visible.map((q, i) => <QuestCard key={q.userQuestId} quest={q} index={i} />)
        )}
      </ScrollView>
    </View>
  )
}
