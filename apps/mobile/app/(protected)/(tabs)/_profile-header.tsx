import { View, Text, Pressable } from 'react-native'

type ProfileHeaderProps = {
  username: string
  initial: string
  xpRank: number
  achievementCount: number
  totalAchievements: number
  totalXp: number
  currentLevel: number
  nextLevel: number | null
  progressPercent: number
  xpNeededToNextLevel: number
  profileCompletion: number
  topAchievements: { id: string; icon: string; title: string }[]
  onXpDetailsPress: () => void
}

export function ProfileHeader({
  username,
  initial,
  xpRank,
  achievementCount,
  totalAchievements,
  totalXp,
  currentLevel,
  nextLevel,
  progressPercent,
  xpNeededToNextLevel,
  profileCompletion,
  topAchievements,
  onXpDetailsPress,
}: ProfileHeaderProps) {
  return (
    <View className="bg-surface rounded-[20px] p-5 gap-4 border border-white/[0.06]">
      {/* Avatar row */}
      <View className="flex-row items-center gap-4">
        <View className="w-[72px] h-[72px] rounded-full items-center justify-center bg-primary/15 border-2 border-primary">
          <Text className="text-[28px] font-black text-primary">{initial}</Text>
        </View>

        {/* Name + badges */}
        <View className="flex-1 gap-1">
          <Text className="text-[22px] font-black text-white tracking-[-0.5px]">
            {username}
          </Text>
          <View className="flex-row flex-wrap gap-1.5">
            <View className="rounded-lg px-2 py-[3px] border bg-primary/15 border-primary/30">
              <Text className="text-[11px] font-bold text-primary">
                ⭐ Level {currentLevel}
              </Text>
            </View>

            {xpRank > 0 && (
              <View className="rounded-lg px-2 py-[3px] border bg-indigo/15 border-indigo/30">
                <Text className="text-[11px] font-bold text-indigoLight">
                  #{xpRank} Global
                </Text>
              </View>
            )}

            {achievementCount > 0 && (
              <View className="rounded-lg px-2 py-[3px] border bg-accent/[0.12] border-accent/25">
                <Text className="text-[11px] font-bold text-accent">
                  🏆 {achievementCount}/{totalAchievements}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {topAchievements.length > 0 && (
        <View className="flex-row flex-wrap gap-1.5">
          {topAchievements.map((ach) => (
            <View
              key={ach.id}
              className="flex-row items-center gap-[5px] rounded-full px-2.5 py-1 border bg-white/[0.06] border-white/[0.08]"
            >
              <Text className="text-[13px]">{ach.icon}</Text>
              <Text className="text-[11px] font-semibold text-fgBright">{ach.title}</Text>
            </View>
          ))}
        </View>
      )}

      {/* XP Progress */}
      <View className="gap-1.5">
        <View className="flex-row justify-between items-center">
          <Text className="text-[10px] font-bold text-fgMuted uppercase tracking-[1px]">
            Level Progress
          </Text>
          <Pressable onPress={onXpDetailsPress}>
            <Text className="text-[11px] font-semibold text-primary">Details →</Text>
          </Pressable>
        </View>
        <View className="h-1.5 rounded-sm bg-white/[0.08]">
          <View
            className="h-1.5 rounded-sm bg-primary"
            style={{ width: `${progressPercent}%` }}
          />
        </View>
        <View className="flex-row justify-between">
          <Text className="text-[11px] text-fgFaint">
            {totalXp.toLocaleString()} XP
          </Text>
          {nextLevel !== null && (
            <Text className="text-[11px] text-fgFaint">
              {xpNeededToNextLevel} to Level {nextLevel}
            </Text>
          )}
        </View>
      </View>

      {/* Profile Completion */}
      <View className="flex-row justify-between items-center pt-2 border-t border-white/[0.06]">
        <Text className="text-[10px] font-bold text-fgMuted uppercase tracking-[1px]">
          Profile Completion
        </Text>
        <View className="flex-row items-center gap-2">
          <View className="w-20 h-1 rounded-sm bg-white/[0.08]">
            <View className="h-1 rounded-sm bg-primary" style={{ width: `${profileCompletion}%` }} />
          </View>
          <Text className="text-[13px] font-extrabold text-primary">
            {profileCompletion}%
          </Text>
        </View>
      </View>
    </View>
  )
}
