import { useCallback, useState } from 'react'
import { View, Text, Pressable, Alert, ScrollView, RefreshControl } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect } from 'expo-router'
import { useSession } from '@/features/auth/providers/SessionProvider'
import { supabase } from '@/lib/supabase'
import { queryGet, querySet, queryFetch } from '@/lib/queryCache'
import { profileKey } from '@/lib/cacheKeys'
import { getXpProgress } from '@stridequest/shared/xp'
import { formatDistance } from '@stridequest/shared/running'
import { loadProfileSummary, type ProfileData, type ProfileSummary } from '@/features/profiles/services/profile-summary'
import { ProfileSkeleton } from '@/components/ui/SkeletonLoader'
import type { PersonalRecord, RecentActivity } from '@/features/profiles/services/profile'
import { ProfileHeader } from './_profile-header'
import { colors } from '@/theme'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { StatCard } from '@/components/ui/StatCard'
import {
  RecordCard,
  ActivityRow,
  ShortcutRow,
} from './_profile-components'

const CACHE_STALE_MS = 60_000

export default function ProfileScreen() {
  const { session } = useSession()
  const router = useRouter()
  const [data, setData] = useState<ProfileData | null>(null)
  const [records, setRecords] = useState<PersonalRecord[]>([])
  const [activity, setActivity] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [topAchievements, setTopAchievements] = useState<{ id: string; icon: string; title: string }[]>([])

  const fetchAndStore = useCallback(async (userId: string, userEmail: string | undefined) => {
    const summary = await queryFetch(profileKey(userId), () => loadProfileSummary(userId, userEmail))
    querySet<ProfileSummary>(profileKey(userId), summary)
    setData(summary.data)
    setRecords(summary.records)
    setActivity(summary.activity)
    setTopAchievements(summary.topAchievements)
  }, [])

  const loadData = useCallback(() => {
    const userId = session?.user.id
    if (!userId) return

    const cached = queryGet<ProfileSummary>(profileKey(userId), CACHE_STALE_MS)
    if (cached) {
      // Serve from cache immediately — no skeleton flash on tab switches
      setData(cached.data)
      setRecords(cached.records)
      setActivity(cached.activity)
      setTopAchievements(cached.topAchievements)
      setLoading(false)
      // Revalidate silently in background
      void fetchAndStore(userId, session?.user.email).catch(() => {})
      return
    }

    setLoading(true)
    setError(null)
    void (async () => {
      try {
        await fetchAndStore(userId, session?.user.email)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load profile')
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
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          <ProfileSkeleton />
        </View>
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.white, textAlign: 'center' }}>
          Failed to load profile
        </Text>
        <Text style={{ fontSize: 13, color: colors.fgSecondary, textAlign: 'center', marginTop: 6 }}>
          {error}
        </Text>
        <Pressable
          onPress={loadData}
          style={{ marginTop: 16, backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 }}
        >
          <Text style={{ color: colors.white, fontWeight: '700' }}>Try Again</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  const initial = (data?.username ?? 'R')[0].toUpperCase()

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1 px-5 pt-6"
        contentContainerStyle={{ gap: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={colors.primary}
          />
        }
      >
        <Animated.View entering={FadeInDown.delay(0).duration(400)}>
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
          onXpDetailsPress={() => router.push('/(protected)/xp')}
        />
        </Animated.View>

        {/* ── Stats 2×2 Grid ── */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
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
            <StatCard
              label="Territory"
              value={String(data?.territoryCount ?? 0)}
              icon="map"
              footer={
                (data?.captureCount ?? 0) > 0 || (data?.stolenCount ?? 0) > 0
                  ? `${data?.captureCount ?? 0} captured · ${data?.stolenCount ?? 0} stolen`
                  : undefined
              }
            />
            <StatCard
              label="Achievements"
              value={`${data?.achievementCount ?? 0}/${data?.totalAchievements ?? 0}`}
              icon="medal"
              accent
            />
          </View>
        </View>
        </Animated.View>

        {/* ── Personal Records ── */}
        {records.length > 0 && (
          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <View style={{ gap: 10 }}>
            <SectionLabel>Personal Records</SectionLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {records.map((rec) => (
                <RecordCard key={rec.id} record={rec} />
              ))}
            </View>
          </View>
          </Animated.View>
        )}

        {/* ── Recent Activity ── */}
        {activity.length > 0 && (
          <View style={{ gap: 10 }}>
            <SectionLabel>Recent Activity</SectionLabel>
            <View className="rounded-2xl bg-surface overflow-hidden">
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
            onPress={() => router.push('/(protected)/xp')}
          />
          <ShortcutRow
            label="Achievements"
            icon="medal"
            onPress={() => router.push('/(protected)/achievements')}
          />
          <ShortcutRow
            label="Leaderboards"
            icon="podium"
            onPress={() => router.push('/(protected)/leaderboards')}
          />
        </View>

        {/* Logout */}
        <Pressable
          onPress={handleLogout}
          className="items-center rounded-2xl border border-danger/40 py-4"
        >
          <Text className="text-base font-semibold text-danger">Sign Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}
