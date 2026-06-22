import { supabase } from '@/lib/supabase'
import type { RoutePoint } from '../types'

export async function fetchRoutePoints(workoutId: string): Promise<RoutePoint[]> {
  const { data, error } = await supabase
    .from('route_points')
    .select('lat, lng')
    .eq('workout_id', workoutId)
    .order('recorded_at', { ascending: true })
    .order('batch_seq', { ascending: true })
    .order('point_seq', { ascending: true })

  if (error || !data) return []
  return data as RoutePoint[]
}
