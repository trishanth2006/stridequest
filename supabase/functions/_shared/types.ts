export type LatLng = { lat: number; lng: number }
export type CellId = string

export type CaptureRoutePoint = {
  lat: number
  lng: number
  recordedAt: string   // ISO-8601 — from DB recorded_at column
  batchSeq: number
  pointSeq: number
}
