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
    <View
      style={{
        backgroundColor: '#171717',
        borderRadius: 20,
        padding: 20,
        gap: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
      }}
    >
      {/* Avatar row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: 'rgba(16,185,129,0.15)',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: '#10b981',
          }}
        >
          <Text style={{ fontSize: 28, fontWeight: '900', color: '#10b981' }}>{initial}</Text>
        </View>

        {/* Name + badges */}
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.5 }}>
            {username}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <View
              style={{
                backgroundColor: 'rgba(16,185,129,0.15)',
                borderRadius: 8,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderWidth: 1,
                borderColor: 'rgba(16,185,129,0.3)',
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#10b981' }}>
                ⭐ Level {currentLevel}
              </Text>
            </View>

            {xpRank > 0 && (
              <View
                style={{
                  backgroundColor: 'rgba(99,102,241,0.15)',
                  borderRadius: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderWidth: 1,
                  borderColor: 'rgba(99,102,241,0.3)',
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#818cf8' }}>
                  #{xpRank} Global
                </Text>
              </View>
            )}

            {achievementCount > 0 && (
              <View
                style={{
                  backgroundColor: 'rgba(245,158,11,0.12)',
                  borderRadius: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderWidth: 1,
                  borderColor: 'rgba(245,158,11,0.25)',
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#f59e0b' }}>
                  🏆 {achievementCount}/{totalAchievements}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {topAchievements.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {topAchievements.map((ach) => (
            <View
              key={ach.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderRadius: 20,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.08)',
              }}
            >
              <Text style={{ fontSize: 13 }}>{ach.icon}</Text>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#e5e5e5' }}>{ach.title}</Text>
            </View>
          ))}
        </View>
      )}

      {/* XP Progress */}
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#71717a', textTransform: 'uppercase', letterSpacing: 1 }}>
            Level Progress
          </Text>
          <Pressable onPress={onXpDetailsPress}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#10b981' }}>Details →</Text>
          </Pressable>
        </View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)' }}>
          <View
            style={{
              height: 6,
              borderRadius: 3,
              backgroundColor: '#10b981',
              width: `${progressPercent}%`,
            }}
          />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 11, color: '#52525b' }}>
            {totalXp.toLocaleString()} XP
          </Text>
          {nextLevel !== null && (
            <Text style={{ fontSize: 11, color: '#52525b' }}>
              {xpNeededToNextLevel} to Level {nextLevel}
            </Text>
          )}
        </View>
      </View>

      {/* Profile Completion */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }}>
        <Text style={{ fontSize: 10, fontWeight: '700', color: '#71717a', textTransform: 'uppercase', letterSpacing: 1 }}>
          Profile Completion
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 80, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)' }}>
            <View style={{ width: `${profileCompletion}%`, height: 4, borderRadius: 2, backgroundColor: '#10b981' }} />
          </View>
          <Text style={{ fontSize: 13, fontWeight: '800', color: '#10b981' }}>
            {profileCompletion}%
          </Text>
        </View>
      </View>
    </View>
  )
}
