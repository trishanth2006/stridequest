/**
 * Leaderboards screen — Sprint 6 (deferred).
 *
 * This screen is reachable from Profile shortcuts and the Home Explore section.
 * Full implementation requires a `get_leaderboard()` Supabase RPC that exposes
 * cross-user rankings without a service-role key.
 *
 * For now, this renders a clear placeholder explaining what's coming and how
 * to unlock it on the backend.
 */
import { View, Text, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

const PLANNED_BOARDS = [
  { icon: '⭐', label: 'XP', description: 'Total experience points' },
  { icon: '🌍', label: 'Territory', description: 'Cells owned' },
  { icon: '📏', label: 'Distance', description: 'Lifetime km run' },
  { icon: '📅', label: 'Weekly', description: 'XP earned this week' },
]

export default function LeaderboardsScreen() {
  const router = useRouter()

  return (
    <SafeAreaView className="flex-1 bg-[#0b0b0f]">
      {/* Header */}
      <View className="flex-row items-center px-5 pt-5 pb-6" style={{ gap: 12 }}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#10b981" />
        </Pressable>
        <Text className="text-2xl font-extrabold text-white">Leaderboards</Text>
      </View>

      <View className="flex-1 px-5" style={{ gap: 20 }}>
        {/* Coming soon banner */}
        <View
          style={{
            backgroundColor: '#171717',
            borderRadius: 16,
            padding: 20,
            gap: 12,
            borderWidth: 1,
            borderColor: 'rgba(16,185,129,0.2)',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="podium" size={24} color="#10b981" />
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>
              Global Rankings
            </Text>
          </View>
          <Text style={{ fontSize: 13, color: '#71717a', lineHeight: 20 }}>
            Leaderboards go live once the{' '}
            <Text style={{ color: '#10b981', fontWeight: '600' }}>
              get_leaderboard()
            </Text>{' '}
            RPC is deployed. This will enable cross-user rankings without
            exposing private data or using a service-role key on device.
          </Text>
        </View>

        {/* Planned boards preview */}
        <View style={{ gap: 8 }}>
          <Text
            style={{
              fontSize: 10,
              fontWeight: '700',
              color: '#71717a',
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            Planned Boards
          </Text>
          {PLANNED_BOARDS.map((board) => (
            <View
              key={board.label}
              style={{
                backgroundColor: '#171717',
                borderRadius: 12,
                padding: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                opacity: 0.6,
              }}
            >
              <Text style={{ fontSize: 22 }}>{board.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#a3a3a3' }}>
                  {board.label} Leaderboard
                </Text>
                <Text style={{ fontSize: 11, color: '#52525b', marginTop: 2 }}>
                  {board.description}
                </Text>
              </View>
              <Ionicons name="lock-closed" size={14} color="#52525b" />
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  )
}
