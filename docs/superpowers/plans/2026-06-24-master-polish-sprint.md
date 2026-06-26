# Master Polish Sprint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate the StrideQuest mobile app from MVP feel to production-polish standard by shipping interactive chart cursors, a stable share dialog with route diagram, and all P0/P1 gamification gaps across Leaderboards, Profile, and Achievements screens.

**Architecture:** Phase 1 adds a reusable `ChartCursor` wrapper + `useChartTouch` hook layered over the existing SVG charts; the share dialog gains a stability patch and an SVG route preview. Phase 2 surgically augments existing screens with missing data sections. Phase 3 adds a `SkeletonLoader` component and wires Reanimated entrance animations throughout.

**Tech Stack:** React Native 0.76, Expo 52, react-native-reanimated 4.1.1, react-native-svg, PanResponder (stdlib), expo-sharing 14.0.8, react-native-view-shot 5.1.1

---

## File Map

### Phase 1 — Interactive Charts + Share Dialog
| Action | Path |
|--------|------|
| Create | `apps/mobile/src/components/charts/useChartTouch.ts` |
| Create | `apps/mobile/src/components/charts/ChartCursor.tsx` |
| Modify | `apps/mobile/src/features/running/components/WorkoutCharts.tsx` |
| Modify | `apps/mobile/src/features/running/components/WorkoutElevationChart.tsx` |
| Modify | `apps/mobile/src/features/running/components/WorkoutShareDialog.tsx` |

### Phase 2 — P0 Critical Parity
| Action | Path |
|--------|------|
| Modify | `apps/mobile/app/(protected)/leaderboards/index.tsx` |
| Modify | `apps/mobile/app/(protected)/(tabs)/profile.tsx` |
| Modify | `apps/mobile/src/features/profiles/services/public-profile.ts` |
| Modify | `apps/mobile/app/(protected)/profile/[username].tsx` |
| Modify | `apps/mobile/app/(protected)/achievements/index.tsx` |

### Phase 3 — P1 Polish
| Action | Path |
|--------|------|
| Create | `apps/mobile/src/components/ui/SkeletonLoader.tsx` |
| Modify | `apps/mobile/app/(protected)/leaderboards/index.tsx` |
| Modify | `apps/mobile/app/(protected)/(tabs)/profile.tsx` |
| Modify | `apps/mobile/app/(protected)/achievements/index.tsx` |

---

## Phase 1 — Interactive Charts + Share Dialog

---

### Task 1: `useChartTouch` — coordinate mapping hook

**Files:**
- Create: `apps/mobile/src/components/charts/useChartTouch.ts`

Both `LineChart.tsx` and `AreaChart.tsx` use `PAD_X = PAD_Y = 8` and the same linear mapping formula:
`pixelX = padX + ((dataX - minX) / rangeX) * drawW`. This hook inverts that formula and exposes a `PanResponder` + Reanimated shared values for use by `ChartCursor`.

- [ ] **Step 1.1: Create the hook file**

```typescript
// apps/mobile/src/components/charts/useChartTouch.ts
import { useRef, useState } from 'react'
import { PanResponder } from 'react-native'
import { useSharedValue } from 'react-native-reanimated'

export type ChartPoint = { x: number; y: number }

// Must match the PAD_X constant in LineChart.tsx and AreaChart.tsx
const CHART_PAD_X = 8

// ── Pure coordinate utilities (module-level, no stale-closure risk) ──────────

export function chartFindClosest(
  pixelX: number,
  data: ChartPoint[],
  chartWidth: number,
): number {
  if (data.length < 2) return -1
  const minX = Math.min(...data.map((p) => p.x))
  const maxX = Math.max(...data.map((p) => p.x))
  const rangeX = maxX - minX || 1
  const drawW = chartWidth - CHART_PAD_X * 2
  const t = Math.max(0, Math.min(1, (pixelX - CHART_PAD_X) / drawW))
  const dataX = minX + t * rangeX
  let closest = 0
  let minDist = Infinity
  data.forEach((p, i) => {
    const dist = Math.abs(p.x - dataX)
    if (dist < minDist) { minDist = dist; closest = i }
  })
  return closest
}

export function chartIndexToPixelX(
  idx: number,
  data: ChartPoint[],
  chartWidth: number,
): number {
  const minX = Math.min(...data.map((p) => p.x))
  const maxX = Math.max(...data.map((p) => p.x))
  const rangeX = maxX - minX || 1
  const drawW = chartWidth - CHART_PAD_X * 2
  return CHART_PAD_X + ((data[idx].x - minX) / rangeX) * drawW
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Wires touch tracking for a chart of given data + pixel width.
 *
 * Returns:
 *  - cursorX  — Reanimated shared value: pixel X of cursor, -1 when hidden
 *  - activeIdx — React state: index into `data[]`, -1 when hidden
 *  - panResponder — attach via {...panResponder.panHandlers} to the touch overlay View
 */
export function useChartTouch(data: ChartPoint[], chartWidth: number) {
  const cursorX = useSharedValue(-1)
  const [activeIdx, setActiveIdx] = useState(-1)

  // Stable ref so PanResponder closure always reads latest props
  const stateRef = useRef({ data, chartWidth, cursorX, setActiveIdx })
  stateRef.current = { data, chartWidth, cursorX, setActiveIdx }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { data: d, chartWidth: w, cursorX: cx, setActiveIdx: set } = stateRef.current
        const idx = chartFindClosest(evt.nativeEvent.locationX, d, w)
        if (idx >= 0) { cx.value = chartIndexToPixelX(idx, d, w); set(idx) }
      },
      onPanResponderMove: (evt) => {
        const { data: d, chartWidth: w, cursorX: cx, setActiveIdx: set } = stateRef.current
        const idx = chartFindClosest(evt.nativeEvent.locationX, d, w)
        if (idx >= 0) { cx.value = chartIndexToPixelX(idx, d, w); set(idx) }
      },
      onPanResponderRelease: () => {
        const { cursorX: cx, setActiveIdx: set } = stateRef.current
        cx.value = -1; set(-1)
      },
      onPanResponderTerminate: () => {
        const { cursorX: cx, setActiveIdx: set } = stateRef.current
        cx.value = -1; set(-1)
      },
    }),
  ).current

  return { cursorX, activeIdx, panResponder }
}
```

- [ ] **Step 1.2: Verify typecheck**

```bash
cd apps/mobile && npx tsc --noEmit --project tsconfig.json 2>&1 | grep useChartTouch
```
Expected: no output (no errors for this file).

- [ ] **Step 1.3: Commit**

```bash
git add apps/mobile/src/components/charts/useChartTouch.ts
git commit -m "feat(mobile/charts): add useChartTouch hook for interactive cursor tracking"
```

