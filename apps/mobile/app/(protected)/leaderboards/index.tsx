import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, FlatList, Pressable, ActivityIndicator,
  ListRenderItemInfo,
} from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSession } from '@/features/auth/providers/SessionProvider'
import { fetchLeaderboard, fetchMyRank } from '@/features/leaderboards/services/leaderboards'
import { formatLeaderboardValue, formatLeaderboardLabel } from '@stridequest/shared/leaderboards'
import { LeaderboardSkeleton } from '@/components/ui/SkeletonLoader'
import type { LeaderboardCategory, LeaderboardEntry, MyRank } from '@stridequest/shared'
import { colors, withAlpha } from '@/theme'

const CATEGORIES: LeaderboardCategory[] = ['xp', 'territory', 'distance', 'weekly']
const PAGE_SIZE = 20

const MEDAL = ['🥇', '🥈', '🥉']
const MEDAL_COLOR = [colors.accent, colors.silver, colors.bronze]
const PODIUM_BG = [
  withAlpha(colors.accent, 0.1),
  withAlpha(colors.silver, 0.08),
  withAlpha(colors.bronze, 0.08),
]

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
  const [territoryKing, setTerritoryKing] = useState<LeaderboardEntry | null>(null)

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

  // Fetch territory king once on mount
  useEffect(() => {
    if (!userId) return
    void (async () => {
      try {
        const top = await fetchLeaderboard('territory', userId, 1, 0)
        setTerritoryKing(Array.isArray(top) && top.length > 0 ? top[0] : null)
      } catch { /* ignore */ }
    })()
  }, [userId])

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

  const podium = entries.slice(0, 3)
  const rest = entries.slice(3)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4, gap: 12 }}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.white }}>Leaderboards</Text>
          {myRank && myRank.totalUsers > 0 && (
            <Text style={{ fontSize: 12, color: colors.fgFaint, marginTop: 1 }}>
              {myRank.totalUsers.toLocaleString()} athletes competing
            </Text>
          )}
        </View>
      </View>

      {/* My rank hero strip */}
      {myRank && myRank.rank > 0 && (
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
        <View style={{ marginHorizontal: 20, marginTop: 12, marginBottom: 4, backgroundColor: colors.surface, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: withAlpha(colors.primary, 0.2) }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: withAlpha(colors.primary, 0.15), alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: '900', color: colors.primary }}>#{myRank.rank}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.white }}>
              Your rank in {formatLeaderboardLabel(activeTab)}
            </Text>
            <Text style={{ fontSize: 11, color: colors.fgFaint }}>
              Top {Math.max(1, Math.round(100 - myRank.percentile))}% of {myRank.totalUsers.toLocaleString()} runners
            </Text>
          </View>
          {myRank.nextRankValue !== null && (
            <Text style={{ fontSize: 11, color: colors.fgFaint, textAlign: 'right', maxWidth: 90 }}>
              {formatLeaderboardValue(activeTab, myRank.nextRankValue - myRank.value)} to #{myRank.rank - 1}
            </Text>
          )}
        </View>
        </Animated.View>
      )}

      {/* Territory King */}
      {territoryKing && (
        <Animated.View entering={FadeInDown.delay(0).duration(400)}>
        <View
          style={{
            marginHorizontal: 20,
            marginTop: 4,
            marginBottom: 4,
            backgroundColor: withAlpha(colors.accent, 0.06),
            borderRadius: 14,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            borderWidth: 1,
            borderColor: withAlpha(colors.accent, 0.25),
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: withAlpha(colors.accent, 0.15),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 22 }}>👑</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: colors.accent, textTransform: 'uppercase', letterSpacing: 1 }}>
              Territory King
            </Text>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.white, marginTop: 2 }}>
              {territoryKing.username}
            </Text>
            <Text style={{ fontSize: 11, color: colors.fgMuted, marginTop: 1 }}>
              ruling {territoryKing.value} {territoryKing.value === 1 ? 'cell' : 'cells'}
            </Text>
          </View>
        </View>
        </Animated.View>
      )}

      {/* Category tabs */}
      <Animated.View entering={FadeInDown.delay(100).duration(400)}>
      <View style={{ flexDirection: 'row', marginHorizontal: 20, marginTop: 12, marginBottom: 16, backgroundColor: colors.surface, borderRadius: 12, padding: 4 }}>
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat}
            onPress={() => setActiveTab(cat)}
            style={{
              flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center',
              backgroundColor: activeTab === cat ? withAlpha(colors.primary, 0.15) : 'transparent',
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: activeTab === cat ? colors.primary : colors.fgMuted }}>
              {formatLeaderboardLabel(cat)}
            </Text>
          </Pressable>
        ))}
      </View>
      </Animated.View>

      {/* Per-tab participant summary */}
      {myRank && (
        <View style={{ marginHorizontal: 20, marginBottom: 4, flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 11, color: colors.fgFaint }}>
            {myRank.totalUsers.toLocaleString()} {myRank.totalUsers === 1 ? 'athlete' : 'athletes'}
          </Text>
          <Text style={{ fontSize: 11, color: colors.fgFaint }}>
            {myRank.rank > 0 ? `You're ranked #${myRank.rank}` : 'You are not ranked yet'}
          </Text>
        </View>
      )}

      {loading ? (
        <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48 }}>
          <LeaderboardSkeleton />
        </View>
      ) : (
        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={{ flex: 1 }}>
        <FlatList
          data={rest}
          keyExtractor={(e) => `${e.userId}-${e.rank}`}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
          ListHeaderComponent={
            podium.length > 0 ? (
              <PodiumSection entries={podium} category={activeTab} userId={userId} onPress={(u) => router.push(`/(protected)/profile/${u}` as never)} />
            ) : null
          }
          renderItem={({ item }: ListRenderItemInfo<LeaderboardEntry>) => (
            <EntryRow
              entry={item}
              category={activeTab}
              onPress={() => router.push(`/(protected)/profile/${item.username}` as never)}
            />
          )}
          ListEmptyComponent={
            podium.length === 0 ? (
              <Text style={{ color: colors.fgFaint, textAlign: 'center', marginTop: 32, fontSize: 14 }}>
                No athletes ranked yet in {formatLeaderboardLabel(activeTab)}.
              </Text>
            ) : null
          }
          ListFooterComponent={
            hasMore ? (
              <Pressable onPress={() => handleLoadMore(entries)} style={{ alignItems: 'center', paddingVertical: 16 }}>
                {loadingMore
                  ? <ActivityIndicator color={colors.primary} size="small" />
                  : <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>Load more</Text>
                }
              </Pressable>
            ) : null
          }
        />
        </Animated.View>
      )}
    </SafeAreaView>
  )
}

