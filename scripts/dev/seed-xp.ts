import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { seedLeaderboardUsers } from './seed-leaderboards'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

if (process.env.NODE_ENV !== 'development') {
  console.error('Error: Refusing to run. NODE_ENV must be set to "development".')
  process.exit(1)
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
})

async function seed() {
  console.log('Starting XP & Achievements seed...')

  // 1. Get first available user
  const { data: users, error: userError } = await supabase
    .from('profiles')
    .select('id')
    .limit(1)

  if (userError || !users || users.length === 0) {
    console.warn('No real users found; skipping primary-user achievement seed.')
    return
  }

  const userId = users[0].id
  console.log(`Seeding data for user ${userId}`)

  // 2. Clean up previous seed data for idempotency
  // Delete all xp_events for this user
  await supabase.from('xp_events').delete().eq('user_id', userId)
  // Delete all captures for this user
  await supabase.from('territory_captures').delete().eq('user_id', userId)
  // Delete seed workouts
  await supabase.from('workouts').delete().eq('user_id', userId).eq('source', 'seed-xp')

  console.log('Cleared previous seed data.')

  // 3. Define 10 workouts to satisfy achievements & records
  // We want to generate:
  // - Total workouts = 10 (Unlocks First Run, Runner)
  // - Total distance = 55.5 km (Unlocks Marathoner, keeps Distance Beast locked at 55.5%)
  // - Total captures = 44 (keeps Explorer locked at 88% - Almost There!)
  // - Total XP = 875 (Unlocks XP Hunter, XP Master, Rising Star, keeps Elite Runner locked at Level 4 / 5 - Almost There!)
  // - PRs:
  //   - Fastest 1K: Workout 5 (pace 200s/km)
  //   - Fastest 5K: Workout 5 (pace 200s/km)
  //   - Fastest 10K: Workout 5 (pace 200s/km)
  //   - Longest Run: Workout 5 (12 km)
  //   - Most XP Workout: Workout 6 (250 XP)
  //   - Most Territory Workout: Workout 7 (15 captures)
  //   - Most Efficient Run: Workout 6 (125 XP/km)
  //   - Territory Efficiency: Workout 7 (5 captures/km)
  const workoutsToSeed = [
    { distance_m: 1500, duration_s: 360, xp: 30, captures: 1 }, // Workout 1
    { distance_m: 2000, duration_s: 600, xp: 35, captures: 0 }, // Workout 2
    { distance_m: 5500, duration_s: 1650, xp: 50, captures: 2 }, // Workout 3
    { distance_m: 10500, duration_s: 2940, xp: 75, captures: 4 }, // Workout 4
    { distance_m: 12000, duration_s: 2400, xp: 120, captures: 5 }, // Workout 5 (Fastest, Longest)
    { distance_m: 2000, duration_s: 500, xp: 250, captures: 8 }, // Workout 6 (Most XP, Most Efficient)
    { distance_m: 3000, duration_s: 900, xp: 150, captures: 15 }, // Workout 7 (Most Territory, Territory Efficient)
    { distance_m: 8000, duration_s: 2400, xp: 60, captures: 2 }, // Workout 8
    { distance_m: 6000, duration_s: 1800, xp: 55, captures: 3 }, // Workout 9
    { distance_m: 5000, duration_s: 1500, xp: 50, captures: 4 }, // Workout 10
  ]

  const createdWorkouts = []
  const createdEvents = []
  const createdCaptures = []

  for (let i = 0; i < workoutsToSeed.length; i++) {
    const w = workoutsToSeed[i]
    const date = new Date(Date.now() - (10 - i) * 86400000) // Spaced 1 day apart
    const pace = w.duration_s / (w.distance_m / 1000)

    const { data: dbWorkout, error: wError } = await supabase
      .from('workouts')
      .insert({
        user_id: userId,
        status: 'completed',
        source: 'seed-xp',
        distance_m: w.distance_m,
        duration_s: w.duration_s,
        avg_pace_s_per_km: pace,
        xp_awarded: w.xp,
        started_at: date.toISOString(),
        ended_at: new Date(date.getTime() + w.duration_s * 1000).toISOString(),
        path: null,
      })
      .select('id, started_at')
      .single()

    if (wError || !dbWorkout) {
      console.error(`Error creating workout ${i + 1}:`, wError?.message)
      process.exit(1)
    }

    createdWorkouts.push(dbWorkout)
    console.log(`Created workout ${i + 1}: ID ${dbWorkout.id}, Distance ${w.distance_m}m`)

    // Create XP Event for this workout
    createdEvents.push({
      user_id: userId,
      workout_id: dbWorkout.id,
      event_type: 'workout',
      xp_awarded: w.xp,
      created_at: date.toISOString()
    })

    // Create territory captures for this workout
    for (let c = 0; c < w.captures; c++) {
      createdCaptures.push({
        user_id: userId,
        workout_id: dbWorkout.id,
        cell_id: `seed_cell_${i}_${c}`,
        action: c % 2 === 0 ? 'claim' : 'steal',
        captured_at: date.toISOString()
      })
    }
  }

  // Insert XP Events
  const { error: eError } = await supabase.from('xp_events').insert(createdEvents)
  if (eError) {
    console.error('Error inserting XP events:', eError.message)
    process.exit(1)
  }
  console.log('XP Events seeded.')

  // Insert Captures
  if (createdCaptures.length > 0) {
    const { error: cError } = await supabase.from('territory_captures').insert(createdCaptures)
    if (cError) {
      console.error('Error inserting captures:', cError.message)
      process.exit(1)
    }
    console.log(`${createdCaptures.length} Territory Captures seeded.`)
  }

  // Update user_xp
  const totalXp = workoutsToSeed.reduce((sum, w) => sum + w.xp, 0)
  // 875 XP corresponds to Level 4 (Level 4 threshold is 500, Level 5 is 1000)
  const level = 4

  const { error: uError } = await supabase
    .from('user_xp')
    .upsert({
      user_id: userId,
      total_xp: totalXp,
      level: level,
      updated_at: new Date().toISOString()
    })

  if (uError) {
    console.error('Error upserting user_xp:', uError.message)
    process.exit(1)
  }

  console.log(`Updated user_xp: Total XP ${totalXp}, Level ${level}`)
  console.log('Seed completed successfully! You can now test achievements and personal records.')
}

async function main(): Promise<void> {
  await seed()
  // 02E-06: seed competitor users so every leaderboard has a distinct leader.
  await seedLeaderboardUsers(supabase)
  console.log('\nAll seeding complete.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
