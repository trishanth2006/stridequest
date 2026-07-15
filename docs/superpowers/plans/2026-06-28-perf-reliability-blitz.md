# Performance & Reliability Blitz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate 8 confirmed bugs — a critical data leak, a silent crash leaving workouts stuck, a wall-clock duration miscalculation, unbounded GPS bridge flooding, two mobile render-performance regressions, a hardcoded developer camera, and a serial DB lock-contention loop.

**Architecture:** All 8 fixes are surgical: no new abstractions, no new screens, no schema redesign. DB changes land as two new migrations. The edge function gains a try/catch and an extra body parameter. Mobile hooks get throttle config, useMemo, and cache guards.

**Tech Stack:** Expo 52 / React Native 0.76 / @rnmapbox/maps, Deno edge functions, Supabase PostGIS, expo-location, TypeScript strict.

---

## File Map

| File | Change |
|------|--------|
| `supabase/migrations/20260628_add_workout_failed_status.sql` | **Create** — adds `'failed'` to workouts status constraint |
| `supabase/migrations/20260628_finalize_workout_v4.sql` | **Create** — new RPC: `p_active_duration_s` param + set-based CTE territory loop |
| `supabase/functions/finalize-workout/index.ts` | **Modify** — try/catch around captureCells; accept + forward `activeDurationS` |
| `apps/mobile/src/features/running/services/workout.ts` | **Modify** — `finalizeWorkout` accepts and sends `activeDurationS` |
| `apps/mobile/app/(protected)/record.tsx` | **Modify** — capture `elapsedSeconds` before stop; pass to `finalizeWorkout` |
| `apps/mobile/src/features/maps/services/territory.ts` | **Modify** — add `.eq('owner_user_id', userId)` filter via `getUser()` |
| `apps/mobile/src/features/running/hooks/useLocation.ts` | **Modify** — add `timeInterval: 2000, distanceInterval: 5` to `watchPositionAsync` |
| `apps/mobile/app/(protected)/(tabs)/territory.tsx` | **Modify** — `useMemo` for `heatmapPoints`; queryCache TTL guard in `loadData`; pass `userCenter` to MapView |
| `apps/mobile/src/features/maps/components/MapView.tsx` | **Modify** — remove hardcoded Camera; accept `initialCenter?: [number, number]` prop |

---

## Task 1: Add `'failed'` to workouts status constraint

**Files:**
- Create: `supabase/migrations/20260628_add_workout_failed_status.sql`

- [ ] **Step 1: Create the migration**

```sql
-- 20260628_add_workout_failed_status.sql
-- Allow finalize-workout edge function to mark a workout as 'failed' when
-- GPS data is corrupt and captureCells throws before the RPC can run.
ALTER TABLE public.workouts
  DROP CONSTRAINT workouts_status_check,
  ADD CONSTRAINT workouts_status_check
    CHECK (status IN ('recording', 'completed', 'discarded', 'failed'));
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Use `mcp__supabase__apply_migration` with the SQL above.

- [ ] **Step 3: Verify constraint**

Run via MCP `mcp__supabase__execute_sql`:
```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.workouts'::regclass
  AND conname = 'workouts_status_check';
```
Expected output contains `'recording', 'completed', 'discarded', 'failed'`.

---

## Task 2: `finalize_workout` v4 — active duration + set-based CTE

**Files:**
- Create: `supabase/migrations/20260628_finalize_workout_v4.sql`

This migration does two things at once (both touch the same function):
1. Adds `p_active_duration_s integer DEFAULT NULL` — uses client-provided active time instead of wall-clock when supplied.
2. Replaces the per-cell `FOREACH` loop with a single CTE that resolves actions, batch-inserts captures, and batch-upserts ownership in O(1) lock acquisitions.

- [ ] **Step 1: Create the migration file**

```sql
-- 20260628_finalize_workout_v4.sql
-- v4 changes vs v3:
--   1. p_active_duration_s: client supplies active (non-paused) duration so stored
--      duration_s and avg_pace_s_per_km reflect real running time, not wall-clock.
--   2. Serial FOREACH territory loop replaced with a single set-based CTE:
--      locks all existing cells at once (FOR UPDATE) then resolves claim/steal/defend
--      and batch-inserts territory_captures + batch-upserts cell_ownership in two
--      statements instead of 3×N individual statements.