---

### Task 2: `ChartCursor` — interactive overlay component

**Files:**
- Create: `apps/mobile/src/components/charts/ChartCursor.tsx`

Wraps any chart SVG with:
1. A transparent touch-capture `View` (full-size, z-index 10)
2. An animated vertical cursor line (Reanimated `useAnimatedStyle`)
3. A floating tooltip pill (snaps to nearest data point label)

The tooltip is clamped to stay within the chart bounds; it appears above the chart.

- [ ] **Step 2.1: Create the component**

```tsx
// apps/mobile/src/components/charts/ChartCursor.tsx
import React from 'react'
import { View, Text } from 'react-native'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { useChartTouch, type ChartPoint } from './useChartTouch'

const TOOLTIP_WIDTH = 96
const TOOLTIP_HEIGHT = 26

interface ChartCursorProps {
  data: ChartPoint[]
  width: number
  height: number
  color: string
  /** Receives the active data point and returns the string shown in the tooltip */
  formatTooltip: (point: ChartPoint) => string
  children: React.ReactNode
}

/**
 * Drop-in wrapper that adds touch-to-scrub interactivity to any SVG chart.
 * Usage: wrap <LineChart /> or <AreaChart /> with this component.
 */
export function ChartCursor({
  data,
  width,
  height,
  color,
  formatTooltip,
  children,
}: ChartCursorProps) {
  const { cursorX, activeIdx, panResponder } = useChartTouch(data, width)

  const tooltipText = activeIdx >= 0 && activeIdx < data.length
    ? formatTooltip(data[activeIdx])
    : ''

  // Cursor line: translates to cursorX, hidden when cursorX = -1
  const cursorLineStyle = useAnimatedStyle(() => ({
    opacity: cursorX.value < 0 ? 0 : 0.7,
    transform: [{ translateX: cursorX.value < 0 ? 0 : cursorX.value - 0.5 }],
  }))

  // Tooltip: follows cursor X, clamped to chart width
  const tooltipStyle = useAnimatedStyle(() => {
    const x = cursorX.value < 0
      ? 0
      : Math.min(Math.max(0, cursorX.value - TOOLTIP_WIDTH / 2), width - TOOLTIP_WIDTH)
    return {
      opacity: cursorX.value < 0 ? 0 : 1,
      transform: [{ translateX: x }],
    }
  })

  return (
    <View style={{ width, height, position: 'relative' }}>
      {/* Chart SVG */}
      {children}

      {/* Touch-capture layer + cursor overlay */}
      <View
        style={{ position: 'absolute', top: 0, left: 0, width, height, zIndex: 10 }}
        {...panResponder.panHandlers}
      >
        {/* Vertical cursor line */}
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              width: 1,
              height,
              backgroundColor: color,
            },
            cursorLineStyle,
          ]}
        />

        {/* Tooltip pill — positioned above the chart area */}
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: -(TOOLTIP_HEIGHT + 6),
              left: 0,
              width: TOOLTIP_WIDTH,
              height: TOOLTIP_HEIGHT,
              backgroundColor: 'rgba(10,10,14,0.92)',
              borderRadius: 8,
              borderWidth: 1,
              borderColor: `${color}50`,
              alignItems: 'center',
              justifyContent: 'center',
            },
            tooltipStyle,
          ]}
        >
          <Text
            numberOfLines={1}
            style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}
          >
            {tooltipText}
          </Text>
        </Animated.View>
      </View>
    </View>
  )
}
```

- [ ] **Step 2.2: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | grep -E "ChartCursor|useChartTouch" | head -20
```
Expected: no errors.

- [ ] **Step 2.3: Commit**

```bash
git add apps/mobile/src/components/charts/ChartCursor.tsx
git commit -m "feat(mobile/charts): add ChartCursor interactive overlay with Reanimated cursor line"
```

---

### Task 3: Wire `ChartCursor` into `WorkoutCharts.tsx`

**Files:**
- Modify: `apps/mobile/src/features/running/components/WorkoutCharts.tsx`

Each pace/speed chart gains a `ChartCursor` wrapper. The tooltip format:
- Pace chart: `"X.XX min/km"` (format via `formatPace`)
- Speed chart: `"X.XX km/h"`

Note: `ChartPoint.x` = distanceKm, `ChartPoint.y` = raw pace (s/km) or speed (km/h).

- [ ] **Step 3.1: Rewrite `WorkoutCharts.tsx`**

```tsx
// apps/mobile/src/features/running/components/WorkoutCharts.tsx
import { View, useWindowDimensions } from 'react-native'
import { LineChart } from '@/components/charts/LineChart'
import { ChartCursor } from '@/components/charts/ChartCursor'
import { Card, SectionLabel, ChartAxis } from './shared'
import { formatPace } from '@stridequest/shared/running'
import type { WorkoutChartPoint } from '@stridequest/shared/analytics'

interface WorkoutChartsProps {
  chartSeries: WorkoutChartPoint[]
}

export function WorkoutCharts({ chartSeries }: WorkoutChartsProps) {
  const { width } = useWindowDimensions()
  const CHART_W = width - 40 - 40
  const CHART_H = 120

  if (chartSeries.length === 0) return null

  const paceData = chartSeries.map((p) => ({ x: p.distanceKm, y: p.pace }))
  const speedData = chartSeries.map((p) => ({ x: p.distanceKm, y: p.speed }))

  return (
    <View style={{ gap: 16 }}>
      {paceData.length >= 2 && (
        <Card>
          <SectionLabel>Pace</SectionLabel>
          <View style={{ marginTop: 12, paddingTop: 32 }}>
            <ChartCursor
              data={paceData}
              width={CHART_W}
              height={CHART_H}
              color="#3b82f6"
              formatTooltip={(p) => formatPace(p.y)}
            >
              <LineChart data={paceData} width={CHART_W} height={CHART_H} color="#3b82f6" />
            </ChartCursor>
            <ChartAxis label="Distance (km)" />
          </View>
        </Card>
      )}

      {speedData.length >= 2 && (
        <Card>
          <SectionLabel>Speed</SectionLabel>
          <View style={{ marginTop: 12, paddingTop: 32 }}>
            <ChartCursor
              data={speedData}
              width={CHART_W}
              height={CHART_H}
              color="#10b981"
              formatTooltip={(p) => `${p.y.toFixed(1)} km/h`}
            >
              <LineChart data={speedData} width={CHART_W} height={CHART_H} color="#10b981" />
            </ChartCursor>
            <ChartAxis label="km/h over distance" />
          </View>
        </Card>
      )}
    </View>
  )
}
```

Note the `paddingTop: 32` on the inner `View` — this creates space above the chart for the tooltip pill, which renders at `top: -(26+6)`.

- [ ] **Step 3.2: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | grep WorkoutCharts | head -10
```
Expected: no errors.

