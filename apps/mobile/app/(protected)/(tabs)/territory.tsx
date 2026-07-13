import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  Animated,
  PanResponder,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'

import { fetchTerritory } from '@/features/maps/services/territory'
import { MapView } from '@/features/maps/components/MapView'
import { TerritoryLayer } from '@/features/maps/components/TerritoryLayer'
import { HeatmapLayer } from '@/features/maps/components/HeatmapLayer'
import { loadTerritoryStats, getUserHeatmap } from '@/features/maps/services/heatmap'
import { useHapticTerritoryCapture } from '@/features/maps/hooks/useHapticTerritoryCapture'
import { StatCard } from '@/components/ui/StatCard'
import { SectionLabel } from '@/components/ui/SectionLabel'
import type { TerritoryCollection } from '@/features/maps/types'
import type { TerritoryStats, HeatmapCell } from '@/features/maps/services/heatmap'
import { colors, withAlpha } from '@/theme'
import * as Location from 'expo-location'
import { queryGet, querySet } from '@/lib/queryCache'

const EMPTY: TerritoryCollection = { type: 'FeatureCollection', features: [] }

const TERRITORY_CACHE_KEY = 'territory-screen'
const TERRITORY_CACHE_TTL = 60_000

type LayerMode = 'territory' | 'heatmap'

// Bottom sheet snap positions (distance from bottom of screen)
const SHEET_COLLAPSED = 80
const SHEET_EXPANDED = 340