CREATE OR REPLACE FUNCTION public.finalize_workout(
  p_workout_id        uuid,
  p_cell_ids          text[],
  p_user_id           uuid,
  p_active_duration_s integer DEFAULT NULL   -- nullable; falls back to wall-clock
)
RETURNS public.finalize_workout_result
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_workout       public.workouts%ROWTYPE;
  v_path          extensions.geography;
  v_point_count   integer;
  v_distance_m    integer;
  v_duration_s    integer;
  v_avg_pace      integer;

  v_claimed       integer := 0;
  v_stolen        integer := 0;
  v_defended      integer := 0;

  v_workout_xp    integer := 0;
  v_capture_xp    integer := 0;
  v_steal_xp      integer := 0;
  v_total_xp      integer := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'finalize_workout: p_user_id is required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_workout FROM public.workouts WHERE id = p_workout_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'finalize_workout: workout not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_workout.user_id <> p_user_id THEN
    RAISE EXCEPTION 'finalize_workout: not authorized' USING ERRCODE = '42501';
  END IF;

  -- Idempotent path (already completed).
  IF v_workout.status = 'completed' THEN
    SELECT
      count(*) FILTER (WHERE action = 'claim'),
      count(*) FILTER (WHERE action = 'steal'),
      count(*) FILTER (WHERE action = 'defend')
    INTO v_claimed, v_stolen, v_defended
    FROM public.territory_captures
    WHERE workout_id = p_workout_id;

    RETURN ROW(
      v_workout.id, v_workout.status, v_workout.distance_m, v_workout.duration_s,
      v_workout.avg_pace_s_per_km, v_workout.xp_awarded,
      v_claimed, v_stolen, v_defended
    )::public.finalize_workout_result;
  END IF;

  IF v_workout.status <> 'recording' THEN
    RAISE EXCEPTION 'finalize_workout: workout is not active (status=%)', v_workout.status
      USING ERRCODE = 'P0001';
  END IF;

  -- Build route geometry.
  SELECT
    extensions.st_setsrid(
      extensions.st_makeline(
        extensions.st_makepoint(rp.lng, rp.lat)
        ORDER BY rp.recorded_at, rp.batch_seq, rp.point_seq
      ),
      4326
    )::extensions.geography,
    count(*)
  INTO v_path, v_point_count
  FROM public.route_points rp
  WHERE rp.workout_id = p_workout_id;

  IF v_point_count >= 2 THEN
    v_distance_m := round(extensions.st_length(v_path))::integer;
  ELSE
    v_path := NULL;
    v_distance_m := 0;
  END IF;

  -- Duration: prefer client-supplied active time (excludes pauses); fall back to wall-clock.
  v_duration_s := COALESCE(
    p_active_duration_s,
    greatest(0, floor(extract(epoch FROM (now() - v_workout.started_at)))::integer)
  );

  IF v_distance_m > 0 THEN
    v_avg_pace := round(v_duration_s::numeric * 1000 / v_distance_m)::integer;
  ELSE
    v_avg_pace := NULL;
  END IF;

  UPDATE public.workouts
  SET status            = 'completed',
      ended_at          = now(),
      path              = v_path,
      distance_m        = v_distance_m,
      duration_s        = v_duration_s,
      avg_pace_s_per_km = v_avg_pace
  WHERE id = p_workout_id;

  -- ── Set-based territory CTE ───────────────────────────────────────────────
  -- Lock all existing cell_ownership rows in one shot, resolve actions, then
  -- batch-insert captures and batch-upsert ownership — replacing the serial
  -- FOREACH loop that acquired one lock per cell and ran 3×N statements.
  WITH
  input AS (
    SELECT unnest(coalesce(p_cell_ids, ARRAY[]::text[])) AS cell_id
  ),
  locked_owners AS (
    SELECT co.cell_id, co.owner_user_id
    FROM public.cell_ownership co
    WHERE co.cell_id = ANY(coalesce(p_cell_ids, ARRAY[]::text[]))
    FOR UPDATE
  ),
  resolved AS (
    SELECT
      i.cell_id,
      CASE
        WHEN lo.owner_user_id IS NULL     THEN 'claim'
        WHEN lo.owner_user_id = p_user_id THEN 'defend'
        ELSE                                   'steal'
      END AS action
    FROM input i
    LEFT JOIN locked_owners lo ON lo.cell_id = i.cell_id
  ),
  capture_insert AS (
    INSERT INTO public.territory_captures (workout_id, user_id, cell_id, action)
    SELECT p_workout_id, p_user_id, cell_id, action FROM resolved
    RETURNING cell_id
  ),
  ownership_upsert AS (
    INSERT INTO public.cell_ownership (cell_id, owner_user_id, owned_since_workout_id, updated_at)
    SELECT cell_id, p_user_id, p_workout_id, now()
    FROM resolved
    WHERE action IN ('claim', 'steal')
    ON CONFLICT (cell_id) DO UPDATE
      SET owner_user_id          = excluded.owner_user_id,
          owned_since_workout_id = excluded.owned_since_workout_id,
          updated_at             = excluded.updated_at
  )
  SELECT
    count(*) FILTER (WHERE action = 'claim'),
    count(*) FILTER (WHERE action = 'steal'),
    count(*) FILTER (WHERE action = 'defend')
  INTO v_claimed, v_stolen, v_defended
  FROM resolved;
  -- ── End CTE ───────────────────────────────────────────────────────────────

  v_workout_xp := 25 + (floor(greatest(v_distance_m, 0)::numeric / 1000) * 5)::integer;
  v_capture_xp := v_claimed * 10;
  v_steal_xp   := v_stolen  * 25;
  v_total_xp   := v_workout_xp + v_capture_xp + v_steal_xp;

  UPDATE public.workouts SET xp_awarded = v_total_xp WHERE id = p_workout_id;

  IF v_workout_xp > 0 THEN
    INSERT INTO public.xp_events (user_id, workout_id, event_type, xp_awarded)
    VALUES (p_user_id, p_workout_id, 'workout', v_workout_xp);
  END IF;

  IF v_capture_xp > 0 THEN
    INSERT INTO public.xp_events (user_id, workout_id, event_type, xp_awarded)
    VALUES (p_user_id, p_workout_id, 'capture', v_capture_xp);
  END IF;

  IF v_steal_xp > 0 THEN
    INSERT INTO public.xp_events (user_id, workout_id, event_type, xp_awarded)
    VALUES (p_user_id, p_workout_id, 'steal', v_steal_xp);
  END IF;

  INSERT INTO public.user_xp (user_id, total_xp, level, updated_at)
  VALUES (p_user_id, v_total_xp, public.xp_level(v_total_xp), now())
  ON CONFLICT (user_id) DO UPDATE
    SET total_xp   = public.user_xp.total_xp + excluded.total_xp,
        level      = public.xp_level(public.user_xp.total_xp + excluded.total_xp),
        updated_at = excluded.updated_at;

  RETURN ROW(
    p_workout_id, 'completed', v_distance_m, v_duration_s, v_avg_pace,
    v_total_xp, v_claimed, v_stolen, v_defended
  )::public.finalize_workout_result;
