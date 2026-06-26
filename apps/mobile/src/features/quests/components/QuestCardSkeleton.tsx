import { useEffect } from 'react'
import { View } from 'react-native'
import { colors, withAlpha } from '@/theme'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

const BLOCK = withAlpha(colors.white, 0.08)

export function QuestCardSkeleton() {
  const o = useSharedValue(0.4)

  useEffect(() => {
    o.value = withRepeat(withTiming(1, { duration: 800 }), -1, true)
  }, [o])

  const pulse = useAnimatedStyle(() => ({ opacity: o.value }))

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: withAlpha(colors.white, 0.06),
      }}
    >
      {/* Top row: badge bubble + title lines + reward pill */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Animated.View
          style={[
            { width: 40, height: 40, borderRadius: 20, backgroundColor: BLOCK },
            pulse,
          ]}
        />
        <View style={{ flex: 1, gap: 8 }}>
          <Animated.View
            style={[
              { width: '60%', height: 14, borderRadius: 7, backgroundColor: BLOCK },
              pulse,
            ]}
          />
          <Animated.View
            style={[
              { width: '85%', height: 10, borderRadius: 5, backgroundColor: BLOCK },
              pulse,
            ]}
          />
        </View>
        <Animated.View
          style={[
            { width: 56, height: 24, borderRadius: 8, backgroundColor: BLOCK },
            pulse,
          ]}
        />
      </View>

      {/* Progress track */}
      <Animated.View
        style={[
          { height: 8, borderRadius: 4, backgroundColor: BLOCK, marginTop: 18 },
          pulse,
        ]}
      />
    </View>
  )
}
