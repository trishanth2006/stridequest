import { useEffect } from 'react'
import { View } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import notifee from '@notifee/react-native'
import { useSession } from '@/features/auth/providers/SessionProvider'
import { getActiveWorkout } from '@/features/running/services/workout'
import { usePushRegistration } from '@/features/notifications/usePushRegistration'
import { colors } from '@/theme'

// Must be registered at module scope before any component renders.
// The promise intentionally never resolves — the FG service stays alive
// until cancelLiveRun() or stopLiveRunWithSummary() calls stopForegroundService().
notifee.registerForegroundService(() => new Promise<void>(() => {}))

export default function ProtectedLayout() {
  const { session, loading } = useSession()
  const router = useRouter()

  usePushRegistration()

  useEffect(() => {
    if (!loading && !session) {
      router.replace('/(auth)/login')
    }
  }, [session, loading, router])

  // Recovery: if an active workout exists in the DB when the app loads,
  // navigate to the recording screen so the user can resume or end it.
  useEffect(() => {
    if (loading || !session) return
    void getActiveWorkout().then((workout) => {
      if (workout) {
        router.push('/(protected)/record' as never)
      }
    })
  }, [session, loading, router])

  if (loading || !session) {
    return <View className="flex-1 bg-background" />
  }

  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    />
  )
}
