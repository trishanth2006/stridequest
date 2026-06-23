import { useEffect, useState, useRef } from 'react'
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
import { fetchRoutePoints } from '@/features/maps/services/route'
import { MapView } from '@/features/maps/components/MapView'
import { RouteLayer } from '@/features/maps/components/RouteLayer'
import { getMobileWorkoutDetail } from '@/features/running/services/workout-detail'
import { LineChart } from '@/components/charts/LineChart'
import { AreaChart } from '@/components/charts/AreaChart'
import type { MobileWorkoutDetail } from '@/features/running/services/workout-detail'
import type { RoutePoint } from '@/features/maps/types'

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { width } = useWindowDimensions()
  const CHART_W = width - 40 - 40 // screen - px-5*2 - card p-5*2
  const CHART_H = 120

  const [detail, setDetail] = useState<MobileWorkoutDetail | null>(null)
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    void (async () => {
      const [det, pts] = await Promise.all([
        getMobileWorkoutDetail(id),
        fetchRoutePoints(id),
      ])
      if (!det) {
        setError('Could not load workout.')
      } else {
        setDetail(det)
        setRoutePoints(pts)
      }
      setLoading(false)
    })()
  }, [id])

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-[#0b0b0f] items-center justify-center">
        <ActivityIndicator color="#10b981" size="large" />
      </SafeAreaView>
    )
  }

  if (error || !detail) {
    return (
      <SafeAreaView className="flex-1 bg-[#0b0b0f] items-center justify-center" style={{ gap: 16 }}>
        <Text className="text-base text-neutral-400">{error ?? 'Workout not found.'}</Text>
        <Pressable onPress={() => router.back()}>
          <Text className="text-sm font-semibold text-emerald-400">← Go Back</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  const date = new Date(detail.startedAt)
  const dateStr = date.toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
  const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

  const paceData = detail.chartSeries.map((p) => ({ x: p.distanceKm, y: p.pace }))
  const speedData = detail.chartSeries.map((p) => ({ x: p.distanceKm, y: p.speed }))
  const elevData = detail.chartSeries
    .filter((p) => p.altitude != null)
    .map((p) => ({ x: p.distanceKm, y: p.altitude! }))

  return (
    <SafeAreaView className="flex-1 bg-[#0b0b0f]">
      <ScrollView
        className="flex-1 px-5 pt-4"
        contentContainerStyle={{ gap: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <Pressable onPress={() => router.back()} className="flex-row items-center" style={{ gap: 4 }}>
          <Ionicons name="chevron-back" size={18} color="#10b981" />
          <Text className="text-sm font-semibold text-emerald-400">Back</Text>
        </Pressable>

        {/* Header */}
        <View style={{ gap: 2 }}>
          <Text className="text-2xl font-extrabold text-white">Run</Text>
          <Text className="text-sm text-neutral-400">{dateStr}</Text>
          <Text className="text-xs text-neutral-500">{timeStr}</Text>
        </View>

        {/* Key Metrics */}
        <Card>
          <SectionLabel>Key Metrics</SectionLabel>
          <View style={{ gap: 12, marginTop: 12 }}>
            <MetricRow label="Distance" value={formatDistance(detail.distanceM)} />
            <MetricRow label="Duration" value={formatDuration(detail.durationS)} />
            <MetricRow label="Avg Pace" value={formatPace(detail.avgPaceSPerKm)} />
            <MetricRow
              label="XP Earned"
              value={`+${detail.xpBreakdown.totalXp} XP`}
              highlight
            />
          </View>
        </Card>

        {/* Territory Battle Report */}
        {detail.territoryBreakdown.totalImpact > 0 && (
          <Card>
            <SectionLabel>Territory Battle Report</SectionLabel>
            <View className="flex-row" style={{ gap: 8, marginTop: 12 }}>
              <BattleStat
                label="Captured"
                value={detail.territoryBreakdown.claimed}
                color="#10b981"
                icon="flag"
              />
              <BattleStat
                label="Stolen"
                value={detail.territoryBreakdown.stolen}
                color="#f59e0b"
                icon="flash"
              />
              <BattleStat
                label="Defended"
                value={detail.territoryBreakdown.defended}
                color="#6366f1"
                icon="shield"
              />
              <BattleStat
                label="Impact"
                value={detail.territoryBreakdown.totalImpact}
                color="#ef4444"
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

        {/* Insights */}
        {detail.insights.length > 0 && (
          <View style={{ gap: 8 }}>
            <SectionLabel>Insights</SectionLabel>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingRight: 20 }}
            >
              {detail.insights.map((ins) => (
                <View
                  key={ins.id}
                  style={{
                    backgroundColor: '#171717',
                    borderRadius: 14,
                    padding: 14,
                    minWidth: 130,
                    gap: 4,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.06)',
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#10b981', textTransform: 'uppercase', letterSpacing: 1 }}>
                    {ins.label}
                  </Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>
                    {ins.value}
                  </Text>
                  {ins.detail && (
                    <Text style={{ fontSize: 11, color: '#71717a' }}>{ins.detail}</Text>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Route Map */}
        <Card noPad>
          <View className="px-5 pt-5 pb-3">
            <SectionLabel>Route Map</SectionLabel>
          </View>
          {routePoints.length === 0 ? (
            <View className="px-5 pb-5 items-center">
              <Text className="text-sm text-neutral-500">No route recorded</Text>
            </View>
          ) : (
            <Pressable
              onPress={() => router.push(`/run/${id}/map` as never)}
              style={{ height: 160 }}
            >
              <MapView interactive={false} style={{ flex: 1 }}>
                <RouteLayer points={routePoints} />
              </MapView>
            </Pressable>
          )}
        </Card>

        {/* Pace Chart */}
        {paceData.length >= 2 && (
          <Card>
            <SectionLabel>Pace</SectionLabel>
            <View style={{ marginTop: 12 }}>
              <LineChart data={paceData} width={CHART_W} height={CHART_H} color="#10b981" />
              <ChartAxis label="Distance (km)" />
            </View>
          </Card>
        )}

        {/* Speed Chart */}
        {speedData.length >= 2 && (
          <Card>
            <SectionLabel>Speed</SectionLabel>
            <View style={{ marginTop: 12 }}>
              <LineChart data={speedData} width={CHART_W} height={CHART_H} color="#6366f1" />
              <ChartAxis label="km/h over distance" />
            </View>
          </Card>
        )}

        {/* Elevation */}
        {detail.elevation.hasData && (
          <Card>
            <SectionLabel>Elevation</SectionLabel>
            <View className="flex-row" style={{ gap: 8, marginTop: 12 }}>
              <ElevStat label="Gain" value={`+${detail.elevation.gainM}m`} color="#10b981" />
              <ElevStat label="Loss" value={`-${detail.elevation.lossM}m`} color="#ef4444" />
              <ElevStat label="High" value={`${detail.elevation.highestM}m`} color="#a3a3a3" />
              <ElevStat label="Low" value={`${detail.elevation.lowestM}m`} color="#a3a3a3" />
            </View>
            {elevData.length >= 2 && (
              <View style={{ marginTop: 12 }}>
                <AreaChart data={elevData} width={CHART_W} height={CHART_H} color="#6366f1" />
                <ChartAxis label="Altitude (m) over distance" />
              </View>
            )}
          </Card>
        )}

        {/* Splits */}
        {detail.splits.length > 0 && (
          <Card noPad>
            <View className="px-5 pt-5 pb-3">
              <SectionLabel>Splits</SectionLabel>
            </View>
            {/* Header row */}
            <View className="flex-row px-5 pb-2">
              <Text style={{ width: 36, fontSize: 10, color: '#71717a', fontWeight: '600' }}>#</Text>
              <Text style={{ flex: 1, fontSize: 10, color: '#71717a', fontWeight: '600' }}>Dist</Text>
              <Text style={{ flex: 1, fontSize: 10, color: '#71717a', fontWeight: '600' }}>Time</Text>
              <Text style={{ flex: 1, fontSize: 10, color: '#71717a', fontWeight: '600', textAlign: 'right' }}>Pace</Text>
            </View>
            <View className="h-px bg-white/10" />
            {detail.splits.map((split, i) => {
              const bg = split.isFastest
                ? 'rgba(16,185,129,0.08)'
                : split.isSlowest
                ? 'rgba(239,68,68,0.08)'
                : 'transparent'
              const accent = split.isFastest ? '#10b981' : split.isSlowest ? '#ef4444' : '#fff'
              return (
                <View
                  key={split.index}
                  style={{ backgroundColor: bg }}
                  className="flex-row items-center px-5 py-3"
                >
                  <View style={{ width: 36, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: accent }}>
                      {split.index}
                    </Text>
                    {split.isFastest && (
                      <Ionicons name="flash" size={11} color="#10b981" />
                    )}
                    {split.isSlowest && (
                      <Ionicons name="hourglass" size={11} color="#ef4444" />
                    )}
                  </View>
                  <Text style={{ flex: 1, fontSize: 13, color: '#a3a3a3' }}>
                    {(split.distanceM / 1000).toFixed(2)} km
                  </Text>
                  <Text style={{ flex: 1, fontSize: 13, color: '#a3a3a3' }}>
                    {formatDuration(Math.round(split.durationS))}
                  </Text>
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: accent, textAlign: 'right' }}>
                    {formatPace(split.paceSPerKm)}
                  </Text>
                </View>
              )
            })}
            <View style={{ height: 8 }} />
          </Card>
        )}

        {/* Personal Records */}
        {detail.personalRecords.length > 0 && (
          <Card>
            <SectionLabel>Personal Records 🏆</SectionLabel>
            <View style={{ gap: 10, marginTop: 12 }}>
              {detail.personalRecords.map((rec) => (
                <View
                  key={rec.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: 'rgba(16,185,129,0.08)',
                    borderRadius: 12,
                    padding: 12,
                    gap: 10,
                    borderWidth: 1,
                    borderColor: 'rgba(16,185,129,0.2)',
                  }}
                >
                  <Ionicons name="trophy" size={20} color="#10b981" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#10b981' }}>
                      {rec.title}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>
                      New personal best!
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Card({ children, noPad = false }: { children: React.ReactNode; noPad?: boolean }) {
  return (
    <View
      style={{
        backgroundColor: '#171717',
        borderRadius: 16,
        padding: noPad ? 0 : 20,
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontSize: 10, fontWeight: '700', color: '#71717a', textTransform: 'uppercase', letterSpacing: 1 }}>
      {children}
    </Text>
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
      <Text className="text-sm text-neutral-400">{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '600', color: highlight ? '#10b981' : '#fff' }}>
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
      <Text style={{ fontSize: 9, fontWeight: '600', color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Text>
    </View>
  )
}

function ElevStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color }}>{value}</Text>
      <Text style={{ fontSize: 9, fontWeight: '600', color: '#71717a', textTransform: 'uppercase' }}>
        {label}
      </Text>
    </View>
  )
}

function ChartAxis({ label }: { label: string }) {
  return (
    <Text style={{ fontSize: 9, color: '#52525b', marginTop: 4, textAlign: 'center' }}>
      {label}
    </Text>
  )
}
