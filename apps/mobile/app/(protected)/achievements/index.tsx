import { useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { loadAchievements } from '@/features/achievements/services/achievements'
import {
  sortAchievements,
  type AchievementCategory,
  type Achievement,
} from '@stridequest/shared/analytics'

type FilterTab = 'all' | AchievementCategory

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'running', label: '🏃 Running' },
  { key: 'territory', label: '🌍 Territory' },
  { key: 'xp', label: '⭐ XP' },
]

export default function AchievementsScreen() {
  const router = useRouter()
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [totalXp, setTotalXp] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<FilterTab>('all')

  const load = useCallback(() => {
    setLoading(true)
    void loadAchievements().then((result) => {
      setAchievements(result.achievements)
      setTotalXp(result.totalXp)
      setLoading(false)
    })
  }, [])

  useFocusEffect(load)

  const unlocked = achievements.filter((a) => a.unlocked)
  const locked = achievements.filter((a) => !a.unlocked)

  const filtered =
    activeTab === 'all'
      ? achievements
      : achievements.filter((a) => a.category === activeTab)

  const recentlyUnlocked = unlocked
    .filter((a) => a.unlockedAt)
    .sort((a, b) => new Date(b.unlockedAt!).getTime() - new Date(a.unlockedAt!).getTime())
    .slice(0, 3)

  return (
    <SafeAreaView className="flex-1 bg-[#0b0b0f]">
      {/* Header */}
      <View className="flex-row items-center px-5 pt-5 pb-3" style={{ gap: 12 }}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#10b981" />
        </Pressable>
        <Text className="text-2xl font-extrabold text-white flex-1">Achievements</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#10b981" size="large" />
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-5"
          contentContainerStyle={{ gap: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Summary card */}
          <View
            style={{
              backgroundColor: '#171717',
              borderRadius: 16,
              padding: 20,
              gap: 16,
            }}
          >
            <View className="flex-row justify-between items-center">
              <View style={{ gap: 2 }}>
                <Text style={{ fontSize: 32, fontWeight: '800', color: '#fff' }}>
                  {unlocked.length}
                  <Text style={{ fontSize: 16, fontWeight: '500', color: '#71717a' }}>
                    /{achievements.length}
                  </Text>
                </Text>
                <Text style={{ fontSize: 11, color: '#71717a', textTransform: 'uppercase', letterSpacing: 1, fontWeight: '600' }}>
                  Unlocked
                </Text>
              </View>
              <View
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  borderWidth: 3,
                  borderColor: '#10b981',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#10b981' }}>
                  {achievements.length > 0
                    ? Math.round((unlocked.length / achievements.length) * 100)
                    : 0}%
                </Text>
              </View>
            </View>
            <View className="h-2 w-full rounded-full bg-white/10">
              <View
                className="h-2 rounded-full bg-emerald-500"
                style={{
                  width: `${achievements.length > 0 ? (unlocked.length / achievements.length) * 100 : 0}%`,
                }}
              />
            </View>
          </View>

          {/* Recently Unlocked */}
          {recentlyUnlocked.length > 0 && (
            <View style={{ gap: 10 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#71717a', textTransform: 'uppercase', letterSpacing: 1 }}>
                Recently Unlocked
              </Text>
              {recentlyUnlocked.map((ach) => (
                <AchievementCard key={ach.id} achievement={ach} />
              ))}
            </View>
          )}

          {/* Category tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {TABS.map((tab) => {
              const active = activeTab === tab.key
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    borderRadius: 20,
                    backgroundColor: active ? '#10b981' : '#262626',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color: active ? '#000' : '#a3a3a3',
                    }}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>

          {/* Achievement list */}
          <View style={{ gap: 10 }}>
            {filtered.map((ach) => (
              <AchievementCard key={ach.id} achievement={ach} />
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

function AchievementCard({ achievement: ach }: { achievement: Achievement }) {
  const pct = ach.target > 0 ? Math.min(1, ach.progress / ach.target) : 0

  return (
    <View
      style={{
        backgroundColor: '#171717',
        borderRadius: 14,
        padding: 16,
        gap: 10,
        opacity: ach.unlocked ? 1 : 0.75,
        borderWidth: 1,
        borderColor: ach.unlocked ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)',
      }}
    >
      <View className="flex-row items-center" style={{ gap: 12 }}>
        {/* Icon */}
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: ach.unlocked ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {ach.unlocked ? (
            <Text style={{ fontSize: 22 }}>{ach.icon}</Text>
          ) : (
            <Ionicons name="lock-closed" size={20} color="#52525b" />
          )}
        </View>

        {/* Info */}
        <View style={{ flex: 1, gap: 2 }}>
          <View className="flex-row items-center justify-between">
            <Text
              style={{
                fontSize: 14,
                fontWeight: '700',
                color: ach.unlocked ? '#fff' : '#a3a3a3',
              }}
            >
              {ach.title}
            </Text>
            {ach.unlocked && (
              <View
                style={{
                  backgroundColor: 'rgba(16,185,129,0.15)',
                  borderRadius: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#10b981' }}>✓ Done</Text>
              </View>
            )}
          </View>
          <Text style={{ fontSize: 12, color: '#71717a' }}>{ach.description}</Text>
          {ach.unlockedAt && (
            <Text style={{ fontSize: 10, color: '#52525b' }}>
              {new Date(ach.unlockedAt).toLocaleDateString()}
            </Text>
          )}
        </View>
      </View>

      {/* Progress bar */}
      {!ach.unlocked && (
        <View style={{ gap: 4 }}>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: '#262626' }}>
            <View
              style={{
                height: 4,
                borderRadius: 2,
                backgroundColor: '#10b981',
                width: `${pct * 100}%`,
              }}
            />
          </View>
          <Text style={{ fontSize: 10, color: '#71717a' }}>
            {ach.progress.toLocaleString()} / {ach.target.toLocaleString()}
          </Text>
        </View>
      )}
    </View>
  )
}
