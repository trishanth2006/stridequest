import { Redirect } from 'expo-router'
import { View } from 'react-native'
import { useSession } from '@/features/auth/providers/SessionProvider'

export default function Index() {
  const { session, loading } = useSession()

  if (loading) return <View className="flex-1 bg-background" />

  if (session) return <Redirect href="/(protected)/(tabs)" />

  return <Redirect href="/(auth)/login" />
}
