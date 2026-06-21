import { useState, useCallback } from 'react'
import { View, Text, FlatList, Pressable, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { WorkoutActivityCard } from '@/features/running/components/WorkoutActivityCard'
import { getWorkoutsPage } from '@/features/running/services/history'
import type { RecentWorkout, SortField } from '@/features/running/services/history'

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
    await fetchPage(0, nextSort, true)
    setPage(0)
    setLoading(false)
  }, [fetchPage])

  const handleRefresh = useCallback(async () => {
    setLoading(true)
    await fetchPage(0, sort, true)
    setPage(0)
    setLoading(false)
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
    await fetchPage(nextPage, sort, false)
    setPage(nextPage)
    setLoadingMore(false)
  }, [loadingMore, hasMore, page, sort, fetchPage])

  // Load on mount
  useState(() => {
    void loadInitial('started_at')
  })

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-[#0b0b0f] items-center justify-center">
        <ActivityIndicator color="#10b981" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0b0b0f]">
      <View className="px-5 pt-6 pb-3 gap-4">
        <Text className="text-2xl font-extrabold text-white">Activity</Text>

        {/* Sort chips */}
        <View className="flex-row gap-2">
          {SORT_OPTIONS.map(({ label, field }) => (
            <Pressable
              key={field}
              onPress={() => void handleSortChange(field)}
              className={`rounded-full px-4 py-1.5 ${
                sort === field ? 'bg-emerald-500' : 'bg-neutral-800'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  sort === field ? 'text-white' : 'text-neutral-400'
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
        renderItem={({ item }) => (
          <WorkoutActivityCard
            workout={item}
            onPress={() => router.push(`/(protected)/(tabs)/run/${item.id}` as never)}
          />
        )}
        ListEmptyComponent={<EmptyState />}
        ListFooterComponent={
          hasMore && workouts.length > 0 ? (
            <Pressable
              onPress={() => void handleLoadMore()}
              disabled={loadingMore}
              className="mt-3 items-center py-4"
            >
              {loadingMore ? (
                <ActivityIndicator color="#10b981" />
              ) : (
                <Text className="text-sm font-semibold text-emerald-400">Load more</Text>
              )}
            </Pressable>
          ) : null
        }
      />
    </SafeAreaView>
  )
}

function EmptyState() {
  return (
    <View className="flex-1 items-center justify-center pt-20 gap-3">
      <Text className="text-base font-semibold text-white text-center">No runs yet.</Text>
      <Text className="text-sm text-neutral-400 text-center">
        Claim your first territory to begin your journey.
      </Text>
    </View>
  )
}
