import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, TablesInsert } from '@/infrastructure/supabase/database.types'
import type { IngestBatchInput } from '@/features/running/schemas'

/** Outcome of an ingest attempt, mapped to HTTP by the route handler. */
export type IngestResult =
  | { status: 'ok'; inserted: number }
  | { status: 'forbidden' }
  | { status: 'error' }

// The per-sample idempotency grain (02B-07 migration). A replayed batch re-sends
// identical (workout_id, batch_seq, point_seq) tuples, which all conflict.
const ON_CONFLICT = 'workout_id,batch_seq,point_seq'

/**
 * Map a validated batch into `route_points` insert rows. `point_seq` is the
 * sample's index within its batch — the per-sample idempotency key (FR-RR-2).
 * `recorded_at` is the client clock (FR-RR-3) converted to ISO; `received_at` is
 * deliberately omitted so the column default (`now()`) stamps server time.
 * Pure and deterministic.
 */
export function buildRoutePointRows(
  workoutId: string,
  input: IngestBatchInput,
): TablesInsert<'route_points'>[] {
  return input.samples.map((sample, point_seq) => ({
    workout_id: workoutId,
    lat: sample.lat,
    lng: sample.lng,
    accuracy_m: sample.accuracy,
    altitude_m: sample.altitude ?? null,
    speed_mps: sample.speed ?? null,
    heading_deg: sample.heading ?? null,
    recorded_at: new Date(sample.recordedAt).toISOString(),
    batch_seq: input.batchSeq,
    point_seq,
  }))
}

/**
 * Append a batch to `route_points` (FR-RR-1/4 — never finalizes). Ownership is
 * enforced by the INSERT RLS policy: a non-owner or unknown workout raises
 * Postgres `42501`, mapped to `forbidden` (FR-RR-5 / NFR-Sec-1). Idempotency is
 * the DB's — `ON CONFLICT DO NOTHING` on the per-sample grain — so an identical
 * replay inserts nothing and still succeeds (FR-RR-2 / NFR-R-1).
 *
 * This relies on the client resending the same samples in the same order for a
 * given `batch_seq`; the sample buffer guarantees that by retrying the same batch.
 */
export async function ingestBatch(
  supabase: SupabaseClient<Database>,
  workoutId: string,
  input: IngestBatchInput,
): Promise<IngestResult> {
  const rows = buildRoutePointRows(workoutId, input)
  const { data, error } = await supabase
    .from('route_points')
    .upsert(rows, { onConflict: ON_CONFLICT, ignoreDuplicates: true })
    .select('id')

  if (error) {
    // 42501: RLS check failed (not owner / unknown workout). 23503: FK violation.
    if (error.code === '42501' || error.code === '23503') return { status: 'forbidden' }
    return { status: 'error' }
  }

  return { status: 'ok', inserted: data?.length ?? 0 }
}
