import { useEffect } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { colors } from '@/theme'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

function usePulse() {
  const opacity = useSharedValue(1)
  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.4, { duration: 800 }),
      -1,
      true
    )
  }, [opacity])
  return useAnimatedStyle(() => ({ opacity: opacity.value }))
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
      style={[
        {
          width,
          height,
          backgroundColor: colors.surfaceAlt,
          borderRadius,
        },
        pulseStyle,
        style,
      ]}
    />
  )
}

export function SkeletonCard({ height = 120 }: { height?: number }) {
  const pulseStyle = usePulse()

  return (
    <Animated.View
      style={[
        {
          width: '100%',
          height,
          backgroundColor: colors.surfaceAlt,
          borderRadius: 16,
        },
        pulseStyle,
      ]}
    />
  )
}

export function LeaderboardSkeleton() {
  return (
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
  )
}

export function ProfileSkeleton() {
  return (
    <View style={{ gap: 16 }}>
      {/* Header card */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 20,
          padding: 20,
          gap: 14,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <SkeletonRow width={64} height={64} borderRadius={32} />
          <View style={{ flex: 1, gap: 8 }}>
            <SkeletonRow width="70%" height={20} />
            <SkeletonRow width="40%" height={14} />
          </View>
        </View>
        <SkeletonRow height={6} borderRadius={3} />
      </View>
      {/* Stats - 2x2 grid */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <SkeletonCard height={80} />
        </View>
        <View style={{ flex: 1 }}>
          <SkeletonCard height={80} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <SkeletonCard height={80} />
        </View>
        <View style={{ flex: 1 }}>
          <SkeletonCard height={80} />
        </View>
      </View>
    </View>
  )
}

export function AchievementSkeleton() {
  return (
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
  )
}
