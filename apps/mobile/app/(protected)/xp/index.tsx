import { useCallback, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { getXpProgress } from '@stridequest/shared/xp'
import { formatDistance, formatDuration } from '@stridequest/shared/running'
import { loadXpScreenData } from '@/features/xp/services/xp'
import type { XpEvent, WorkoutXpEntry } from '@/features/xp/services/xp'

export default function XPScreen() {
  const router = useRouter()
  const [data, setData] = useState<Awaited<ReturnType<typeof loadXpScreenData>> | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    void loadXpScreenData().then((d) => {
      setData(d)
      setLoading(false)
    })
  }, [])

  useFocusEffect(load)

  const progress = getXpProgress(data?.totalXp ?? 0)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0b0b0f' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, gap: 12 }}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#10b981" />
        </Pressable>
        <View style={{ gap: 1 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#10b981', textTransform: 'uppercase', letterSpacing: 1.5 }}>
            XP Profile
          </Text>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#fff' }}>Progress</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#10b981" size="large" />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1, paddingHorizontal: 20 }}
          contentContainerStyle={{ gap: 16, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Stats row */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatCard
              label="Current Level"
              value={`Level ${data?.level ?? 1}`}
              accent
              icon="star"
            />
            <StatCard
              label="Total XP"
              value={(data?.totalXp ?? 0).toLocaleString()}
              icon="flash"
            />
            <StatCard
              label="Next Level"
              value={
                progress.nextLevel === null
                  ? 'Max'
                  : `${progress.xpNeededToNextLevel} XP`
              }
              icon="trending-up"
            />
          </View>

          {/* XP Progress bar */}
          <View style={{ backgroundColor: '#171717', borderRadius: 16, padding: 20, gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#71717a', textTransform: 'uppercase', letterSpacing: 1 }}>
                Level Progress
              </Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#10b981' }}>
                {progress.progressPercent}%
              </Text>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)' }}>
              <View
                style={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: '#10b981',
                  width: `${progress.progressPercent}%`,
                }}
              />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 11, color: '#71717a' }}>
                Level {progress.currentLevel} ({progress.currentLevelXp.toLocaleString()} XP)
              </Text>
              {progress.nextLevel !== null && (
                <Text style={{ fontSize: 11, color: '#71717a' }}>
                  Level {progress.nextLevel} ({(progress.nextLevelXp ?? 0).toLocaleString()} XP)
                </Text>
              )}
            </View>
          </View>

          {/* Recent XP Events */}
          <SectionHeader title="Recent XP Events" subtitle="Your latest XP activity" />
          {(data?.recentEvents.length ?? 0) === 0 ? (
            <EmptyCard message="No XP events yet. Complete a run to earn XP!" />
          ) : (
            <View style={{ backgroundColor: '#171717', borderRadius: 16, overflow: 'hidden' }}>
              {data!.recentEvents.map((event, i) => (
                <XpEventRow key={event.id} event={event} isLast={i === data!.recentEvents.length - 1} />
              ))}
            </View>
          )}

          {/* Workout XP History */}
          <SectionHeader title="Workout XP History" subtitle="Runs that moved you forward" />
          {(data?.workoutHistory.length ?? 0) === 0 ? (
            <EmptyCard message="No XP workouts yet. Complete your first run!" />
          ) : (
            <View style={{ gap: 8 }}>
              {data!.workoutHistory.map((w) => (
                <WorkoutXpCard key={w.workoutId} entry={w} />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  accent = false,
}: {
  label: string
  value: string
  icon: React.ComponentProps<typeof Ionicons>['name']
  accent?: boolean
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#171717',
        borderRadius: 14,
        padding: 14,
        gap: 8,
        borderWidth: 1,
        borderColor: accent ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.05)',
      }}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          backgroundColor: accent ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={14} color={accent ? '#10b981' : '#a3a3a3'} />
      </View>
      <Text style={{ fontSize: 15, fontWeight: '800', color: accent ? '#10b981' : '#fff' }}>
        {value}
      </Text>
      <Text style={{ fontSize: 9, fontWeight: '600', color: '#52525b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Text>
    </View>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ fontSize: 10, fontWeight: '700', color: '#71717a', textTransform: 'uppercase', letterSpacing: 1 }}>
        {subtitle}
      </Text>
      <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff' }}>{title}</Text>
    </View>
  )
}

function EmptyCard({ message }: { message: string }) {
  return (
    <View
      style={{
        backgroundColor: '#171717',
        borderRadius: 14,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: 'rgba(255,255,255,0.08)',
      }}
    >
      <Text style={{ fontSize: 13, color: '#52525b', textAlign: 'center' }}>{message}</Text>
    </View>
  )
}

const EVENT_LABEL: Record<XpEvent['eventType'], string> = {
  workout: 'Workout',
  capture: 'Capture',
  steal: 'Steal',
}

const EVENT_COLOR: Record<XpEvent['eventType'], string> = {
  workout: '#10b981',
  capture: '#6366f1',
  steal: '#f59e0b',
}

const EVENT_ICON: Record<XpEvent['eventType'], React.ComponentProps<typeof Ionicons>['name']> = {
  workout: 'footsteps',
  capture: 'flag',
  steal: 'flash',
}

function XpEventRow({ event, isLast }: { event: XpEvent; isLast: boolean }) {
  const color = EVENT_COLOR[event.eventType]
  const dateStr = new Date(event.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: `${color}20`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={EVENT_ICON[event.eventType]} size={16} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>
          {EVENT_LABEL[event.eventType]}
        </Text>
        <Text style={{ fontSize: 11, color: '#52525b', marginTop: 1 }}>{dateStr}</Text>
      </View>
      <Text style={{ fontSize: 16, fontWeight: '800', color: '#10b981' }}>
        +{event.xpAwarded}
      </Text>
    </View>
  )
}

function WorkoutXpCard({ entry }: { entry: WorkoutXpEntry }) {
  const dateStr = new Date(entry.startedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <View
      style={{
        backgroundColor: '#171717',
        borderRadius: 14,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: 'rgba(16,185,129,0.12)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="footsteps" size={18} color="#10b981" />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>{dateStr}</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {entry.distanceM !== null && (
            <Text style={{ fontSize: 12, color: '#71717a' }}>
              {formatDistance(entry.distanceM)}
            </Text>
          )}
          {entry.durationS !== null && (
            <Text style={{ fontSize: 12, color: '#71717a' }}>
              {formatDuration(entry.durationS)}
            </Text>
          )}
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: '#10b981' }}>
          +{entry.xpAwarded}
        </Text>
        <Text style={{ fontSize: 10, color: '#52525b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          XP
        </Text>
      </View>
    </View>
  )
}
