import { useCallback, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSession } from '@/features/auth/providers/SessionProvider'
import { supabase } from '@/lib/supabase'
import { queryGet, querySet } from '@/lib/queryCache'
import { getXpProgress } from '@stridequest/shared/xp'
import { formatDistance, formatDuration } from '@stridequest/shared/running'
import { computeDashboardStats, type DashboardComputedStats } from '@stridequest/shared/analytics'
import { loadDashboard } from '@/features/running/services/dashboard'
import { WorkoutActivityCard } from '@/features/running/components/WorkoutActivityCard'
import { QuestDashboard } from '@/features/quests/components/QuestDashboard'
import { DashboardSkeleton } from '@/components/ui/SkeletonLoader'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { StatCard } from '@/components/ui/StatCard'
import type { RecentWorkout } from '@/features/running/services/history'
import { colors, fonts, withAlpha } from '@/theme'

const CACHE_KEY = 'dashboard'
const STALE_MS = 60_000

type HeaderData = {
  username: string
  totalXp: number
  totalDistanceM: number
}

type DashboardCache = {
  header: HeaderData
  stats: DashboardComputedStats
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function HomeScreen() {
  const { session } = useSession()
  const router = useRouter()
  const [header, setHeader] = useState<HeaderData | null>(null)
  const [stats, setStats] = useState<DashboardComputedStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAndStore = useCallback(async (userId: string, userEmail: string | undefined) => {
    const [profileRes, xpRes, workoutsRes, dashResult] = await Promise.all([
      supabase.from('profiles').select('username').eq('id', userId).single(),
      supabase.from('user_xp').select('total_xp').eq('user_id', userId).single(),
      supabase.from('workouts').select('distance_m').eq('user_id', userId).eq('status', 'completed'),
      loadDashboard(),
    ])

    const totalDistanceM = (workoutsRes.data ?? []).reduce(
      (sum, w) => sum + ((w.distance_m as number | null) ?? 0),
      0,
    )
    const nextHeader: HeaderData = {
      username: profileRes.data?.username ?? userEmail ?? 'Runner',
      totalXp: xpRes.data?.total_xp ?? 0,
      totalDistanceM,
    }
    const nextStats = computeDashboardStats(dashResult.activity, new Date())

    querySet<DashboardCache>(CACHE_KEY, { header: nextHeader, stats: nextStats })
    setHeader(nextHeader)
    setStats(nextStats)
  }, [])

  const loadData = useCallback(() => {
    const userId = session?.user.id
    if (!userId) return

    const cached = queryGet<DashboardCache>(CACHE_KEY, STALE_MS)
    if (cached) {
      // Serve from cache immediately — no loading flash
      setHeader(cached.header)
      setStats(cached.stats)
      setLoading(false)
      // Revalidate silently in background
      void fetchAndStore(userId, session?.user.email)
      return
    }

    setLoading(true)
    setError(null)
    void (async () => {
      try {
        await fetchAndStore(userId, session?.user.email)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    })()
  }, [session?.user.id, session?.user.email, fetchAndStore])

  useFocusEffect(loadData)

  const handleRefresh = useCallback(async () => {
    const userId = session?.user.id
    if (!userId) return
    setRefreshing(true)
    try {
      await fetchAndStore(userId, session?.user.email)
    } catch {
      // keep showing current data on refresh failure
    } finally {
      setRefreshing(false)
    }
  }, [session, fetchAndStore])

  const handleOpenRun = useCallback((id: string) => {
    router.push(`/(protected)/(tabs)/run/${id}` as never)
  }, [router])

  const progress = getXpProgress(header?.totalXp ?? 0)

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
          <DashboardSkeleton />
        </ScrollView>
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-6">
        <Text className="text-base font-semibold text-white text-center">Something went wrong</Text>
        <Text className="text-sm text-fgSecondary text-center mt-2">{error}</Text>
        <Pressable onPress={loadData} className="mt-4 bg-primary px-6 py-3 rounded-2xl">
          <Text className="text-white font-bold">Try Again</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1 px-5 pt-6"
        contentContainerStyle={{ gap: 20, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={colors.primary}
          />
        }
      >
        {/* ── Header ── */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ gap: 2, flex: 1 }}>
            <Text className="text-xs font-semibold uppercase tracking-widest text-primary">
              Ready to conquer today?
            </Text>
            <Text className="text-4xl font-extrabold tracking-tight text-white">
              {header?.username ?? 'Runner'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <View
                style={{
                  backgroundColor: withAlpha(colors.primary, 0.15),
                  borderRadius: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderWidth: 1,
                  borderColor: withAlpha(colors.primary, 0.3),
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
                  Level {progress.currentLevel}
                </Text>
              </View>
              <Text className="text-xs text-fgMuted">
                {(header?.totalXp ?? 0).toLocaleString()} XP
              </Text>
            </View>
          </View>

          {/* Start Run CTA */}
          <Pressable
            onPress={() => router.push('/(protected)/record' as never)}
            style={({ pressed }) => ({
              backgroundColor: pressed ? colors.primaryDark : colors.primary,
              borderRadius: 16,
              paddingHorizontal: 16,
              paddingVertical: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginTop: 4,
            })}
          >
            <Ionicons name="play" size={14} color={colors.white} />
            <Text style={{ fontSize: 14, fontWeight: '800', color: colors.white }}>Run</Text>
          </Pressable>
        </View>

        {/* ── XP Progress bar ── */}
        <View className="rounded-2xl bg-surface p-5" style={{ gap: 10 }}>
          <View className="flex-row justify-between items-center">
            <Text className="text-xs font-semibold uppercase tracking-widest text-fgSecondary">
              Level Progress
            </Text>
            <Text className="text-xs font-bold text-primaryBright">
              {progress.progressPercent}%
            </Text>
          </View>
          <View className="h-2 w-full rounded-full bg-white/10">
            <View
              className="h-2 rounded-full bg-primary"
              style={{ width: `${progress.progressPercent}%` }}
            />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text className="text-xs text-fgMuted">
              Level {progress.currentLevel}
            </Text>
            {progress.nextLevel !== null && (
              <Text className="text-xs text-fgMuted">
                {progress.xpNeededToNextLevel} XP to Level {progress.nextLevel}
              </Text>
            )}
          </View>
        </View>

        {/* ── Lifetime Stats ── */}
        <SectionLabel>All Time</SectionLabel>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <StatCard
            label="Total XP"
            value={(header?.totalXp ?? 0).toLocaleString()}
            icon="flash"
            accent
          />
          <StatCard
            label="Distance"
            value={formatDistance(header?.totalDistanceM ?? 0)}
            icon="navigate"
          />
        </View>

        {/* ── Today's Activity ── */}
        <SectionLabel>Today</SectionLabel>
        <View className="flex-row" style={{ gap: 10 }}>
          <StatCard
            label="Distance"
            value={formatDistance(stats?.today.distanceM ?? 0)}
            icon="navigate"
          />
          <StatCard
            label="Time"
            value={formatDuration(stats?.today.durationS ?? 0)}
            icon="time"
          />
        </View>
        <View className="flex-row" style={{ gap: 10 }}>
          <StatCard
            label="XP Earned"
            value={`+${stats?.today.xpAwarded ?? 0}`}
            icon="star"
            accent
          />
          <StatCard
            label="Runs"
            value={String(stats?.today.runCount ?? 0)}
            icon="footsteps"
          />
        </View>

        {/* ── Quests ── */}
        <SectionLabel>Quests</SectionLabel>
        <QuestDashboard userId={session?.user.id ?? ''} />

        {/* ── Streak ── */}
        <SectionLabel>Streak</SectionLabel>
        <View className="flex-row" style={{ gap: 10 }}>
          <StreakCard
            label="Current Streak"
            value={stats?.streakDays ?? 0}
            unit="days"
            icon="flame"
            accent
          />
          <StreakCard
            label="Longest Streak"
            value={stats?.longestStreakDays ?? 0}
            unit="days"
            icon="trophy"
          />
        </View>

        {/* ── Weekly Progress ── */}
        <SectionLabel>This Week</SectionLabel>
        <View className="rounded-2xl bg-surface p-5" style={{ gap: 14 }}>
          <View className="flex-row justify-between">
            {DAYS.map((day, i) => {
              const active = stats?.thisWeekActiveDays[i] ?? false
              return (
                <View key={day} style={{ alignItems: 'center', gap: 6 }}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: active ? colors.primary : colors.surfaceMuted,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {active && <Ionicons name="checkmark" size={14} color={colors.white} />}
                  </View>
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '600',
                      color: active ? colors.primary : colors.fgMuted,
                    }}
                  >
                    {day}
                  </Text>
                </View>
              )
            })}
          </View>
          <Text className="text-xs text-fgSecondary">
            {stats?.thisWeekRunCount ?? 0} run{stats?.thisWeekRunCount !== 1 ? 's' : ''} this week
          </Text>
        </View>

        {/* ── Explore ── */}
        <SectionLabel>Explore</SectionLabel>
        <View className="flex-row flex-wrap" style={{ gap: 10 }}>
          <ExploreCard
            label="Territory"
            icon="map"
            onPress={() => router.push('/(protected)/(tabs)/territory' as never)}
          />
          <ExploreCard
            label="History"
            icon="list"
            onPress={() => router.push('/(protected)/(tabs)/run' as never)}
          />
          <ExploreCard
            label="Achievements"
            icon="medal"
            onPress={() => router.push('/(protected)/achievements' as never)}
          />
          <ExploreCard
            label="Leaderboards"
            icon="podium"
            onPress={() => router.push('/(protected)/leaderboards' as never)}
          />
        </View>

        {/* ── Recent Activity ── */}
        <View style={{ gap: 12 }}>
          <View className="flex-row items-center justify-between">
            <SectionLabel>Recent Activity</SectionLabel>
            <Pressable onPress={() => router.push('/(protected)/(tabs)/run' as never)}>
              <Text className="text-sm font-semibold text-primaryBright">See All →</Text>
            </Pressable>
          </View>

          {(stats?.recentWorkouts.length ?? 0) > 0 ? (
            (stats!.recentWorkouts as RecentWorkout[]).map((w) => (
              <WorkoutActivityCard
                key={w.id}
                workout={w}
                onPress={handleOpenRun}
              />
            ))
          ) : (
            <View className="rounded-2xl bg-surface p-5 items-center">
              <Text className="text-sm text-fgSecondary">
                No runs yet — tap Run to get started
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StreakCard({
  label,
  value,
  unit,
  icon,
  accent = false,
}: {
  label: string
  value: number
  unit: string
  icon: React.ComponentProps<typeof Ionicons>['name']
  accent?: boolean
}) {
  return (
    <View className="flex-1 rounded-2xl bg-surface p-4" style={{ gap: 4 }}>
      <View className="flex-row items-center" style={{ gap: 6 }}>
        <Ionicons name={icon} size={16} color={accent ? colors.primary : colors.fgSecondary} />
        <Text className="text-[10px] font-semibold uppercase tracking-widest text-fgSecondary">
          {label}
        </Text>
      </View>
      <Text style={{ fontSize: 30, fontFamily: fonts.displayHeavy, color: accent ? colors.primary : colors.white, fontVariant: ['tabular-nums'] }}>
        {value}
        <Text style={{ fontSize: 14, fontFamily: fonts.display, color: colors.fgMuted }}>{' '}{unit}</Text>
      </Text>
    </View>
  )
}

function ExploreCard({
  label,
  icon,
  onPress,
}: {
  label: string
  icon: React.ComponentProps<typeof Ionicons>['name']
  onPress: () => void
}) {
  const scale = useSharedValue(1)
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.95) }}
      onPressOut={() => { scale.value = withSpring(1) }}
      style={{ width: '47.5%' }}
    >
      <Animated.View
        style={[
          animatedStyle,
          {
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 16,
            gap: 10,
            borderWidth: 1,
            borderColor: withAlpha(colors.white, 0.06),
          },
        ]}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: withAlpha(colors.primary, 0.12),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={18} color={colors.primary} />
        </View>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.white }}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  )
}
