import { useEffect, useState } from 'react'
import { View, Pressable, Text, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { fetchRoutePoints } from '@/features/maps/services/route'
import { MapView } from '@/features/maps/components/MapView'
import { RouteLayer } from '@/features/maps/components/RouteLayer'
import type { RoutePoint } from '@/features/maps/types'
import { colors } from '@/theme'

// MAP-TECH-DEBT-001: Re-fetches route_points independently from the detail screen.
// Future: pass route via navigation params or in-memory cache.

export default function RouteMapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [points, setPoints] = useState<RoutePoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    void fetchRoutePoints(id).then((pts) => {
      setPoints(pts)
      setLoading(false)
    })
  }, [id])

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {loading ? (
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </SafeAreaView>
      ) : (
        <MapView style={{ flex: 1 }}>
          <RouteLayer points={points} />
        </MapView>
      )}

      {/* Back button overlay */}
      <SafeAreaView
        style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={() => router.back()}
          style={{ margin: 16, alignSelf: 'flex-start' }}
          className="bg-surface/80 rounded-full px-4 py-2"
        >
          <Text className="text-sm font-semibold text-primaryBright">← Back</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  )
}
