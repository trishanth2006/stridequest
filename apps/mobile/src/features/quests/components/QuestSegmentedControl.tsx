import { useEffect, useState } from 'react'
import { View, Text, Pressable, type LayoutChangeEvent } from 'react-native'
import * as Haptics from 'expo-haptics'
import { colors, withAlpha } from '@/theme'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated'

interface QuestSegmentedControlProps {
  value: 'daily' | 'weekly'
  onChange: (v: 'daily' | 'weekly') => void
}

const PADDING = 4

export function QuestSegmentedControl({ value, onChange }: QuestSegmentedControlProps) {
  // Half of the inner (padding-adjusted) width = one segment's width.
  const [segWidth, setSegWidth] = useState(0)
  const tx = useSharedValue(0)

  const onLayout = (e: LayoutChangeEvent) => {
    const inner = e.nativeEvent.layout.width - PADDING * 2
    setSegWidth(inner / 2)
  }

  useEffect(() => {
    if (segWidth === 0) return
    const target = value === 'weekly' ? segWidth : 0
    tx.value = withSpring(target, { damping: 15, stiffness: 150, mass: 0.8 })
  }, [value, segWidth, tx])

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }))

  return (
    <View
      onLayout={onLayout}
      className="flex-row bg-surface rounded-xl p-1 relative"
    >
      {/* Sliding indicator — only rendered once measured to avoid a full-width flash */}
      {segWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: PADDING,
              top: PADDING,
              bottom: PADDING,
              width: segWidth,
              borderRadius: 8,
              backgroundColor: withAlpha(colors.primary, 0.15),
            },
            indicatorStyle,
          ]}
        />
      )}

      {(['daily', 'weekly'] as const).map((seg) => {
        const active = value === seg
        return (
          <Pressable
            key={seg}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onChange(seg)
            }}
            className="flex-1 py-2 rounded-lg items-center"
          >
            <Text className={`text-[13px] ${active ? 'font-bold text-primary' : 'font-semibold text-fgMuted'}`}>
              {seg === 'daily' ? 'Daily' : 'Weekly'}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