- [ ] **Step 3.3: Commit**

```bash
git add apps/mobile/src/features/running/components/WorkoutCharts.tsx
git commit -m "feat(mobile): add interactive touch cursor to Pace and Speed charts"
```

---

### Task 4: Wire `ChartCursor` into `WorkoutElevationChart.tsx`

**Files:**
- Modify: `apps/mobile/src/features/running/components/WorkoutElevationChart.tsx`

- [ ] **Step 4.1: Rewrite `WorkoutElevationChart.tsx`**

```tsx
// apps/mobile/src/features/running/components/WorkoutElevationChart.tsx
import { View, Text, useWindowDimensions } from 'react-native'
import { AreaChart } from '@/components/charts/AreaChart'
import { ChartCursor } from '@/components/charts/ChartCursor'
import { Card, SectionLabel, ChartAxis } from './shared'
import type { WorkoutChartPoint, WorkoutElevation } from '@stridequest/shared/analytics'

interface WorkoutElevationChartProps {
  chartSeries: WorkoutChartPoint[]
  elevation: WorkoutElevation
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

export function WorkoutElevationChart({ chartSeries, elevation }: WorkoutElevationChartProps) {
  const { width } = useWindowDimensions()
  const CHART_W = width - 40 - 40
  const CHART_H = 120

  if (!elevation.hasData) return null

  const elevData = chartSeries
    .filter((p) => p.altitude != null)
    .map((p) => ({ x: p.distanceKm, y: p.altitude! }))

  return (
    <Card>
      <SectionLabel>Elevation</SectionLabel>
      <View className="flex-row" style={{ gap: 8, marginTop: 12 }}>
        <ElevStat label="Gain" value={`+${elevation.gainM}m`} color="#10b981" />
        <ElevStat label="Loss" value={`-${elevation.lossM}m`} color="#ef4444" />
        <ElevStat label="High" value={`${elevation.highestM}m`} color="#a3a3a3" />
        <ElevStat label="Low" value={`${elevation.lowestM}m`} color="#a3a3a3" />
      </View>
      {elevData.length >= 2 && (
        <View style={{ marginTop: 12, paddingTop: 32 }}>
          <ChartCursor
            data={elevData}
            width={CHART_W}
            height={CHART_H}
            color="#6366f1"
            formatTooltip={(p) => `${Math.round(p.y)}m alt`}
          >
            <AreaChart data={elevData} width={CHART_W} height={CHART_H} color="#6366f1" />
          </ChartCursor>
          <ChartAxis label="Altitude (m) over distance" />
        </View>
      )}
    </Card>
  )
}
```

- [ ] **Step 4.2: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | grep ElevationChart | head -10
```

- [ ] **Step 4.3: Commit**

```bash
git add apps/mobile/src/features/running/components/WorkoutElevationChart.tsx
git commit -m "feat(mobile): add interactive touch cursor to Elevation chart"
```

---

### Task 5: `WorkoutShareDialog` — stability patch + route diagram

**Files:**
- Modify: `apps/mobile/src/features/running/components/WorkoutShareDialog.tsx`

**Stability patches:**
1. `Sharing.isAvailableAsync()` guard before calling `shareAsync`
2. Ensure URI has `file://` prefix (Android returns a bare path, iOS returns the full URI)
3. `try/catch` around the entire pipeline with `Alert` fallback

**Route diagram:**
- Decimate route points to ≤ 200 samples to keep path string short
- Normalize lat/lng to SVG [padded] coordinates, preserving aspect ratio
- Draw as an SVG `Path` on a `#0c1a10` gradient background

- [ ] **Step 5.1: Rewrite `WorkoutShareDialog.tsx`**

```tsx
// apps/mobile/src/features/running/components/WorkoutShareDialog.tsx
import { useRef, useState } from 'react'
import {
  View, Text, Modal, Pressable, ActivityIndicator,
  SafeAreaView, Dimensions, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import ViewShot, { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg'
import { formatDistance, formatDuration, formatPace } from '@stridequest/shared/running'
import type { MobileWorkoutDetail } from '../services/workout-detail'
import type { WorkoutRoutePoint } from '@stridequest/shared/analytics'

interface WorkoutShareDialogProps {
  workout: MobileWorkoutDetail
  visible: boolean
  onClose: () => void
}

// ── Route diagram helpers ────────────────────────────────────────────────────

function decimatePoints(pts: WorkoutRoutePoint[], maxPts: number): WorkoutRoutePoint[] {
  if (pts.length <= maxPts) return pts
  const step = Math.ceil(pts.length / maxPts)
  const out: WorkoutRoutePoint[] = []
  for (let i = 0; i < pts.length; i += step) out.push(pts[i])
  if (out[out.length - 1] !== pts[pts.length - 1]) out.push(pts[pts.length - 1])
  return out
}

function buildRouteSvgPath(
  routePoints: WorkoutRoutePoint[],
  svgW: number,
  svgH: number,
): string {
  const pts = decimatePoints(routePoints, 200)
  if (pts.length < 2) return ''
  const PAD = 16
  const drawW = svgW - PAD * 2
  const drawH = svgH - PAD * 2

  const lngs = pts.map((p) => p.lng)
  const lats = pts.map((p) => p.lat)
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
  const minLat = Math.min(...lats), maxLat = Math.max(...lats)
  const rangeX = maxLng - minLng || 0.001
  const rangeY = maxLat - minLat || 0.001

  // Preserve aspect ratio: use the tighter scale
  const scale = Math.min(drawW / rangeX, drawH / rangeY)
  const offsetX = PAD + (drawW - rangeX * scale) / 2
  const offsetY = PAD + (drawH - rangeY * scale) / 2

  return pts
    .map((p, i) => {
      const x = (offsetX + (p.lng - minLng) * scale).toFixed(1)
      const y = (offsetY + (maxLat - p.lat) * scale).toFixed(1) // flip Y axis
      return `${i === 0 ? 'M' : 'L'}${x},${y}`
    })
    .join(' ')
}

// ── Share handler ────────────────────────────────────────────────────────────

async function shareImage(uri: string): Promise<void> {
  // Ensure file:// prefix — Android sometimes returns a bare path
  const safeUri = uri.startsWith('file://') ? uri : `file://${uri}`
  const available = await Sharing.isAvailableAsync()
  if (!available) {
    Alert.alert('Sharing unavailable', 'Your device does not support file sharing.')
    return
  }
  await Sharing.shareAsync(safeUri, {
    dialogTitle: 'Share your StrideQuest workout',
    mimeType: 'image/png',
  })
}