// ── Podium ───────────────────────────────────────────────────────────────────

function PodiumSection({
  entries,
  category,
  userId,
  onPress,
}: {
  entries: LeaderboardEntry[]
  category: LeaderboardCategory
  userId: string
  onPress: (username: string) => void
}) {
  // Reorder: 2nd, 1st, 3rd for visual podium effect
  const order = entries.length >= 3
    ? [entries[1], entries[0], entries[2]]
    : entries.length === 2
    ? [entries[1], entries[0]]
    : [entries[0]]

  const heights = entries.length >= 3 ? [72, 96, 56] : [72, 96]

  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ fontSize: 10, fontWeight: '700', color: colors.fgMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
        Top Runners
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 12 }}>
        {order.map((entry, i) => {
          const originalIdx = entries.indexOf(entry)
          const podiumH = heights[i] ?? 56
          const isCenter = i === (entries.length >= 2 ? 1 : 0)
          const color = MEDAL_COLOR[originalIdx] ?? colors.fgMuted
          const bg = PODIUM_BG[originalIdx] ?? withAlpha(colors.white, 0.04)
          const isCurrentUser = entry.userId === userId

          return (
            <Pressable
              key={entry.userId}
              onPress={() => onPress(entry.username)}
              style={{
                flex: 1,
                backgroundColor: isCurrentUser ? withAlpha(colors.primary, 0.1) : colors.surface,
                borderRadius: 14,
                alignItems: 'center',
                paddingTop: 12,
                paddingBottom: 10,
                borderWidth: 1,
                borderColor: isCurrentUser ? withAlpha(colors.primary, 0.3) : `${color}30`,
              }}
            >
              {/* Medal */}
              <Text style={{ fontSize: 20 }}>{MEDAL[originalIdx] ?? '🏅'}</Text>

              {/* Avatar */}
              <View
                style={{
                  width: isCenter ? 48 : 40,
                  height: isCenter ? 48 : 40,
                  borderRadius: isCenter ? 24 : 20,
                  backgroundColor: bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 6,
                  borderWidth: 2,
                  borderColor: color,
                }}
              >
                <Text style={{ fontSize: isCenter ? 18 : 15, fontWeight: '800', color }}>
                  {entry.username[0].toUpperCase()}
                </Text>
              </View>

              {/* Name */}
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: isCurrentUser ? colors.primary : colors.fgBright,
                  marginTop: 6,
                  maxWidth: 70,
                }}
              >
                {entry.username}
              </Text>

              {/* Value */}
              <Text style={{ fontSize: 11, color: color, fontWeight: '700', marginTop: 2 }}>
                {formatLeaderboardValue(category, entry.value)}
              </Text>

              {/* Rank number */}
              <View
                style={{
                  position: 'absolute',
                  bottom: -8,
                  backgroundColor: color,
                  borderRadius: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '900', color: colors.black }}>
                  #{entry.rank}
                </Text>
              </View>
            </Pressable>
          )
        })}
      </View>

      {/* Spacer for rank badge overflow */}
      <View style={{ height: 16 }} />

      {/* Divider */}
      <View style={{ height: 1, backgroundColor: withAlpha(colors.white, 0.06), marginBottom: 8 }} />
    </View>
  )
}

