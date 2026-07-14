import { View, Text, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { PersonalRecord, RecentActivity } from '@/features/profiles/services/profile'
import { colors, withAlpha } from '@/theme'

export function RecordCard({ record }: { record: PersonalRecord }) {
  return (
    <View
      style={{
        width: '47%',
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: 14,
        gap: 4,
        borderWidth: 1,
        borderColor: withAlpha(colors.white, 0.06),
      }}
    >
      <Text style={{ fontSize: 10, fontWeight: '600', color: colors.fgMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {record.title}
      </Text>
      <Text style={{ fontSize: 18, fontWeight: '800', color: colors.primary }}>
        {record.displayValue}
      </Text>
    </View>
  )
}

export const ACTIVITY_ICON: Record<RecentActivity['type'], React.ComponentProps<typeof Ionicons>['name']> = {
  workout: 'footsteps',
  capture: 'flag',
  achievement: 'trophy',
}

export function ActivityRow({ item, isLast }: { item: RecentActivity; isLast: boolean }) {
  const dateStr = new Date(item.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: withAlpha(colors.white, 0.05),
      }}
    >
      <Ionicons name={ACTIVITY_ICON[item.type]} size={16} color={colors.primary} />
      <Text style={{ flex: 1, fontSize: 13, color: colors.fgBright }}>{item.title}</Text>
      <Text style={{ fontSize: 11, color: colors.fgFaint }}>{dateStr}</Text>
    </View>
  )
}

export function ShortcutRow({
  label,
  icon,
  onPress,
}: {
  label: string
  icon: React.ComponentProps<typeof Ionicons>['name']
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
        borderRadius: 14,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: withAlpha(colors.primary, 0.12),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.white }}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.fgFaint} />
    </Pressable>
  )
}
