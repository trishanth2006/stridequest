import { useCallback, useState } from 'react'
import { View, Text, Pressable, Alert, ScrollView, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect } from 'expo-router'
import { useSession } from '@/features/auth/providers/SessionProvider'
import { supabase } from '@/lib/supabase'
import { getXpProgress } from '@stridequest/shared/xp'
import { formatDistance } from '@stridequest/shared/running'
import { loadOwnProfileExtras } from '@/features/profiles/services/profile'
import { fetchMyRank } from '@/features/leaderboards/services/leaderboards'
import { loadAchievements } from '@/features/achievements/services/achievements'
import type { PersonalRecord, RecentActivity } from '@/features/profiles/services/profile'
import { ProfileHeader } from './profile-header'
import {
  SectionLabel,
  StatCard,
  TerritoryStatCard,
  RecordCard,
  ActivityRow,
  ShortcutRow,
} from './profile-components'

type ProfileData = {
  username: string
  totalXp: number
  totalDistanceM: number
  workoutCount: number
  territoryCount: number
  xpRank: number
  totalUsers: number
  achievementCount: number
  totalAchievements: number
  captureCount: number
  stolenCount: number
  profileCompletion: number
}

export default function ProfileScreen() {
  const { session } = useSession()
  const router = useRouter()
  const [data, setData] = useState<ProfileData | null>(null)
  const [records, setRecords] = useState<PersonalRecord[]>([])
  const [activity, setActivity] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [topAchievements, setTopAchievements] = useState<{ id: string; icon: string; title: string }[]>([])

  const loadData = useCallback(() => {
    const userId = session?.user.id
    if (!userId) return

    setLoading(true)
    void (async () => {
      try {
        const [profileResult, xpResult, workoutsResult, territoryResult, extras, rankResult, achResult, claimsResult, stolenResult] =
          await Promise.all([
            supabase.from('profiles').select('username').eq('id', userId).single(),
            supabase.from('user_xp').select('total_xp').eq('user_id', userId).single(),
            supabase
              .from('workouts')
              .select('distance_m')
              .eq('user_id', userId)
              .eq('status', 'completed'),
            supabase
              .from('cell_ownership')
              .select('cell_id', { count: 'exact', head: true })
              .eq('owner_user_id', userId),
            loadOwnProfileExtras(),
            fetchMyRank('xp').catch(() => ({ rank: 0, totalUsers: 0, value: 0, percentile: 0, nextRankValue: null })),
            loadAchievements().catch(() => ({ achievements: [], totalXp: 0 })),
            supabase.from('territory_captures').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('action', 'claim'),
            supabase.from('territory_captures').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('action', 'steal'),
          ])

        const workouts = workoutsResult.data ?? []
        const totalDistanceM = workouts.reduce(
          (sum, w) => sum + ((w.distance_m as number | null) ?? 0),
          0,
        )

        const achs = achResult.achievements
        const unlockedCount = achs.filter((a) => a.unlocked).length

        const captureCount = claimsResult.count ?? 0
        const stolenCount = stolenResult.count ?? 0
        const totalXp = xpResult.data?.total_xp ?? 0
        const workoutCount = workouts.length
        const profileCompletion = Math.round(
          ([
            totalXp > 0,
            workoutCount > 0,
            (territoryResult.count ?? 0) > 0,
            unlockedCount > 0,
          ].filter(Boolean).length / 4) * 100
        )

        const unlocked = achs.filter((a) => a.unlocked)
        setTopAchievements(unlocked.slice(0, 3).map((a) => ({ id: a.id, icon: a.icon, title: a.title })))

        setData({
          username: profileResult.data?.username ?? session?.user.email ?? 'Runner',
          totalXp,
          totalDistanceM,
          workoutCount,
          territoryCount: territoryResult.count ?? 0,
          xpRank: rankResult.rank,
          totalUsers: rankResult.totalUsers,
          achievementCount: unlockedCount,
          totalAchievements: achs.length,
          captureCount,
          stolenCount,
          profileCompletion,
        })
        setRecords(extras.personalRecords)
        setActivity(extras.recentActivity)
        setLoading(false)
      } catch {
        setLoading(false)
      }
    })()
  }, [session?.user.id, session?.user.email])

  useFocusEffect(loadData)

  const progress = getXpProgress(data?.totalXp ?? 0)

  async function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut()
          router.replace('/(auth)/login')
        },
      },
    ])
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-[#0b0b0f] items-center justify-center">
        <ActivityIndicator color="#10b981" size="large" />
      </SafeAreaView>
    )
  }

  const initial = (data?.username ?? 'R')[0].toUpperCase()

  return (
    <SafeAreaView className="flex-1 bg-[#0b0b0f]">
      <ScrollView
        className="flex-1 px-5 pt-6"
        contentContainerStyle={{ gap: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <ProfileHeader
          username={data?.username ?? 'Runner'}
          initial={initial}
          xpRank={data?.xpRank ?? 0}
          achievementCount={data?.achievementCount ?? 0}
          totalAchievements={data?.totalAchievements ?? 0}
          totalXp={data?.totalXp ?? 0}
          currentLevel={progress.currentLevel}
          nextLevel={progress.nextLevel}
          progressPercent={progress.progressPercent}
          xpNeededToNextLevel={progress.xpNeededToNextLevel}
          profileCompletion={data?.profileCompletion ?? 0}
          topAchievements={topAchievements}
          onXpDetailsPress={() => router.push('/(protected)/xp' as never)}
        />

        {/* ── Stats 2×2 Grid ── */}
        <View style={{ gap: 10 }}>
          <SectionLabel>Stats</SectionLabel>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatCard
              label="Distance"
              value={formatDistance(data?.totalDistanceM ?? 0)}
              icon="navigate"
            />
            <StatCard
              label="Runs"
              value={String(data?.workoutCount ?? 0)}
              icon="footsteps"
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TerritoryStatCard
              count={data?.territoryCount ?? 0}
              captureCount={data?.captureCount ?? 0}
              stolenCount={data?.stolenCount ?? 0}
            />
            <StatCard
              label="Achievements"
              value={`${data?.achievementCount ?? 0}/${data?.totalAchievements ?? 0}`}
              icon="medal"
              accent
            />
          </View>
        </View>

        {/* ── Personal Records ── */}
        {records.length > 0 && (
          <View style={{ gap: 10 }}>
            <SectionLabel>Personal Records</SectionLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {records.map((rec) => (
                <RecordCard key={rec.id} record={rec} />
              ))}
            </View>
          </View>
        )}

        {/* ── Recent Activity ── */}
        {activity.length > 0 && (
          <View style={{ gap: 10 }}>
            <SectionLabel>Recent Activity</SectionLabel>
            <View className="rounded-2xl bg-neutral-900 overflow-hidden">
              {activity.slice(0, 5).map((item, i) => (
                <ActivityRow
                  key={item.id}
                  item={item}
                  isLast={i === Math.min(activity.length, 5) - 1}
                />
              ))}
            </View>
          </View>
        )}

        {/* ── Quick Links ── */}
        <View style={{ gap: 8 }}>
          <SectionLabel>Explore</SectionLabel>
          <ShortcutRow
            label="XP & Progress"
            icon="flash"
            onPress={() => router.push('/(protected)/xp' as never)}
          />
          <ShortcutRow
            label="Achievements"
            icon="medal"
            onPress={() => router.push('/(protected)/achievements' as never)}
          />
          <ShortcutRow
            label="Leaderboards"
            icon="podium"
            onPress={() => router.push('/(protected)/leaderboards' as never)}
          />
        </View>

        {/* Logout */}
        <Pressable
          onPress={handleLogout}
          className="items-center rounded-2xl border border-red-500/40 py-4"
        >
          <Text className="text-base font-semibold text-red-400">Sign Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}