// ── Entry Row ────────────────────────────────────────────────────────────────

function EntryRow({
  entry,
  category,
  onPress,
}: {
  entry: LeaderboardEntry
  category: LeaderboardCategory
  onPress: () => void
}) {
  const isTop3 = entry.rank <= 3
  const medalColor = isTop3 ? MEDAL_COLOR[entry.rank - 1] : colors.fgFaint

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: withAlpha(colors.white, 0.04),
        backgroundColor: entry.isCurrentUser ? withAlpha(colors.primary, 0.06) : 'transparent',
        borderRadius: entry.isCurrentUser ? 8 : 0,
        paddingHorizontal: entry.isCurrentUser ? 8 : 0,
      }}
    >
      {/* Rank */}
      <Text style={{ width: 32, fontSize: 13, fontWeight: '700', color: medalColor, textAlign: 'center' }}>
        {entry.rank}
      </Text>

      {/* Avatar */}
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: entry.isCurrentUser ? withAlpha(colors.primary, 0.15) : withAlpha(colors.white, 0.06),
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 10,
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: '800', color: entry.isCurrentUser ? colors.primary : colors.fgSecondary }}>
          {entry.username[0].toUpperCase()}
        </Text>
      </View>

      {/* Username */}
      <Text style={{ flex: 1, fontSize: 14, fontWeight: entry.isCurrentUser ? '700' : '500', color: entry.isCurrentUser ? colors.primary : colors.fgBright }}>
        {entry.username}{entry.isCurrentUser ? ' (you)' : ''}
      </Text>

      {/* Value */}
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.fgSecondary }}>
        {formatLeaderboardValue(category, entry.value)}
      </Text>
    </Pressable>
  )
}
