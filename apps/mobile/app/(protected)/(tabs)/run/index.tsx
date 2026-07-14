import { useState, useCallback, useEffect } from 'react'
import { View, Text, FlatList, Pressable, ActivityIndicator, type ListRenderItemInfo } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { WorkoutActivityCard } from '@/features/running/components/WorkoutActivityCard'
import { HistorySkeleton } from '@/components/ui/SkeletonLoader'
import { getWorkoutsPage } from '@/features/running/services/history'
import type { RecentWorkout, SortField } from '@/features/running/services/history'
import { colors } from '@/theme'

const SORT_OPTIONS: { label: string; field: SortField }[] = [
  { label: 'Newest', field: 'started_at' },
  { label: 'Distance', field: 'distance_m' },
  { label: 'XP', field: 'xp_awarded' },
]

export default function ActivityHistoryScreen() {
  const router = useRouter()
  const [workouts, setWorkouts] = useState<RecentWorkout[]>([])
  const [sort, setSort] = useState<SortField>('started_at')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPage = useCallback(async (nextPage: number, nextSort: SortField, replace: boolean) => {
    const rows = await getWorkoutsPage(nextPage, nextSort)
    if (replace) {
      setWorkouts(rows)
    } else {
      setWorkouts((prev) => [...prev, ...rows])
    }
    setHasMore(rows.length === 20)
  }, [])

  const loadInitial = useCallback(async (nextSort: SortField) => {
    setLoading(true)
    setError(null)
    try {
      await fetchPage(0, nextSort, true)
      setPage(0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load activity')
    } finally {
      setLoading(false)
    }
  }, [fetchPage])

  const handleRefresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await fetchPage(0, sort, true)
      setPage(0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to refresh')
    } finally {
      setLoading(false)
    }
  }, [fetchPage, sort])

  const handleSortChange = useCallback(async (field: SortField) => {
    if (field === sort) return
    setSort(field)
    setPage(0)
    await loadInitial(field)
  }, [sort, loadInitial])

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const nextPage = page + 1
    try {
      await fetchPage(nextPage, sort, false)
      setPage(nextPage)
    } catch {
      // preserve existing list on pagination error
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMore, page, sort, fetchPage])

  useEffect(() => {
    void loadInitial('started_at')
  }, [])

  const handleStartRun = useCallback(() => {
    router.push('/(protected)/record')
  }, [router])

  const handleOpenRun = useCallback((id: string) => {
    router.push(`/(protected)/(tabs)/run/${id}`)
  }, [router])

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<RecentWorkout>) => (
      <WorkoutActivityCard workout={item} onPress={handleOpenRun} />
    ),
    [handleOpenRun],
  )

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="px-5 pt-6 pb-3">
          <Text className="text-2xl font-extrabold text-white">Activity</Text>
        </View>
        <HistorySkeleton />
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-6">
        <Text className="text-base font-semibold text-white text-center">Failed to load activity</Text>
        <Text className="text-sm text-fgSecondary text-center mt-2">{error}</Text>
        <Pressable onPress={() => void loadInitial(sort)} className="mt-4 bg-primary px-6 py-3 rounded-2xl">
          <Text className="text-white font-bold">Try Again</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-5 pt-6 pb-3 gap-4">
        <View className="flex-row justify-between items-center">
          <Text className="text-2xl font-extrabold text-white">Activity</Text>
          <Pressable
            onPress={handleStartRun}
            className="bg-primary rounded-full px-5 py-2"
          >
            <Text className="text-white font-bold text-sm">Start Run</Text>
          </Pressable>
        </View>

        {/* Sort chips */}
        <View className="flex-row gap-2">
          {SORT_OPTIONS.map(({ label, field }) => (
            <Pressable
              key={field}
              onPress={() => void handleSortChange(field)}
              className={`rounded-full px-4 py-1.5 ${
                sort === field ? 'bg-primary' : 'bg-surfaceMuted'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  sort === field ? 'text-black' : 'text-fgSecondary'
                }`}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        data={workouts}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-5 gap-3 pb-12"
        refreshing={loading}
        onRefresh={handleRefresh}
        renderItem={renderItem}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        ListEmptyComponent={<EmptyState onStartRun={handleStartRun} />}
        ListFooterComponent={
          hasMore && workouts.length > 0 ? (
            <Pressable
              onPress={() => void handleLoadMore()}
              disabled={loadingMore}
              className="mt-3 items-center py-4"
            >
              {loadingMore ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text className="text-sm font-semibold text-primaryBright">Load more</Text>
              )}
            </Pressable>
          ) : null
        }
      />
    </SafeAreaView>
  )
}

function EmptyState({ onStartRun }: { onStartRun: () => void }) {
  return (
    <View className="flex-1 items-center justify-center pt-20 gap-3">
      <Text className="text-base font-semibold text-white text-center">No runs yet.</Text>
      <Text className="text-sm text-fgSecondary text-center">
        Claim your first territory to begin your journey.
      </Text>
      <Pressable onPress={onStartRun} className="mt-2 bg-primary rounded-full px-6 py-3">
        <Text className="text-black font-bold text-sm">Start Your First Run</Text>
      </Pressable>
    </View>
  )
}