// ── Component ────────────────────────────────────────────────────────────────

const ROUTE_SVG_W = 280
const ROUTE_SVG_H = 140

export function WorkoutShareDialog({ workout, visible, onClose }: WorkoutShareDialogProps) {
  const viewRef = useRef<View>(null)
  const [sharing, setSharing] = useState(false)

  const routePath = buildRouteSvgPath(workout.routePoints, ROUTE_SVG_W, ROUTE_SVG_H)
  const hasRoute = routePath.length > 0

  const { width } = Dimensions.get('window')
  const PREVIEW_WIDTH = width * 0.85

  const handleShare = async () => {
    try {
      setSharing(true)
      const uri = await captureRef(viewRef, { format: 'png', quality: 1 })
      await shareImage(uri)
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred.'
      Alert.alert('Share failed', message)
    } finally {
      setSharing(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' }}>
        <SafeAreaView style={{ flex: 1, width: '100%', alignItems: 'center' }}>
          {/* Close button */}
          <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'flex-end', padding: 20 }}>
            <Pressable onPress={onClose} style={{ padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20 }}>
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
          </View>

          {/* Share card preview */}
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' }}>
            <ViewShot
              ref={viewRef as React.RefObject<typeof ViewShot>}
              options={{ format: 'png', quality: 1 }}
              style={{ width: PREVIEW_WIDTH }}
            >
              <View
                style={{
                  backgroundColor: '#0c1a10',
                  borderRadius: 28,
                  overflow: 'hidden',
                  borderWidth: 1.5,
                  borderColor: 'rgba(16,185,129,0.4)',
                }}
              >
                {/* Route diagram */}
                {hasRoute && (
                  <View style={{ width: '100%', height: ROUTE_SVG_H, backgroundColor: '#0f2219' }}>
                    <Svg width="100%" height={ROUTE_SVG_H} viewBox={`0 0 ${ROUTE_SVG_W} ${ROUTE_SVG_H}`}>
                      <Defs>
                        <LinearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
                          <Stop offset="0%" stopColor="#0f2219" stopOpacity={1} />
                          <Stop offset="100%" stopColor="#0a1610" stopOpacity={1} />
                        </LinearGradient>
                      </Defs>
                      <Path d={`M0,0 H${ROUTE_SVG_W} V${ROUTE_SVG_H} H0 Z`} fill="url(#bgGrad)" />
                      <Path
                        d={routePath}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={0.9}
                      />
                    </Svg>
                    {/* Gradient overlay fading into card body */}
                    <View
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: 40,
                        backgroundColor: 'transparent',
                      }}
                      pointerEvents="none"
                    />
                  </View>
                )}

                {/* Stats strip */}
                <View style={{ padding: 24, gap: 16, alignItems: 'center' }}>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '800',
                      color: '#10b981',
                      letterSpacing: 3,
                      textTransform: 'uppercase',
                    }}
                  >
                    StrideQuest
                  </Text>

                  <Text
                    style={{
                      fontSize: 64,
                      fontWeight: '900',
                      color: '#fff',
                      letterSpacing: -3,
                      lineHeight: 68,
                    }}
                  >
                    {formatDistance(workout.distanceM)}
                  </Text>

                  <View style={{ flexDirection: 'row', gap: 20 }}>
                    <ShareMetric label="TIME" value={formatDuration(workout.durationS)} />
                    <ShareMetric label="PACE" value={formatPace(workout.avgPaceSPerKm)} />
                    {workout.xpBreakdown.totalXp > 0 && (
                      <ShareMetric
                        label="XP"
                        value={`+${workout.xpBreakdown.totalXp}`}
                        accent
                      />
                    )}
                  </View>
                </View>
              </View>
            </ViewShot>
          </View>

          {/* Share button */}
          <View style={{ width: '100%', padding: 24, paddingBottom: 48 }}>
            <Pressable
              onPress={handleShare}
              disabled={sharing}
              style={{
                backgroundColor: '#10b981',
                borderRadius: 16,
                paddingVertical: 16,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
                opacity: sharing ? 0.7 : 1,
              }}
            >
              {sharing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="share-outline" size={20} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                    Share Summary
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  )
}

function ShareMetric({
  label,
  value,
  accent = false,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <Text
        style={{
          fontSize: 10,
          fontWeight: '700',
          color: accent ? '#10b981' : '#6ee7b7',
          letterSpacing: 1.5,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 18,
          fontWeight: '800',
          color: accent ? '#10b981' : '#fff',
        }}
      >
        {value}
      </Text>
    </View>
  )
}
```

- [ ] **Step 5.2: Typecheck Phase 1**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | head -40
```
Expected: no errors. Fix any type errors before continuing.

- [ ] **Step 5.3: Commit Phase 1**

```bash
git add apps/mobile/src/features/running/components/WorkoutShareDialog.tsx
git commit -m "feat(mobile): patch share dialog stability + add SVG route diagram to share card"
```

---

## Phase 2 — P0 Critical Parity

---

### Task 6: Leaderboards — TerritoryKingCard + per-tab participant count

**Files:**
- Modify: `apps/mobile/app/(protected)/leaderboards/index.tsx`

**Changes:**
1. On mount, fire an additional `fetchLeaderboard('territory', userId, 1, 0)` to get the top territory holder (territory king). Store as `territoryKing: LeaderboardEntry | null`.
2. Render a "Reigning Champion" card with amber border/icon between the header and the category tabs.
3. Below the tab pills, show a subtitle row: `{myRank.totalUsers} athletes · You're ranked #{myRank.rank}` (or `Unranked`).

- [ ] **Step 6.1: Add territory king fetch + state**

At the top of `LeaderboardsScreen`, add:
```tsx
const [territoryKing, setTerritoryKing] = useState<LeaderboardEntry | null>(null)
```

In the `load` callback, extend the `Promise.all` to also fetch the top territory entry:
```tsx
const [page, rank, topTerritory] = await Promise.all([
  fetchLeaderboard(category, userId, PAGE_SIZE, 0),
  fetchMyRank(category),
  // only fetch once on first load (when entries is empty)
  entries.length === 0 ? fetchLeaderboard('territory', userId, 1, 0) : Promise.resolve(null),
])
if (topTerritory) {
  setTerritoryKing(topTerritory[0] ?? null)
}
```

Actually, since we want the king to load once regardless of active tab, fetch it in a separate `useEffect` that runs only on mount:

```tsx
// Fetch territory king once on mount
useEffect(() => {
  void (async () => {
    try {
      const top = await fetchLeaderboard('territory', userId, 1, 0)
      setTerritoryKing(top[0] ?? null)
    } catch { /* ignore */ }
  })()
}, [userId])
```

