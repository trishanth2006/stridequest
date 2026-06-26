import { View, Text, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { PersonalRecord, RecentActivity } from '@/features/profiles/services/profile'
import { colors, withAlpha } from '@/theme'

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontSize: 10, fontWeight: '700', color: colors.fgMuted, textTransform: 'uppercase', letterSpacing: 1 }}>
      {children}
    </Text>
  )
}

export function StatCard({
  label,
  value,
  icon,
  accent = false,
}: {
  label: string
  value: string
  icon: React.ComponentProps<typeof Ionicons>['name']
  accent?: boolean
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: accent ? withAlpha(colors.primary, 0.08) : colors.surface,
        borderRadius: 16,
        padding: 16,
        gap: 8,
        borderWidth: 1,
        borderColor: accent ? withAlpha(colors.primary, 0.2) : withAlpha(colors.white, 0.06),
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          backgroundColor: accent ? withAlpha(colors.primary, 0.15) : withAlpha(colors.white, 0.06),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={15} color={accent ? colors.primary : colors.fgSecondary} />
      </View>
      <Text style={{ fontSize: 22, fontWeight: '900', color: accent ? colors.primary : colors.white, letterSpacing: -0.5 }}>
        {value}
      </Text>
      <Text style={{ fontSize: 10, fontWeight: '600', color: colors.fgFaint, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Text>
    </View>
  )
}

export function TerritoryStatCard({
  count,
  captureCount,
  stolenCount,
}: {
  count: number
  captureCount: number
  stolenCount: number
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        gap: 4,
        borderWidth: 1,
        borderColor: withAlpha(colors.white, 0.06),
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          backgroundColor: withAlpha(colors.white, 0.06),
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 4,
        }}
      >
        <Ionicons name="map" size={15} color={colors.fgSecondary} />
      </View>
      <Text style={{ fontSize: 22, fontWeight: '900', color: colors.white, letterSpacing: -0.5 }}>{count}</Text>
      <Text style={{ fontSize: 10, fontWeight: '600', color: colors.fgFaint, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Territory
      </Text>
      {(captureCount > 0 || stolenCount > 0) && (
        <Text style={{ fontSize: 10, color: colors.fgFaint, marginTop: 2 }}>
          {captureCount} captured · {stolenCount} stolen
        </Text>
      )}
    </View>
  )
}

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
