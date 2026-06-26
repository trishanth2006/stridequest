import { View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { WorkoutInsight } from '@stridequest/shared/analytics'
import { SectionLabel } from './shared'
import { colors, withAlpha } from '@/theme'

interface WorkoutInsightsProps {
  insights: WorkoutInsight[]
}

const STYLES: Record<string, { icon: keyof typeof Ionicons.glyphMap; tint: string; text: string }> = {
  'strongest-push': { icon: 'flame', tint: withAlpha(colors.accent, 0.2), text: colors.accent },
  'best-segment': { icon: 'footsteps', tint: withAlpha(colors.blue, 0.2), text: colors.blue },
  efficiency: { icon: 'flash', tint: withAlpha(colors.yellow, 0.2), text: colors.yellow },
  consistency: { icon: 'analytics', tint: withAlpha(colors.primary, 0.2), text: colors.primary },
  'territory-efficiency': { icon: 'map', tint: withAlpha(colors.primary, 0.2), text: colors.primary }, // primary
}

const FALLBACK = { icon: 'bulb' as keyof typeof Ionicons.glyphMap, tint: withAlpha(colors.white, 0.1), text: colors.white }

export function WorkoutInsights({ insights }: WorkoutInsightsProps) {
  if (insights.length === 0) return null

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 }}>
        <Ionicons name="flame" size={16} color={colors.accent} />
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.white }}>Insights</Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {insights.map((insight) => {
          const style = STYLES[insight.id] ?? FALLBACK
          return (
            <View
              key={insight.id}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                padding: 14,
                width: '48%', // Approx half minus gap
                flexGrow: 1,
                gap: 4,
                borderWidth: 1,
                borderColor: withAlpha(colors.white, 0.06),
              }}
            >
              <View style={{ backgroundColor: style.tint, padding: 6, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 4 }}>
                <Ionicons name={style.icon} size={16} color={style.text} />
              </View>
              <Text style={{ fontSize: 10, fontWeight: '700', color: colors.fgSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>
                {insight.label}
              </Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.white }}>
                {insight.value}
              </Text>
              {insight.detail && (
                <Text style={{ fontSize: 11, color: colors.fgMuted, marginTop: 2 }}>{insight.detail}</Text>
              )}
            </View>
          )
        })}
      </View>
    </View>
  )
}
