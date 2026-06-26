import { View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { formatDuration, formatPace } from '@stridequest/shared/running'
import type { WorkoutSplit } from '@stridequest/shared/analytics'
import { Card, SectionLabel } from './shared'

interface WorkoutSplitsTableProps {
  splits: WorkoutSplit[]
}

export function WorkoutSplitsTable({ splits }: WorkoutSplitsTableProps) {
  if (splits.length === 0) return null

  return (
    <Card noPad>
      <View className="px-5 pt-5 pb-3">
        <SectionLabel>Splits</SectionLabel>
      </View>
      <View className="flex-row px-5 pb-2">
        <Text style={{ width: 36, fontSize: 10, color: '#71717a', fontWeight: '600' }}>#</Text>
        <Text style={{ flex: 1, fontSize: 10, color: '#71717a', fontWeight: '600' }}>Dist</Text>
        <Text style={{ flex: 1, fontSize: 10, color: '#71717a', fontWeight: '600' }}>Time</Text>
        <Text style={{ flex: 1, fontSize: 10, color: '#71717a', fontWeight: '600', textAlign: 'right' }}>Pace</Text>
      </View>
      <View className="h-px bg-white/10" />
      {splits.map((split) => {
        const bg = split.isFastest
          ? 'rgba(16,185,129,0.08)'
          : split.isSlowest
          ? 'rgba(239,68,68,0.08)'
          : 'transparent'
        const accent = split.isFastest ? '#10b981' : split.isSlowest ? '#ef4444' : '#fff'
        return (
          <View
            key={split.index}
            style={{ backgroundColor: bg }}
            className="flex-row items-center px-5 py-3"
          >
            <View style={{ width: 36, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: accent }}>
                {split.index}
              </Text>
              {split.isFastest && <Ionicons name="flash" size={11} color="#10b981" />}
              {split.isSlowest && <Ionicons name="hourglass" size={11} color="#ef4444" />}
            </View>
            <Text style={{ flex: 1, fontSize: 13, color: '#a3a3a3' }}>
              {(split.distanceM / 1000).toFixed(2)} km
            </Text>
            <Text style={{ flex: 1, fontSize: 13, color: '#a3a3a3' }}>
              {formatDuration(Math.round(split.durationS))}
            </Text>
            <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: accent, textAlign: 'right' }}>
              {formatPace(split.paceSPerKm)}
            </Text>
          </View>
        )
      })}
      <View style={{ height: 8 }} />
    </Card>
  )
}
