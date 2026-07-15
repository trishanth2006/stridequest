import { View, Text, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { PersonalRecord, RecentActivity } from '@/features/profiles/services/profile'
import { colors } from '@/theme'

export function RecordCard({ record }: { record: PersonalRecord }) {
  return (
    <View className="w-[47%] bg-surface rounded-[14px] p-3.5 gap-1 border border-white/[0.06]">
      <Text className="text-[10px] font-semibold text-fgMuted uppercase tracking-[0.5px]">
        {record.title}
      </Text>
      <Text className="text-lg font-extrabold text-primary">
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
    <View className={`flex-row items-center px-4 py-3 gap-3 ${isLast ? '' : 'border-b border-white/5'}`}>
      <Ionicons name={ACTIVITY_ICON[item.type]} size={16} color={colors.primary} />
      <Text className="flex-1 text-[13px] text-fgBright">{item.title}</Text>
      <Text className="text-[11px] text-fgFaint">{dateStr}</Text>
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
      className="rounded-[14px] p-4 flex-row items-center gap-3"
      style={({ pressed }) => ({ backgroundColor: pressed ? colors.surfaceMuted : colors.surface })}
    >
      <View className="w-9 h-9 rounded-[10px] items-center justify-center bg-primary/[0.12]">
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <Text className="flex-1 text-[15px] font-semibold text-white">{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.fgFaint} />
    </Pressable>
  )
}
