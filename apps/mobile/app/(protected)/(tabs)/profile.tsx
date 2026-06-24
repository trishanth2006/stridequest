import { useCallback, useState } from 'react'
import { View, Text, Pressable, Alert, ScrollView, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSession } from '@/features/auth/providers/SessionProvider'
import { supabase } from '@/lib/supabase'
import { getXpProgress } from '@stridequest/shared/xp'
import { formatDistance } from '@stridequest/shared/running'
import { loadOwnProfileExtras } from '@/features/profiles/services/profile'
import { fetchMyRank } from '@/features/leaderboards/services/leaderboards'
import { loadAchievements } from '@/features/achievements/services/achievements'
import type { PersonalRecord, RecentActivity } from '@/features/profiles/services/profile'

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
        {/* ── Gamer Profile Header ── */}
        <View
          style={{
            backgroundColor: '#171717',
            borderRadius: 20,
            padding: 20,
            gap: 16,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.06)',
          }}
        >
          {/* Avatar row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            {/* Avatar */}
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: 'rgba(16,185,129,0.15)',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: '#10b981',
              }}
            >
              <Text style={{ fontSize: 28, fontWeight: '900', color: '#10b981' }}>
                {initial}
              </Text>
            </View>

            {/* Name + badges */}
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.5 }}>
                {data?.username ?? 'Runner'}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {/* Level badge */}
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
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#10b981' }}>
                    ⭐ Level {progress.currentLevel}
                  </Text>
                </View>

                {/* Rank badge */}
                {(data?.xpRank ?? 0) > 0 && (
                  <View
                    style={{
                      backgroundColor: 'rgba(99,102,241,0.15)',
                      borderRadius: 8,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderWidth: 1,
                      borderColor: 'rgba(99,102,241,0.3)',
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#818cf8' }}>
                      #{data!.xpRank} Global
                    </Text>
                  </View>
                )}

                {/* Achievement badge */}
                {(data?.achievementCount ?? 0) > 0 && (
                  <View
                    style={{
                      backgroundColor: 'rgba(245,158,11,0.12)',
                      borderRadius: 8,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderWidth: 1,
                      borderColor: 'rgba(245,158,11,0.25)',
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#f59e0b' }}>
                      🏆 {data!.achievementCount}/{data!.totalAchievements}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {topAchievements.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {topAchievements.map((ach) => (
                <View
                  key={ach.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    borderRadius: 20,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.08)',
                  }}
                >
                  <Text style={{ fontSize: 13 }}>{ach.icon}</Text>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#e5e5e5' }}>{ach.title}</Text>
                </View>
              ))}
            </View>
          )}

          {/* XP Progress */}
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#71717a', textTransform: 'uppercase', letterSpacing: 1 }}>
                Level Progress
              </Text>
              <Pressable onPress={() => router.push('/(protected)/xp' as never)}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#10b981' }}>Details →</Text>
              </Pressable>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)' }}>
              <View
                style={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: '#10b981',
                  width: `${progress.progressPercent}%`,
                }}
              />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 11, color: '#52525b' }}>
                {(data?.totalXp ?? 0).toLocaleString()} XP
              </Text>
              {progress.nextLevel !== null && (
                <Text style={{ fontSize: 11, color: '#52525b' }}>
                  {progress.xpNeededToNextLevel} to Level {progress.nextLevel}
                </Text>
              )}
            </View>
          </View>

          {/* Profile Completion */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#71717a', textTransform: 'uppercase', letterSpacing: 1 }}>
              Profile Completion
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 80, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)' }}>
                <View style={{ width: `${data?.profileCompletion ?? 0}%`, height: 4, borderRadius: 2, backgroundColor: '#10b981' }} />
              </View>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#10b981' }}>
                {data?.profileCompletion ?? 0}%
              </Text>
            </View>
          </View>
        </View>

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

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontSize: 10, fontWeight: '700', color: '#71717a', textTransform: 'uppercase', letterSpacing: 1 }}>
      {children}
    </Text>
  )
}

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
        backgroundColor: accent ? 'rgba(16,185,129,0.08)' : '#171717',
        borderRadius: 16,
        padding: 16,
        gap: 8,
        borderWidth: 1,
        borderColor: accent ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)',
      }}
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
        <Ionicons name={icon} size={15} color={accent ? '#10b981' : '#a3a3a3'} />
      </View>
      <Text style={{ fontSize: 22, fontWeight: '900', color: accent ? '#10b981' : '#fff', letterSpacing: -0.5 }}>
        {value}
      </Text>
      <Text style={{ fontSize: 10, fontWeight: '600', color: '#52525b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Text>
    </View>
  )
}

function TerritoryStatCard({
  count,
  captureCount,
  stolenCount,
}: {
  count: number
  captureCount: number
  stolenCount: number
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#171717',
        borderRadius: 16,
        padding: 16,
        gap: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          backgroundColor: 'rgba(255,255,255,0.06)',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 4,
        }}
      >
        <Ionicons name="map" size={15} color="#a3a3a3" />
      </View>
      <Text style={{ fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.5 }}>{count}</Text>
      <Text style={{ fontSize: 10, fontWeight: '600', color: '#52525b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Territory
      </Text>
      {(captureCount > 0 || stolenCount > 0) && (
        <Text style={{ fontSize: 10, color: '#52525b', marginTop: 2 }}>
          {captureCount} captured · {stolenCount} stolen
        </Text>
      )}
    </View>
  )
}

function RecordCard({ record }: { record: PersonalRecord }) {
  return (
    <View
      style={{
        width: '47%',
        backgroundColor: '#171717',
        borderRadius: 14,
        padding: 14,
        gap: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
      }}
    >
      <Text style={{ fontSize: 10, fontWeight: '600', color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {record.title}
      </Text>
      <Text style={{ fontSize: 18, fontWeight: '800', color: '#10b981' }}>
        {record.displayValue}
      </Text>
    </View>
  )
}

const ACTIVITY_ICON: Record<RecentActivity['type'], React.ComponentProps<typeof Ionicons>['name']> = {
  workout: 'footsteps',
  capture: 'flag',
  achievement: 'trophy',
}

function ActivityRow({ item, isLast }: { item: RecentActivity; isLast: boolean }) {
  const dateStr = new Date(item.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
      }}
    >
      <Ionicons name={ACTIVITY_ICON[item.type]} size={16} color="#10b981" />
      <Text style={{ flex: 1, fontSize: 13, color: '#e5e5e5' }}>{item.title}</Text>
      <Text style={{ fontSize: 11, color: '#52525b' }}>{dateStr}</Text>
    </View>
  )
}

function ShortcutRow({
  label,
  icon,
  onPress,
}: {
  label: string
  icon: React.ComponentProps<typeof Ionicons>['name']
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? '#262626' : '#171717',
        borderRadius: 14,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      })}
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
      <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: '#fff' }}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color="#52525b" />
    </Pressable>
  )
}