END;
$$;

-- Permissions unchanged: service_role only.
REVOKE EXECUTE ON FUNCTION public.finalize_workout(uuid, text[], uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finalize_workout(uuid, text[], uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.finalize_workout(uuid, text[], uuid, integer) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.finalize_workout(uuid, text[], uuid, integer) TO service_role;
```

- [ ] **Step 2: Apply the migration via MCP**

Use `mcp__supabase__apply_migration` with the full SQL from Step 1.

- [ ] **Step 3: Verify the new function signature**

Run via `mcp__supabase__execute_sql`:
```sql
SELECT pg_get_function_arguments(oid)
FROM pg_proc
WHERE proname = 'finalize_workout'
  AND pronamespace = 'public'::regnamespace;
```
Expected: `p_workout_id uuid, p_cell_ids text[], p_user_id uuid, p_active_duration_s integer`

---

## Task 3: Edge function — error handling + activeDurationS

**Files:**
- Modify: `supabase/functions/finalize-workout/index.ts`

- [ ] **Step 1: Replace index.ts with the fixed version**

Full replacement of `supabase/functions/finalize-workout/index.ts`:

```typescript
import { createClient } from 'npm:@supabase/supabase-js@2'
import { captureCells } from '../_shared/capture.ts'
import type { CaptureRoutePoint } from '../_shared/types.ts'
import { evaluateQuestProgress, bestKmPaceSPerKm } from '../_shared/quests.ts'
import type { ActiveQuest, QuestWorkoutContext, QuestUpdate } from '../_shared/quests.ts'

const SUPABASE_URL             = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY        = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

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

  let workoutId: string
  let activeDurationS: number | null = null
  try {
    const body = await req.json() as { workoutId?: string; activeDurationS?: number }
    if (!body.workoutId || typeof body.workoutId !== 'string') throw new Error()
    workoutId = body.workoutId
    if (typeof body.activeDurationS === 'number' && body.activeDurationS >= 0) {
      activeDurationS = Math.floor(body.activeDurationS)
    }
  } catch {
    return new Response(JSON.stringify({ error: 'workoutId required' }), { status: 400 })
  }

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

  // Compute territory cells. If GPS data is corrupt (invalid coordinates or H3
  // cells), catch the error, mark the workout 'failed' so the state machine
  // doesn't hang, and return a descriptive error to the client.
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

  const { data: result, error: rpcError } = await adminClient.rpc('finalize_workout', {
    p_workout_id:        workoutId,
    p_cell_ids:          cellIds,
    p_user_id:           user.id,
    p_active_duration_s: activeDurationS,
  })

  if (rpcError) {
    console.error('[finalize-workout] RPC error', rpcError)
    return new Response(JSON.stringify({ error: 'Finalization failed' }), { status: 500 })
  }

  const row = Array.isArray(result) ? result[0] : result

  // Quests — best-effort; a failure must never roll back the finalized workout.
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
    const { data: activeRows, error: ensureErr } = await adminClient.rpc(
      'ensure_active_quests',
      { p_user_id: user.id },
    )
    if (ensureErr) throw ensureErr

    const activeQuests: ActiveQuest[] = (activeRows ?? []).map(
      (q: Record<string, unknown>) => ({
        userQuestId:      q.user_quest_id as string,
        questId:          q.quest_id as string,
        slug:             q.slug as string,
        title:            q.title as string,
        description:      q.description as string,
        type:             q.type as ActiveQuest['type'],
        targetValue:      Number(q.target_value) || 0,
        rewardXp:         Number(q.reward_xp) || 0,
        durationType:     q.duration_type as ActiveQuest['durationType'],
        rewardBadgeIcon:  (q.reward_badge_icon as string | null) ?? null,
        rewardBadgeLabel: (q.reward_badge_label as string | null) ?? null,
        windowEndHour:    q.window_end_hour === null ? null : Number(q.window_end_hour),
        status:           q.status as ActiveQuest['status'],
        currentValue:     Number(q.current_value) || 0,
        expiresAt:        q.expires_at as string,
      }),
    )

    const questPoints = (rawPoints ?? []).map((p) => ({
      lat:       p.lat,
      lng:       p.lng,
      timestamp: p.recorded_at,
    }))
    const bestKm = bestKmPaceSPerKm(questPoints)

    const context: QuestWorkoutContext = {
      distanceM:           row.distance_m,
      durationS:           row.duration_s,
      avgPaceSPerKm:       row.avg_pace_s_per_km ?? null,
      bestKmPaceSPerKm:    bestKm,
      cellsClaimed:        row.cells_claimed,
      cellsStolen:         row.cells_stolen,
      cellsDefended:       row.cells_defended,
      completedAtHourUTC:  new Date().getUTCHours(),
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
          userQuestId:      r.user_quest_id as string,
          questId:          r.quest_id as string,
          title:            q?.title ?? null,
          rewardBadgeIcon:  q?.rewardBadgeIcon ?? null,
          rewardBadgeLabel: q?.rewardBadgeLabel ?? null,
          rewardXp:         Number(r.reward_xp) || 0,
        }
      })
      questXpAwarded = questsCompleted.reduce((sum, q) => sum + q.rewardXp, 0)
    }
  } catch (e) {
    console.error('[finalize-workout] quest step failed', e)
    questsCompleted = []
    questXpAwarded  = 0
  }

  return new Response(
    JSON.stringify({
      workoutId:      row.workout_id,
      distanceM:      row.distance_m,
      durationS:      row.duration_s,
      avgPaceSPerKm:  row.avg_pace_s_per_km,
      xpAwarded:      row.xp_awarded,
      cellsClaimed:   row.cells_claimed,
      cellsStolen:    row.cells_stolen,
      cellsDefended:  row.cells_defended,
      questsCompleted,
      questXpAwarded,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
```

- [ ] **Step 2: Confirm changes compile (Deno check)**

```bash
cd supabase/functions
deno check finalize-workout/index.ts
```
Expected: no errors.

---

## Task 4: Mobile workout service — forward activeDurationS

**Files:**
- Modify: `apps/mobile/src/features/running/services/workout.ts`
- Modify: `apps/mobile/app/(protected)/record.tsx`

- [ ] **Step 1: Update `finalizeWorkout` signature in workout.ts**

In `apps/mobile/src/features/running/services/workout.ts`, change:

```typescript
// OLD
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
  // ...
}
```

New signature and body:

```typescript
export async function finalizeWorkout(
  workoutId: string,
  activeDurationS: number,
): Promise<FinalizeResult> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
  const response = await fetch(`${supabaseUrl}/functions/v1/finalize-workout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ workoutId, activeDurationS }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? `Finalization failed (${response.status})`)
  }

  return response.json() as Promise<FinalizeResult>
}
```

- [ ] **Step 2: Update record.tsx to pass elapsedSeconds**

In `apps/mobile/app/(protected)/record.tsx`, update `handleStop`:

```typescript
// OLD
const handleStop = useCallback(async () => {
  if (!recorder.workoutId) return
  const id = recorder.workoutId
  await recorder.stop()
  try {
    const result = await finalizeWorkout(id)
    setFinalization(result)
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to save run')
  }
}, [recorder])
```

New version (capture `elapsedSeconds` before stop, since stop() is async and clears the timer):

```typescript
const handleStop = useCallback(async () => {
  if (!recorder.workoutId) return
  const id = recorder.workoutId
  const activeDurationS = recorder.elapsedSeconds  // capture before stop clears timer
  await recorder.stop()
  try {
    const result = await finalizeWorkout(id, activeDurationS)
    setFinalization(result)
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to save run')
  }
}, [recorder])
```

- [ ] **Step 3: Typecheck mobile**

```bash
cd apps/mobile && npm run typecheck
```
Expected: 0 errors.

---

## Task 5: Territory service — add owner filter

**Files:**
- Modify: `apps/mobile/src/features/maps/services/territory.ts`

- [ ] **Step 1: Replace the file content**

```typescript
import { supabase } from '@/lib/supabase'
import { cellsToFeatureCollection } from '@stridequest/shared/territory'
import type { TerritoryCollection, TerritoryFetchOptions } from '../types'

const EMPTY: TerritoryCollection = { type: 'FeatureCollection', features: [] }

export async function fetchTerritory(options: TerritoryFetchOptions): Promise<TerritoryCollection> {
  if (options.scope === 'me') {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return EMPTY

    const { data, error } = await supabase
      .from('cell_ownership')
      .select('cell_id')
      .eq('owner_user_id', user.id)
      .limit(5000)

    if (error || !data) return EMPTY
    const cellIds = (data as { cell_id: string }[]).map((row) => row.cell_id)
    return cellsToFeatureCollection(cellIds) as TerritoryCollection
  }

  return EMPTY
}
```

- [ ] **Step 2: Write a unit test**

Create `apps/mobile/tests/unit/maps/fetchTerritory.test.ts`:

```typescript
import { fetchTerritory } from '@/features/maps/services/territory'

// Minimal supabase mock
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'user-123' } },
      }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({
        data: [{ cell_id: '8928308280fffff' }],
        error: null,
      }),
    }),
  },
}))

jest.mock('@stridequest/shared/territory', () => ({
  cellsToFeatureCollection: (ids: string[]) => ({
    type: 'FeatureCollection',
    features: ids.map((id) => ({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[]] },
      properties: { cellId: id },
    })),
  }),
}))

describe('fetchTerritory', () => {
  it('passes owner_user_id filter to cell_ownership query', async () => {
    const { supabase } = jest.requireMock('@/lib/supabase') as {
      supabase: { from: jest.Mock }
    }
    await fetchTerritory({ scope: 'me' })
    const eqCalls = (supabase.from('cell_ownership').select('cell_id').eq as jest.Mock).mock.calls
    expect(eqCalls).toContainEqual(['owner_user_id', 'user-123'])
  })

  it('returns empty collection when unauthenticated', async () => {
    const { supabase } = jest.requireMock('@/lib/supabase') as {
      supabase: { auth: { getUser: jest.Mock } }
    }
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: null } })
    const result = await fetchTerritory({ scope: 'me' })
    expect(result.features).toHaveLength(0)
  })
})
```

- [ ] **Step 3: Run the test**

```bash
cd apps/mobile && npx jest tests/unit/maps/fetchTerritory.test.ts --no-coverage
```
Expected: 2 passing.

---

## Task 6: GPS throttle

**Files:**
- Modify: `apps/mobile/src/features/running/hooks/useLocation.ts`

- [ ] **Step 1: Add timeInterval and distanceInterval**

In `useLocation.ts`, change the `watchPositionAsync` call:

```typescript
// OLD
subscriptionRef.current = await Location.watchPositionAsync(
  { accuracy: Location.Accuracy.BestForNavigation },
  (location) => { ... }
)
```

```typescript
// NEW
subscriptionRef.current = await Location.watchPositionAsync(
  {
    accuracy:         Location.Accuracy.BestForNavigation,
    timeInterval:     2000,   // at most one update per 2 s
    distanceInterval: 5,      // at most one update per 5 m of movement
  },
  (location) => { ... }
)
```

No other changes to the file. The callback body is unchanged.

- [ ] **Step 2: Typecheck**

```bash
cd apps/mobile && npm run typecheck 2>&1 | grep useLocation
```
Expected: no output (no errors on this file).

---

## Task 7: Territory screen — useMemo + queryCache + dynamic camera

**Files:**
- Modify: `apps/mobile/app/(protected)/(tabs)/territory.tsx`

Three sub-fixes in one screen file:
- **7A** — wrap `heatmapPoints` in `useMemo`
- **7B** — wire `queryCache` into `loadData` with 60 s TTL; invalidate on post-run navigation
- **7C** — resolve user's last known location and pass as `initialCenter` to `MapView`

- [ ] **Step 1: Update the imports block**

At the top of `territory.tsx`, the current imports are:
```typescript
import { useEffect, useState, useRef, useCallback } from 'react'
import { ... } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

import { fetchTerritory } from '@/features/maps/services/territory'
import { MapView } from '@/features/maps/components/MapView'
import { TerritoryLayer } from '@/features/maps/components/TerritoryLayer'
import { HeatmapLayer } from '@/features/maps/components/HeatmapLayer'
import { loadTerritoryStats, getUserHeatmap } from '@/features/maps/services/heatmap'
import type { TerritoryCollection } from '@/features/maps/types'
import type { TerritoryStats, HeatmapCell } from '@/features/maps/services/heatmap'
import { colors, withAlpha } from '@/theme'
```

Replace with:
```typescript
import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { ... } from 'react-native'  // unchanged
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Location from 'expo-location'

import { fetchTerritory } from '@/features/maps/services/territory'
import { MapView } from '@/features/maps/components/MapView'
import { TerritoryLayer } from '@/features/maps/components/TerritoryLayer'
import { HeatmapLayer } from '@/features/maps/components/HeatmapLayer'
import { loadTerritoryStats, getUserHeatmap } from '@/features/maps/services/heatmap'
import type { TerritoryCollection } from '@/features/maps/types'
import type { TerritoryStats, HeatmapCell } from '@/features/maps/services/heatmap'
import { colors, withAlpha } from '@/theme'
import { queryGet, querySet } from '@/lib/queryCache'
```

- [ ] **Step 2: Add state + constants inside the component**

After `const [sheetExpanded, setSheetExpanded] = useState(false)` add:

```typescript
const [userCenter, setUserCenter] = useState<[number, number] | null>(null)
```

And add the cache TTL constant before the component (above the `EMPTY` const):

```typescript
const TERRITORY_CACHE_KEY = 'territory-screen'
const TERRITORY_CACHE_TTL = 60_000 // 60 s
```

- [ ] **Step 3: Get last-known location on mount**

Add this `useEffect` after the existing animation `useEffect`:

```typescript
useEffect(() => {
  Location.getLastKnownPositionAsync({ maxAge: 300_000, requiredAccuracy: 3000 })
    .then((loc) => {
      if (loc) setUserCenter([loc.coords.longitude, loc.coords.latitude])
    })
    .catch(() => {})
}, [])
```

- [ ] **Step 4: Wire queryCache into loadData**

Replace the existing `loadData` callback:

```typescript
// OLD
const loadData = useCallback(() => {
  setLoading(true)
  void (async () => {
    const [territory, territoryStats, cells] = await Promise.all([
      fetchTerritory({ scope: 'me' }),
      loadTerritoryStats(),
      getUserHeatmap(),
    ])
    setPolygons(territory)
    setStats(territoryStats)
    setHeatmapCells(cells)
    setLoading(false)
  })()
}, [])
```

```typescript
// NEW
const loadData = useCallback(() => {
  const cached = queryGet<{
    territory: TerritoryCollection
    stats: TerritoryStats
    cells: HeatmapCell[]
  }>(TERRITORY_CACHE_KEY, TERRITORY_CACHE_TTL)

  if (cached) {
    setPolygons(cached.territory)
    setStats(cached.stats)
    setHeatmapCells(cached.cells)
    setLoading(false)
    return
  }

  setLoading(true)
  void (async () => {
    const [territory, stats, cells] = await Promise.all([
      fetchTerritory({ scope: 'me' }),
      loadTerritoryStats(),
      getUserHeatmap(),
    ])
    querySet(TERRITORY_CACHE_KEY, { territory, stats, cells })
    setPolygons(territory)
    setStats(stats)
    setHeatmapCells(cells)
    setLoading(false)
  })()
}, [])
```

- [ ] **Step 5: Memoize heatmapPoints**

Replace the unmemoized inline computation:

```typescript
// OLD (in render body, before return)
const heatmapPoints = heatmapCells.slice(0, 500).map((cell) => {
  const coords = tryGetCellCenter(cell.cellId)
  return { cellId: cell.cellId, lat: coords.lat, lng: coords.lng, captures: cell.captures }
})
```

```typescript
// NEW — stable reference; only recomputes when heatmapCells changes
const heatmapPoints = useMemo(
  () =>
    heatmapCells.slice(0, 500).map((cell) => {
      const coords = tryGetCellCenter(cell.cellId)
      return { cellId: cell.cellId, lat: coords.lat, lng: coords.lng, captures: cell.captures }
    }),
  [heatmapCells],
)
```

- [ ] **Step 6: Pass userCenter to MapView**

Find the `<MapView style={{ flex: 1 }}>` element and update:

```tsx
// OLD
<MapView style={{ flex: 1 }}>

// NEW
<MapView style={{ flex: 1 }} initialCenter={userCenter ?? undefined}>
```

- [ ] **Step 7: Typecheck**

```bash
cd apps/mobile && npm run typecheck 2>&1 | grep territory
```
Expected: no output.

---

## Task 8: MapView — accept initialCenter prop, remove hardcoded Camera

**Files:**
- Modify: `apps/mobile/src/features/maps/components/MapView.tsx`

- [ ] **Step 1: Replace MapView.tsx**

Full file replacement:

```typescript
import { View, StyleSheet } from 'react-native'

type MapboxGLType = typeof import('@rnmapbox/maps')['default']
let MapboxGL: MapboxGLType | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  MapboxGL = (require('@rnmapbox/maps') as { default: MapboxGLType }).default
  console.log('[Mapbox Init] EXPO_PUBLIC_MAPBOX_TOKEN defined:', !!process.env.EXPO_PUBLIC_MAPBOX_TOKEN)
  console.log('[Mapbox Init] MapboxGL loaded successfully (Native Build)')
} catch (error) {
  console.error('[Mapbox Init] Error loading MapboxGL (Likely Expo Go):', error)
}

type Props = {
  style?: object
  children?: React.ReactNode
  interactive?: boolean
  /** Initial camera center [lng, lat]. When omitted, no Camera is set and
   *  Mapbox uses its default viewport; TerritoryLayer overrides with bounds
   *  once territory exists. */
  initialCenter?: [number, number]
}

export function MapView({ style, children, interactive = true, initialCenter }: Props) {
  if (!MapboxGL) {
    return <View style={[styles.fill, style as object]} />
  }
  return (
    <MapboxGL.MapView
      style={style ?? styles.fill}
      styleURL={MapboxGL.StyleURL.Dark}
      scrollEnabled={interactive}
      zoomEnabled={interactive}
      pitchEnabled={interactive}
      rotateEnabled={interactive}
    >
      {initialCenter && (
        <MapboxGL.Camera centerCoordinate={initialCenter} zoomLevel={12} />
      )}
      {children}
    </MapboxGL.MapView>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
})
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/mobile && npm run typecheck 2>&1 | grep MapView
```
Expected: no output.

---

## Task 9: Full typecheck pass

- [ ] **Step 1: Run full mobile typecheck**

```bash
cd apps/mobile && npm run typecheck
```
Expected: 0 errors. Fix any that arise before declaring done.

- [ ] **Step 2: Run mobile unit tests**

```bash
cd apps/mobile && npx jest tests/unit --no-coverage
```
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add \
  supabase/migrations/20260628_add_workout_failed_status.sql \
  supabase/migrations/20260628_finalize_workout_v4.sql \
  supabase/functions/finalize-workout/index.ts \
  apps/mobile/src/features/running/services/workout.ts \
  apps/mobile/app/(protected)/record.tsx \
  apps/mobile/src/features/maps/services/territory.ts \
  apps/mobile/src/features/running/hooks/useLocation.ts \
  apps/mobile/app/(protected)/(tabs)/territory.tsx \
  apps/mobile/src/features/maps/components/MapView.tsx \
  apps/mobile/tests/unit/maps/fetchTerritory.test.ts
git commit -m "perf(mobile+db): performance & reliability blitz — 8 fixes

- Block 1: fetchTerritory scoped to owner_user_id (data leak fix)
- Block 2a: finalize-workout edge fn catches captureCells errors, marks workout 'failed'
- Block 2b: finalize_workout v4 uses client active duration, not wall-clock
- Block 3a: useLocation throttled to 2s/5m (bridge flood fix)
- Block 3b: territory heatmapPoints memoized; loadData wired to queryCache (60s TTL)
- Block 3c: MapView initialCenter prop replaces hardcoded Hyderabad camera
- Block 4: finalize_workout v4 CTE replaces serial per-cell lock loop

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|---|---|
| Block 1 — owner filter on territory.ts | Task 5 |
| Block 2A — captureCells error handling, 'failed' status | Tasks 1 + 3 |
| Block 2B — active duration instead of wall-clock | Tasks 2 + 4 |
| Block 3A — GPS throttle timeInterval/distanceInterval | Task 6 |
| Block 3B-A — heatmapPoints useMemo | Task 7 |
| Block 3B-B — queryCache TTL in loadData | Task 7 |
| Block 3C — MapView dynamic camera | Tasks 7 + 8 |
| Block 4 — CTE territory loop | Task 2 |

All 8 requirements covered. No placeholders detected.
