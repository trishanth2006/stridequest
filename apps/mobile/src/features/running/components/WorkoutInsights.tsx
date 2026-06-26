import { View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { WorkoutInsight } from '@stridequest/shared/analytics'
import { SectionLabel } from './shared'

interface WorkoutInsightsProps {
  insights: WorkoutInsight[]
}

const STYLES: Record<string, { icon: keyof typeof Ionicons.glyphMap; tint: string; text: string }> = {
  'strongest-push': { icon: 'flame', tint: 'rgba(245, 158, 11, 0.2)', text: '#f59e0b' },
  'best-segment': { icon: 'footsteps', tint: 'rgba(59, 130, 246, 0.2)', text: '#3b82f6' },
  efficiency: { icon: 'flash', tint: 'rgba(234, 179, 8, 0.2)', text: '#eab308' },
  consistency: { icon: 'analytics', tint: 'rgba(16, 185, 129, 0.2)', text: '#10b981' },
  'territory-efficiency': { icon: 'map', tint: 'rgba(16, 185, 129, 0.2)', text: '#10b981' }, // primary
}

const FALLBACK = { icon: 'bulb' as keyof typeof Ionicons.glyphMap, tint: 'rgba(255, 255, 255, 0.1)', text: '#ffffff' }

export function WorkoutInsights({ insights }: WorkoutInsightsProps) {
  if (insights.length === 0) return null

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 }}>
        <Ionicons name="flame" size={16} color="#f59e0b" />
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Insights</Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {insights.map((insight) => {
          const style = STYLES[insight.id] ?? FALLBACK
          return (
            <View
              key={insight.id}
              style={{
                backgroundColor: '#171717',
                borderRadius: 14,
                padding: 14,
                width: '48%', // Approx half minus gap
                flexGrow: 1,
                gap: 4,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.06)',
              }}
            >
              <View style={{ backgroundColor: style.tint, padding: 6, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 4 }}>
                <Ionicons name={style.icon} size={16} color={style.text} />
              </View>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#a3a3a3', textTransform: 'uppercase', letterSpacing: 1 }}>
                {insight.label}
              </Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>
                {insight.value}
              </Text>
              {insight.detail && (
                <Text style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>{insight.detail}</Text>
              )}
            </View>
          )
        })}
      </View>
    </View>
  )
}
