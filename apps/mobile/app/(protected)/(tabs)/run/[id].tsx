import { useEffect, useState } from 'react'
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { formatDistance, formatDuration, formatPace } from '@stridequest/shared/running'
import { fetchRoutePoints } from '@/features/maps/services/route'
import { MapView } from '@/features/maps/components/MapView'
import { RouteLayer } from '@/features/maps/components/RouteLayer'
import type { RoutePoint } from '@/features/maps/types'

type WorkoutDetail = {
  id: string
  started_at: string
  ended_at: string | null
  distance_m: number | null
  duration_s: number | null
  avg_pace_s_per_km: number | null
  xp_awarded: number | null
  status: string
}

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [workout, setWorkout] = useState<WorkoutDetail | null>(null)
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    void (async () => {
      const [workoutResult, points] = await Promise.all([
        supabase
          .from('workouts')
          .select(
            'id, started_at, ended_at, distance_m, duration_s, avg_pace_s_per_km, xp_awarded, status',
          )
          .eq('id', id)
          .single(),
        fetchRoutePoints(id),
      ])

      if (workoutResult.error || !workoutResult.data) {
        setError('Could not load workout.')
      } else {
        setWorkout(workoutResult.data as WorkoutDetail)
        setRoutePoints(points)
      }
      setLoading(false)
    })()
  }, [id])

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-[#0b0b0f] items-center justify-center">
        <ActivityIndicator color="#10b981" />
      </SafeAreaView>
    )
  }

  if (error || !workout) {
    return (
      <SafeAreaView className="flex-1 bg-[#0b0b0f] items-center justify-center gap-4">
        <Text className="text-base text-neutral-400">{error ?? 'Workout not found.'}</Text>
        <Pressable onPress={() => router.back()}>
          <Text className="text-sm font-semibold text-emerald-400">Go back</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  const date = new Date(workout.started_at)
  const dateStr = date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

  return (
    <SafeAreaView className="flex-1 bg-[#0b0b0f]">
      <ScrollView className="flex-1 px-5 pt-4" contentContainerClassName="gap-6 pb-12">

        {/* Back */}
        <Pressable onPress={() => router.back()} className="flex-row items-center gap-1">
          <Text className="text-sm font-semibold text-emerald-400">← Back</Text>
        </Pressable>

        {/* Header */}
        <View className="gap-1">
          <Text className="text-2xl font-extrabold text-white">Run</Text>
          <Text className="text-sm text-neutral-400">{dateStr}</Text>
          <Text className="text-xs text-neutral-500">{timeStr}</Text>
        </View>

        {/* Key metrics */}
        <View className="rounded-2xl bg-neutral-900 p-5 gap-4">
          <MetricRow label="Distance" value={formatDistance(workout.distance_m ?? 0)} />
          <MetricRow label="Duration" value={formatDuration(workout.duration_s ?? 0)} />
          <MetricRow label="Avg Pace" value={formatPace(workout.avg_pace_s_per_km ?? 0)} />
          {workout.xp_awarded !== null && workout.xp_awarded > 0 && (
            <MetricRow label="XP Earned" value={`+${workout.xp_awarded} XP`} highlight />
          )}
        </View>

        {/* Route map card */}
        <View className="rounded-2xl bg-neutral-900 overflow-hidden">
          <View className="px-5 pt-5 pb-3">
            <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
              Route Map
            </Text>
          </View>
          {routePoints.length === 0 ? (
            <View className="px-5 pb-5 items-center">
              <Text className="text-sm text-neutral-500">No route recorded</Text>
            </View>
          ) : (
            <Pressable
              onPress={() => router.push(`/run/${id}/map` as never)}
              style={{ height: 160 }}
            >
              <MapView interactive={false} style={{ flex: 1 }}>
                <RouteLayer points={routePoints} />
              </MapView>
            </Pressable>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

function MetricRow({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <View className="flex-row justify-between items-center">
      <Text className="text-sm text-neutral-400">{label}</Text>
      <Text className={`text-sm font-semibold ${highlight ? 'text-emerald-400' : 'text-white'}`}>
        {value}
      </Text>
    </View>
  )
}
