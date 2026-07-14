import { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { getXpProgress } from '@stridequest/shared/xp'
import { formatDistance } from '@stridequest/shared/running'
import { StatCard } from '@/components/ui/StatCard'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { fetchPublicProfile } from '@/features/profiles/services/public-profile'
import type { PublicProfile } from '@/features/profiles/services/public-profile'
import { colors } from '@/theme'

export default function PublicProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>()
  const router = useRouter()
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!username) return
    void (async () => {
      const p = await fetchPublicProfile(username)
      if (!p) setNotFound(true)
      else setProfile(p)
      setLoading(false)
    })()
  }, [username])

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    )
  }

  if (notFound || !profile) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center gap-4">
        <Ionicons name="person-outline" size={48} color={colors.fgFaint} />
        <Text className="text-lg font-bold text-white">Runner not found</Text>
        <Text className="text-sm text-fgMuted">@{username} doesn&apos;t exist</Text>
        <Pressable onPress={() => router.back()}>
          <Text className="text-sm font-semibold text-primary">← Go Back</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  const progress = getXpProgress(profile.totalXp)

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center px-5 pt-5 pb-4 gap-3">
        <Pressable onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </Pressable>
        <Text className="text-lg font-bold text-white">Profile</Text>
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ gap: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile header card */}
        <View className="bg-surface rounded-[20px] p-5 gap-3 border border-white/[0.06]">
          {/* Avatar placeholder */}
          <View className="flex-row items-center gap-4">
            <View className="w-16 h-16 rounded-full items-center justify-center bg-primary/15 border-2 border-primary">
              <Text className="text-2xl font-extrabold text-primary">
                {profile.username[0].toUpperCase()}
              </Text>
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-[22px] font-extrabold text-white">
                {profile.username}
              </Text>
              <View className="flex-row items-center gap-2">
                <View className="rounded-lg bg-primary/15 px-2.5 py-[3px]">
                  <Text className="text-xs font-bold text-primary">
                    Level {profile.level}
                  </Text>
                </View>
                <Text className="text-xs text-fgMuted">
                  {profile.totalXp.toLocaleString()} XP
                </Text>
              </View>
            </View>
          </View>

          {/* XP Progress bar */}
          <View className="gap-1.5">
            <View className="h-1.5 rounded-sm bg-white/[0.08]">
              <View
                className="h-1.5 rounded-sm bg-primary"
                style={{ width: `${progress.progressPercent}%` }}
              />
            </View>
            {progress.nextLevel !== null && (
              <Text className="text-[11px] text-fgFaint">
                {progress.xpNeededToNextLevel} XP to Level {progress.nextLevel}
              </Text>
            )}
          </View>
        </View>

        {/* Stats grid */}
        <View className="gap-2">
          <SectionLabel>Stats</SectionLabel>
          <View className="flex-row gap-2">
            <StatCard label="Total Distance" value={formatDistance(profile.totalDistanceM)} icon="navigate" />
            <StatCard label="Runs" value={String(profile.totalWorkouts)} icon="footsteps" />
          </View>
          <View className="flex-row gap-2">
            <StatCard label="Territory Cells" value={String(profile.territoriesOwned)} icon="map" />
            <StatCard label="Captures" value={String(profile.territoriesCaptured)} icon="flag" />
          </View>
          {profile.territoriesStolen > 0 && (
            <View className="flex-row gap-2">
              <StatCard label="Territories Stolen" value={String(profile.territoriesStolen)} icon="flash" accent />
              <View className="flex-1" />
            </View>
          )}
        </View>

        {/* Personal Records */}
        {profile.records.length > 0 && (
          <View className="gap-2">
            <SectionLabel>Personal Records</SectionLabel>
            <View className="flex-row flex-wrap gap-2.5">
              {profile.records.map((rec) => (
                <View
                  key={rec.id}
                  className="w-[47%] bg-surface rounded-[14px] p-3.5 gap-1 border border-white/[0.06]"
                >
                  <Text className="text-[10px] font-semibold text-fgMuted uppercase tracking-[0.5px]">
                    {rec.title}
                  </Text>
                  <Text className="text-lg font-extrabold text-primary">
                    {rec.displayValue}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Recent Activity */}
        {profile.recentActivity.length > 0 && (
          <View className="gap-2">
            <SectionLabel>Recent Activity</SectionLabel>
            <View className="rounded-2xl bg-surface overflow-hidden">
              {profile.recentActivity.map((item, i) => {
                const dateStr = new Date(item.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })
                const isLast = i === profile.recentActivity.length - 1
                return (
                  <View
                    key={item.id}
                    className={`flex-row items-center px-4 py-3 gap-3 ${isLast ? '' : 'border-b border-white/5'}`}
                  >
                    <Ionicons name="footsteps" size={16} color={colors.primary} />
                    <Text className="flex-1 text-[13px] text-fgBright">{item.title}</Text>
                    <Text className="text-[11px] text-fgFaint">{dateStr}</Text>
                  </View>
                )
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
