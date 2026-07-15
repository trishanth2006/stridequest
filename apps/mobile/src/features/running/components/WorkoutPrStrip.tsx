import { View, Text } from 'react-native'
import type { PersonalRecord } from '@stridequest/shared/analytics'
import { colors, withAlpha } from '@/theme'

interface WorkoutPrStripProps {
  records: PersonalRecord[]
}

export function WorkoutPrStrip({ records }: WorkoutPrStripProps) {
  if (records.length === 0) return null

  return (
    <View
      style={{
        backgroundColor: withAlpha(colors.indigo, 0.05), // indigo-500/5
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: withAlpha(colors.indigo, 0.25), // indigo-500/25
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <Text style={{ fontSize: 16 }}>🏅</Text>
        <Text style={{ fontSize: 11, fontWeight: '800', color: colors.indigoLight, textTransform: 'uppercase', letterSpacing: 1 }}>
          Personal Records Set
        </Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {records.map(pr => (
          <View
            key={pr.id}
            style={{
              backgroundColor: withAlpha(colors.black, 0.4),
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderWidth: 1,
              borderColor: withAlpha(colors.indigo, 0.15),
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.white }}>
              {pr.title}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}
