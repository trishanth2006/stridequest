import { useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { loadAchievements } from '@/features/achievements/services/achievements'
import { AchievementSkeleton } from '@/components/ui/SkeletonLoader'
import {
  type AchievementCategory,
  type Achievement,
} from '@stridequest/shared/analytics'
import { getXpProgress } from '@stridequest/shared/xp'

type FilterTab = 'all' | AchievementCategory

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'running', label: '🏃 Running' },
  { key: 'territory', label: '🌍 Territory' },
  { key: 'xp', label: '⭐ XP' },
]

const CATEGORY_ICONS: Record<AchievementCategory, React.ComponentProps<typeof Ionicons>['name']> = {
  running: 'footsteps',
  territory: 'map',
  xp: 'flash',
}

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

  // Closest to unlock
  const nextToUnlock = locked
    .filter((a) => a.target > 0)
    .sort((a, b) => b.progress / b.target - a.progress / a.target)[0] ?? null

  // Category counts
  const categoryCounts = (['running', 'territory', 'xp'] as AchievementCategory[]).map((cat) => {
    const catAchs = achievements.filter((a) => a.category === cat)
    return {
      cat,
      unlocked: catAchs.filter((a) => a.unlocked).length,
      total: catAchs.length,
    }
  })

  const completionPct = achievements.length > 0
    ? Math.round((unlocked.length / achievements.length) * 100)
    : 0

  const xpProgress = getXpProgress(totalXp)

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-[#0b0b0f]">
        <View className="flex-row items-center px-5 pt-5 pb-3" style={{ gap: 12 }}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="#10b981" />
          </Pressable>
          <Text className="text-2xl font-extrabold text-white flex-1">Achievements</Text>
        </View>
        <View style={{ paddingHorizontal: 20 }}>
          <AchievementSkeleton />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0b0b0f]">
      {/* Header */}
      <View className="flex-row items-center px-5 pt-5 pb-3" style={{ gap: 12 }}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#10b981" />
        </Pressable>
        <Text className="text-2xl font-extrabold text-white flex-1">Achievements</Text>
      </View>

      <ScrollView
          className="flex-1 px-5"
          contentContainerStyle={{ gap: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Summary row */}
          <Animated.View entering={FadeInDown.delay(0).duration(400)}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {/* Left: Achievements card */}
            <View style={{ flex: 1, backgroundColor: '#171717', borderRadius: 16, padding: 16, gap: 8 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#71717a', textTransform: 'uppercase', letterSpacing: 1 }}>
                Achievements
              </Text>
              <Text style={{ fontSize: 32, fontWeight: '800', color: '#fff' }}>
                {unlocked.length}
                <Text style={{ fontSize: 14, fontWeight: '500', color: '#71717a' }}>/{achievements.length}</Text>
              </Text>
              {/* Progress bar */}
              <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)' }}>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: '#10b981', width: `${completionPct}%` }} />
              </View>
              {/* Category mini-row */}
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                {categoryCounts.map(({ cat, unlocked: u, total }) => (
                  <View key={cat} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
                    <Ionicons name={CATEGORY_ICONS[cat]} size={12} color={u === total && total > 0 ? '#10b981' : '#52525b'} />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: u === total && total > 0 ? '#10b981' : '#a3a3a3' }}>
                      {u}/{total}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Right: XP Status card */}
            <View style={{ flex: 1, backgroundColor: '#171717', borderRadius: 16, padding: 16, gap: 8, borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)' }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: 1 }}>
                XP Status
              </Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#f59e0b' }}>
                {totalXp.toLocaleString()}
                <Text style={{ fontSize: 12, fontWeight: '500', color: '#78716c' }}> xp</Text>
              </Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>
                Level {xpProgress.currentLevel}
              </Text>
              {xpProgress.nextLevel !== null ? (
                <Text style={{ fontSize: 11, color: '#78716c', lineHeight: 15 }}>
                  {xpProgress.xpNeededToNextLevel.toLocaleString()} XP to Level {xpProgress.nextLevel}
                </Text>
              ) : (
                <Text style={{ fontSize: 11, color: '#10b981' }}>Max level!</Text>
              )}
              {/* XP bar */}
              <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)' }}>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: '#f59e0b', width: `${xpProgress.progressPercent}%` }} />
              </View>
            </View>
          </View>
          </Animated.View>

          {/* Next to unlock */}
          {nextToUnlock && (
            <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <View
              style={{
                backgroundColor: '#171717',
                borderRadius: 14,
                padding: 16,
                gap: 10,
                borderWidth: 1,
                borderColor: 'rgba(245,158,11,0.2)',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="rocket" size={14} color="#f59e0b" />
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: 1 }}>
                  Next to Unlock
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: 'rgba(245,158,11,0.12)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="lock-open" size={20} color="#f59e0b" />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>
                    {nextToUnlock.title}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#71717a' }}>
                    {nextToUnlock.description}
                  </Text>
                </View>
              </View>
              <View style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 11, color: '#f59e0b', fontWeight: '600' }}>
                    {nextToUnlock.progress.toLocaleString()} / {nextToUnlock.target.toLocaleString()}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#71717a' }}>
                    {Math.round((nextToUnlock.progress / nextToUnlock.target) * 100)}%
                  </Text>
                </View>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: '#262626' }}>
                  <View
                    style={{
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: '#f59e0b',
                      width: `${Math.min(100, (nextToUnlock.progress / nextToUnlock.target) * 100)}%`,
                    }}
                  />
                </View>
              </View>
            </View>
            </Animated.View>
          )}

          {/* Recently Unlocked */}
          {recentlyUnlocked.length > 0 && (
            <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <View style={{ gap: 10 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#71717a', textTransform: 'uppercase', letterSpacing: 1 }}>
                Recently Unlocked
              </Text>
              {recentlyUnlocked.map((ach) => (
                <AchievementCard key={ach.id} achievement={ach} />
              ))}
            </View>
            </Animated.View>
          )}

          {/* Category tabs */}
          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
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
          </Animated.View>
        </ScrollView>
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
