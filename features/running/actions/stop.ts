'use server'

import { createClient } from '@/infrastructure/supabase/server'
import { createServiceRoleClient } from '@/infrastructure/supabase/service-role'
import { stopWorkoutSchema } from '@/features/running/schemas'
import { finalizeWorkout } from '@/features/running/services/finalize'
import { captureCells } from '@/features/territory/capture'
import type { CaptureRoutePoint } from '@/features/territory/capture'
import type { WorkoutActionResult } from '@/features/running/types'

// FR-WL-3: stop the caller's own active workout.
//
// Updated in 02D-05 (trust boundary ADR Option A):
// Ownership is now enforced at three layers:
//   1. RLS on the preflight SELECT (a non-owner's row is invisible).
//   2. `getUser()` identity verification via the user-scoped client (JWT validated
//      server-side, not trusting the client claim).
//   3. Inside the finalize RPC's `p_user_id <> workouts.user_id` check (service-role
//      call; auth.uid() is null for service-role, so we pass the verified uid).
//
// The service-role client is used ONLY to invoke the finalize RPC. Identity is
// always established via the user-scoped client first. The service-role key is
// a server-side secret (no NEXT_PUBLIC_ prefix); it never appears in the browser
// bundle.
//
// Flow:
//   1. Parse workoutId from FormData.
//   2. user-scoped client: getUser() to verify JWT identity.
//   3. user-scoped client: preflight SELECT (RLS scopes to owner).
//   4. service-role client: fetch route_points for the workout.
//   5. captureCells(points) — pure TS, no DB.
//   6. service-role client: call finalize_workout RPC with cellIds + userId.
export async function stopWorkout(
  _prevState: WorkoutActionResult,
  formData: FormData
): Promise<WorkoutActionResult> {
  const parsed = stopWorkoutSchema.safeParse({
    workoutId: (formData.get('workoutId') ?? '') as string,
  })

  if (!parsed.success) {
    return { status: 'error', error: parsed.error.issues[0].message }
  }

  const { workoutId } = parsed.data

  // Step 2: verify caller identity from the JWT (user-scoped client).
  // getUser() validates the token server-side via Supabase Auth — not trusting
  // the access token claim directly. This is the canonical identity source for
  // the service-role RPC call below.
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { status: 'error', error: 'Not authenticated' }
  }

  // Step 3: preflight — verify the workout exists and is visible to the caller
  // (RLS scopes this to owner). Catches not-found / not-owned with a user-
  // friendly message before hitting the RPC.
  const { data: workout, error: fetchError } = await supabase
    .from('workouts')
    .select('id, status')
    .eq('id', workoutId)
    .maybeSingle()

  if (fetchError) {
    return { status: 'error', error: 'Could not stop workout. Please try again.' }
  }

  if (!workout) {
    return { status: 'error', error: 'Workout not found' }
  }

  // Cannot finalize a discarded workout.
  if (workout.status === 'discarded') {
    return { status: 'error', error: 'Workout is not active' }
  }

  // Switch to the service-role client for privileged operations.
  // The caller's identity is already locked in as user.id (verified above).
  const adminSupabase = createServiceRoleClient()

  try {
    // Step 4: fetch route points. Service-role bypasses RLS; the workout is
    // already confirmed to belong to user.id via the preflight SELECT above.
    const { data: rawPoints, error: pointsError } = await adminSupabase
      .from('route_points')
      .select('lat, lng, recorded_at, batch_seq, point_seq')
      .eq('workout_id', workoutId)
      .order('recorded_at')
      .order('batch_seq')
      .order('point_seq')

    if (pointsError) {
      return { status: 'error', error: 'Could not stop workout. Please try again.' }
    }

    // Step 5: derive the canonical cell set. captureCells re-sorts internally
    // (determinism guarantee from 02D-04), so the SQL ORDER BY above is
    // belt-and-suspenders for clarity only.
    const points: CaptureRoutePoint[] = (rawPoints ?? []).map((p) => ({
      lat: p.lat,
      lng: p.lng,
      recordedAt: p.recorded_at,
      batchSeq: p.batch_seq,
      pointSeq: p.point_seq,
    }))

    const cellIds = captureCells(points)

    // Step 6: invoke the v2 RPC via the service-role client.
    // The finalize_workout RPC has EXECUTE granted only to service_role (02D-05
    // migration). authenticated cannot reach it via PostgREST.
    const metrics = await finalizeWorkout(adminSupabase, workoutId, cellIds, user.id)
    return { status: 'success', workoutId, metrics }
  } catch {
    return { status: 'error', error: 'Could not stop workout. Please try again.' }
  }
}
