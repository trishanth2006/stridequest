/**
 * Server-only leaderboard data loader (02E-06).
 *
 * Leaderboards are inherently cross-user, but every relevant table except
 * `cell_ownership` is read-own under RLS (workouts / user_xp / xp_events /
 * profiles). The phase forbids migrations, RPCs and views, so the only way to
 * read across users is the service-role client, which bypasses RLS.
 *
 * SECURITY: like `infrastructure/supabase/service-role.ts`, this module MUST
 * NEVER be imported by a client component or any browser-reachable barrel. It is
 * imported only by the server component `app/(protected)/leaderboards/page.tsx`.
 * The service-role key lives in `SUPABASE_SERVICE_ROLE_KEY` (no NEXT_PUBLIC
 * prefix), so it can never be bundled to the browser. Only minimal columns are
 * read here; only aggregated rankings (rank/username/value) ever reach the client.
 *
 * This file does I/O only — all ranking logic stays in the pure
 * `services/leaderboards.ts` functions.
 */
import { createServiceRoleClient } from '@/infrastructure/supabase/service-role'
import { startOfIsoWeekUtc } from '@/features/leaderboards/services/leaderboards'
import type {
  LeaderboardUser,
  XpStanding,
  DistanceContribution,
  CellOwnership,
  WeeklyXpEvent,
} from '@/features/leaderboards/types'

export type LeaderboardData = {
  users: LeaderboardUser[]
  standings: XpStanding[]
  contributions: DistanceContribution[]
  cells: CellOwnership[]
  weeklyEvents: WeeklyXpEvent[]
}

/** Fetches the minimal cross-user rows needed to rank every leaderboard. */
export async function loadLeaderboardData(now: Date): Promise<LeaderboardData> {
  const supabase = createServiceRoleClient()
  const weekStartIso = startOfIsoWeekUtc(now).toISOString()

  const [profilesRes, xpRes, workoutsRes, cellsRes, eventsRes] = await Promise.all([
    supabase.from('profiles').select('id, username, created_at'),
    supabase.from('user_xp').select('user_id, total_xp, updated_at'),
    supabase
      .from('workouts')
      .select('user_id, distance_m, started_at')
      .eq('status', 'completed')
      .not('distance_m', 'is', null),
    supabase.from('cell_ownership').select('owner_user_id, updated_at'),
    supabase
      .from('xp_events')
      .select('user_id, xp_awarded, created_at')
      .gte('created_at', weekStartIso),
  ])

  for (const res of [profilesRes, xpRes, workoutsRes, cellsRes, eventsRes]) {
    if (res.error) throw new Error(res.error.message)
  }

  const users: LeaderboardUser[] = (profilesRes.data ?? []).map((row) => ({
    userId: row.id,
    username: row.username,
    createdAt: row.created_at,
  }))

  const standings: XpStanding[] = (xpRes.data ?? []).map((row) => ({
    userId: row.user_id,
    totalXp: row.total_xp,
    updatedAt: row.updated_at,
  }))

  const contributions: DistanceContribution[] = (workoutsRes.data ?? []).map((row) => ({
    userId: row.user_id,
    distanceM: row.distance_m ?? 0,
    startedAt: row.started_at,
  }))

  const cells: CellOwnership[] = (cellsRes.data ?? []).map((row) => ({
    ownerUserId: row.owner_user_id,
    updatedAt: row.updated_at,
  }))

  const weeklyEvents: WeeklyXpEvent[] = (eventsRes.data ?? []).map((row) => ({
    userId: row.user_id,
    xpAwarded: row.xp_awarded,
    createdAt: row.created_at,
  }))

  return { users, standings, contributions, cells, weeklyEvents }
}
