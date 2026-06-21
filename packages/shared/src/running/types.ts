/**
 * A geographic coordinate in WGS84 degrees.
 */
export type LatLng = {
  lat: number
  lng: number
}

/**
 * A raw GPS sample captured client-side. `recordedAt` is epoch milliseconds
 * from the client clock; the server stamps its own `received_at` on ingest.
 */
export type GpsSample = LatLng & {
  accuracy: number
  recordedAt: number
  altitude?: number
  speed?: number
  heading?: number
}
