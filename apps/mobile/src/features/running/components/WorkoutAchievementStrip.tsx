import { View, Text } from 'react-native'
import type { Achievement } from '@stridequest/shared/analytics'

interface WorkoutAchievementStripProps {
  achievements: Achievement[]
}

export function WorkoutAchievementStrip({ achievements }: WorkoutAchievementStripProps) {
  if (achievements.length === 0) return null

  return (
    <View className="bg-accent/5 rounded-3xl p-5 border border-accent/30 mt-4">
      <View className="flex-row items-center gap-2 mb-4">
        <Text className="text-2xl">🏆</Text>
        <Text className="text-lg font-extrabold text-accent">
          Achievements Earned
        </Text>
      </View>

      <View className="gap-3 mt-4">
        {achievements.map(ach => (
          <View
            key={ach.id}
            className="flex-row items-center gap-4 bg-black/40 rounded-2xl p-4 border border-accent/20"
          >
            <View className="w-14 h-14 rounded-full items-center justify-center bg-accent/10">
              <Text className="text-[28px]">{ach.icon}</Text>
            </View>
            <View className="flex-1 gap-1">
              <Text className="text-base font-extrabold text-white">
                {ach.title}
              </Text>
              <Text className="text-[13px] text-fgSecondary">
                {ach.description}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}
