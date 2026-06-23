type _MapboxGLType = typeof import('@rnmapbox/maps')['default']

// @rnmapbox/maps throws at module load when native code isn't compiled
// (e.g. Expo Go). Wrap in try-catch so other screens still work.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const MapboxGL = (require('@rnmapbox/maps') as { default: _MapboxGLType }).default
  const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN
  console.log('[MapboxProvider] EXPO_PUBLIC_MAPBOX_TOKEN defined:', !!token)
  MapboxGL.setAccessToken(token ?? '')
  MapboxGL.setTelemetryEnabled(false)
} catch (error) {
  console.error('[MapboxProvider] Error loading MapboxGL (Likely Expo Go):', error)
  // native build required — run `expo run:android` / `expo run:ios`
}

export function MapboxProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
