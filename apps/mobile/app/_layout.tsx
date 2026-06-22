import '../global.css'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SessionProvider } from '@/features/auth/providers/SessionProvider'
import { MapboxProvider } from '@/features/maps/providers/MapboxProvider'

export default function RootLayout() {
  return (
    <SessionProvider>
      <MapboxProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }} />
      </MapboxProvider>
    </SessionProvider>
  )
}
