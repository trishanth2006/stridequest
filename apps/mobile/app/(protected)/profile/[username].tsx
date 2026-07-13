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
import { colors, withAlpha } from '@/theme'

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
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    )
  }

  if (notFound || !profile) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <Ionicons name="person-outline" size={48} color={colors.fgFaint} />
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.white }}>Runner not found</Text>
        <Text style={{ fontSize: 14, color: colors.fgMuted }}>@{username} doesn't exist</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>← Go Back</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  const progress = getXpProgress(profile.totalXp)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, gap: 12 }}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.white }}>Profile</Text>
      </View>

      <ScrollView
        style={{ flex: 1, paddingHorizontal: 20 }}
        contentContainerStyle={{ gap: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile header card */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 20,
            padding: 20,
            gap: 12,
            borderWidth: 1,
            borderColor: withAlpha(colors.white, 0.06),
          }}
        >
          {/* Avatar placeholder */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: withAlpha(colors.primary, 0.15),
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: colors.primary,
              }}
            >
              <Text style={{ fontSize: 24, fontWeight: '800', color: colors.primary }}>
                {profile.username[0].toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: colors.white }}>
                {profile.username}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    backgroundColor: withAlpha(colors.primary, 0.15),
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
                    Level {profile.level}
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: colors.fgMuted }}>
                  {profile.totalXp.toLocaleString()} XP
                </Text>
              </View>
            </View>
          </View>

          {/* XP Progress bar */}
          <View style={{ gap: 6 }}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: withAlpha(colors.white, 0.08) }}>
              <View
                style={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: colors.primary,
                  width: `${progress.progressPercent}%`,
                }}
              />
            </View>
            {progress.nextLevel !== null && (
              <Text style={{ fontSize: 11, color: colors.fgFaint }}>
                {progress.xpNeededToNextLevel} XP to Level {progress.nextLevel}
              </Text>
            )}
          </View>
        </View>

        {/* Stats grid */}
        <View style={{ gap: 8 }}>
          <SectionLabel>Stats</SectionLabel>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <StatCard label="Total Distance" value={formatDistance(profile.totalDistanceM)} icon="navigate" />
            <StatCard label="Runs" value={String(profile.totalWorkouts)} icon="footsteps" />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <StatCard label="Territory Cells" value={String(profile.territoriesOwned)} icon="map" />
            <StatCard label="Captures" value={String(profile.territoriesCaptured)} icon="flag" />
          </View>
          {profile.territoriesStolen > 0 && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <StatCard label="Territories Stolen" value={String(profile.territoriesStolen)} icon="flash" accent />
              <View style={{ flex: 1 }} />
            </View>
          )}
        </View>

        {/* Personal Records */}
        {profile.records.length > 0 && (
          <View style={{ gap: 8 }}>
            <SectionLabel>Personal Records</SectionLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {profile.records.map((rec) => (
                <View
                  key={rec.id}
                  style={{
                    width: '47%',
                    backgroundColor: colors.surface,
                    borderRadius: 14,
                    padding: 14,
                    gap: 4,
                    borderWidth: 1,
                    borderColor: withAlpha(colors.white, 0.06),
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '600', color: colors.fgMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {rec.title}
                  </Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.primary }}>
                    {rec.displayValue}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Recent Activity */}
        {profile.recentActivity.length > 0 && (
          <View style={{ gap: 8 }}>
            <SectionLabel>Recent Activity</SectionLabel>
            <View style={{ borderRadius: 16, backgroundColor: colors.surface, overflow: 'hidden' }}>
              {profile.recentActivity.map((item, i) => {
                const dateStr = new Date(item.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })
                const isLast = i === profile.recentActivity.length - 1
                return (
                  <View
                    key={item.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      gap: 12,
                      borderBottomWidth: isLast ? 0 : 1,
                      borderBottomColor: withAlpha(colors.white, 0.05),
                    }}
                  >
                    <Ionicons
                      name="footsteps"
                      size={16}
                      color={colors.primary}
                    />
                    <Text style={{ flex: 1, fontSize: 13, color: colors.fgBright }}>{item.title}</Text>
                    <Text style={{ fontSize: 11, color: colors.fgFaint }}>{dateStr}</Text>
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

