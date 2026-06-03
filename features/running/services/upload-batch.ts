import type { SampleBatch, UploadBatch } from '@/features/running/services/sample-buffer'

/**
 * Client-side implementation of the buffer's {@link UploadBatch} seam: POST one
 * cut batch to the idempotent ingest route (02B-07). `workout_id` travels in the
 * URL (FR-RR-1); the body is the `ingestBatchSchema` shape — a `GpsSample` is
 * already a valid `gpsSampleSchema`, so the samples are sent as-is.
 *
 * Pure transport. It owns no batching, ordering, or retry — the sample buffer
 * does. Success is read from HTTP status alone: 2xx resolves (201 fresh, 200
 * idempotent replay), anything else throws so the buffer keeps the batch at the
 * head and retries it with the same `batchSeq` (the server dedupes — FR-RR-2).
 */
export const uploadBatch: UploadBatch = async (batch: SampleBatch): Promise<void> => {
  const response = await fetch(`/api/workouts/${batch.workoutId}/points`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ batchSeq: batch.batchSeq, samples: batch.samples }),
  })

  if (!response.ok) {
    throw new Error(`Batch upload failed (${response.status})`)
  }
}
