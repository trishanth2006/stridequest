'use server'

import { createClient } from '@/infrastructure/supabase/server'
import { stopWorkoutSchema } from '@/features/running/schemas'
import { finalizeWorkout } from '@/features/running/services/finalize'
import type { WorkoutActionResult } from '@/features/running/types'

// FR-WL-3: stop the caller's own active workout. Ownership is enforced twice:
// once by RLS on the preflight SELECT (a non-owner's row is invisible), and
// again inside the finalize RPC's auth.uid() check. Idempotency: stopping an
// already-completed workout is a no-op success (the RPC returns the stored
// record without recomputing). 02C-02 replaces the 02A stub with a real call
// to the finalize_workout RPC which computes distance/duration/pace from
// route_points and writes the canonical LINESTRING.
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
  const supabase = await createClient()

  // Preflight: verify the workout exists and is visible to the caller (RLS
  // scopes this to owner). This catches the not-found / not-owned case with a
  // user-friendly message before hitting the RPC.
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

  // Idempotent shortcut: stopping an already-completed workout still calls the
  // RPC (which returns the stored record) so the caller always gets metrics.
  // But for a discarded workout the RPC would raise, so we gate above.

  try {
    const metrics = await finalizeWorkout(supabase, workoutId)
    return { status: 'success', workoutId, metrics }
  } catch {
    return { status: 'error', error: 'Could not stop workout. Please try again.' }
  }
}
