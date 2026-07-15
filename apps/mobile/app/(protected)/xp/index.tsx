import { useCallback, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { getXpProgress } from '@stridequest/shared/xp'
import { formatDistance, formatDuration } from '@stridequest/shared/running'
import { StatCard } from '@/components/ui/StatCard'
import { BackButton } from '@/components/ui/BackButton'
import { loadXpScreenData } from '@/features/xp/services/xp'
import type { XpEvent, WorkoutXpEntry } from '@/features/xp/services/xp'
import { colors, fonts } from '@/theme'

export default function XPScreen() {
  const [data, setData] = useState<Awaited<ReturnType<typeof loadXpScreenData>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        setData(await loadXpScreenData())
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load XP data')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  useFocusEffect(load)

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      setData(await loadXpScreenData())
    } catch {
      // keep showing current data on refresh failure
    } finally {
      setRefreshing(false)
    }
  }, [])

  const progress = getXpProgress(data?.totalXp ?? 0)

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center px-5 pt-5 pb-4 gap-3">
        <BackButton />
        <View className="gap-px">
          <Text className="text-[10px] font-bold text-primary uppercase tracking-[1.5px]">
            XP Profile
          </Text>
          <Text className="text-2xl font-extrabold text-white">Progress</Text>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-[15px] font-semibold text-white text-center">
            Failed to load XP data
          </Text>
          <Text className="text-[13px] text-fgSecondary text-center mt-1.5">
            {error}
          </Text>
          <Pressable
            onPress={load}
            className="mt-4 bg-primary px-6 py-3 rounded-[14px]"
          >
            <Text className="text-white font-bold">Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-5"
          contentContainerStyle={{ gap: 16, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void handleRefresh()}
              tintColor={colors.primary}
            />
          }
        >
          {/* Stats row */}
          <View className="flex-row gap-2.5">
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
          <View className="bg-surface rounded-2xl p-5 gap-3">
            <View className="flex-row justify-between items-center">
              <Text className="text-[10px] font-bold text-fgMuted uppercase tracking-[1px]">
                Level Progress
              </Text>
              <Text className="text-xs font-bold text-primary">
                {progress.progressPercent}%
              </Text>
            </View>
            <View className="h-2 rounded bg-white/[0.08]">
              <View
                className="h-2 rounded bg-primary"
                style={{ width: `${progress.progressPercent}%` }}
              />
            </View>
            <View className="flex-row justify-between">
              <Text className="text-[11px] text-fgMuted">
                Level {progress.currentLevel} ({progress.currentLevelXp.toLocaleString()} XP)
              </Text>
              {progress.nextLevel !== null && (
                <Text className="text-[11px] text-fgMuted">
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
            <View className="bg-surface rounded-2xl overflow-hidden">
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
            <View className="gap-2">
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

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View className="gap-0.5">
      <Text className="text-[10px] font-bold text-fgMuted uppercase tracking-[1px]">
        {subtitle}
      </Text>
      <Text className="text-lg font-bold text-white">{title}</Text>
    </View>
  )
}

function EmptyCard({ message }: { message: string }) {
  return (
    <View className="bg-surface rounded-[14px] p-6 items-center border border-dashed border-white/[0.08]">
      <Text className="text-[13px] text-fgFaint text-center">{message}</Text>
    </View>
  )
}

const EVENT_LABEL: Record<XpEvent['eventType'], string> = {
  workout: 'Workout',
  capture: 'Capture',
  steal: 'Steal',
}

const EVENT_COLOR: Record<XpEvent['eventType'], string> = {
  workout: colors.primary,
  capture: colors.indigo,
  steal: colors.accent,
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
    <View className={`flex-row items-center px-4 py-3.5 gap-3 ${isLast ? '' : 'border-b border-white/5'}`}>
      <View
        className="w-9 h-9 rounded-[10px] items-center justify-center"
        style={{ backgroundColor: `${color}20` }}
      >
        <Ionicons name={EVENT_ICON[event.eventType]} size={16} color={color} />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-white">
          {EVENT_LABEL[event.eventType]}
        </Text>
        <Text className="text-[11px] text-fgFaint mt-px">{dateStr}</Text>
      </View>
      <Text style={{ fontSize: 18, fontFamily: fonts.displayHeavy, color: colors.primary, fontVariant: ['tabular-nums'] }}>
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
    <View className="bg-surface rounded-[14px] p-4 flex-row items-center gap-3">
      <View className="w-10 h-10 rounded-xl items-center justify-center bg-primary/[0.12]">
        <Ionicons name="footsteps" size={18} color={colors.primary} />
      </View>
      <View className="flex-1 gap-1">
        <Text className="text-sm font-semibold text-white">{dateStr}</Text>
        <View className="flex-row gap-3">
          {entry.distanceM !== null && (
            <Text className="text-xs text-fgMuted">
              {formatDistance(entry.distanceM)}
            </Text>
          )}
          {entry.durationS !== null && (
            <Text className="text-xs text-fgMuted">
              {formatDuration(entry.durationS)}
            </Text>
          )}
        </View>
      </View>
      <View className="items-end">
        <Text style={{ fontSize: 18, fontFamily: fonts.displayHeavy, color: colors.primary, fontVariant: ['tabular-nums'] }}>
          +{entry.xpAwarded}
        </Text>
        <Text className="text-[10px] text-fgFaint uppercase tracking-[0.5px]">
          XP
        </Text>
      </View>
    </View>
  )
}
