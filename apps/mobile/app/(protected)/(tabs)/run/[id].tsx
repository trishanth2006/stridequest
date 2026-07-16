import { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { formatDistance, formatDuration, formatPace } from '@stridequest/shared/running'
import { RunReplayMap } from '@/features/running/components/RunReplayMap'
import { getMobileWorkoutDetail } from '@/features/running/services/workout-detail'
import type { MobileWorkoutDetail } from '@/features/running/services/workout-detail'

// New components
import { WorkoutElevationChart } from '@/features/running/components/WorkoutElevationChart'
import { WorkoutCharts } from '@/features/running/components/WorkoutCharts'
import { WorkoutInsights } from '@/features/running/components/WorkoutInsights'
import { WorkoutSplitsTable } from '@/features/running/components/WorkoutSplitsTable'
import { WorkoutAchievementStrip } from '@/features/running/components/WorkoutAchievementStrip'
import { WorkoutPrStrip } from '@/features/running/components/WorkoutPrStrip'
import { WorkoutComparisonCard } from '@/features/running/components/WorkoutComparisonCard'
import { WorkoutShareDialog } from '@/features/running/components/WorkoutShareDialog'

// Shared UI from [id].tsx
import { Card, SectionLabel } from '@/features/running/components/shared'
import { BackButton } from '@/components/ui/BackButton'
import { colors, fonts, withAlpha } from '@/theme'

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { width } = useWindowDimensions()

  const [detail, setDetail] = useState<MobileWorkoutDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [shareVisible, setShareVisible] = useState(false)

  useEffect(() => {
    if (!id) return
    void (async () => {
      const det = await getMobileWorkoutDetail(id)
      if (!det) {
        setError('Could not load workout.')
      } else {
        setDetail(det)
      }
      setLoading(false)
    })()
  }, [id])

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    )
  }

  if (error || !detail) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" style={{ gap: 16 }}>
        <Text className="text-base text-fgSecondary">{error ?? 'Workout not found.'}</Text>
        <Pressable onPress={() => router.back()}>
          <Text className="text-sm font-semibold text-primaryBright">← Go Back</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  const date = new Date(detail.startedAt)
  const dateStr = date.toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  })
  const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

  const distKm = detail.distanceM / 1000

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ gap: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Nav */}
        <View className="px-5 pt-4 flex-row justify-between items-center">
          <BackButton />
          <Pressable
            onPress={() => setShareVisible(true)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Share this run"
            className="flex-row items-center"
            style={{ gap: 4 }}
          >
            <Text className="text-sm font-semibold text-primaryBright">Share</Text>
            <Ionicons name="share-outline" size={18} color={colors.primary} />
          </Pressable>
        </View>

        {/* ── Hero Section ── */}
        <View
          style={{
            marginHorizontal: 20,
            backgroundColor: colors.tint900,
            borderRadius: 24,
            padding: 24,
            gap: 8,
            borderWidth: 1,
            borderColor: withAlpha(colors.primary, 0.2),
          }}
        >
          <Text style={{ fontSize: 12, color: colors.primarySoft, fontWeight: '600', letterSpacing: 0.3 }}>
            {dateStr} · {timeStr}
          </Text>

          <Text
            style={{
              fontSize: 64,
              fontFamily: fonts.displayHeavy,
              color: colors.white,
              lineHeight: 68,
              fontVariant: ['tabular-nums'],
            }}
          >
            {distKm < 10
              ? distKm.toFixed(2)
              : distKm.toFixed(1)}
            <Text style={{ fontSize: 26, fontFamily: fonts.display, color: colors.primarySoft }}>
              {' '}km
            </Text>
          </Text>

          <View style={{ flexDirection: 'row', gap: 0, marginTop: 8 }}>
            <HeroMetric label="Time" value={formatDuration(detail.durationS)} />
            <View style={{ width: 1, backgroundColor: withAlpha(colors.white, 0.1), marginVertical: 4 }} />
            <HeroMetric label="Pace" value={formatPace(detail.avgPaceSPerKm)} />
            <View style={{ width: 1, backgroundColor: withAlpha(colors.white, 0.1), marginVertical: 4 }} />
            <HeroMetric label="XP" value={`+${detail.xpBreakdown.totalXp}`} accent />
          </View>
        </View>

        <View style={{ gap: 16, paddingHorizontal: 20 }}>
          {/* Territory Battle Report */}
          {detail.territoryBreakdown.totalImpact > 0 && (
            <Card>
              <SectionLabel>Territory Battle Report</SectionLabel>
              <View className="flex-row" style={{ gap: 8, marginTop: 12 }}>
                <BattleStat
                  label="Captured"
                  value={detail.territoryBreakdown.claimed}
                  color={colors.primary}
                  icon="flag"
                />
                <BattleStat
                  label="Stolen"
                  value={detail.territoryBreakdown.stolen}
                  color={colors.accent}
                  icon="flash"
                />
                <BattleStat
                  label="Defended"
                  value={detail.territoryBreakdown.defended}
                  color={colors.indigo}
                  icon="shield"
                />
                <BattleStat
                  label="Impact"
                  value={detail.territoryBreakdown.totalImpact}
                  color={colors.danger}
                  icon="globe"
                />
              </View>
            </Card>
          )}

          {/* XP Breakdown */}
          {(detail.xpBreakdown.captureXp > 0 || detail.xpBreakdown.stealXp > 0) && (
            <Card>
              <SectionLabel>XP Breakdown</SectionLabel>
              <View style={{ gap: 8, marginTop: 12 }}>
                <MetricRow label="Base (distance)" value={`+${detail.xpBreakdown.baseXp} XP`} />
                {detail.xpBreakdown.captureXp > 0 && (
                  <MetricRow label="Captures" value={`+${detail.xpBreakdown.captureXp} XP`} />
                )}
                {detail.xpBreakdown.stealXp > 0 && (
                  <MetricRow label="Steals" value={`+${detail.xpBreakdown.stealXp} XP`} />
                )}
                <View className="h-px bg-white/10" />
                <MetricRow label="Total" value={`${detail.xpBreakdown.totalXp} XP`} highlight />
              </View>
            </Card>
          )}

          {/* Route Map */}
          <Card noPad>
            <View className="px-5 pt-5 pb-3">
              <SectionLabel>Live Replay</SectionLabel>
            </View>
            {detail.routePoints.length === 0 ? (
              <View className="px-5 pb-5 items-center">
                <Text className="text-sm text-fgMuted">No route recorded</Text>
              </View>
            ) : (
              <View style={{ height: 300, overflow: 'hidden', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
                <RunReplayMap routeCoordinates={detail.routePoints.map(p => [p.lng, p.lat])} />
              </View>
            )}
          </Card>

          {/* Historical Comparison */}
          <WorkoutComparisonCard comparison={detail.comparison} />

          {/* Insights */}
          <WorkoutInsights insights={detail.insights} />

          {/* Splits */}
          <WorkoutSplitsTable splits={detail.splits} />

          {/* Pace + Speed Charts */}
          <WorkoutCharts chartSeries={detail.chartSeries} />

          {/* Elevation */}
          <WorkoutElevationChart chartSeries={detail.chartSeries} elevation={detail.elevation} />

          {/* Achievements & PRs */}
          <WorkoutPrStrip records={detail.prFlags.records} />
          <WorkoutAchievementStrip achievements={detail.achievementsUnlocked} />
        </View>
      </ScrollView>

      {/* Share Modal */}
      <WorkoutShareDialog
        workout={detail}
        visible={shareVisible}
        onClose={() => setShareVisible(false)}
      />
    </SafeAreaView>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function HeroMetric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 3 }}>
      <Text style={{ fontSize: 10, fontWeight: '600', color: colors.primarySoft, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 18, fontFamily: fonts.displayHeavy, color: accent ? colors.primary : colors.white, fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  )
}

function MetricRow({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <View className="flex-row justify-between items-center">
      <Text className="text-sm text-fgSecondary">{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '600', color: highlight ? colors.primary : colors.white }}>
        {value}
      </Text>
    </View>
  )
}

function BattleStat({
  label,
  value,
  color,
  icon,
}: {
  label: string
  value: number
  color: string
  icon: React.ComponentProps<typeof Ionicons>['name']
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: `${color}20`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={{ fontSize: 20, fontWeight: '800', color }}>{value}</Text>
      <Text style={{ fontSize: 9, fontWeight: '600', color: colors.fgMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Text>
    </View>
  )
}