export default function TerritoryScreen() {
  const { height: screenHeight } = useWindowDimensions()

  const [polygons, setPolygons] = useState<TerritoryCollection>(EMPTY)
  const [stats, setStats] = useState<TerritoryStats | null>(null)
  const [heatmapCells, setHeatmapCells] = useState<HeatmapCell[]>([])
  const [layerMode, setLayerMode] = useState<LayerMode>('territory')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sheetExpanded, setSheetExpanded] = useState(false)
  const [userCenter, setUserCenter] = useState<[number, number] | null>(null)

  // Haptic feedback on territory capture
  useHapticTerritoryCapture(polygons)

  // Animated bottom sheet
  const sheetY = useRef(new Animated.Value(0)).current
  const lastY = useRef(0)
  const targetOffset = sheetExpanded ? SHEET_EXPANDED : SHEET_COLLAPSED

  // Animate sheet on toggle
  useEffect(() => {
    Animated.spring(sheetY, {
      toValue: sheetExpanded ? SHEET_EXPANDED - SHEET_COLLAPSED : 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start()
  }, [sheetExpanded, sheetY])

  useEffect(() => {
    Location.getLastKnownPositionAsync({ maxAge: 300_000, requiredAccuracy: 3000 })
      .then((loc) => {
        if (loc) setUserCenter([loc.coords.longitude, loc.coords.latitude])
      })
      .catch(() => {})
  }, [])

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dy }) => Math.abs(dy) > 5,
      onPanResponderMove: (_, { dy }) => {
        const next = Math.max(0, Math.min(SHEET_EXPANDED - SHEET_COLLAPSED, lastY.current - dy))
        sheetY.setValue(next)
      },
      onPanResponderRelease: (_, { dy }) => {
        const current = lastY.current - dy
        if (current > (SHEET_EXPANDED - SHEET_COLLAPSED) / 2) {
          setSheetExpanded(true)
          lastY.current = SHEET_EXPANDED - SHEET_COLLAPSED
        } else {
          setSheetExpanded(false)
          lastY.current = 0
        }
      },
    }),
  ).current

  const loadData = useCallback(() => {
    const cached = queryGet<{
      territory: TerritoryCollection
      stats: TerritoryStats
      cells: HeatmapCell[]
    }>(TERRITORY_CACHE_KEY, TERRITORY_CACHE_TTL)

    if (cached) {
      setPolygons(cached.territory)
      setStats(cached.stats)
      setHeatmapCells(cached.cells)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const [territory, stats, cells] = await Promise.all([
          fetchTerritory({ scope: 'me' }),
          loadTerritoryStats(),
          getUserHeatmap(),
        ])
        querySet(TERRITORY_CACHE_KEY, { territory, stats, cells })
        setPolygons(territory)
        setStats(stats)
        setHeatmapCells(cells)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load territory')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  useFocusEffect(loadData)

  const heatmapPoints = useMemo(
    () =>
      heatmapCells.slice(0, 500).map((cell) => {
        const coords = tryGetCellCenter(cell.cellId)
        return { cellId: cell.cellId, lat: coords.lat, lng: coords.lng, captures: cell.captures }
      }),
    [heatmapCells],
  )

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-6">
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.white, textAlign: 'center' }}>
          Failed to load territory
        </Text>
        <Text style={{ fontSize: 13, color: colors.fgSecondary, textAlign: 'center', marginTop: 6 }}>
          {error}
        </Text>
        <Pressable
          onPress={loadData}
          style={{ marginTop: 16, backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 }}
        >
          <Text style={{ color: colors.white, fontWeight: '700' }}>Try Again</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Full-screen map */}
      <MapView style={{ flex: 1 }} initialCenter={userCenter ?? undefined}>
        {layerMode === 'territory' && polygons.features.length > 0 && (
          <TerritoryLayer data={polygons} />
        )}
        {layerMode === 'heatmap' && heatmapPoints.length > 0 && (
          <HeatmapLayer cells={heatmapPoints} />
        )}
      </MapView>

      {/* Top overlay: title + layer toggle */}
      <SafeAreaView
        style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
        pointerEvents="box-none"
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingTop: 8,
          }}
          pointerEvents="box-none"
        >
          <View
            style={{
              backgroundColor: withAlpha(colors.background, 0.85),
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 8,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.white }}>My Territory</Text>
            <Text style={{ fontSize: 11, color: colors.fgMuted }}>
              {stats?.totalCells ?? polygons.features.length} cell{stats?.totalCells !== 1 ? 's' : ''} owned
            </Text>
          </View>

          {/* Layer toggle pill */}
          <View
            style={{
              backgroundColor: withAlpha(colors.background, 0.85),
              borderRadius: 20,
              flexDirection: 'row',
              padding: 3,
            }}
          >
            <LayerToggleBtn
              label="Territory"
              active={layerMode === 'territory'}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                setLayerMode('territory')
              }}
            />
            <LayerToggleBtn
              label="Heatmap"
              active={layerMode === 'heatmap'}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                setLayerMode('heatmap')
              }}
            />
          </View>
        </View>
      </SafeAreaView>

      {/* Bottom sheet */}
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          transform: [{ translateY: Animated.multiply(sheetY, -1) }],
        }}
      >
        {/* Drag handle area */}
        <View
          {...panResponder.panHandlers}
          style={{
            height: SHEET_COLLAPSED,
            backgroundColor: colors.background,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            alignItems: 'center',
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: withAlpha(colors.white, 0.08),
          }}
        >
          {/* Handle bar */}
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong }} />

          {/* Collapsed summary */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              setSheetExpanded(!sheetExpanded)
            }}
            style={{ flex: 1, width: '100%', justifyContent: 'center', paddingHorizontal: 20 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <StatPill label="Cells" value={String(stats?.totalCells ?? 0)} />
              <StatPill label="Captures" value={String(stats?.totalCaptures ?? 0)} />
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Ionicons
                  name={sheetExpanded ? 'chevron-down' : 'chevron-up'}
                  size={18}
                  color={colors.fgMuted}
                />
              </View>
            </View>
          </Pressable>
        </View>

        {/* Expanded content */}
        <View
          style={{
            backgroundColor: colors.background,
            height: SHEET_EXPANDED - SHEET_COLLAPSED,
            paddingHorizontal: 20,
            gap: 16,
          }}
        >
          <SectionLabel>Territory Stats</SectionLabel>

          {/* Stats grid */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatCard label="Cells Owned" value={String(stats?.totalCells ?? 0)} icon="grid" />
            <StatCard label="Total Captures" value={String(stats?.totalCaptures ?? 0)} icon="flag" />
          </View>

          {/* Most captured */}
          {stats?.mostCapturedCellId && (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Ionicons name="flame" size={20} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: colors.fgMuted, marginBottom: 2 }}>Most Captured Cell</Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.white, fontFamily: 'monospace' }}>
                  {stats.mostCapturedCellId.slice(0, 14)}…
                </Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.accent }}>
                {stats.topCells[0]?.captures ?? 0}×
              </Text>
            </View>
          )}

          {/* Top 5 cells */}
          {stats && stats.topCells.length > 1 && (
            <View style={{ gap: 6 }}>
              <SectionLabel>Top Cells</SectionLabel>
              {stats.topCells.slice(0, 5).map((cell, i) => (
                <View key={cell.cellId} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.fgFaint, width: 16 }}>
                    {i + 1}
                  </Text>
                  <Text style={{ flex: 1, fontSize: 11, color: colors.fgSecondary, fontFamily: 'monospace' }}>
                    {cell.cellId.slice(0, 12)}…
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>
                    {cell.captures}×
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Safely get lat/lng from an H3 cell ID. Returns (0,0) on failure so the
 * heatmap point is still created (it will be off-screen at 0°N 0°E).
 */
function tryGetCellCenter(cellId: string): { lat: number; lng: number } {
  try {
    // Use shared territory utility when it exports cellToLatLng
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { cellToLatLng } = require('h3-js') as { cellToLatLng: (id: string) => [number, number] }
    const [lat, lng] = cellToLatLng(cellId)
    return { lat, lng }
  } catch {
    return { lat: 0, lng: 0 }
  }
}

function LayerToggleBtn({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: active ? colors.primary : 'transparent',
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: '700', color: active ? colors.black : colors.fgMuted }}>
        {label}
      </Text>
    </Pressable>
  )
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
      <Text style={{ fontSize: 18, fontWeight: '800', color: colors.white }}>{value}</Text>
      <Text style={{ fontSize: 11, color: colors.fgMuted }}>{label}</Text>
    </View>
  )
}
