'use server'

import { createClient } from '@/infrastructure/supabase/server'
import type { WorkoutActionResult } from '@/features/running/types'

// FR-WL-1 / FR-WL-2: create exactly one recording workout for the caller. start
// takes no client input (server sets user_id/status/started_at/source), so it is
// zero-arg; `useActionState` accepts it. The `workouts_one_active_per_user`
// partial-unique index enforces "at most one active workout"; a violation
// surfaces as Postgres error code 23505.
export async function startWorkout(): Promise<WorkoutActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: 'error', error: 'You must be signed in to start a workout' }
  }

  const { data, error } = await supabase
    .from('workouts')
    .insert({ user_id: user.id })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { status: 'error', error: 'You already have an active workout' }
    }
    return { status: 'error', error: 'Could not start workout. Please try again.' }
  }

  return { status: 'success', workoutId: data.id }
}
