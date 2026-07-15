import '../global.css'
import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import {
  useFonts,
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
} from '@expo-google-fonts/barlow-condensed'
import { SessionProvider } from '@/features/auth/providers/SessionProvider'
import { MapboxProvider } from '@/features/maps/providers/MapboxProvider'
import { LogBox } from 'react-native'

// Ignore legacy NativeEventEmitter warnings from third-party modules (like Mapbox)
LogBox.ignoreLogs(['new NativeEventEmitter() was called with a non-null argument'])

// Keep the splash visible until the display fonts are ready so hero
// numerals never flash in the system font.
void SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    BarlowCondensed_700Bold,
    BarlowCondensed_800ExtraBold,
  })

  // On fontError we proceed anyway — RN falls back to the system font,
  // which beats being stuck on the splash screen forever.
  const ready = fontsLoaded || fontError !== null

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync()
  }, [ready])

  if (!ready) return null

  return (
    <SessionProvider>
      <MapboxProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }} />
      </MapboxProvider>
    </SessionProvider>
  )
}
