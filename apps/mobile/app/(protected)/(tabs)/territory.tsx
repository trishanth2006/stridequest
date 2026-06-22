import { useEffect, useState } from 'react'
import { View, Text, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { fetchTerritory } from '@/features/maps/services/territory'
import { MapView } from '@/features/maps/components/MapView'
import { TerritoryLayer } from '@/features/maps/components/TerritoryLayer'
import type { TerritoryCollection } from '@/features/maps/types'

const EMPTY: TerritoryCollection = { type: 'FeatureCollection', features: [] }

export default function TerritoryScreen() {
  const [polygons, setPolygons] = useState<TerritoryCollection>(EMPTY)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void fetchTerritory({ scope: 'me' }).then((data) => {
      setPolygons(data)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-[#0b0b0f] items-center justify-center">
        <ActivityIndicator color="#10b981" />
      </SafeAreaView>
    )
  }

  if (polygons.features.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-[#0b0b0f] items-center justify-center gap-3">
        <Text className="text-2xl font-bold text-white">Territory</Text>
        <Text className="text-sm text-neutral-400">No territory captured yet</Text>
        <Text className="text-xs text-neutral-500">Complete a run to claim your first cells</Text>
      </SafeAreaView>
    )
  }

  return (
    <View style={{ flex: 1 }}>
      <MapView style={{ flex: 1 }}>
        <TerritoryLayer data={polygons} />
      </MapView>

      {/* Header overlay */}
      <SafeAreaView
        style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
        pointerEvents="none"
      >
        <View className="px-5 pt-2">
          <Text className="text-lg font-bold text-white">My Territory</Text>
          <Text className="text-xs text-neutral-400">
            {polygons.features.length} cell{polygons.features.length !== 1 ? 's' : ''} owned
          </Text>
        </View>
      </SafeAreaView>
    </View>
  )
}
