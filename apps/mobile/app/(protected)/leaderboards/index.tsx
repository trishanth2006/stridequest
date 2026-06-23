import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, FlatList, Pressable, ActivityIndicator,
  ListRenderItemInfo,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSession } from '@/features/auth/providers/SessionProvider'
import { fetchLeaderboard, fetchMyRank } from '@/features/leaderboards/services/leaderboards'
import { formatLeaderboardValue, formatLeaderboardLabel } from '@stridequest/shared/leaderboards'
import type { LeaderboardCategory, LeaderboardEntry, MyRank } from '@stridequest/shared'

const CATEGORIES: LeaderboardCategory[] = ['xp', 'territory', 'distance', 'weekly']
const PAGE_SIZE = 10

export default function LeaderboardsScreen() {
  const { session } = useSession()
  const router = useRouter()
  const userId = session?.user.id ?? ''

  const [activeTab, setActiveTab] = useState<LeaderboardCategory>('xp')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [myRank, setMyRank] = useState<MyRank | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  // Initial load for a category — always starts at offset 0.
  const load = useCallback((category: LeaderboardCategory) => {
    setLoading(true)
    setHasMore(true)
    void (async () => {
      try {
        const [page, rank] = await Promise.all([
          fetchLeaderboard(category, userId, PAGE_SIZE, 0),
          fetchMyRank(category),
        ])
        setEntries(page)
        setMyRank(rank)
        setHasMore(page.length === PAGE_SIZE)
      } catch {
        // keep existing state on error
      } finally {
        setLoading(false)
      }
    })()
  }, [userId])

  useEffect(() => { load(activeTab) }, [activeTab, load])

  // Load-more uses entries.length as the offset — avoids stale closure on offset state.
  const handleLoadMore = (currentEntries: LeaderboardEntry[]) => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    void (async () => {
      try {
        const page = await fetchLeaderboard(activeTab, userId, PAGE_SIZE, currentEntries.length)
        setEntries((prev) => [...prev, ...page])
        setHasMore(page.length === PAGE_SIZE)
      } catch {
        // keep existing state on error
      } finally {
        setLoadingMore(false)
      }
    })()
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0b0b0f' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, gap: 12 }}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#10b981" />
        </Pressable>
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff' }}>Leaderboards</Text>
      </View>

      {/* Category tabs */}
      <View style={{ flexDirection: 'row', marginHorizontal: 20, marginBottom: 16, backgroundColor: '#171717', borderRadius: 12, padding: 4 }}>
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat}
            onPress={() => setActiveTab(cat)}
            style={{
              flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center',
              backgroundColor: activeTab === cat ? 'rgba(16,185,129,0.15)' : 'transparent',
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: activeTab === cat ? '#10b981' : '#71717a' }}>
              {formatLeaderboardLabel(cat)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* My Rank card */}
      {myRank && <MyRankCard rank={myRank} category={activeTab} />}

      {/* Ranked list */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#10b981" />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => `${e.userId}-${e.rank}`}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
          renderItem={({ item }: ListRenderItemInfo<LeaderboardEntry>) => (
            <EntryRow entry={item} category={activeTab} />
          )}
          ListEmptyComponent={
            <Text style={{ color: '#52525b', textAlign: 'center', marginTop: 32, fontSize: 14 }}>
              No athletes ranked yet in {formatLeaderboardLabel(activeTab)}.
            </Text>
          }
          ListFooterComponent={
            hasMore ? (
              <Pressable onPress={() => handleLoadMore(entries)} style={{ alignItems: 'center', paddingVertical: 16 }}>
                {loadingMore
                  ? <ActivityIndicator color="#10b981" size="small" />
                  : <Text style={{ color: '#10b981', fontSize: 13, fontWeight: '600' }}>Load more</Text>
                }
              </Pressable>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  )
}

function MyRankCard({ rank, category }: { rank: MyRank; category: LeaderboardCategory }) {
  const isUnranked = rank.rank === 0
  const topPercent = 100 - rank.percentile
  const topDisplay = topPercent < 1 ? '<1' : `${Math.round(topPercent)}`

  return (
    <View style={{ marginHorizontal: 20, marginBottom: 12, backgroundColor: '#171717', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={{ fontSize: 11, color: '#71717a', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Your Rank</Text>
          <Text style={{ fontSize: 26, fontWeight: '800', color: '#fff', marginTop: 2 }}>
            {isUnranked ? 'Unranked' : `#${rank.rank}`}
          </Text>
        </View>
        {!isUnranked && (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 11, color: '#71717a' }}>Top</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#10b981' }}>{topDisplay}%</Text>
          </View>
        )}
      </View>
      {!isUnranked && rank.nextRankValue !== null && (
        <Text style={{ fontSize: 11, color: '#52525b', marginTop: 8 }}>
          Need {formatLeaderboardValue(category, rank.nextRankValue - rank.value)} more to reach #{rank.rank - 1}
        </Text>
      )}
    </View>
  )
}

function EntryRow({ entry, category }: { entry: LeaderboardEntry; category: LeaderboardCategory }) {
  const isTop3 = entry.rank <= 3
  const medalColor = entry.rank === 1 ? '#f59e0b' : entry.rank === 2 ? '#9ca3af' : '#cd7c3a'

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
      backgroundColor: entry.isCurrentUser ? 'rgba(16,185,129,0.06)' : 'transparent',
      borderRadius: entry.isCurrentUser ? 8 : 0,
      paddingHorizontal: entry.isCurrentUser ? 8 : 0,
    }}>
      <Text style={{ width: 32, fontSize: 13, fontWeight: '700', color: isTop3 ? medalColor : '#52525b', textAlign: 'center' }}>
        {entry.rank}
      </Text>
      <Text style={{ flex: 1, fontSize: 14, fontWeight: entry.isCurrentUser ? '700' : '500', color: entry.isCurrentUser ? '#10b981' : '#e5e5e5', marginLeft: 8 }}>
        {entry.username}{entry.isCurrentUser ? ' (you)' : ''}
      </Text>
      <Text style={{ fontSize: 13, fontWeight: '600', color: '#a3a3a3' }}>
        {formatLeaderboardValue(category, entry.value)}
      </Text>
    </View>
  )
}
