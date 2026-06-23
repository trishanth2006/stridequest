import { useEffect, useState, useRef, useCallback } from 'react'
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

import { fetchTerritory } from '@/features/maps/services/territory'
import { MapView } from '@/features/maps/components/MapView'
import { TerritoryLayer } from '@/features/maps/components/TerritoryLayer'
import { HeatmapLayer } from '@/features/maps/components/HeatmapLayer'
import { loadTerritoryStats, getUserHeatmap } from '@/features/maps/services/heatmap'
import type { TerritoryCollection } from '@/features/maps/types'
import type { TerritoryStats, HeatmapCell } from '@/features/maps/services/heatmap'

const EMPTY: TerritoryCollection = { type: 'FeatureCollection', features: [] }

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
  const [sheetExpanded, setSheetExpanded] = useState(false)

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
    setLoading(true)
    void (async () => {
      const [territory, territoryStats, cells] = await Promise.all([
        fetchTerritory({ scope: 'me' }),
        loadTerritoryStats(),
        getUserHeatmap(),
      ])
      setPolygons(territory)
      setStats(territoryStats)
      setHeatmapCells(cells)
      setLoading(false)
    })()
  }, [])

  useFocusEffect(loadData)

  // Convert heatmap cells to lat/lng for the map layer
  const heatmapPoints = heatmapCells.slice(0, 500).map((cell) => {
    // Use cell centre from shared territory utility if available
    const coords = tryGetCellCenter(cell.cellId)
    return { cellId: cell.cellId, lat: coords.lat, lng: coords.lng, captures: cell.captures }
  })

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-[#0b0b0f] items-center justify-center">
        <ActivityIndicator color="#10b981" size="large" />
      </SafeAreaView>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0b0b0f' }}>
      {/* Full-screen map */}
      <MapView style={{ flex: 1 }}>
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
              backgroundColor: 'rgba(11,11,15,0.85)',
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 8,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>My Territory</Text>
            <Text style={{ fontSize: 11, color: '#71717a' }}>
              {stats?.totalCells ?? polygons.features.length} cell{stats?.totalCells !== 1 ? 's' : ''} owned
            </Text>
          </View>

          {/* Layer toggle pill */}
          <View
            style={{
              backgroundColor: 'rgba(11,11,15,0.85)',
              borderRadius: 20,
              flexDirection: 'row',
              padding: 3,
            }}
          >
            <LayerToggleBtn
              label="Territory"
              active={layerMode === 'territory'}
              onPress={() => setLayerMode('territory')}
            />
            <LayerToggleBtn
              label="Heatmap"
              active={layerMode === 'heatmap'}
              onPress={() => setLayerMode('heatmap')}
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
            backgroundColor: '#0b0b0f',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            alignItems: 'center',
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: 'rgba(255,255,255,0.08)',
          }}
        >
          {/* Handle bar */}
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#3f3f46' }} />

          {/* Collapsed summary */}
          <Pressable
            onPress={() => setSheetExpanded(!sheetExpanded)}
            style={{ flex: 1, width: '100%', justifyContent: 'center', paddingHorizontal: 20 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <StatPill label="Cells" value={String(stats?.totalCells ?? 0)} />
              <StatPill label="Captures" value={String(stats?.totalCaptures ?? 0)} />
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Ionicons
                  name={sheetExpanded ? 'chevron-down' : 'chevron-up'}
                  size={18}
                  color="#71717a"
                />
              </View>
            </View>
          </Pressable>
        </View>

        {/* Expanded content */}
        <View
          style={{
            backgroundColor: '#0b0b0f',
            height: SHEET_EXPANDED - SHEET_COLLAPSED,
            paddingHorizontal: 20,
            gap: 16,
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#71717a', textTransform: 'uppercase', letterSpacing: 1 }}>
            Territory Stats
          </Text>

          {/* Stats grid */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatCard label="Cells Owned" value={String(stats?.totalCells ?? 0)} icon="grid" />
            <StatCard label="Total Captures" value={String(stats?.totalCaptures ?? 0)} icon="flag" />
          </View>

          {/* Most captured */}
          {stats?.mostCapturedCellId && (
            <View
              style={{
                backgroundColor: '#171717',
                borderRadius: 12,
                padding: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Ionicons name="flame" size={20} color="#f59e0b" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: '#71717a', marginBottom: 2 }}>Most Captured Cell</Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#fff', fontFamily: 'monospace' }}>
                  {stats.mostCapturedCellId.slice(0, 14)}…
                </Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#f59e0b' }}>
                {stats.topCells[0]?.captures ?? 0}×
              </Text>
            </View>
          )}

          {/* Top 5 cells */}
          {stats && stats.topCells.length > 1 && (
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#71717a', textTransform: 'uppercase', letterSpacing: 1 }}>
                Top Cells
              </Text>
              {stats.topCells.slice(0, 5).map((cell, i) => (
                <View key={cell.cellId} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#52525b', width: 16 }}>
                    {i + 1}
                  </Text>
                  <Text style={{ flex: 1, fontSize: 11, color: '#a3a3a3', fontFamily: 'monospace' }}>
                    {cell.cellId.slice(0, 12)}…
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#10b981' }}>
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
        backgroundColor: active ? '#10b981' : 'transparent',
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#000' : '#71717a' }}>
        {label}
      </Text>
    </Pressable>
  )
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
      <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>{value}</Text>
      <Text style={{ fontSize: 11, color: '#71717a' }}>{label}</Text>
    </View>
  )
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: React.ComponentProps<typeof Ionicons>['name']
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#171717',
        borderRadius: 12,
        padding: 14,
        gap: 8,
      }}
    >
      <Ionicons name={icon} size={18} color="#10b981" />
      <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff' }}>{value}</Text>
      <Text style={{ fontSize: 10, fontWeight: '600', color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Text>
    </View>
  )
}