- [ ] **Step 6.2: Add TerritoryKingCard and subtitle to the JSX**

Insert the following between the My Rank hero strip and the category tabs:

```tsx
{/* Territory King */}
{territoryKing && (
  <View
    style={{
      marginHorizontal: 20,
      marginTop: 4,
      marginBottom: 4,
      backgroundColor: 'rgba(245,158,11,0.06)',
      borderRadius: 14,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      borderWidth: 1,
      borderColor: 'rgba(245,158,11,0.25)',
    }}
  >
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(245,158,11,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 22 }}>👑</Text>
    </View>
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 10, fontWeight: '700', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: 1 }}>
        Territory King
      </Text>
      <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff', marginTop: 2 }}>
        {territoryKing.username}
      </Text>
      <Text style={{ fontSize: 11, color: '#71717a', marginTop: 1 }}>
        ruling {territoryKing.value} {territoryKing.value === 1 ? 'cell' : 'cells'}
      </Text>
    </View>
  </View>
)}
```

Insert the following between the category tabs and the loading state / FlatList:

```tsx
{/* Per-tab participant summary */}
{myRank && (
  <View style={{ marginHorizontal: 20, marginBottom: 4, flexDirection: 'row', justifyContent: 'space-between' }}>
    <Text style={{ fontSize: 11, color: '#52525b' }}>
      {myRank.totalUsers.toLocaleString()} {myRank.totalUsers === 1 ? 'athlete' : 'athletes'}
    </Text>
    <Text style={{ fontSize: 11, color: '#52525b' }}>
      {myRank.rank > 0 ? `You're ranked #${myRank.rank}` : 'You are not ranked yet'}
    </Text>
  </View>
)}
```

- [ ] **Step 6.3: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | grep -i leaderboard | head -20
```

- [ ] **Step 6.4: Commit**

```bash
git add apps/mobile/app/(protected)/leaderboards/index.tsx
git commit -m "feat(mobile): add TerritoryKingCard and per-tab participant count to Leaderboards"
```

---

### Task 7: Profile (Own) — completion %, achievement pills, territory sub-stats, achievement stat card

**Files:**
- Modify: `apps/mobile/app/(protected)/(tabs)/profile.tsx`

**Changes needed:**
1. Add `captureCount: number` and `stolenCount: number` to `ProfileData` (new parallel queries)
2. Compute `profileCompletion%` from 4 binary signals
3. Show achievement pills (top 3 unlocked badges) below header badges
4. Replace the "Total XP" StatCard with an "Achievements" StatCard
5. Add sub-stats line under Territory card: `X captured · Y stolen`

- [ ] **Step 7.1: Update `ProfileData` type and queries**

Add to `ProfileData` type:
```tsx
type ProfileData = {
  // ... existing fields
  captureCount: number
  stolenCount: number
}
```

In the `Promise.all`, add two more queries:
```tsx
supabase.from('territory_captures').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('action', 'claim'),
supabase.from('territory_captures').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('action', 'steal'),
```

Update the destructuring and setData:
```tsx
const [profileResult, xpResult, workoutsResult, territoryResult, extras, rankResult, achResult, claimsResult, stolenResult] = await Promise.all([...])

// Compute profile completion
const totalXp = xpResult.data?.total_xp ?? 0
const workoutCount = workouts.length
const captureCount = claimsResult.count ?? 0
const stolenCount = stolenResult.count ?? 0
const profileCompletion = Math.round(
  ([totalXp > 0, workoutCount > 0, territoryResult.count !== null && (territoryResult.count ?? 0) > 0, unlockedCount > 0]
    .filter(Boolean).length / 4) * 100
)

setData({
  // ... existing fields
  captureCount,
  stolenCount,
  profileCompletion,
})
```

- [ ] **Step 7.2: Add profile completion % to header card**

Inside the `ProfileData` type add `profileCompletion: number`.

Below the XP progress bar section, add:
```tsx
{/* Profile Completion */}
<View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }}>
  <Text style={{ fontSize: 10, fontWeight: '700', color: '#71717a', textTransform: 'uppercase', letterSpacing: 1 }}>
    Profile Completion
  </Text>
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    <View style={{ width: 80, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)' }}>
      <View style={{ width: `${data?.profileCompletion ?? 0}%`, height: 4, borderRadius: 2, backgroundColor: '#10b981' }} />
    </View>
    <Text style={{ fontSize: 13, fontWeight: '800', color: '#10b981' }}>
      {data?.profileCompletion ?? 0}%
    </Text>
  </View>
</View>
```

- [ ] **Step 7.3: Add top achievement pills**

Store unlocked achievement objects (not just count) in state:
```tsx
const [topAchievements, setTopAchievements] = useState<{ id: string; icon: string; title: string }[]>([])
// In loadData, after achResult:
const unlocked = achResult.achievements.filter((a) => a.unlocked)
setTopAchievements(unlocked.slice(0, 3).map((a) => ({ id: a.id, icon: a.icon, title: a.title })))
```

Below the badges row in the header card:
```tsx
{topAchievements.length > 0 && (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
    {topAchievements.map((ach) => (
      <View
        key={ach.id}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          backgroundColor: 'rgba(255,255,255,0.06)',
          borderRadius: 20,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
        }}
      >
        <Text style={{ fontSize: 13 }}>{ach.icon}</Text>
        <Text style={{ fontSize: 11, fontWeight: '600', color: '#e5e5e5' }}>{ach.title}</Text>
      </View>
    ))}
  </View>
)}
```

- [ ] **Step 7.4: Swap XP StatCard for Achievements, add Territory sub-stats**

In the 2×2 stats grid, change first row from `[Total XP, Distance]` to `[Distance, Runs]`, and second row from `[Runs, Territory]` to `[Territory, Achievements]`:

```tsx
{/* ── Stats 2×2 Grid ── */}
<View style={{ gap: 10 }}>
  <SectionLabel>Stats</SectionLabel>
  <View style={{ flexDirection: 'row', gap: 10 }}>
    <StatCard label="Distance" value={formatDistance(data?.totalDistanceM ?? 0)} icon="navigate" />
    <StatCard label="Runs" value={String(data?.workoutCount ?? 0)} icon="footsteps" />
  </View>
  <View style={{ flexDirection: 'row', gap: 10 }}>
    <TerritoryStatCard
      count={data?.territoryCount ?? 0}
      captureCount={data?.captureCount ?? 0}
      stolenCount={data?.stolenCount ?? 0}
    />
    <StatCard
      label="Achievements"
      value={`${data?.achievementCount ?? 0}/${data?.totalAchievements ?? 0}`}
      icon="medal"
      accent
    />
  </View>
</View>
```

