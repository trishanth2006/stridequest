import type { Tables } from '@/infrastructure/supabase/database.types'

/**
 * A geographic coordinate in WGS84 degrees. The minimal shape consumed by the
 * pure distance functions in `services/distance.ts`.
 */
export type LatLng = {
  lat: number
  lng: number
}

/**
 * A raw GPS sample captured client-side (architecture §2.2). Produced by the
 * geolocation layer and consumed by `services/sample-filter.ts`. `recordedAt`
 * is epoch ms from the client clock; the server stamps its own `received_at`
 * on ingest, so client time is never trusted for cross-user ordering.
 */
export type GpsSample = LatLng & {
  accuracy: number
  recordedAt: number
  altitude?: number
  speed?: number
  heading?: number
}

export type WorkoutStatus = 'recording' | 'completed' | 'discarded'

export type Workout = Tables<'workouts'>

/**
 * Server-computed metrics returned by the `finalize_workout` RPC (02C-01).
 * Mirrors the `finalize_workout_result` composite type. Territory and XP
 * fields are nullable — populated by 02D/02E respectively.
 */
export type FinalizeResult = {
  workoutId: string
  status: string
  distanceM: number | null
  durationS: number | null
  avgPaceSPerKm: number | null
  xpAwarded: number | null
  cellsClaimed: number | null
  cellsStolen: number | null
  cellsDefended: number | null
}

/**
 * Result of a workout lifecycle server action, shaped for `useActionState`.
 * `idle` is the initial state; `success` carries the affected workout's id so
 * the client can transition without re-querying. When stop returns finalized
 * metrics (02C-02), they are attached to the success case.
 */
export type WorkoutActionResult =
  | { status: 'idle' }
  | { status: 'success'; workoutId: string; metrics?: FinalizeResult }
  | { status: 'error'; error: string }
