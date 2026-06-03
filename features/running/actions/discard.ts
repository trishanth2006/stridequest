'use server'

import { createClient } from '@/infrastructure/supabase/server'
import { discardWorkoutSchema } from '@/features/running/schemas'
import type { WorkoutActionResult } from '@/features/running/types'

// FR-WL-4: discard the caller's own active workout. No finalize: no metrics,
// no XP, no territory capture — only status flips to `discarded`. Ownership is
// enforced by RLS (a non-owner's row is invisible to the fetch).
export async function discardWorkout(
  _prevState: WorkoutActionResult,
  formData: FormData
): Promise<WorkoutActionResult> {
  const parsed = discardWorkoutSchema.safeParse({
    workoutId: (formData.get('workoutId') ?? '') as string,
  })

  if (!parsed.success) {
    return { status: 'error', error: parsed.error.issues[0].message }
  }

  const { workoutId } = parsed.data
  const supabase = await createClient()

  const { data: workout, error: fetchError } = await supabase
    .from('workouts')
    .select('id, status')
    .eq('id', workoutId)
    .maybeSingle()

  if (fetchError) {
    return { status: 'error', error: 'Could not discard workout. Please try again.' }
  }

  if (!workout) {
    return { status: 'error', error: 'Workout not found' }
  }

  // Idempotent: discarding an already-discarded workout is a no-op success.
  if (workout.status === 'discarded') {
    return { status: 'success', workoutId }
  }

  // Only an active (recording) workout can be discarded; a completed run cannot.
  if (workout.status !== 'recording') {
    return { status: 'error', error: 'Only an active workout can be discarded' }
  }

  const { error: updateError } = await supabase
    .from('workouts')
    .update({ status: 'discarded' })
    .eq('id', workoutId)

  if (updateError) {
    return { status: 'error', error: 'Could not discard workout. Please try again.' }
  }

  return { status: 'success', workoutId }
}
