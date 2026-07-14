import React, { memo, useState } from 'react'
import { View, Text, Pressable, ActivityIndicator } from 'react-native'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import Animated, {
  useAnimatedStyle,
  withSpring,
  useDerivedValue,
  interpolate,
  interpolateColor,
  Extrapolation,
} from 'react-native-reanimated'
import { formatDistance, formatDuration, formatPace } from '@stridequest/shared/running'
import { colors, fonts } from '@/theme'
import { Ionicons } from '@expo/vector-icons'
import { useDistanceAudioCoach } from '../hooks/useDistanceAudioCoach'
import type { MotionEngine } from '../engine/MotionEngine'
import { DiagnosticsOverlay } from './DiagnosticsOverlay'

export type RunHUDProps = {
  status: 'recording' | 'paused'
  distanceMeters: number
  elapsedSeconds: number
  hasFix: boolean
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onDiscardConfirm: () => void
  engine: MotionEngine | null
}

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView)

export const RunHUD = memo(({
  status,
  distanceMeters,
  elapsedSeconds,
  hasFix,
  onPause,
  onResume,
  onStop,
  onDiscardConfirm,
  engine,
}: RunHUDProps) => {
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [isDevModeEnabled, setIsDevModeEnabled] = useState(false)
  const isPaused = status === 'paused'

  const distanceKm = distanceMeters / 1000
  const paceMinutes = elapsedSeconds > 0 && distanceMeters > 0 
    ? (elapsedSeconds / 60) / distanceKm 
    : 0

  useDistanceAudioCoach(distanceKm, paceMinutes, isAudioEnabled, elapsedSeconds)

  const progress = useDerivedValue(() => {
    return withSpring(isPaused ? 1 : 0, {
      damping: 20,
      stiffness: 120,
      mass: 1,
    })
  }, [isPaused])

  const containerStyle = useAnimatedStyle(() => {
    return {
      flex: 1,
      backgroundColor: interpolateColor(
        progress.value,
        [0, 1],
        ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.4)']
      ),
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      width: '100%',
    }
  })

  const paceStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(progress.value, [0, 1], [1, 0]),
      height: interpolate(progress.value, [0, 1], [60, 0], Extrapolation.CLAMP),
      overflow: 'hidden',
    }
  })
  
  const pausedTextStyle = useAnimatedStyle(() => {
    return {
      opacity: progress.value,
      transform: [
        { translateY: interpolate(progress.value, [0, 1], [-20, 0]) }
      ]
    }
  })

  const recordingControlsStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(progress.value, [0, 0.5], [1, 0]),
      transform: [
        { scale: interpolate(progress.value, [0, 0.5], [1, 0.8]) },
        { translateY: interpolate(progress.value, [0, 0.5], [0, 20]) }
      ],
      position: 'absolute',
      width: '100%',
      pointerEvents: isPaused ? 'none' : 'auto',
    }
  })

  const pausedControlsStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(progress.value, [0.5, 1], [0, 1]),
      transform: [
        { scale: interpolate(progress.value, [0.5, 1], [0.8, 1]) },
        { translateY: interpolate(progress.value, [0.5, 1], [20, 0]) }
      ],
      position: 'absolute',
      width: '100%',
      pointerEvents: isPaused ? 'auto' : 'none',
    }
  })

  const handlePause = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onPause()
    setConfirmingDiscard(false)
  }

  const handleResume = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onResume()
    setConfirmingDiscard(false)
  }

  const handleStop = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onStop()
  }

  const handleDiscardClick = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setConfirmingDiscard(true)
  }

  const handleDiscardConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    onDiscardConfirm()
  }

  const toggleAudio = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setIsAudioEnabled((prev) => !prev)
  }

  const handleDevModeToggle = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    setIsDevModeEnabled((prev) => !prev)
  }

  return (
    <Animated.View style={containerStyle}>
      {isDevModeEnabled && <DiagnosticsOverlay engine={engine} />}
      
      {/* Audio Toggle Button */}
      <View className="absolute top-16 right-6 z-50">
        <AnimatedBlurView
          intensity={40}
          tint="dark"
          className="rounded-full overflow-hidden"
        >
          <Pressable
            onPress={toggleAudio}
            accessibilityRole="button"
            accessibilityLabel={isAudioEnabled ? 'Mute audio coach' : 'Unmute audio coach'}
            className="p-3 items-center justify-center border border-white/20 rounded-full"
          >
            <Ionicons
              name={isAudioEnabled ? "volume-high" : "volume-mute"}
              size={24}
              color={isAudioEnabled ? colors.primaryBright : "rgba(255, 255, 255, 0.5)"}
            />
          </Pressable>
        </AnimatedBlurView>
      </View>

      <Animated.Text
        style={[pausedTextStyle, { position: 'absolute', top: 100 }]}
        className="text-fgSecondary text-sm tracking-widest uppercase font-bold"
      >
        Paused
      </Animated.Text>

      {!hasFix && !isPaused && (
        <View className="flex-row items-center gap-2 bg-accent/20 px-4 py-2 rounded-full absolute top-24">
          <ActivityIndicator color={colors.accentBright} size="small" />
          <Text className="text-accentBright text-xs font-medium">Waiting for GPS…</Text>
        </View>
      )}

      <View className="items-center gap-8 mb-32">
        <Pressable 
          onLongPress={handleDevModeToggle}
          delayLongPress={2000}
          className="items-center gap-1"
        >
          <Text
            className="text-7xl text-white"
            style={{ fontVariant: ['tabular-nums'], fontFamily: fonts.displayHeavy }}
          >
            {formatDistance(distanceMeters)}
          </Text>
          <Text className="text-fgSecondary text-sm font-medium tracking-wide uppercase">distance</Text>
        </Pressable>

        <View className="flex-row gap-12">
          <View className="items-center gap-1">
            <Text
              className="text-3xl text-white"
              style={{ fontVariant: ['tabular-nums'], fontFamily: fonts.display }}
            >
              {formatDuration(elapsedSeconds)}
            </Text>
            <Text className="text-fgSecondary text-xs font-medium tracking-wide uppercase">time</Text>
          </View>
          
          <Animated.View style={paceStyle} className="items-center gap-1">
            <Text
              className="text-3xl text-white"
              style={{ fontVariant: ['tabular-nums'], fontFamily: fonts.display }}
            >
              {elapsedSeconds > 0 && distanceMeters > 0
                ? formatPace((elapsedSeconds * 1000) / distanceMeters)
                : '--:--'}
            </Text>
            <Text className="text-fgSecondary text-xs font-medium tracking-wide uppercase">pace /km</Text>
          </Animated.View>
        </View>
      </View>

      <View className="absolute bottom-12 w-full h-32 justify-center">
        {/* Recording Controls */}
        <Animated.View style={recordingControlsStyle} className="flex-row justify-center gap-6 items-center w-full px-8">
          <AnimatedBlurView
            intensity={40}
            tint="dark"
            className="rounded-full overflow-hidden flex-1"
          >
            <Pressable
              onPress={handlePause}
              className="py-5 items-center justify-center border border-white/20 rounded-full"
            >
              <Text className="text-white font-extrabold text-lg tracking-wider">PAUSE</Text>
            </Pressable>
          </AnimatedBlurView>

          <AnimatedBlurView
            intensity={20}
            tint="dark"
            className="rounded-full overflow-hidden"
          >
            {!confirmingDiscard ? (
              <Pressable
                onPress={handleDiscardClick}
                className="px-6 py-5 items-center justify-center rounded-full"
              >
                <Text className="text-white/70 font-bold text-sm tracking-wide">Discard</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={handleDiscardConfirm}
                className="px-6 py-5 items-center justify-center bg-danger/80 rounded-full border border-danger"
              >
                <Text className="text-white font-bold text-sm tracking-wide">Confirm</Text>
              </Pressable>
            )}
          </AnimatedBlurView>
        </Animated.View>

        {/* Paused Controls */}
        <Animated.View style={pausedControlsStyle} className="flex-row justify-center gap-4 items-center w-full px-8">
          <AnimatedBlurView
            intensity={40}
            tint="dark"
            className="rounded-full overflow-hidden flex-1"
          >
            <Pressable
              onPress={handleResume}
              className="py-5 items-center justify-center bg-primary/90 border border-primaryBright/30 rounded-full"
            >
              <Text className="text-white font-extrabold text-lg tracking-wider">RESUME</Text>
            </Pressable>
          </AnimatedBlurView>

          <AnimatedBlurView
            intensity={40}
            tint="dark"
            className="rounded-full overflow-hidden flex-1"
          >
            <Pressable
              onPress={handleStop}
              className="py-5 items-center justify-center border border-white/20 rounded-full"
            >
              <Text className="text-white font-extrabold text-lg tracking-wider">END RUN</Text>
            </Pressable>
          </AnimatedBlurView>

          <AnimatedBlurView
            intensity={20}
            tint="dark"
            className="rounded-full overflow-hidden"
          >
            {!confirmingDiscard ? (
              <Pressable
                onPress={handleDiscardClick}
                accessibilityRole="button"
                accessibilityLabel="Discard run"
                className="px-4 py-5 items-center justify-center rounded-full"
              >
                <Text className="text-danger/80 font-bold text-sm tracking-wide">Discard</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={handleDiscardConfirm}
                accessibilityRole="button"
                accessibilityLabel="Confirm discard"
                className="px-4 py-5 items-center justify-center bg-danger/90 rounded-full border border-danger"
              >
                <Text className="text-white font-bold text-sm tracking-wide">Confirm</Text>
              </Pressable>
            )}
          </AnimatedBlurView>
        </Animated.View>
      </View>
    </Animated.View>
  )
})
