import { useCallback, useRef, useState } from 'react'
import {
  Animated,
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSession } from '@/features/auth/providers/SessionProvider'
import { supabase } from '@/lib/supabase'
import { getXpProgress } from '@stridequest/shared/xp'
import { formatDistance, formatDuration } from '@stridequest/shared/running'
import { computeDashboardStats, type DashboardComputedStats } from '@stridequest/shared/analytics'
import { loadDashboard } from '@/features/running/services/dashboard'
import { WorkoutActivityCard } from '@/features/running/components/WorkoutActivityCard'
import type { RecentWorkout } from '@/features/running/services/history'

type HeaderData = {
  username: string
  totalXp: number
  totalDistanceM: number
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function HomeScreen() {
  const { session } = useSession()
  const router = useRouter()
  const [header, setHeader] = useState<HeaderData | null>(null)
  const [stats, setStats] = useState<DashboardComputedStats | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(() => {
    const userId = session?.user.id
    if (!userId) return

    setLoading(true)
    void (async () => {
      const [profileRes, xpRes, workoutsRes, dashResult] = await Promise.all([
        supabase.from('profiles').select('username').eq('id', userId).single(),
        supabase.from('user_xp').select('total_xp').eq('user_id', userId).single(),
        supabase
          .from('workouts')
          .select('distance_m')
          .eq('user_id', userId)
          .eq('status', 'completed'),
        loadDashboard(),
      ])

      const totalDistanceM = (workoutsRes.data ?? []).reduce(
        (sum, w) => sum + ((w.distance_m as number | null) ?? 0),
        0,
      )

      setHeader({
        username: profileRes.data?.username ?? session?.user.email ?? 'Runner',
        totalXp: xpRes.data?.total_xp ?? 0,
        totalDistanceM,
      })

      const computed = computeDashboardStats(dashResult.activity, new Date())
      setStats(computed)
      setLoading(false)
    })()
  }, [session?.user.id, session?.user.email])

  useFocusEffect(loadData)

  const progress = getXpProgress(header?.totalXp ?? 0)

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-[#0b0b0f] items-center justify-center">
        <ActivityIndicator color="#10b981" size="large" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0b0b0f]">
      <ScrollView
        className="flex-1 px-5 pt-6"
        contentContainerStyle={{ gap: 20, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ gap: 2, flex: 1 }}>
            <Text className="text-xs font-semibold uppercase tracking-widest text-emerald-500">
              Ready to conquer today?
            </Text>
            <Text className="text-4xl font-extrabold tracking-tight text-white">
              {header?.username ?? 'Runner'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <View
                style={{
                  backgroundColor: 'rgba(16,185,129,0.15)',
                  borderRadius: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderWidth: 1,
                  borderColor: 'rgba(16,185,129,0.3)',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#10b981' }}>
                  Level {progress.currentLevel}
                </Text>
              </View>
              <Text className="text-xs text-neutral-500">
                {(header?.totalXp ?? 0).toLocaleString()} XP
              </Text>
            </View>
          </View>

          {/* Start Run CTA */}
          <Pressable
            onPress={() => router.push('/(protected)/record' as never)}
            style={({ pressed }) => ({
              backgroundColor: pressed ? '#059669' : '#10b981',
              borderRadius: 16,
              paddingHorizontal: 16,
              paddingVertical: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginTop: 4,
            })}
          >
            <Ionicons name="play" size={14} color="#fff" />
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>Run</Text>
          </Pressable>
        </View>

        {/* ── XP Progress bar ── */}
        <View className="rounded-2xl bg-neutral-900 p-5" style={{ gap: 10 }}>
          <View className="flex-row justify-between items-center">
            <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
              Level Progress
            </Text>
            <Text className="text-xs font-bold text-emerald-400">
              {progress.progressPercent}%
            </Text>
          </View>
          <View className="h-2 w-full rounded-full bg-white/10">
            <View
              className="h-2 rounded-full bg-emerald-500"
              style={{ width: `${progress.progressPercent}%` }}
            />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text className="text-xs text-neutral-500">
              Level {progress.currentLevel}
            </Text>
            {progress.nextLevel !== null && (
              <Text className="text-xs text-neutral-500">
                {progress.xpNeededToNextLevel} XP to Level {progress.nextLevel}
              </Text>
            )}
          </View>
        </View>

        {/* ── Lifetime Stats ── */}
        <SectionLabel>All Time</SectionLabel>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <LifetimeStat
            label="Total XP"
            value={(header?.totalXp ?? 0).toLocaleString()}
            icon="flash"
            accent
          />
          <LifetimeStat
            label="Distance"
            value={formatDistance(header?.totalDistanceM ?? 0)}
            icon="navigate"
          />
        </View>

        {/* ── Today's Activity ── */}
        <SectionLabel>Today</SectionLabel>
        <View className="flex-row" style={{ gap: 10 }}>
          <TodayCard
            label="Distance"
            value={formatDistance(stats?.today.distanceM ?? 0)}
            icon="navigate"
          />
          <TodayCard
            label="Time"
            value={formatDuration(stats?.today.durationS ?? 0)}
            icon="time"
          />
        </View>
        <View className="flex-row" style={{ gap: 10 }}>
          <TodayCard
            label="XP Earned"
            value={`+${stats?.today.xpAwarded ?? 0}`}
            icon="star"
            accent
          />
          <TodayCard
            label="Runs"
            value={String(stats?.today.runCount ?? 0)}
            icon="footsteps"
          />
        </View>

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
        <View className="rounded-2xl bg-neutral-900 p-5" style={{ gap: 14 }}>
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
                      backgroundColor: active ? '#10b981' : '#262626',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {active && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '600',
                      color: active ? '#10b981' : '#71717a',
                    }}
                  >
                    {day}
                  </Text>
                </View>
              )
            })}
          </View>
          <Text className="text-xs text-neutral-400">
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
              <Text className="text-sm font-semibold text-emerald-400">See All →</Text>
            </Pressable>
          </View>

          {(stats?.recentWorkouts.length ?? 0) > 0 ? (
            (stats!.recentWorkouts as RecentWorkout[]).map((w) => (
              <WorkoutActivityCard
                key={w.id}
                workout={w}
                onPress={() =>
                  router.push(`/(protected)/(tabs)/run/${w.id}` as never)
                }
              />
            ))
          ) : (
            <View className="rounded-2xl bg-neutral-900 p-5 items-center">
              <Text className="text-sm text-neutral-400">
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
      {children}
    </Text>
  )
}

