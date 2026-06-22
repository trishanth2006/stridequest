import MapboxGL from '@rnmapbox/maps'

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '')
MapboxGL.setTelemetryEnabled(false)

export function MapboxProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
