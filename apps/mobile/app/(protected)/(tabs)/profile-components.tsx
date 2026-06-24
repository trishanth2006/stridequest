import { View, Text, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { PersonalRecord, RecentActivity } from '@/features/profiles/services/profile'

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontSize: 10, fontWeight: '700', color: '#71717a', textTransform: 'uppercase', letterSpacing: 1 }}>
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
        backgroundColor: accent ? 'rgba(16,185,129,0.08)' : '#171717',
        borderRadius: 16,
        padding: 16,
        gap: 8,
        borderWidth: 1,
        borderColor: accent ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)',
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          backgroundColor: accent ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={15} color={accent ? '#10b981' : '#a3a3a3'} />
      </View>
      <Text style={{ fontSize: 22, fontWeight: '900', color: accent ? '#10b981' : '#fff', letterSpacing: -0.5 }}>
        {value}
      </Text>
      <Text style={{ fontSize: 10, fontWeight: '600', color: '#52525b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
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
        backgroundColor: '#171717',
        borderRadius: 16,
        padding: 16,
        gap: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          backgroundColor: 'rgba(255,255,255,0.06)',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 4,
        }}
      >
        <Ionicons name="map" size={15} color="#a3a3a3" />
      </View>
      <Text style={{ fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.5 }}>{count}</Text>
      <Text style={{ fontSize: 10, fontWeight: '600', color: '#52525b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Territory
      </Text>
      {(captureCount > 0 || stolenCount > 0) && (
        <Text style={{ fontSize: 10, color: '#52525b', marginTop: 2 }}>
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
        backgroundColor: '#171717',
        borderRadius: 14,
        padding: 14,
        gap: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
      }}
    >
      <Text style={{ fontSize: 10, fontWeight: '600', color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {record.title}
      </Text>
      <Text style={{ fontSize: 18, fontWeight: '800', color: '#10b981' }}>
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
        borderBottomColor: 'rgba(255,255,255,0.05)',
      }}
    >
      <Ionicons name={ACTIVITY_ICON[item.type]} size={16} color="#10b981" />
      <Text style={{ flex: 1, fontSize: 13, color: '#e5e5e5' }}>{item.title}</Text>
      <Text style={{ fontSize: 11, color: '#52525b' }}>{dateStr}</Text>
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
        backgroundColor: pressed ? '#262626' : '#171717',
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
          backgroundColor: 'rgba(16,185,129,0.12)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={18} color="#10b981" />
      </View>
      <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: '#fff' }}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color="#52525b" />
    </Pressable>
  )
}
