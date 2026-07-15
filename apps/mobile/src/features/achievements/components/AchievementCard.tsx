import { memo } from 'react'
import { View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { type Achievement } from '@stridequest/shared/analytics'
import { colors } from '@/theme'

export const AchievementCard = memo(function AchievementCard({ achievement: ach }: { achievement: Achievement }) {
  const pct = ach.target > 0 ? Math.min(1, ach.progress / ach.target) : 0

  return (
    <View
      className={`rounded-[14px] bg-surface p-4 gap-2.5 border ${ach.unlocked ? 'border-primary/20' : 'border-white/5 opacity-75'}`}
    >
      <View className="flex-row items-center gap-3">
        <View
          className={`w-11 h-11 rounded-xl items-center justify-center ${ach.unlocked ? 'bg-primary/15' : 'bg-white/5'}`}
        >
          {ach.unlocked ? (
            <Text className="text-[22px]">{ach.icon}</Text>
          ) : (
            <Ionicons name="lock-closed" size={20} color={colors.fgFaint} />
          )}
        </View>

        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center justify-between">
            <Text className={`text-sm font-bold ${ach.unlocked ? 'text-white' : 'text-fgSecondary'}`}>
              {ach.title}
            </Text>
            <View className="flex-row gap-1.5">
              {ach.unlocked && (
                <View className="rounded-lg bg-primary/15 px-2 py-0.5">
                  <Text className="text-[10px] font-bold text-primary">✓ Done</Text>
                </View>
              )}
              {!ach.unlocked && ach.target > 0 && (ach.progress / ach.target) >= 0.8 && (
                <View className="rounded-lg bg-accent/15 px-2 py-0.5">
                  <Text className="text-[10px] font-bold text-accent">Almost There</Text>
                </View>
              )}
            </View>
          </View>
          <Text className="text-xs text-fgMuted">{ach.description}</Text>
          {ach.unlockedAt && (
            <Text className="text-[10px] text-fgFaint">
              {new Date(ach.unlockedAt).toLocaleDateString()}
            </Text>
          )}
        </View>
      </View>

      {!ach.unlocked && (
        <View className="gap-1">
          <View className="h-1 rounded-sm bg-surfaceMuted">
            <View
              className={`h-1 rounded-sm ${pct >= 0.8 ? 'bg-accent' : 'bg-primary'}`}
              style={{ width: `${pct * 100}%` }}
            />
          </View>
          <Text className="text-[10px] text-fgMuted">
            {ach.progress.toLocaleString()} / {ach.target.toLocaleString()}
          </Text>
        </View>
      )}
    </View>
  )
})
