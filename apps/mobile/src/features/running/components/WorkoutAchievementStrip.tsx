import { View, Text, ScrollView } from 'react-native'
import type { Achievement } from '@stridequest/shared/analytics'

interface WorkoutAchievementStripProps {
  achievements: Achievement[]
}

export function WorkoutAchievementStrip({ achievements }: WorkoutAchievementStripProps) {
  if (achievements.length === 0) return null

  return (
    <View
      style={{
        backgroundColor: 'rgba(245, 158, 11, 0.05)', // amber-500/5
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.3)',
        marginTop: 16,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Text style={{ fontSize: 24 }}>🏆</Text>
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#f59e0b' }}>
          Achievements Earned
        </Text>
      </View>

      <View style={{ gap: 12, marginTop: 16 }}>
        {achievements.map(ach => (
          <View
            key={ach.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
              backgroundColor: 'rgba(0,0,0,0.4)',
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: 'rgba(245, 158, 11, 0.2)',
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 28 }}>{ach.icon}</Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>
                {ach.title}
              </Text>
              <Text style={{ fontSize: 13, color: '#a3a3a3' }}>
                {ach.description}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}