function LifetimeStat({
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
        backgroundColor: accent ? 'rgba(16,185,129,0.08)' : '#171717',
        borderRadius: 16,
        padding: 16,
        gap: 6,
        borderWidth: 1,
        borderColor: accent ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.06)',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name={icon} size={14} color={accent ? '#10b981' : '#71717a'} />
        <Text style={{ fontSize: 10, fontWeight: '700', color: accent ? '#10b981' : '#71717a', textTransform: 'uppercase', letterSpacing: 0.8 }}>
          {label}
        </Text>
      </View>
      <Text style={{ fontSize: 22, fontWeight: '900', color: accent ? '#10b981' : '#fff', letterSpacing: -0.5 }}>
        {value}
      </Text>
    </View>
  )
}

function TodayCard({
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
      className="flex-1 rounded-2xl bg-neutral-900 p-4"
      style={{ gap: 8 }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          backgroundColor: accent ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={16} color={accent ? '#10b981' : '#a3a3a3'} />
      </View>
      <Text
        style={{
          fontSize: 20,
          fontWeight: '800',
          color: accent ? '#10b981' : '#fff',
          letterSpacing: -0.5,
        }}
      >
        {value}
      </Text>
      <Text className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
        {label}
      </Text>
    </View>
  )
}

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
    <View
      className="flex-1 rounded-2xl bg-neutral-900 p-4"
      style={{ gap: 4 }}
    >
      <View className="flex-row items-center" style={{ gap: 6 }}>
        <Ionicons name={icon} size={16} color={accent ? '#10b981' : '#a3a3a3'} />
        <Text className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
          {label}
        </Text>
      </View>
      <Text
        style={{
          fontSize: 28,
          fontWeight: '800',
          color: accent ? '#10b981' : '#fff',
          letterSpacing: -1,
        }}
      >
        {value}
        <Text style={{ fontSize: 13, fontWeight: '500', color: '#71717a' }}>
          {' '}
          {unit}
        </Text>
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
  const scale = useRef(new Animated.Value(1)).current

  const handlePressIn = () =>
    Animated.spring(scale, { toValue: 0.95, useNativeDriver: true }).start()
  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start()

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={{ width: '47.5%' }}
    >
      <Animated.View
        style={{
          transform: [{ scale }],
          backgroundColor: '#171717',
          borderRadius: 16,
          padding: 16,
          gap: 10,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: 'rgba(16,185,129,0.12)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={18} color="#10b981" />
        </View>
        <Text
          style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  )
}
