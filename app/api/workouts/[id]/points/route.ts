import { z } from 'zod'
import { createClient } from '@/infrastructure/supabase/server'
import { ingestBatchSchema } from '@/features/running/schemas'
import { ingestBatch } from '@/features/running/services/ingest'

// POST /api/workouts/[id]/points — idempotent GPS batch ingest (02B-07, FR-RR).
// Thin transport layer: validate, authenticate, delegate to the ingest service
// (logic lives in features/running per CLAUDE.md), map the result to HTTP. It
// only appends to route_points; it never finalizes (FR-RR-4).

const workoutIdSchema = z.string().uuid()

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params
  if (!workoutIdSchema.safeParse(id).success) {
    return Response.json({ ok: false, error: 'invalid_workout_id' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const parsed = ingestBatchSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ ok: false, error: 'validation' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const result = await ingestBatch(supabase, id, parsed.data)
  switch (result.status) {
    case 'ok':
      return Response.json({ ok: true, inserted: result.inserted }, { status: result.inserted > 0 ? 201 : 200 })
    case 'forbidden':
      return Response.json({ ok: false, error: 'forbidden' }, { status: 403 })
    default:
      return Response.json({ ok: false, error: 'ingest_failed' }, { status: 500 })
  }
}