Add a new `TerritoryStatCard` sub-component:
```tsx
function TerritoryStatCard({
  count,
  captureCount,
  stolenCount,
}: {
  count: number
  captureCount: number
  stolenCount: number
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#171717',
        borderRadius: 16,
        padding: 16,
        gap: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          backgroundColor: 'rgba(255,255,255,0.06)',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 4,
        }}
      >
        <Ionicons name="map" size={15} color="#a3a3a3" />
      </View>
      <Text style={{ fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.5 }}>{count}</Text>
      <Text style={{ fontSize: 10, fontWeight: '600', color: '#52525b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Territory
      </Text>
      {(captureCount > 0 || stolenCount > 0) && (
        <Text style={{ fontSize: 10, color: '#52525b', marginTop: 2 }}>
          {captureCount} captured · {stolenCount} stolen
        </Text>
      )}
    </View>
  )
}
```

- [ ] **Step 7.5: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | grep profile | head -20
```

- [ ] **Step 7.6: Commit**

```bash
git add apps/mobile/app/(protected)/(tabs)/profile.tsx
git commit -m "feat(mobile): add profile completion %, achievement pills, and territory sub-stats to Profile screen"
```

---

### Task 8: Public Profile — add Recent Activity Feed

**Files:**
- Modify: `apps/mobile/src/features/profiles/services/public-profile.ts`
- Modify: `apps/mobile/app/(protected)/profile/[username].tsx`

- [ ] **Step 8.1: Extend `PublicProfile` type and service**

Add to `PublicProfile`:
```typescript
recentActivity: Array<{ id: string; type: 'workout' | 'capture'; title: string; createdAt: string }>
```

In `fetchPublicProfile`, after building `records`, add a separate activity query:
```typescript
// Fetch recent activity (respects RLS — returns empty if profile is private)
const { data: activityWorkouts } = await supabase
  .from('workouts')
  .select('id, started_at, distance_m')
  .eq('user_id', row.userId)
  .eq('status', 'completed')
  .order('started_at', { ascending: false })
  .limit(8)

const recentActivity = (activityWorkouts ?? []).map((w) => {
  const distKm = ((w.distance_m as number ?? 0) / 1000).toFixed(1).replace(/\.0$/, '')
  return {
    id: `workout-${w.id as string}`,
    type: 'workout' as const,
    title: `🏃 Completed ${distKm} km run`,
    createdAt: w.started_at as string,
  }
})

return {
  // ... existing fields
  recentActivity,
}
```

- [ ] **Step 8.2: Render activity feed in public profile screen**

In `apps/mobile/app/(protected)/profile/[username].tsx`, after the Personal Records section:

```tsx
{/* Recent Activity */}
{profile.recentActivity.length > 0 && (
  <View style={{ gap: 8 }}>
    <SectionLabel>Recent Activity</SectionLabel>
    <View style={{ borderRadius: 16, backgroundColor: '#171717', overflow: 'hidden' }}>
      {profile.recentActivity.map((item, i) => {
        const dateStr = new Date(item.createdAt).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        })
        const isLast = i === profile.recentActivity.length - 1
        return (
          <View
            key={item.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 12,
              gap: 12,
              borderBottomWidth: isLast ? 0 : 1,
              borderBottomColor: 'rgba(255,255,255,0.05)',
            }}
          >
            <Ionicons
              name={item.type === 'workout' ? 'footsteps' : 'flag'}
              size={16}
              color="#10b981"
            />
            <Text style={{ flex: 1, fontSize: 13, color: '#e5e5e5' }}>{item.title}</Text>
            <Text style={{ fontSize: 11, color: '#52525b' }}>{dateStr}</Text>
          </View>
        )
      })}
    </View>
  </View>
)}
```

- [ ] **Step 8.3: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | grep -E "public-profile|username" | head -20
```

- [ ] **Step 8.4: Commit**

```bash
git add apps/mobile/src/features/profiles/services/public-profile.ts \
        apps/mobile/app/(protected)/profile/[username].tsx
git commit -m "feat(mobile): add Recent Activity Feed to public profile screen"
```

---

### Task 9: Achievements — XP Status summary card

**Files:**
- Modify: `apps/mobile/app/(protected)/achievements/index.tsx`

`loadAchievements()` already returns `{ achievements, totalXp }`. Wire `totalXp` into state and render it as a third card.

- [ ] **Step 9.1: Add `totalXp` state**

```tsx
const [totalXp, setTotalXp] = useState(0)

// In load callback:
void loadAchievements().then((result) => {
  setAchievements(result.achievements)
  setTotalXp(result.totalXp)
  setLoading(false)
})
```

- [ ] **Step 9.2: Derive level from totalXp**

Import from shared:
```tsx
import { getXpProgress } from '@stridequest/shared/xp'
```

In render:
```tsx
const xpProgress = getXpProgress(totalXp)
```

- [ ] **Step 9.3: Render XP Status card as third summary item**

Replace the summary section with two separate cards (unlocked count + XP status):

```tsx
{/* Summary row: unlocked count card + XP status card */}
<View style={{ flexDirection: 'row', gap: 10 }}>
  {/* Achievements unlocked card */}
  <View
    style={{
      flex: 1,
      backgroundColor: '#171717',
      borderRadius: 16,
      padding: 16,
      gap: 12,
    }}
  >
    <View className="flex-row justify-between items-center">
      <View style={{ gap: 2 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: '#fff' }}>
          {unlocked.length}
          <Text style={{ fontSize: 14, fontWeight: '500', color: '#71717a' }}>
            /{achievements.length}
          </Text>
        </Text>
        <Text style={{ fontSize: 10, color: '#71717a', textTransform: 'uppercase', letterSpacing: 1, fontWeight: '600' }}>
          Unlocked
        </Text>
      </View>
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          borderWidth: 2.5,
          borderColor: '#10b981',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: '800', color: '#10b981' }}>
          {completionPct}%
        </Text>
      </View>
    </View>
    <View className="h-1.5 w-full rounded-full bg-white/10">
      <View
        className="h-1.5 rounded-full bg-emerald-500"
        style={{ width: `${completionPct}%` }}
      />
    </View>
  </View>

  {/* XP Status card */}
  <View
    style={{
      flex: 1,
      backgroundColor: '#171717',
      borderRadius: 16,
      padding: 16,
      gap: 8,
      justifyContent: 'space-between',
    }}
  >
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Text style={{ fontSize: 16 }}>⚡</Text>
      <Text style={{ fontSize: 10, fontWeight: '700', color: '#71717a', textTransform: 'uppercase', letterSpacing: 1 }}>
        XP Status
      </Text>
    </View>
    <Text style={{ fontSize: 22, fontWeight: '900', color: '#f59e0b' }}>
      {totalXp.toLocaleString()}
      <Text style={{ fontSize: 12, fontWeight: '600', color: '#71717a' }}> XP</Text>
    </Text>
    <Text style={{ fontSize: 12, fontWeight: '700', color: '#a3a3a3' }}>
      Level {xpProgress.currentLevel}
    </Text>
    {xpProgress.nextLevel !== null && (
      <Text style={{ fontSize: 10, color: '#52525b' }}>
        {xpProgress.xpNeededToNextLevel} to Level {xpProgress.nextLevel}
      </Text>
    )}
  </View>
</View>

{/* Category counts row (now separate from the main summary) */}
<View style={{ flexDirection: 'row', gap: 8 }}>
  {categoryCounts.map(({ cat, unlocked: u, total }) => (
    <View
      key={cat}
      style={{
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 10,
        padding: 10,
        alignItems: 'center',
        gap: 4,
      }}
    >
      <Ionicons name={CATEGORY_ICONS[cat]} size={14} color={u === total && total > 0 ? '#10b981' : '#71717a'} />
      <Text style={{ fontSize: 13, fontWeight: '800', color: u === total && total > 0 ? '#10b981' : '#fff' }}>
        {u}/{total}
      </Text>
      <Text style={{ fontSize: 9, fontWeight: '600', color: '#52525b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {cat}
      </Text>
    </View>
  ))}
</View>
```

