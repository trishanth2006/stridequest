// apps/mobile/src/features/running/components/WorkoutShareDialog.tsx
import { useRef, useState } from 'react'
import {
  View, Text, Modal, Pressable, ActivityIndicator,
  SafeAreaView, Dimensions, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import ViewShot, { captureRef, type ViewShotRef } from 'react-native-view-shot'
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
    throw new Error('Your device does not support file sharing.')
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
  const viewRef = useRef<ViewShotRef>(null)
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
              ref={viewRef}
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
