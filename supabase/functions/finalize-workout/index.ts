import { createClient } from 'npm:@supabase/supabase-js@2'
import { captureCells } from '../_shared/capture.ts'
import type { CaptureRoutePoint } from '../_shared/types.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  // 1. Verify user JWT
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401 })
  }
  const token = authHeader.slice(7)

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  })

  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  // 2. Parse body
  let workoutId: string
  try {
    const body = await req.json() as { workoutId?: string }
    if (!body.workoutId || typeof body.workoutId !== 'string') throw new Error()
    workoutId = body.workoutId
  } catch {
    return new Response(JSON.stringify({ error: 'workoutId required' }), { status: 400 })
  }

  // 3. Verify ownership — explicit user_id check for defense in depth
  // (RLS already enforces this, but we check explicitly so the gate still
  // holds if RLS is ever inadvertently relaxed on this table)
  const { data: workout, error: workoutError } = await userClient
    .from('workouts')
    .select('id, status')
    .eq('id', workoutId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (workoutError || !workout) {
    return new Response(JSON.stringify({ error: 'Workout not found' }), { status: 404 })
  }

  if (workout.status !== 'recording') {
    return new Response(
      JSON.stringify({ error: `Workout is not active (status: ${workout.status})` }),
      { status: 409 }
    )
  }

  // 4. Fetch route points using service-role (bypass RLS for efficiency)
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const { data: rawPoints, error: pointsError } = await adminClient
    .from('route_points')
    .select('lat, lng, recorded_at, batch_seq, point_seq')
    .eq('workout_id', workoutId)
    .order('recorded_at')
    .order('batch_seq')
    .order('point_seq')

  if (pointsError) {
    return new Response(JSON.stringify({ error: 'Failed to fetch route points' }), { status: 500 })
  }

  // 5. Compute territory cells (same algorithm as web stop.ts)
  const points: CaptureRoutePoint[] = (rawPoints ?? []).map((p) => ({
    lat: p.lat,
    lng: p.lng,
    recordedAt: p.recorded_at,
    batchSeq: p.batch_seq,
    pointSeq: p.point_seq,
  }))
  const cellIds = captureCells(points)

  // 6. Call finalize_workout RPC with service-role
  const { data: result, error: rpcError } = await adminClient.rpc('finalize_workout', {
    p_workout_id: workoutId,
    p_cell_ids: cellIds,
    p_user_id: user.id,
  })

  if (rpcError) {
    console.error('[finalize-workout] RPC error', rpcError)
    return new Response(JSON.stringify({ error: 'Finalization failed' }), { status: 500 })
  }

  const row = Array.isArray(result) ? result[0] : result
  return new Response(
    JSON.stringify({
      workoutId: row.workout_id,
      distanceM: row.distance_m,
      durationS: row.duration_s,
      avgPaceSPerKm: row.avg_pace_s_per_km,
      xpAwarded: row.xp_awarded,
      cellsClaimed: row.cells_claimed,
      cellsStolen: row.cells_stolen,
      cellsDefended: row.cells_defended,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
