import { View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { type Achievement } from '@stridequest/shared/analytics'
import { colors, withAlpha } from '@/theme'

export function AchievementCard({ achievement: ach }: { achievement: Achievement }) {
  const pct = ach.target > 0 ? Math.min(1, ach.progress / ach.target) : 0

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: 16,
        gap: 10,
        opacity: ach.unlocked ? 1 : 0.75,
        borderWidth: 1,
        borderColor: ach.unlocked ? withAlpha(colors.primary, 0.2) : withAlpha(colors.white, 0.05),
      }}
    >
      <View className="flex-row items-center" style={{ gap: 12 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: ach.unlocked ? withAlpha(colors.primary, 0.15) : withAlpha(colors.white, 0.05),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {ach.unlocked ? (
            <Text style={{ fontSize: 22 }}>{ach.icon}</Text>
          ) : (
            <Ionicons name="lock-closed" size={20} color={colors.fgFaint} />
          )}
        </View>

        <View style={{ flex: 1, gap: 2 }}>
          <View className="flex-row items-center justify-between">
            <Text
              style={{
                fontSize: 14,
                fontWeight: '700',
                color: ach.unlocked ? colors.white : colors.fgSecondary,
              }}
            >
              {ach.title}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {ach.unlocked && (
                <View
                  style={{
                    backgroundColor: withAlpha(colors.primary, 0.15),
                    borderRadius: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary }}>✓ Done</Text>
                </View>
              )}
              {!ach.unlocked && ach.target > 0 && (ach.progress / ach.target) >= 0.8 && (
                <View
                  style={{
                    backgroundColor: withAlpha(colors.accent, 0.15),
                    borderRadius: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '700', color: colors.accent }}>Almost There</Text>
                </View>
              )}
            </View>
          </View>
          <Text style={{ fontSize: 12, color: colors.fgMuted }}>{ach.description}</Text>
          {ach.unlockedAt && (
            <Text style={{ fontSize: 10, color: colors.fgFaint }}>
              {new Date(ach.unlockedAt).toLocaleDateString()}
            </Text>
          )}
        </View>
      </View>

      {!ach.unlocked && (
        <View style={{ gap: 4 }}>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.surfaceMuted }}>
            <View
              style={{
                height: 4,
                borderRadius: 2,
                backgroundColor: pct >= 0.8 ? colors.accent : colors.primary,
                width: `${pct * 100}%`,
              }}
            />
          </View>
          <Text style={{ fontSize: 10, color: colors.fgMuted }}>
            {ach.progress.toLocaleString()} / {ach.target.toLocaleString()}
          </Text>
        </View>
      )}
    </View>
  )
}
