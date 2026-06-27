// apps/mobile/src/features/running/components/WorkoutShareDialog.tsx
import { useRef, useState } from 'react'
import {
  View, Text, Pressable, ActivityIndicator,
  SafeAreaView, Dimensions, Alert
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { captureRef } from 'react-native-view-shot'
import * as FileSystem from 'expo-file-system/legacy'
import Share from 'react-native-share'
import * as MediaLibrary from 'expo-media-library'
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg'
import { formatDistance, formatDuration, formatPace } from '@stridequest/shared/running'
import type { MobileWorkoutDetail } from '../services/workout-detail'
import type { WorkoutRoutePoint } from '@stridequest/shared/analytics'
import Carousel from 'react-native-reanimated-carousel'
import { colors, withAlpha } from '@/theme'

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

async function ensurePngExtension(uri: string): Promise<string> {
  let safeUri = uri.startsWith('file://') ? uri : `file://${uri}`
  if (!safeUri.toLowerCase().endsWith('.png')) {
    const newPath = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}share-${Date.now()}.png`
    await FileSystem.copyAsync({ from: safeUri, to: newPath })
    safeUri = newPath
  }
  return safeUri
}

// ── Components ───────────────────────────────────────────────────────────────

const ROUTE_SVG_H = 140
const CARD_WIDTH = Dimensions.get('window').width * 0.85
const CARD_HEIGHT = CARD_WIDTH * 1.25

function ShareMetric({
  label,
  value,
  accent = false,
  light = false,
}: {
  label: string
  value: string
  accent?: boolean
  light?: boolean
}) {
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <Text
        style={{
          fontSize: 10,
          fontWeight: '700',
          color: light ? colors.white : (accent ? colors.primary : colors.primarySoft),
          letterSpacing: 1.5,
          textShadowColor: light ? withAlpha(colors.black, 0.5) : 'transparent',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 2,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 18,
          fontWeight: '800',
          color: light ? colors.white : (accent ? colors.primary : colors.white),
          textShadowColor: light ? withAlpha(colors.black, 0.5) : 'transparent',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 2,
        }}
      >
        {value}
      </Text>
    </View>
  )
}

function MapTemplate({ workout }: { workout: MobileWorkoutDetail }) {
  const routePath = buildRouteSvgPath(workout.routePoints, CARD_WIDTH, ROUTE_SVG_H)
  const hasRoute = routePath.length > 0

  return (
    <View
      style={{
        width: CARD_WIDTH,
        backgroundColor: colors.tint950,
        borderRadius: 28,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: withAlpha(colors.primary, 0.4),
      }}
    >
      {hasRoute && (
        <View 
          collapsable={false} 
          renderToHardwareTextureAndroid={true}
          style={{ 
            width: '100%', 
            height: ROUTE_SVG_H, 
            backgroundColor: colors.tint900,
            opacity: 0.99 
          }}
        >
          <Svg width="100%" height={ROUTE_SVG_H} viewBox={`0 0 ${CARD_WIDTH} ${ROUTE_SVG_H}`}>
            <Defs>
              <LinearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={colors.tint900} stopOpacity={1} />
                <Stop offset="100%" stopColor={colors.tint975} stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Path d={`M0,0 H${CARD_WIDTH} V${ROUTE_SVG_H} H0 Z`} fill="url(#bgGrad)" />
            <Path
              d={routePath}
              fill="none"
              stroke={colors.primary}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.9}
            />
          </Svg>
          <View
            style={{
              position: 'absolute',
              bottom: 0, left: 0, right: 0,
              height: 40,
              backgroundColor: 'transparent',
            }}
            pointerEvents="none"
          />
        </View>
      )}

      <View style={{ padding: 24, gap: 16, alignItems: 'center' }}>
        <Text style={{ fontSize: 12, fontWeight: '800', color: colors.primary, letterSpacing: 3, textTransform: 'uppercase' }}>
          StrideQuest
        </Text>
        <Text style={{ fontSize: 64, fontWeight: '900', color: colors.white, letterSpacing: -3, lineHeight: 68 }}>
          {formatDistance(workout.distanceM)}
        </Text>
        <View style={{ flexDirection: 'row', gap: 20 }}>
          <ShareMetric label="TIME" value={formatDuration(workout.durationS)} />
          <ShareMetric label="PACE" value={formatPace(workout.avgPaceSPerKm)} />
          {workout.xpBreakdown.totalXp > 0 && (
            <ShareMetric label="XP" value={`+${workout.xpBreakdown.totalXp}`} accent />
          )}
        </View>
      </View>
    </View>
  )
}

function StatsTemplate({ workout }: { workout: MobileWorkoutDetail }) {
  const routePath = buildRouteSvgPath(workout.routePoints, CARD_WIDTH, ROUTE_SVG_H)
  const hasRoute = routePath.length > 0

  return (
    <View style={{ width: CARD_WIDTH, padding: 24, gap: 16, alignItems: 'center', backgroundColor: 'transparent' }}>
      {hasRoute && (
        <View style={{ width: '100%', height: ROUTE_SVG_H, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width="100%" height={ROUTE_SVG_H} viewBox={`0 0 ${CARD_WIDTH} ${ROUTE_SVG_H}`}>
            {/* Shadow path to pop over photos */}
            <Path
              d={routePath}
              fill="none"
              stroke={withAlpha(colors.black, 0.5)}
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
              transform="translate(0, 2)"
            />
            {/* Main path */}
            <Path
              d={routePath}
              fill="none"
              stroke={colors.primary}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      )}

      <Text style={{ 
        fontSize: 16, fontWeight: '900', color: colors.white, letterSpacing: 4, textTransform: 'uppercase',
        textShadowColor: withAlpha(colors.black, 0.5), textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4,
      }}>
        StrideQuest
      </Text>
      <Text style={{ 
        fontSize: 80, fontWeight: '900', color: colors.white, letterSpacing: -4, lineHeight: 84,
        textShadowColor: withAlpha(colors.black, 0.5), textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 8,
      }}>
        {formatDistance(workout.distanceM)}
      </Text>
      <View style={{ flexDirection: 'row', gap: 20 }}>
        <ShareMetric label="TIME" value={formatDuration(workout.durationS)} light />
        <ShareMetric label="PACE" value={formatPace(workout.avgPaceSPerKm)} light />
        {workout.xpBreakdown.totalXp > 0 && (
          <ShareMetric label="XP" value={`+${workout.xpBreakdown.totalXp}`} light />
        )}
      </View>
    </View>
  )
}

function ChartTemplate({ workout }: { workout: MobileWorkoutDetail }) {
  const chartPoints = workout.splits || []
  const maxPace = Math.max(...chartPoints.map(p => p.paceSPerKm), 1)
  const minPace = Math.min(...chartPoints.map(p => p.paceSPerKm), maxPace)
  
  return (
    <View style={{ width: CARD_WIDTH, backgroundColor: colors.tint950, borderRadius: 28, padding: 24, borderWidth: 1.5, borderColor: withAlpha(colors.primary, 0.4), alignItems: 'center' }}>
      <Text style={{ fontSize: 12, fontWeight: '800', color: colors.primary, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 16 }}>
        Splits
      </Text>
      
      {chartPoints.length > 0 ? (
        <View style={{ width: '100%', height: 120, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 4 }}>
          {chartPoints.slice(0, 10).map((split, i) => {
            const range = maxPace - minPace || 1;
            const normalized = 1 - ((split.paceSPerKm - minPace) / range);
            const height = Math.max(20, normalized * 120);
            return (
              <View key={i} style={{ flex: 1, height, backgroundColor: split.isFastest ? colors.primary : withAlpha(colors.primary, 0.4), borderRadius: 4 }} />
            )
          })}
        </View>
      ) : (
        <View style={{ height: 120, justifyContent: 'center' }}>
           <Text style={{ color: colors.white }}>No splits available</Text>
        </View>
      )}

      <Text style={{ fontSize: 48, fontWeight: '900', color: colors.white, letterSpacing: -2, lineHeight: 52, marginTop: 24 }}>
        {formatDistance(workout.distanceM)}
      </Text>
      
      <View style={{ flexDirection: 'row', gap: 20, marginTop: 12 }}>
        <ShareMetric label="TIME" value={formatDuration(workout.durationS)} />
        <ShareMetric label="AVG PACE" value={formatPace(workout.avgPaceSPerKm)} />
      </View>
    </View>
  )
}

export function WorkoutShareDialog({ workout, visible, onClose }: WorkoutShareDialogProps) {
  const [sharing, setSharing] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  
  const carouselContainerRef = useRef<any>(null)

  const templates = [
    <MapTemplate key="map" workout={workout} />,
    <StatsTemplate key="stats" workout={workout} />,
    <ChartTemplate key="chart" workout={workout} />
  ]

  const captureActiveTemplate = async (): Promise<string | null> => {
    if (!carouselContainerRef.current) return null;

    const isTransparent = activeIndex === 1;
    const captureOptions = {
      format: isTransparent ? 'png' : 'jpg',
      quality: 1.0,
      ...(isTransparent && { backgroundColor: 'transparent' })
    };

    try {
      let rawUri = await captureRef(carouselContainerRef.current, captureOptions as any);
      return isTransparent ? rawUri : await ensurePngExtension(rawUri);
    } catch (e) {
      await new Promise(resolve => setTimeout(resolve, 500));
      let rawUri = await captureRef(carouselContainerRef.current, captureOptions as any);
      return isTransparent ? rawUri : await ensurePngExtension(rawUri);
    }
  }

  const handleDownload = async () => {
    setSharing(true)
    try {
      const uri = await captureActiveTemplate()
      if (!uri) throw new Error("Could not capture view")

      const { status } = await MediaLibrary.requestPermissionsAsync()
      if (status === 'granted') {
        await MediaLibrary.saveToLibraryAsync(uri)
        Alert.alert('Success', 'Saved to gallery!')
      } else {
        Alert.alert('Permission Denied', 'Need gallery permissions to save.')
      }
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || String(err))
    } finally {
      setSharing(false)
    }
  }

  const executeShare = async (platform?: any) => {
    setSharing(true)
    try {
      const uri = await captureActiveTemplate()
      if (!uri) throw new Error("Could not capture view")

      if (platform) {
        await Share.shareSingle({
          title: 'StrideQuest Workout',
          url: uri,
          social: platform,
          type: 'image/png',
        })
      } else {
        await Share.open({
          title: 'Share your StrideQuest workout',
          url: uri,
          type: 'image/png',
        })
      }
      onClose()
    } catch (err: any) {
      const msg = err?.message || String(err)
      if (msg.includes('User did not share') || msg.includes('cancel')) return
      Alert.alert('Share Failed', `Error: ${msg}`)
    } finally {
      setSharing(false)
    }
  }

  return (
    <View 
      style={{ 
        position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, 
        zIndex: 9999, backgroundColor: withAlpha(colors.black, 0.85), 
        justifyContent: 'center', alignItems: 'center',
        display: visible ? 'flex' : 'none'
      }}
    >
      <SafeAreaView style={{ flex: 1, width: '100%', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'flex-end', padding: 20 }}>
          <Pressable onPress={onClose} style={{ padding: 8, backgroundColor: withAlpha(colors.white, 0.1), borderRadius: 20 }}>
            <Ionicons name="close" size={24} color={colors.white} />
          </Pressable>
        </View>

        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' }}>
          <View 
            ref={carouselContainerRef} 
            collapsable={false}
            style={{ width: CARD_WIDTH, height: CARD_HEIGHT, backgroundColor: 'transparent', overflow: 'hidden' }}
          >
            <Carousel
              loop={false}
              width={CARD_WIDTH}
              height={CARD_HEIGHT}
              data={templates}
              onSnapToItem={(index) => setActiveIndex(index)}
              renderItem={({ item }) => (
                <View 
                  collapsable={false}
                  style={{ 
                    flex: 1, 
                    justifyContent: 'center', 
                    alignItems: 'center',
                    backgroundColor: 'transparent'
                  }}
                >
                  {item}
                </View>
              )}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            {templates.map((_, i) => (
              <View 
                key={i} 
                style={{ 
                  width: 8, height: 8, borderRadius: 4, 
                  backgroundColor: activeIndex === i ? colors.primary : withAlpha(colors.white, 0.2) 
                }} 
              />
            ))}
          </View>
        </View>

        <View style={{ width: '100%', padding: 24, paddingBottom: 48, gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable
              onPress={handleDownload}
              disabled={sharing}
              style={{
                flex: 1, backgroundColor: withAlpha(colors.white, 0.1), borderRadius: 16, paddingVertical: 14,
                alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
                opacity: sharing ? 0.7 : 1, borderWidth: 1, borderColor: withAlpha(colors.white, 0.2)
              }}
            >
              {sharing ? <ActivityIndicator color={colors.white} size="small" /> : (
                <>
                  <Ionicons name="download-outline" size={20} color={colors.white} />
                  <Text style={{ color: colors.white, fontSize: 16, fontWeight: '700' }}>Save</Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={() => executeShare()}
              disabled={sharing}
              style={{
                flex: 1, backgroundColor: withAlpha(colors.white, 0.1), borderRadius: 16, paddingVertical: 14,
                alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
                opacity: sharing ? 0.7 : 1, borderWidth: 1, borderColor: withAlpha(colors.white, 0.2)
              }}
            >
              {sharing ? <ActivityIndicator color={colors.white} size="small" /> : (
                <>
                  <Ionicons name="share-outline" size={20} color={colors.white} />
                  <Text style={{ color: colors.white, fontSize: 16, fontWeight: '700' }}>More</Text>
                </>
              )}
            </Pressable>
          </View>

          <Pressable
            onPress={() => executeShare(Share.Social.INSTAGRAM)}
            disabled={sharing}
            style={{
              backgroundColor: colors.instagram, borderRadius: 16, paddingVertical: 14,
              alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
              opacity: sharing ? 0.7 : 1,
            }}
          >
            <Ionicons name="logo-instagram" size={20} color={colors.white} />
            <Text style={{ color: colors.white, fontSize: 16, fontWeight: '700' }}>Instagram Stories</Text>
          </Pressable>

          <Pressable
            onPress={() => executeShare(Share.Social.TWITTER)}
            disabled={sharing}
            style={{
              backgroundColor: colors.twitter, borderRadius: 16, paddingVertical: 14,
              alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
              opacity: sharing ? 0.7 : 1,
            }}
          >
            <Ionicons name="logo-twitter" size={20} color={colors.white} />
            <Text style={{ color: colors.white, fontSize: 16, fontWeight: '700' }}>Twitter / X</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  )
}
