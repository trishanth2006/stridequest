import { useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  SectionList,
  Pressable,
  RefreshControl,
} from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { BackButton } from '@/components/ui/BackButton'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { loadAchievements } from '@/features/achievements/services/achievements'
import { AchievementCard } from '@/features/achievements/components/AchievementCard'
import { AchievementSkeleton } from '@/components/ui/SkeletonLoader'
import { type AchievementCategory, type Achievement } from '@stridequest/shared/analytics'
import { getXpProgress } from '@stridequest/shared/xp'
import { colors } from '@/theme'

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
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [totalXp, setTotalXp] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<FilterTab>('all')

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const result = await loadAchievements()
        setAchievements(result.achievements)
        setTotalXp(result.totalXp)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load achievements')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  useFocusEffect(load)

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const result = await loadAchievements()
      setAchievements(result.achievements)
      setTotalXp(result.totalXp)
    } catch {
      // keep showing current data on refresh failure
    } finally {
      setRefreshing(false)
    }
  }, [])

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

  const sections = activeTab === 'all'
    ? (['running', 'territory', 'xp'] as AchievementCategory[]).map(cat => ({
        title: TABS.find(t => t.key === cat)?.label || '',
        data: filtered.filter(a => a.category === cat),
      })).filter(section => section.data.length > 0)
    : [{
        title: '',
        data: filtered,
      }]

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-row items-center px-5 pt-5 pb-3 gap-3">
          <BackButton />
          <Text className="text-2xl font-extrabold text-white flex-1">Achievements</Text>
        </View>
        <View className="px-5">
          <AchievementSkeleton />
        </View>
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-row items-center px-5 pt-5 pb-3 gap-3">
          <BackButton />
          <Text className="text-2xl font-extrabold text-white flex-1">Achievements</Text>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-[15px] font-semibold text-white text-center">
            Failed to load achievements
          </Text>
          <Text className="text-[13px] text-fgSecondary text-center mt-1.5">
            {error}
          </Text>
          <Pressable
            onPress={load}
            className="mt-4 bg-primary px-6 py-3 rounded-[14px]"
          >
            <Text className="text-white font-bold">Try Again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center px-5 pt-5 pb-3 gap-3">
        <BackButton />
        <Text className="text-2xl font-extrabold text-white flex-1">Achievements</Text>
      </View>

      <SectionList
        className="flex-1 px-5"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={colors.primary}
          />
        }
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <AchievementCard achievement={item} />}
        renderSectionHeader={({ section: { title } }) =>
          title ? (
            <View className="pt-4 pb-2">
              <SectionLabel>{title}</SectionLabel>
            </View>
          ) : null
        }
        ItemSeparatorComponent={() => <View className={activeTab === 'all' ? 'h-2' : 'h-2.5'} />}
        ListHeaderComponent={
          <View className="gap-4 pb-4">
          {/* Summary row */}
          <Animated.View entering={FadeInDown.delay(0).duration(400)}>
          <View className="flex-row gap-3">
            {/* Left: Achievements card */}
            <View className="flex-1 bg-surface rounded-2xl p-4 gap-2">
              <Text className="text-[10px] font-bold text-fgMuted uppercase tracking-[1px]">
                Achievements
              </Text>
              <Text className="text-[32px] font-extrabold text-white">
                {unlocked.length}
                <Text className="text-sm font-medium text-fgMuted">/{achievements.length}</Text>
              </Text>
              {/* Progress bar */}
              <View className="h-1 rounded-sm bg-white/[0.08]">
                <View className="h-1 rounded-sm bg-primary" style={{ width: `${completionPct}%` }} />
              </View>
              {/* Category mini-row */}
              <View className="flex-row gap-1.5 mt-1">
                {categoryCounts.map(({ cat, unlocked: u, total }) => (
                  <View key={cat} className="flex-1 items-center gap-0.5">
                    <Ionicons name={CATEGORY_ICONS[cat]} size={12} color={u === total && total > 0 ? colors.primary : colors.fgFaint} />
                    <Text className={`text-[10px] font-bold ${u === total && total > 0 ? 'text-primary' : 'text-fgSecondary'}`}>
                      {u}/{total}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Right: XP Status card */}
            <View className="flex-1 bg-surface rounded-2xl p-4 gap-2 border border-accent/20">
              <Text className="text-[10px] font-bold text-accent uppercase tracking-[1px]">
                XP Status
              </Text>
              <Text className="text-[22px] font-extrabold text-accent">
                {totalXp.toLocaleString()}
                <Text className="text-xs font-medium text-stone"> xp</Text>
              </Text>
              <Text className="text-xs font-bold text-white">
                Level {xpProgress.currentLevel}
              </Text>
              {xpProgress.nextLevel !== null ? (
                <Text className="text-[11px] text-stone leading-[15px]">
                  {xpProgress.xpNeededToNextLevel.toLocaleString()} XP to Level {xpProgress.nextLevel}
                </Text>
              ) : (
                <Text className="text-[11px] text-primary">Max level!</Text>
              )}
              {/* XP bar */}
              <View className="h-1 rounded-sm bg-white/[0.08]">
                <View className="h-1 rounded-sm bg-accent" style={{ width: `${xpProgress.progressPercent}%` }} />
              </View>
            </View>
          </View>
          </Animated.View>

          {/* Next to unlock */}
          {nextToUnlock && (
            <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <View className="bg-surface rounded-[14px] p-4 gap-2.5 border border-accent/20">
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="rocket" size={14} color={colors.accent} />
                <Text className="text-[10px] font-bold text-accent uppercase tracking-[1px]">
                  Next to Unlock
                </Text>
              </View>
              <View className="flex-row items-center gap-3">
                <View className="w-11 h-11 rounded-xl items-center justify-center bg-accent/[0.12]">
                  <Ionicons name="lock-open" size={20} color={colors.accent} />
                </View>
                <View className="flex-1 gap-0.5">
                  <Text className="text-sm font-bold text-white">
                    {nextToUnlock.title}
                  </Text>
                  <Text className="text-xs text-fgMuted">
                    {nextToUnlock.description}
                  </Text>
                </View>
              </View>
              <View className="gap-1">
                <View className="flex-row justify-between">
                  <Text className="text-[11px] text-accent font-semibold">
                    {nextToUnlock.progress.toLocaleString()} / {nextToUnlock.target.toLocaleString()}
                  </Text>
                  <Text className="text-[11px] text-fgMuted">
                    {Math.round((nextToUnlock.progress / nextToUnlock.target) * 100)}%
                  </Text>
                </View>
                <View className="h-1.5 rounded-sm bg-surfaceMuted">
                  <View
                    className="h-1.5 rounded-sm bg-accent"
                    style={{ width: `${Math.min(100, (nextToUnlock.progress / nextToUnlock.target) * 100)}%` }}
                  />
                </View>
              </View>
            </View>
            </Animated.View>
          )}

          {/* Recently Unlocked */}
          {recentlyUnlocked.length > 0 && (
            <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <View className="gap-2.5">
              <SectionLabel>Recently Unlocked</SectionLabel>
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
                  className={`px-3.5 py-[7px] rounded-full ${active ? 'bg-primary' : 'bg-surfaceMuted'}`}
                >
                  <Text className={`text-[13px] font-bold ${active ? 'text-black' : 'text-fgSecondary'}`}>
                    {tab.label}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>

          </Animated.View>
          </View>
        }
      />
    </SafeAreaView>
  )
}
