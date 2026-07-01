import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { MotionEngine } from '../engine/MotionEngine'
import { useMotionDiagnostics } from '../hooks/useMotionDiagnostics'
import { colors } from '@/theme'

export type DiagnosticsOverlayProps = {
  engine: MotionEngine | null
}

export function DiagnosticsOverlay({ engine }: DiagnosticsOverlayProps) {
  const insets = useSafeAreaInsets()
  const diagnostics = useMotionDiagnostics(engine)

  if (!diagnostics) return null

  // Determine State Color
  let stateColor = colors.fgPrimary
  if (diagnostics.state === 'Recording') {
    stateColor = colors.primaryBright || '#4ade80' // Green fallback
  } else if (diagnostics.state === 'AutoPaused') {
    stateColor = colors.accentBright || '#facc15' // Yellow fallback
  }

  // Determine Confidence Color
  const confidenceColor = diagnostics.confidence < 0.5 ? colors.danger || '#f87171' : colors.fgPrimary

  return (
    <View style={[styles.container, { top: insets.top + 10 }]} pointerEvents="none">
      <BlurView intensity={70} tint="dark" style={styles.blurContainer}>
        <View style={styles.content}>
          <Text style={styles.title}>ENGINE DIAGNOSTICS</Text>
          
          <View style={styles.row}>
            <Text style={styles.label}>State:</Text>
            <Text style={[styles.value, { color: stateColor }]}>
              {diagnostics.state}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Confidence:</Text>
            <Text style={[styles.value, { color: confidenceColor }]}>
              {diagnostics.confidence.toFixed(3)}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Speed:</Text>
            <Text style={styles.value}>
              {diagnostics.medianSpeedMps.toFixed(2)} m/s
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Quality:</Text>
            <Text style={styles.value}>{diagnostics.gpsQuality}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Tier:</Text>
            <Text style={styles.value}>{diagnostics.sensorTier}</Text>
          </View>
          
          <View style={styles.row}>
            <Text style={styles.label}>Drift Rad:</Text>
            <Text style={styles.value}>{diagnostics.driftRadiusM.toFixed(1)}m</Text>
          </View>
        </View>
      </BlurView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    zIndex: 9999, // Ensure it's above everything
  },
  blurContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  content: {
    padding: 12,
    gap: 4,
  },
  title: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'center',
  },
  label: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    fontFamily: 'Courier',
  },
  value: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Courier',
    fontVariant: ['tabular-nums'],
    fontWeight: 'bold',
  },
})