- [ ] **Step 9.4: Typecheck Phase 2**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | head -40
```
Expected: no errors. Fix before committing.

- [ ] **Step 9.5: Commit**

```bash
git add apps/mobile/app/(protected)/achievements/index.tsx
git commit -m "feat(mobile): add XP Status card to Achievements summary section"
```

---

## Phase 3 — P1 UX Polish

---

### Task 10: `SkeletonLoader` component

**Files:**
- Create: `apps/mobile/src/components/ui/SkeletonLoader.tsx`

Uses Reanimated `withRepeat` + `withTiming` to pulse opacity between 0.3 and 0.7. Exports `SkeletonRow` (a single rounded rect) and `SkeletonCard` (a taller block).

- [ ] **Step 10.1: Create the component**

```tsx
// apps/mobile/src/components/ui/SkeletonLoader.tsx
import { useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated'

function usePulse() {
  const opacity = useSharedValue(0.3)
  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 800 }),
      -1,   // infinite
      true, // reverse
    )
    return () => cancelAnimation(opacity)
  }, [opacity])
  return useAnimatedStyle(() => ({ opacity: opacity.value }))
}

export function SkeletonRow({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
}: {
  width?: number | string
  height?: number
  borderRadius?: number
  style?: object
}) {
  const pulseStyle = usePulse()
  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: '#262626' }, pulseStyle, style]}
    />
  )
}

export function SkeletonCard({ height = 80 }: { height?: number }) {
  const pulseStyle = usePulse()
  return (
    <Animated.View
      style={[
        {
          width: '100%',
          height,
          borderRadius: 16,
          backgroundColor: '#1a1a1a',
        },
        pulseStyle,
      ]}
    />
  )
}

export function LeaderboardSkeleton() {
  return (
    <View style={{ gap: 12, paddingHorizontal: 20 }}>
      <SkeletonCard height={72} />
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 }}>
          <SkeletonRow width={28} height={14} />
          <SkeletonRow width={32} height={32} borderRadius={16} />
          <SkeletonRow width="55%" height={13} />
          <SkeletonRow width={50} height={13} style={{ marginLeft: 'auto' }} />
        </View>
      ))}
    </View>
  )
}

export function ProfileSkeleton() {
  return (
    <View style={{ gap: 16, paddingHorizontal: 20 }}>
      <SkeletonCard height={160} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <SkeletonCard height={90} />
        <SkeletonCard height={90} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <SkeletonCard height={90} />
        <SkeletonCard height={90} />
      </View>
    </View>
  )
}

