import { useCallback, useState } from 'react'
import { View, Text, Pressable, Alert, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSession } from '@/features/auth/providers/SessionProvider'
import { supabase } from '@/lib/supabase'
import { getXpProgress } from '@stridequest/shared/xp'
import { formatDistance } from '@stridequest/shared/running'

type ProfileData = {
  username: string
  totalXp: number
  totalDistanceM: number
  workoutCount: number
  territoryCount: number
}

export default function ProfileScreen() {
  const { session } = useSession()
  const router = useRouter()
  const [data, setData] = useState<ProfileData | null>(null)

  const loadData = useCallback(() => {
    const userId = session?.user.id
    if (!userId) return

    void (async () => {
      const [profileResult, xpResult, workoutsResult, territoryResult] = await Promise.all([
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
      ])

      const workouts = workoutsResult.data ?? []
      const totalDistanceM = workouts.reduce((sum, w) => sum + ((w.distance_m as number | null) ?? 0), 0)

      setData({
        username: profileResult.data?.username ?? session?.user.email ?? 'Runner',
        totalXp: xpResult.data?.total_xp ?? 0,
        totalDistanceM,
        workoutCount: workouts.length,
        territoryCount: territoryResult.count ?? 0,
      })
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

  return (
    <SafeAreaView className="flex-1 bg-[#0b0b0f]">
      <ScrollView
        className="flex-1 px-5 pt-6"
        contentContainerStyle={{ gap: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ gap: 2 }}>
          <Text className="text-3xl font-extrabold tracking-tight text-white">
            {data?.username ?? session?.user.email ?? 'Runner'}
          </Text>
          <Text className="text-sm text-neutral-400">{session?.user.email}</Text>
          <Text className="text-sm font-semibold text-emerald-500">
            Level {progress.currentLevel}
          </Text>
        </View>

        {/* Stats */}
        <View className="rounded-2xl bg-neutral-900 p-5" style={{ gap: 12 }}>
          <ProfileRow label="Total XP" value={(data?.totalXp ?? 0).toLocaleString() + ' xp'} />
          <ProfileRow label="Total Distance" value={formatDistance(data?.totalDistanceM ?? 0)} />
          <ProfileRow label="Completed Runs" value={String(data?.workoutCount ?? 0)} />
          <ProfileRow label="Territory Cells" value={String(data?.territoryCount ?? 0)} />
        </View>

        {/* XP Progress */}
        <View className="rounded-2xl bg-neutral-900 p-5" style={{ gap: 10 }}>
          <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
            XP Progress
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

        {/* Quick Links */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#71717a', textTransform: 'uppercase', letterSpacing: 1 }}>
            Explore
          </Text>
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

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between items-center">
      <Text className="text-sm text-neutral-400">{label}</Text>
      <Text className="text-sm font-semibold text-white">{value}</Text>
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
