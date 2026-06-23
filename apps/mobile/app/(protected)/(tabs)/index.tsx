import { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, View, Text, ScrollView, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { useSession } from '@/features/auth/providers/SessionProvider'
import { supabase } from '@/lib/supabase'
import { getXpProgress } from '@stridequest/shared/xp'
import { formatDistance } from '@stridequest/shared/running'
import { getRecentWorkouts } from '@/features/running/services/history'
import { WorkoutActivityCard } from '@/features/running/components/WorkoutActivityCard'
import type { RecentWorkout } from '@/features/running/services/history'

type DashboardData = {
  username: string
  totalXp: number
  totalDistanceM: number
  workoutCount: number
  recentWorkouts: RecentWorkout[]
}

export default function HomeScreen() {
  const { session } = useSession()
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [recentLoading, setRecentLoading] = useState(true)

  const loadData = useCallback(() => {
    const userId = session?.user.id
    if (!userId) return

    setRecentLoading(true)

    void (async () => {
      const [profileResult, xpResult, workoutsResult, recentResult] = await Promise.all([
        supabase.from('profiles').select('username').eq('id', userId).single(),
        supabase.from('user_xp').select('total_xp').eq('user_id', userId).single(),
        supabase
          .from('workouts')
          .select('distance_m')
          .eq('user_id', userId)
          .eq('status', 'completed'),
        getRecentWorkouts(5),
      ])

      const workouts = workoutsResult.data ?? []
      const totalDistanceM = workouts.reduce((sum, w) => sum + ((w.distance_m as number | null) ?? 0), 0)

      setData({
        username: profileResult.data?.username ?? session?.user.email ?? 'Runner',
        totalXp: xpResult.data?.total_xp ?? 0,
        totalDistanceM,
        workoutCount: workouts.length,
        recentWorkouts: recentResult,
      })
      setRecentLoading(false)
    })()
  }, [session?.user.id, session?.user.email])

  useFocusEffect(loadData)

  const progress = getXpProgress(data?.totalXp ?? 0)

  return (
    <SafeAreaView className="flex-1 bg-[#0b0b0f]">
      <ScrollView className="flex-1 px-5 pt-6" contentContainerClassName="gap-6 pb-12">

        {/* Header */}
        <View className="gap-1">
          <Text className="text-xs font-semibold uppercase tracking-widest text-emerald-500">
            Ready to conquer today?
          </Text>
          <Text className="text-4xl font-extrabold tracking-tight text-white">
            {data?.username ?? session?.user.email ?? 'Runner'}
          </Text>
        </View>

        {/* Stats row */}
        <View className="flex-row gap-3">
          <StatCard label="Total XP" value={(data?.totalXp ?? 0).toLocaleString()} unit="xp" />
          <StatCard label="Distance" value={formatDistance(data?.totalDistanceM ?? 0)} unit="" />
          <StatCard label="Runs" value={String(data?.workoutCount ?? 0)} unit="" />
        </View>

        {/* XP Progress */}
        <View className="rounded-2xl bg-neutral-900 p-5 gap-3">
          <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
            Level {progress.currentLevel}
          </Text>
          <View className="h-2 w-full rounded-full bg-white/10">
            <View
              className="h-2 rounded-full bg-emerald-500"
              style={{ width: `${progress.progressPercent}%` }}
            />
          </View>
          <Text className="text-sm text-neutral-400">
            {progress.xpNeededToNextLevel > 0
              ? `${progress.xpNeededToNextLevel} XP to level ${progress.currentLevel + 1}`
              : 'Max level reached'}
          </Text>
        </View>

        {/* Recent Activity */}
        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-bold text-white">Recent Activity</Text>
            <Pressable onPress={() => router.push('/(protected)/(tabs)/run' as never)}>
              <Text className="text-sm font-semibold text-emerald-400">See All →</Text>
            </Pressable>
          </View>

          {recentLoading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : data && data.recentWorkouts.length > 0 ? (
            data.recentWorkouts.map((workout) => (
              <WorkoutActivityCard
                key={workout.id}
                workout={workout}
                onPress={() => router.push(`/(protected)/(tabs)/run/${workout.id}` as never)}
              />
            ))
          ) : (
            <View className="rounded-2xl bg-neutral-900 p-5 items-center">
              <Text className="text-sm text-neutral-400">No runs yet — tap Run to get started</Text>
            </View>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

function StatCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View className="flex-1 rounded-2xl bg-neutral-900 p-4 gap-1">
      <Text className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
        {label}
      </Text>
      <Text className="text-2xl font-bold text-white">
        {value}
        {unit ? <Text className="text-sm text-neutral-400"> {unit}</Text> : null}
      </Text>
    </View>
  )
}

function SkeletonCard() {
  const opacity = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    )
    anim.start()
    return () => anim.stop()
  }, [opacity])

  return (
    <Animated.View
      style={{ opacity, height: 80, borderRadius: 16, backgroundColor: '#171717' }}
    />
  )
}
