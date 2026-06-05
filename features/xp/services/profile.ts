import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/infrastructure/supabase/database.types'
import type { UserXp, XpEvent, XpEventType } from '@/features/xp/types'
import { getLevelFromXP } from '@/features/xp/services/xp'

/**
 * Read-side XP profile service (02E-01). Pure query logic over an injected
 * client (same DI pattern as the other services); read-only, RLS-scoped to the
 * caller. XP is written exclusively by the finalize_workout RPC.
 */

const XP_EVENT_TYPES: readonly XpEventType[] = ['workout', 'capture', 'steal']

function toXpEventType(value: string): XpEventType {
  if ((XP_EVENT_TYPES as readonly string[]).includes(value)) return value as XpEventType
  throw new Error(`Unknown xp event type: ${value}`)
}

/**
 * The user's cumulative XP. Returns a zeroed level-1 record when the user has
 * earned no XP yet (no `user_xp` row exists until their first finalize).
 */
export async function getUserXP(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<UserXp> {
  const { data, error } = await supabase
    .from('user_xp')
    .select('user_id, total_xp, level, updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) {
    return { userId, totalXp: 0, level: 1, updatedAt: new Date(0).toISOString() }
  }
  return {
    userId: data.user_id,
    totalXp: data.total_xp,
    level: data.level,
    updatedAt: data.updated_at,
  }
}

/** The user's current level, derived from total XP via the MVP formula. */
export async function getUserLevel(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<number> {
  const { totalXp } = await getUserXP(supabase, userId)
  return getLevelFromXP(totalXp)
}

/** The user's most recent XP events, newest first (RLS-scoped to the owner). */
export async function getRecentXPEvents(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit = 10,
): Promise<XpEvent[]> {
  const { data, error } = await supabase
    .from('xp_events')
    .select('id, user_id, workout_id, event_type, xp_awarded, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    workoutId: row.workout_id,
    eventType: toXpEventType(row.event_type),
    xpAwarded: row.xp_awarded,
    createdAt: row.created_at,
  }))
}
