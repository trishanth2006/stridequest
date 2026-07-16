import { createClient } from 'npm:@supabase/supabase-js@2'
import { captureCells } from '../_shared/capture.ts'
import type { CaptureRoutePoint } from '../_shared/types.ts'
import { evaluateQuestProgress, bestKmPaceSPerKm } from '../_shared/quests.ts'
import type { ActiveQuest, QuestWorkoutContext, QuestUpdate } from '../_shared/quests.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  // 1. Verify user JWT
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401 })
  }
  const token = authHeader.slice(7)

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  })

  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  // 2. Parse body
  let body: any
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  // --- Dynamic AI Coach ---
  if (body.requestType === 'coaching-cue') {
    const { pace, totalDistance, heartRate } = body
    const MISTRAL_API_KEY = Deno.env.get('MISTRAL_API_KEY')
    if (!MISTRAL_API_KEY) {
      return new Response(JSON.stringify({ error: 'Mistral API key not configured' }), { status: 500 })
    }

    const prompt = `You are a world-class running coach. Provide a short, 1-sentence motivational cue based on the user's current pace (${pace} min/km) and distance (${totalDistance} km)${heartRate ? ` and heart rate (${heartRate} bpm)` : ''}. Keep it under 10 words.`

    try {
      const mistralReq = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MISTRAL_API_KEY}`
        },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          messages: [{ role: 'system', content: prompt }]
        })
      })
      
      const mistralData = await mistralReq.json()
      const cue = mistralData.choices?.[0]?.message?.content?.replace(/["']/g, '') || "Keep up the great work!"
      return new Response(JSON.stringify({ cue }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    } catch (error) {
      console.error('[finalize-workout] Mistral API error:', error)
      return new Response(JSON.stringify({ cue: "Keep it up, you're doing great!" }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
  }

  // --- Finalize Workout Logic ---
  let workoutId: string
  let activeDurationS: number | null = null
  try {
    if (!body.workoutId || typeof body.workoutId !== 'string') throw new Error()
    workoutId = body.workoutId
    if (typeof body.activeDurationS === 'number' && Number.isFinite(body.activeDurationS) && body.activeDurationS >= 0) {
      activeDurationS = Math.floor(body.activeDurationS)
    }
  } catch {
    return new Response(JSON.stringify({ error: 'workoutId required' }), { status: 400 })
  }

  // 3. Verify ownership — explicit user_id check for defense in depth
  // (RLS already enforces this, but we check explicitly so the gate still
  // holds if RLS is ever inadvertently relaxed on this table)
  const { data: workout, error: workoutError } = await userClient
    .from('workouts')
    .select('id, status')
    .eq('id', workoutId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (workoutError || !workout) {
    return new Response(JSON.stringify({ error: 'Workout not found' }), { status: 404 })
  }

  if (workout.status !== 'recording') {
    return new Response(
      JSON.stringify({ error: `Workout is not active (status: ${workout.status})` }),
      { status: 409 }
    )
  }

  // 4. Fetch route points using service-role (bypass RLS for efficiency)
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const { data: rawPoints, error: pointsError } = await adminClient
    .from('route_points')
    .select('lat, lng, recorded_at, batch_seq, point_seq')
    .eq('workout_id', workoutId)
    .order('recorded_at')
    .order('batch_seq')
    .order('point_seq')

  if (pointsError) {
    return new Response(JSON.stringify({ error: 'Failed to fetch route points' }), { status: 500 })
  }

  // 5. Compute territory cells (same algorithm as web stop.ts)
  const points: CaptureRoutePoint[] = (rawPoints ?? []).map((p) => ({
    lat: p.lat,
    lng: p.lng,
    recordedAt: p.recorded_at,
    batchSeq: p.batch_seq,
    pointSeq: p.point_seq,
  }))
  let cellIds: string[]
  try {
    cellIds = captureCells(points)
  } catch (captureErr) {
    console.error('[finalize-workout] captureCells failed — marking workout failed', captureErr)
    await adminClient
      .from('workouts')
      .update({ status: 'failed' })
      .eq('id', workoutId)
    return new Response(
      JSON.stringify({ error: 'GPS data is corrupt and could not be processed' }),
      { status: 422 }
    )
  }

  // 5b. Snapshot previous owners of cells about to be captured (for push notifications).
  // Must run before the RPC so we read the pre-capture ownership state.
  let prevOwnerIds: string[] = []
  if (cellIds.length > 0) {
    const { data: ownerRows, error: ownerErr } = await adminClient
      .from('cell_ownership')
      .select('owner_user_id')
      .in('cell_id', cellIds)
      .neq('owner_user_id', user.id)
    if (ownerErr) {
      console.error('[finalize-workout] prev-owner snapshot failed', ownerErr)
    }
    prevOwnerIds = [...new Set((ownerRows ?? []).map((r: { owner_user_id: string }) => r.owner_user_id))]
  }

  // 6. Call finalize_workout RPC with service-role
  const { data: result, error: rpcError } = await adminClient.rpc('finalize_workout', {
    p_workout_id: workoutId,
    p_cell_ids: cellIds,
    p_user_id: user.id,
    p_active_duration_s: activeDurationS,
  })

  if (rpcError) {
    console.error('[finalize-workout] RPC error', rpcError)
    return new Response(JSON.stringify({ error: 'Finalization failed' }), { status: 500 })
  }

  const row = Array.isArray(result) ? result[0] : result

  // 6b. Push notification to previous owners whose cells were stolen (best-effort).
  if ((row.cells_stolen as number) > 0 && prevOwnerIds.length > 0) {
    try {
      const { data: tokenRows } = await adminClient
        .from('push_tokens')
        .select('token')
        .in('user_id', prevOwnerIds)
      const tokens = (tokenRows ?? []).map((r: { token: string }) => r.token)
      if (tokens.length > 0) {
        const stolenCount = row.cells_stolen as number
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
          },
          body: JSON.stringify(
            tokens.map((to: string) => ({
              to,
              title: '⚡ Territory Lost!',
              body:
                stolenCount === 1
                  ? 'Someone captured one of your territories. Get back out there!'
                  : `Someone captured ${stolenCount} of your territories. Get back out there!`,
              sound: 'default',
              data: { type: 'territory_lost', count: stolenCount },
            })),
          ),
        })
      }
    } catch (e) {
      console.error('[finalize-workout] push dispatch failed', e)
      // Best-effort: never fail the request over a push notification
    }
  }

  // 7. Quests (best-effort). The workout is already finalized and base XP awarded
  // atomically by the RPC above, so a quest failure must never fail the request:
  // the whole step is wrapped in try/catch and falls back to empty results.
  let questsCompleted: Array<{
    userQuestId: string
    questId: string
    title: string | null
    rewardBadgeIcon: string | null
    rewardBadgeLabel: string | null
    rewardXp: number
  }> = []
  let questXpAwarded = 0

  try {
    // Lazily top-up the user's active daily/weekly quests, then read them back.
    const { data: activeRows, error: ensureErr } = await adminClient.rpc(
      'ensure_active_quests',
      { p_user_id: user.id },
    )
    if (ensureErr) throw ensureErr

    // RPC columns are snake_case; numeric columns arrive as strings (Number()).
    const activeQuests: ActiveQuest[] = (activeRows ?? []).map(
      (q: Record<string, unknown>) => ({
        userQuestId: q.user_quest_id as string,
        questId: q.quest_id as string,
        slug: q.slug as string,
        title: q.title as string,
        description: q.description as string,
        type: q.type as ActiveQuest['type'],
        targetValue: Number(q.target_value) || 0,
        rewardXp: Number(q.reward_xp) || 0,
        durationType: q.duration_type as ActiveQuest['durationType'],
        rewardBadgeIcon: (q.reward_badge_icon as string | null) ?? null,
        rewardBadgeLabel: (q.reward_badge_label as string | null) ?? null,
        windowEndHour: q.window_end_hour === null ? null : Number(q.window_end_hour),
        status: q.status as ActiveQuest['status'],
        currentValue: Number(q.current_value) || 0,
        expiresAt: q.expires_at as string,
      }),
    )

    // Reuse the route points already fetched for capture — no extra query.
    const questPoints = (rawPoints ?? []).map((p) => ({
      lat: p.lat,
      lng: p.lng,
      timestamp: p.recorded_at,
    }))
    const bestKm = bestKmPaceSPerKm(questPoints)

    const context: QuestWorkoutContext = {
      distanceM: row.distance_m,
      durationS: row.duration_s,
      avgPaceSPerKm: row.avg_pace_s_per_km ?? null,
      bestKmPaceSPerKm: bestKm,
      cellsClaimed: row.cells_claimed,
      cellsStolen: row.cells_stolen,
      cellsDefended: row.cells_defended,
      completedAtHourUTC: new Date().getUTCHours(),
    }

    const updates: QuestUpdate[] = evaluateQuestProgress(context, activeQuests)

    if (updates.length > 0) {
      const { data: completedRows, error: applyErr } = await adminClient.rpc(
        'apply_quest_progress',
        { p_user_id: user.id, p_workout_id: workoutId, p_updates: updates },
      )
      if (applyErr) throw applyErr

      questsCompleted = (completedRows ?? []).map((r: Record<string, unknown>) => {
        const q = activeQuests.find((a) => a.userQuestId === (r.user_quest_id as string))
        return {
          userQuestId: r.user_quest_id as string,
          questId: r.quest_id as string,
          title: q?.title ?? null,
          rewardBadgeIcon: q?.rewardBadgeIcon ?? null,
          rewardBadgeLabel: q?.rewardBadgeLabel ?? null,
          rewardXp: Number(r.reward_xp) || 0,
        }
      })
      questXpAwarded = questsCompleted.reduce((sum, q) => sum + q.rewardXp, 0)
    }
  } catch (e) {
    console.error('[finalize-workout] quest step failed', e)
    questsCompleted = []
    questXpAwarded = 0
  }

  return new Response(
    JSON.stringify({
      workoutId: row.workout_id,
      distanceM: row.distance_m,
      durationS: row.duration_s,
      avgPaceSPerKm: row.avg_pace_s_per_km,
      xpAwarded: row.xp_awarded,
      cellsClaimed: row.cells_claimed,
      cellsStolen: row.cells_stolen,
      cellsDefended: row.cells_defended,
      questsCompleted,
      questXpAwarded,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
