import { supabase } from '@/lib/supabase'

export type ActiveWorkout = {
  id: string
  started_at: string
  status: string
}

export type FinalizeResult = {
  workoutId: string
  distanceM: number | null
  durationS: number | null
  avgPaceSPerKm: number | null
  xpAwarded: number | null
  cellsClaimed: number | null
  cellsStolen: number | null
  cellsDefended: number | null
  questsCompleted: Array<{ questId: string; title: string | null; rewardXp: number }>
}

export async function startWorkout(): Promise<{ workoutId: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('workouts')
    .insert({ status: 'recording', source: 'mobile', user_id: user.id })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') throw new Error('You already have an active workout')
    throw new Error(error.message)
  }

  return { workoutId: data.id }
}

export async function discardWorkout(workoutId: string): Promise<void> {
  const { error } = await supabase
    .from('workouts')
    .update({ status: 'discarded' })
    .eq('id', workoutId)

  if (error) throw new Error(error.message)
}

export async function getActiveWorkout(): Promise<ActiveWorkout | null> {
  const { data, error } = await supabase
    .from('workouts')
    .select('id, started_at, status')
    .eq('status', 'recording')
    .maybeSingle()

  if (error) return null
  return data
}

export async function finalizeWorkout(workoutId: string): Promise<FinalizeResult> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
  const response = await fetch(`${supabaseUrl}/functions/v1/finalize-workout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ workoutId }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? `Finalization failed (${response.status})`)
  }

  return response.json() as Promise<FinalizeResult>
}
