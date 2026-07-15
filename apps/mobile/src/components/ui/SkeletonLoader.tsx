import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { colors } from '@/theme'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated'

// Single shared pulse driver — all children read from one SharedValue
const PulseCtx = createContext<SharedValue<number> | null>(null)

export function SkeletonProvider({ children }: { children: ReactNode }) {
  const opacity = useSharedValue(1)
  useEffect(() => {
    opacity.value = withRepeat(withSpring(0.4, { damping: 15, stiffness: 150, mass: 0.8 }), -1, true)
  }, [opacity])
  return <PulseCtx.Provider value={opacity}>{children}</PulseCtx.Provider>
}

function usePulse() {
  const shared = useContext(PulseCtx)
  // fallback value for when used without a provider — still Reanimated, not polled
  const local = useSharedValue(1)
  useEffect(() => {
    if (shared !== null) return
    local.value = withRepeat(withSpring(0.4, { damping: 15, stiffness: 150, mass: 0.8 }), -1, true)
  }, [shared, local])
  return useAnimatedStyle(() => ({ opacity: (shared ?? local).value }))
}

export function SkeletonRow({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
}: {
  width?: number | `${number}%`
  height?: number
  borderRadius?: number
  style?: StyleProp<ViewStyle>
}) {
  const pulseStyle = usePulse()
  return (
    <Animated.View
      style={[{ width, height, backgroundColor: colors.surfaceAlt, borderRadius }, pulseStyle, style]}
    />
  )
}

export function SkeletonCard({ height = 120 }: { height?: number }) {
  const pulseStyle = usePulse()
  return (
    <Animated.View
      style={[{ width: '100%', height, backgroundColor: colors.surfaceAlt, borderRadius: 16 }, pulseStyle]}
    />
  )
}

export function LeaderboardSkeleton() {
  return (
    <SkeletonProvider>
      <View style={{ gap: 10 }}>
        {[...Array(5)].map((_, i) => (
          <View
            key={i}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 14,
              backgroundColor: colors.surfaceSunken,
              borderRadius: 14,
            }}
          >
            <SkeletonRow width={28} height={28} borderRadius={14} />
            <View style={{ flex: 1, gap: 6 }}>
              <SkeletonRow width="60%" height={14} />
              <SkeletonRow width="40%" height={10} />
            </View>
            <SkeletonRow width={40} height={14} />
          </View>
        ))}
      </View>
    </SkeletonProvider>
  )
}

export function ProfileSkeleton() {
  return (
    <SkeletonProvider>
      <View style={{ gap: 16 }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 20, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <SkeletonRow width={64} height={64} borderRadius={32} />
            <View style={{ flex: 1, gap: 8 }}>
              <SkeletonRow width="70%" height={20} />
              <SkeletonRow width="40%" height={14} />
            </View>
          </View>
          <SkeletonRow height={6} borderRadius={3} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><SkeletonCard height={80} /></View>
          <View style={{ flex: 1 }}><SkeletonCard height={80} /></View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><SkeletonCard height={80} /></View>
          <View style={{ flex: 1 }}><SkeletonCard height={80} /></View>
        </View>
      </View>
    </SkeletonProvider>
  )
}

export function AchievementSkeleton() {
  return (
    <SkeletonProvider>
      <View style={{ gap: 16 }}>
        <SkeletonCard height={100} />
        {[...Array(3)].map((_, i) => (
          <View
            key={i}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 16,
              backgroundColor: colors.surface,
              borderRadius: 14,
            }}
          >
            <SkeletonRow width={44} height={44} borderRadius={12} />
            <View style={{ flex: 1, gap: 8 }}>
              <SkeletonRow width="65%" height={14} />
              <SkeletonRow width="80%" height={10} />
            </View>
          </View>
        ))}
      </View>
    </SkeletonProvider>
  )
}

export function DashboardSkeleton() {
  return (
    <SkeletonProvider>
      <View style={{ gap: 20, paddingHorizontal: 20, paddingTop: 24 }}>
        {/* Header */}
        <View style={{ gap: 8 }}>
          <SkeletonRow width="35%" height={10} />
          <SkeletonRow width="55%" height={36} borderRadius={6} />
          <SkeletonRow width="22%" height={22} borderRadius={8} />
        </View>
        {/* XP progress card */}
        <SkeletonCard height={84} />
        {/* All Time */}
        <SkeletonRow width="28%" height={10} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><SkeletonCard height={80} /></View>
          <View style={{ flex: 1 }}><SkeletonCard height={80} /></View>
        </View>
        {/* Today */}
        <SkeletonRow width="22%" height={10} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><SkeletonCard height={100} /></View>
          <View style={{ flex: 1 }}><SkeletonCard height={100} /></View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><SkeletonCard height={100} /></View>
          <View style={{ flex: 1 }}><SkeletonCard height={100} /></View>
        </View>
        {/* Recent Activity */}
        <SkeletonRow width="38%" height={10} />
        <SkeletonCard height={88} />
        <SkeletonCard height={88} />
        <SkeletonCard height={88} />
      </View>
    </SkeletonProvider>
  )
}

export function HistorySkeleton() {
  return (
    <SkeletonProvider>
      <View style={{ gap: 12, paddingHorizontal: 20 }}>
        {[...Array(6)].map((_, i) => (
          <SkeletonCard key={i} height={88} />
        ))}
      </View>
    </SkeletonProvider>
  )
}
