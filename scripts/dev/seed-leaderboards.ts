/**
 * 02E-06 dev seed: competitor users so every leaderboard has a distinct leader.
 *
 * Each persona dominates exactly one category (XP / territory / distance /
 * weekly). Users are created via the admin API so the handle_new_user trigger
 * builds their profile (username is required). Imported and run by seed-xp.ts,
 * which enforces NODE_ENV=development and owns the service-role client.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

type Persona = {
  username: string
  email: string
  totalXp: number
  level: number
  // Completed workouts (distance + historical XP), spaced by `daysAgo`.
  workouts: { distanceM: number; xp: number; daysAgo: number }[]
  cells: number
  weeklyXp: number // XP earned "today" (current ISO week) for the weekly board
}

const PERSONAS: Persona[] = [
  {
    username: 'xp_titan',
    email: 'xp_titan@seed.local',
    totalXp: 2400,
    level: 5,
    workouts: [
      { distanceM: 8000, xp: 200, daysAgo: 20 },
      { distanceM: 6000, xp: 150, daysAgo: 18 },
      { distanceM: 9000, xp: 220, daysAgo: 15 },
    ],
    cells: 12,
    weeklyXp: 120,
  },
  {
    username: 'land_baron',
    email: 'land_baron@seed.local',
    totalXp: 600,
    level: 4,
    workouts: [
      { distanceM: 4000, xp: 90, daysAgo: 16 },
      { distanceM: 5000, xp: 110, daysAgo: 12 },
    ],
    cells: 70,
    weeklyXp: 80,
  },
  {
    username: 'mile_crusher',
    email: 'mile_crusher@seed.local',
    totalXp: 1200,
    level: 5,
    workouts: [
      { distanceM: 21000, xp: 130, daysAgo: 22 },
      { distanceM: 30000, xp: 170, daysAgo: 14 },
      { distanceM: 44000, xp: 245, daysAgo: 9 },
    ],
    cells: 5,
    weeklyXp: 60,
  },
  {
    username: 'week_warrior',
    email: 'week_warrior@seed.local',
    totalXp: 900,
    level: 4,
    workouts: [
      { distanceM: 7000, xp: 80, daysAgo: 10 },
      { distanceM: 6500, xp: 75, daysAgo: 6 },
    ],
    cells: 8,
    weeklyXp: 900,
  },
]

const DAY_MS = 86400000

/** Finds a persona's user by username, or creates it via the admin API. */
async function ensureUser(supabase: SupabaseClient, persona: Persona): Promise<string> {
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', persona.username)
    .maybeSingle()

  if (existing) return existing.id as string

  const { data, error } = await supabase.auth.admin.createUser({
    email: persona.email,
    password: 'seed-password-123',
    email_confirm: true,
    user_metadata: { username: persona.username },
  })

  if (error || !data.user) {
    throw new Error(`Failed to create ${persona.username}: ${error?.message}`)
  }
  return data.user.id
}

async function seedPersona(supabase: SupabaseClient, persona: Persona): Promise<void> {
  const userId = await ensureUser(supabase, persona)

  // Idempotent cleanup (cell_ownership before workouts: its FK has no cascade).
  await supabase.from('cell_ownership').delete().eq('owner_user_id', userId)
  await supabase.from('xp_events').delete().eq('user_id', userId)
  await supabase.from('territory_captures').delete().eq('user_id', userId)
  await supabase.from('workouts').delete().eq('user_id', userId).eq('source', 'seed-xp')

  // Workouts + a 'workout' XP event each (dated historically).
  let firstWorkoutId: string | null = null
  for (const w of persona.workouts) {
    const date = new Date(Date.now() - w.daysAgo * DAY_MS)
    const pace = 250 + (w.daysAgo % 60)
    const { data: row, error } = await supabase
      .from('workouts')
      .insert({
        user_id: userId,
        status: 'completed',
        source: 'seed-xp',
        distance_m: w.distanceM,
        duration_s: Math.round((w.distanceM / 1000) * pace),
        avg_pace_s_per_km: pace,
        xp_awarded: w.xp,
        started_at: date.toISOString(),
        ended_at: new Date(date.getTime() + 1800000).toISOString(),
        path: null,
      })
      .select('id')
      .single()

    if (error || !row) throw new Error(`workout insert failed: ${error?.message}`)
    if (!firstWorkoutId) firstWorkoutId = row.id as string

    await supabase.from('xp_events').insert({
      user_id: userId,
      workout_id: row.id,
      event_type: 'workout',
      xp_awarded: w.xp,
      created_at: date.toISOString(),
    })
  }

  // Owned cells (territory board) reference the persona's first workout.
  if (persona.cells > 0 && firstWorkoutId) {
    const cellRows = Array.from({ length: persona.cells }, (_, i) => ({
      cell_id: `seed_lb_${persona.username}_${i}`,
      owner_user_id: userId,
      owned_since_workout_id: firstWorkoutId,
      updated_at: new Date(Date.now() - 5 * DAY_MS + i * 1000).toISOString(),
    }))
    const { error } = await supabase.from('cell_ownership').upsert(cellRows)
    if (error) throw new Error(`cell_ownership upsert failed: ${error.message}`)
  }

  // Current-week XP event (weekly board) dated a few hours ago.
  if (persona.weeklyXp > 0) {
    await supabase.from('xp_events').insert({
      user_id: userId,
      workout_id: firstWorkoutId,
      event_type: 'capture',
      xp_awarded: persona.weeklyXp,
      created_at: new Date(Date.now() - 3 * 3600000).toISOString(),
    })
  }

  await supabase.from('user_xp').upsert({
    user_id: userId,
    total_xp: persona.totalXp,
    level: persona.level,
    updated_at: new Date().toISOString(),
  })

  console.log(
    `Seeded ${persona.username}: ${persona.totalXp} XP, ${persona.cells} cells, ${persona.weeklyXp} weekly XP`,
  )
}

/** Seeds all leaderboard competitor personas (idempotent). */
export async function seedLeaderboardUsers(supabase: SupabaseClient): Promise<void> {
  console.log('\nSeeding leaderboard competitor users...')
  for (const persona of PERSONAS) {
    await seedPersona(supabase, persona)
  }
  console.log('Leaderboard users seeded.')
}
