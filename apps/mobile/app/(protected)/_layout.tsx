import { useEffect } from 'react'
import { View } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { useSession } from '@/features/auth/providers/SessionProvider'
import { getActiveWorkout } from '@/features/running/services/workout'
import { colors } from '@/theme'

export default function ProtectedLayout() {
  const { session, loading } = useSession()
  const router = useRouter()

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
    return <View className="flex-1 bg-[#0b0b0f]" />
  }

  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    />
  )
}
