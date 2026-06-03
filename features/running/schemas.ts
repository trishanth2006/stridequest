import { z } from 'zod'

// Stop/discard act on a specific workout by id. start takes no client payload
// in Phase 02A (server sets user_id, status, started_at, source).
export const stopWorkoutSchema = z.object({
  workoutId: z.string().uuid('Invalid workout id'),
})

export const discardWorkoutSchema = z.object({
  workoutId: z.string().uuid('Invalid workout id'),
})

export type StopWorkoutInput = z.infer<typeof stopWorkoutSchema>
export type DiscardWorkoutInput = z.infer<typeof discardWorkoutSchema>

// One raw GPS sample as sent by the client recorder (mirrors the GpsSample shape
// in types.ts). recordedAt is the client clock in epoch ms (FR-RR-3); the server
// stamps received_at itself. Coordinate/accuracy bounds mirror the DB CHECKs.
export const gpsSampleSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative(),
  recordedAt: z.number().int().nonnegative(),
  altitude: z.number().optional(),
  speed: z.number().nonnegative().optional(),
  heading: z.number().optional(),
})

// One ingest request body (workout_id travels in the URL path, not the body —
// FR-RR-1). batchSeq is the client's per-workout monotonic counter (FR-RR-2). The
// samples cap is a payload guard, comfortably above the buffer's flush size.
export const ingestBatchSchema = z.object({
  batchSeq: z.number().int().nonnegative(),
  samples: z.array(gpsSampleSchema).min(1).max(1000),
})

export type GpsSampleInput = z.infer<typeof gpsSampleSchema>
export type IngestBatchInput = z.infer<typeof ingestBatchSchema>
