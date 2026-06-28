import { View, StyleSheet } from 'react-native'

// @rnmapbox/maps throws at module load without a native dev build (e.g. Expo Go).
// Load lazily so route discovery doesn't crash the whole app.
type MapboxGLType = typeof import('@rnmapbox/maps')['default']
let MapboxGL: MapboxGLType | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  MapboxGL = (require('@rnmapbox/maps') as { default: MapboxGLType }).default
  console.log('[Mapbox Init] EXPO_PUBLIC_MAPBOX_TOKEN defined:', !!process.env.EXPO_PUBLIC_MAPBOX_TOKEN)
  console.log('[Mapbox Init] MapboxGL loaded successfully (Native Build)')
} catch (error) {
  console.error('[Mapbox Init] Error loading MapboxGL (Likely Expo Go):', error)
  // native build required — run `expo run:android` / `expo run:ios`
}

type Props = {
  style?: object
  children?: React.ReactNode
  interactive?: boolean
  initialCenter?: [number, number]
}

export function MapView({ style, children, interactive = true, initialCenter }: Props) {
  if (!MapboxGL) {
    console.log('[MapView] MapboxGL is null, rendering empty fallback view')
    return <View style={[styles.fill, style as object]} />
  }
  return (
    <MapboxGL.MapView
      style={style ?? styles.fill}
      styleURL={MapboxGL.StyleURL.Dark}
      scrollEnabled={interactive}
      zoomEnabled={interactive}
      pitchEnabled={interactive}
      rotateEnabled={interactive}
    >
      {initialCenter && (
        <MapboxGL.Camera centerCoordinate={initialCenter} zoomLevel={12} />
      )}
      {children}
    </MapboxGL.MapView>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
})