export function AchievementSkeleton() {
  return (
    <View style={{ gap: 10, paddingHorizontal: 20 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <SkeletonCard height={120} />
        <SkeletonCard height={120} />
      </View>
      {[1, 2, 3, 4].map((i) => (
        <SkeletonCard key={i} height={72} />
      ))}
    </View>
  )
}
```

- [ ] **Step 10.2: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | grep SkeletonLoader | head -10
```

- [ ] **Step 10.3: Commit**

```bash
git add apps/mobile/src/components/ui/SkeletonLoader.tsx
git commit -m "feat(mobile/ui): add shimmer SkeletonLoader components with Reanimated pulse"
```

---

### Task 11: Wire skeleton loaders into screens

**Files:**
- Modify: `apps/mobile/app/(protected)/leaderboards/index.tsx`
- Modify: `apps/mobile/app/(protected)/(tabs)/profile.tsx`
- Modify: `apps/mobile/app/(protected)/achievements/index.tsx`

In each screen, replace the full-screen `ActivityIndicator` spinner with the appropriate skeleton:

- [ ] **Step 11.1: Leaderboards skeleton**

```tsx
import { LeaderboardSkeleton } from '@/components/ui/SkeletonLoader'

// Replace:
// if (loading) return <View...><ActivityIndicator /></View>
// With: render the header UI but replace the list content with the skeleton
```

In the leaderboard screen, the loading state is `loading && entries.length === 0`. Change:
```tsx
{loading ? (
  <LeaderboardSkeleton />
) : (
  <FlatList ... />
)}
```

Keep the header (back button, hero strip, tabs) visible during loading so the layout doesn't jump.

- [ ] **Step 11.2: Profile skeleton**

```tsx
import { ProfileSkeleton } from '@/components/ui/SkeletonLoader'

// In ProfileScreen, replace:
// if (loading) return <SafeAreaView><ActivityIndicator /></SafeAreaView>
// With: render SafeAreaView with ProfileSkeleton inside a ScrollView
if (loading) {
  return (
    <SafeAreaView className="flex-1 bg-[#0b0b0f]">
      <ScrollView style={{ paddingTop: 24 }}>
        <ProfileSkeleton />
      </ScrollView>
    </SafeAreaView>
  )
}
```

- [ ] **Step 11.3: Achievements skeleton**

```tsx
import { AchievementSkeleton } from '@/components/ui/SkeletonLoader'

// In AchievementsScreen, replace the loading branch:
{loading ? (
  <View style={{ flex: 1, paddingTop: 16 }}>
    <AchievementSkeleton />
  </View>
) : (
  <ScrollView ... />
)}
```

- [ ] **Step 11.4: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 11.5: Commit**

```bash
git add apps/mobile/app/(protected)/leaderboards/index.tsx \
        apps/mobile/app/(protected)/(tabs)/profile.tsx \
        apps/mobile/app/(protected)/achievements/index.tsx
git commit -m "feat(mobile): replace ActivityIndicator with shimmer skeleton loaders on secondary screens"
```

---

### Task 12: Reanimated entrance animations

**Files:**
- Modify: `apps/mobile/app/(protected)/leaderboards/index.tsx`
- Modify: `apps/mobile/app/(protected)/achievements/index.tsx`

Add `FadeInDown` layout animation to cards in FlatList and ScrollView. Reanimated 4 `FadeInDown` works on `Animated.View` components.

- [ ] **Step 12.1: Import and apply entrance animations**

In each screen that has a list of cards, wrap list items with `Animated.View entering={FadeInDown.delay(i * 50).duration(300)}`:

**Leaderboards** — in `EntryRow`:
```tsx
import Animated, { FadeInDown } from 'react-native-reanimated'

function EntryRow({ entry, category, onPress, index }: { ... index: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 40).duration(280)}>
      <Pressable ... >
        {/* existing content */}
      </Pressable>
    </Animated.View>
  )
}
```

Update the `renderItem` call to pass `index`:
```tsx
renderItem={({ item, index }) => (
  <EntryRow entry={item} category={activeTab} index={index} onPress={...} />
)}
```

**Achievements** — wrap each `AchievementCard` in a filtered list:
```tsx
{filtered.map((ach, i) => (
  <Animated.View key={ach.id} entering={FadeInDown.delay(i * 30).duration(260)}>
    <AchievementCard achievement={ach} />
  </Animated.View>
))}
```

- [ ] **Step 12.2: Animate TerritoryKingCard on leaderboards**

Wrap the territory king section:
```tsx
{territoryKing && (
  <Animated.View entering={FadeInDown.duration(350)}>
    {/* existing king card */}
  </Animated.View>
)}
```

- [ ] **Step 12.3: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 12.4: Commit**

```bash
git add apps/mobile/app/(protected)/leaderboards/index.tsx \
        apps/mobile/app/(protected)/achievements/index.tsx
git commit -m "feat(mobile): add Reanimated FadeInDown entrance animations to leaderboard and achievement cards"
```

---

### Task 13: Achievements — "Almost There" badge + grouped section headers

**Files:**
- Modify: `apps/mobile/app/(protected)/achievements/index.tsx`

- [ ] **Step 13.1: Add "Almost There" badge to `AchievementCard`**

In `AchievementCard`, add inside the title row:
```tsx
const isAlmostThere = !ach.unlocked && ach.target > 0 && ach.progress / ach.target >= 0.8

{/* After the title Text: */}
{isAlmostThere && (
  <View
    style={{
      backgroundColor: 'rgba(245,158,11,0.15)',
      borderRadius: 8,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderWidth: 1,
      borderColor: 'rgba(245,158,11,0.3)',
    }}
  >
    <Text style={{ fontSize: 9, fontWeight: '700', color: '#f59e0b' }}>Almost There</Text>
  </View>
)}
```

- [ ] **Step 13.2: Group achievement list by category when "All" tab is active**

Replace the flat `{filtered.map(...)}` with a grouped render when `activeTab === 'all'`:

```tsx
const CATEGORIES_ORDER: AchievementCategory[] = ['running', 'territory', 'xp']
const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  running: '🏃 Running',
  territory: '🌍 Territory',
  xp: '⭐ XP',
}

// Replace the flat list section:
{activeTab === 'all' ? (
  <View style={{ gap: 16 }}>
    {CATEGORIES_ORDER.map((cat) => {
      const catItems = achievements.filter((a) => a.category === cat)
      if (catItems.length === 0) return null
      return (
        <View key={cat} style={{ gap: 8 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#a3a3a3', textTransform: 'uppercase', letterSpacing: 1 }}>
            {CATEGORY_LABELS[cat]}
          </Text>
          {catItems.map((ach, i) => (
            <Animated.View key={ach.id} entering={FadeInDown.delay(i * 30).duration(260)}>
              <AchievementCard achievement={ach} />
            </Animated.View>
          ))}
        </View>
      )
    })}
  </View>
) : (
  <View style={{ gap: 10 }}>
    {filtered.map((ach, i) => (
      <Animated.View key={ach.id} entering={FadeInDown.delay(i * 30).duration(260)}>
        <AchievementCard achievement={ach} />
      </Animated.View>
    ))}
  </View>
)}
```

- [ ] **Step 13.3: Final typecheck — ALL phases**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1
```
Expected: exit 0, no errors. Fix all type errors before final commit.

- [ ] **Step 13.4: Final commit**

```bash
git add apps/mobile/app/(protected)/achievements/index.tsx
git commit -m "feat(mobile): add Almost There badge, grouped achievement sections, and category section headers"
```

---

## Self-Review Checklist

### Spec coverage
| Requirement | Task |
|---|---|
| Interactive touch cursor on Pace chart | Task 3 |
| Interactive touch cursor on Speed chart | Task 3 |
| Interactive touch cursor on Elevation chart | Task 4 |
| Reanimated cursor animation | Tasks 1-4 (useSharedValue + useAnimatedStyle) |
| Floating tooltip with exact metrics | Task 2 (ChartCursor) |
| WorkoutShareDialog `isAvailableAsync` guard | Task 5 |
| WorkoutShareDialog `file://` URI | Task 5 |
| WorkoutShareDialog try/catch + Alert | Task 5 |
| Route diagram SVG on share card | Task 5 |
| TerritoryKingCard on Leaderboards | Task 6 |
| Per-tab participant count + user rank | Task 6 |
| Profile completion % | Task 7 |
| Top Achievement pills | Task 7 |
| Territory sub-stats (captured/stolen) | Task 7 |
| Achievements stat card in profile grid | Task 7 |
| Recent Activity Feed on public profile | Task 8 |
| XP Status card on Achievements | Task 9 |
| Skeleton loaders (global) | Tasks 10-11 |
| Reanimated FadeInDown animations | Task 12 |
| "Almost There" badge | Task 13 |
| Grouped achievement sections | Task 13 |

### Known constraints
- `WorkoutCharts.tsx` adds `paddingTop: 32` above each chart area to make room for the tooltip pill that renders at `top: -32` relative to the chart surface. If card padding is reduced in future, adjust this value.
- The public profile activity query depends on Supabase RLS allowing read of other users' completed workouts. If RLS blocks it, `recentActivity` will return `[]` and the section will be hidden (graceful empty state).
- `LeaderboardEntry.value` for the territory category = cells owned. Used directly for "ruling X cells" display.
- Reanimated 4.x in Expo 52 requires the New Architecture (enabled by default in SDK 52). If the project has `newArchEnabled: false` in app.json, `FadeInDown` will silently skip. Verify with `npx expo-doctor`.
