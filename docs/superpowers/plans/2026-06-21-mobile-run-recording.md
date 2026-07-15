# Mobile Run Recording — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring Start / Pause / Resume / Stop / Discard run recording to the StrideQuest mobile app, backed by the same Supabase database and RPC as the web, with finalization handled by a secure Edge Function.

**Architecture:** Mobile uses only the publishable (anon) Supabase key with RLS. GPS is captured via expo-location. Route points are inserted directly into Supabase. A Deno Edge Function handles the privileged finalize_workout RPC call (service-role key never leaves the backend). Sample-filter and sample-buffer pure logic moves to @stridequest/shared so web and mobile share one implementation.

**Tech Stack:** expo-location, @react-native-async-storage/async-storage (already installed), @stridequest/shared (local package), Supabase JS v2, Supabase Edge Functions (Deno), h3-js (npm: in Deno)

---

## File Map

**Known tech-debt (see Task 15):** The `captureCells` implementation is duplicated between `packages/shared/src/territory/` and `supabase/functions/_shared/`. They are identical today, but will drift. A follow-up task tracks unification.

**New files:**
```
packages/shared/src/running/sample-filter.ts
packages/shared/src/running/sample-buffer.ts
supabase/functions/_shared/types.ts
supabase/functions/_shared/grid.ts
supabase/functions/_shared/capture.ts
supabase/functions/finalize-workout/index.ts
apps/mobile/src/features/running/hooks/useLocation.ts
apps/mobile/src/features/running/hooks/useWorkoutRecorder.ts
apps/mobile/src/features/running/services/workout.ts
apps/mobile/app/(protected)/record.tsx
apps/mobile/tests/unit/running/workout-service.test.ts
apps/mobile/tests/unit/running/use-location.test.ts
apps/mobile/tests/unit/running/use-workout-recorder.test.ts
apps/mobile/tests/unit/running/recovery.test.ts
```

**Modified files:**
```
packages/shared/src/running/types.ts            — add GpsSample type
packages/shared/src/running/index.ts            — export new additions
features/running/types.ts                        — import GpsSample from shared
features/running/services/sample-filter.ts       — re-export shim → shared
features/running/services/sample-buffer.ts       — re-export shim → shared
apps/mobile/.env                                 — remove service-role key
apps/mobile/app.json                             — add location permissions
apps/mobile/app/(protected)/_layout.tsx          — add recovery check
apps/mobile/app/(protected)/(tabs)/run/index.tsx — add Start Run button
```

---

## Task 1: Remove service-role key from mobile .env

**Files:**
- Modify: `apps/mobile/.env`

- [ ] **Step 1: Confirm nothing uses the key in mobile code**

```bash
grep -r "SERVICE_ROLE" apps/mobile/src apps/mobile/app
```

Expected: no matches (confirmed: `apps/mobile/src/lib/supabase.ts` uses only `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)

- [ ] **Step 2: Remove the key**

In `apps/mobile/.env`, delete the line:
```
EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

The file should retain only:
```
EXPO_NEXT_PUBLIC_MAPBOX_TOKEN=...
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/.env
git commit -m "security: remove service-role key from mobile env"
```

---

## Task 2: Add GpsSample to shared running types

**Files:**
- Modify: `packages/shared/src/running/types.ts`

The `GpsSample` type is used by sample-filter and sample-buffer, both moving to shared. Add it here so those modules import it locally.

- [ ] **Step 1: Update `packages/shared/src/running/types.ts`**

```typescript
/**
 * A geographic coordinate in WGS84 degrees.
 */
export type LatLng = {
  lat: number
  lng: number
}

/**
 * A raw GPS sample captured client-side. `recordedAt` is epoch milliseconds
 * from the client clock; the server stamps its own `received_at` on ingest.
 */
export type GpsSample = LatLng & {
  accuracy: number
  recordedAt: number
  altitude?: number
  speed?: number
  heading?: number
}
```

- [ ] **Step 2: Export GpsSample from `packages/shared/src/running/index.ts`**

```typescript
export * from './types'
export * from './distance'
export * from './formatters'
```

(No change needed — `types` export already covers `LatLng`; adding `GpsSample` to `types.ts` automatically exports it.)

- [ ] **Step 3: Update `features/running/types.ts` to import GpsSample from shared**

```typescript
import type { Tables } from '@/infrastructure/supabase/database.types'
import type { LatLng } from '@stridequest/shared/running'

export type { LatLng }

/**
 * Re-exported from @stridequest/shared — the canonical type shared by web and mobile.
 */
export type { GpsSample } from '@stridequest/shared/running'

export type WorkoutStatus = 'recording' | 'completed' | 'discarded'

export type Workout = Tables<'workouts'>

export type FinalizeResult = {
  workoutId: string
  status: string
  distanceM: number | null
  durationS: number | null
  avgPaceSPerKm: number | null
  xpAwarded: number | null
  cellsClaimed: number | null
  cellsStolen: number | null
  cellsDefended: number | null
}

export type WorkoutActionResult =
  | { status: 'idle' }
  | { status: 'success'; workoutId: string; metrics?: FinalizeResult }
  | { status: 'error'; error: string }
```

- [ ] **Step 4: Run web typecheck to confirm no breakage**

```bash
npm run typecheck
```

Expected: passes with 0 errors

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/running/types.ts features/running/types.ts
git commit -m "feat(shared): add GpsSample to shared running types"
```

---

## Task 3: Move sample-filter to shared package

**Files:**
- Create: `packages/shared/src/running/sample-filter.ts`
- Modify: `features/running/services/sample-filter.ts` (becomes re-export shim)

- [ ] **Step 1: Create `packages/shared/src/running/sample-filter.ts`**

```typescript
import type { GpsSample } from './types'
import { haversineMeters } from './distance'

export type SampleFilterConfig = {
  accuracyMaxM: number
  minDistanceM: number
  maxSpeedMps: number
}

export const DEFAULT_SAMPLE_FILTER_CONFIG: SampleFilterConfig = {
  accuracyMaxM: 30,
  minDistanceM: 5,
  maxSpeedMps: 12.5,
}

export function filterSamples(
  samples: readonly GpsSample[],
  config: SampleFilterConfig = DEFAULT_SAMPLE_FILTER_CONFIG,
): GpsSample[] {
  const accepted: GpsSample[] = []
  let anchor: GpsSample | null = null

  for (const sample of samples) {
    if (sample.accuracy > config.accuracyMaxM) continue

    if (anchor !== null) {
      const distance = haversineMeters(anchor, sample)
      if (distance < config.minDistanceM) continue

      const dtSeconds = (sample.recordedAt - anchor.recordedAt) / 1000
      if (dtSeconds <= 0) continue
      if (distance / dtSeconds > config.maxSpeedMps) continue
    }

    accepted.push(sample)
    anchor = sample
  }

  return accepted
}
```

- [ ] **Step 2: Export from `packages/shared/src/running/index.ts`**

```typescript
export * from './types'
export * from './distance'
export * from './formatters'
export * from './sample-filter'
```

- [ ] **Step 3: Make `features/running/services/sample-filter.ts` a re-export shim**

```typescript
/**
 * Re-export shim — sample filter now lives in @stridequest/shared/running
 * so web and mobile share one implementation. New code should import from
 * '@stridequest/shared/running'.
 */
export {
  filterSamples,
  DEFAULT_SAMPLE_FILTER_CONFIG,
} from '@stridequest/shared/running'
export type { SampleFilterConfig } from '@stridequest/shared/running'
```

- [ ] **Step 4: Run existing sample-filter tests to confirm they still pass**

```bash
npx jest tests/unit/features/running/services/sample-filter.test.ts --no-coverage
```

Expected: all tests PASS (tests import from `@/features/running/services/sample-filter` which now re-exports from shared — same public API)

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/running/sample-filter.ts packages/shared/src/running/index.ts features/running/services/sample-filter.ts
git commit -m "feat(shared): move sample-filter to @stridequest/shared"
```

---

## Task 4: Move sample-buffer to shared package

**Files:**
- Create: `packages/shared/src/running/sample-buffer.ts`
- Modify: `features/running/services/sample-buffer.ts` (becomes re-export shim)

- [ ] **Step 1: Create `packages/shared/src/running/sample-buffer.ts`**

```typescript
import type { GpsSample } from './types'

export type SampleBatch = {
  workoutId: string
  batchSeq: number
  samples: GpsSample[]
}

export type SampleBufferConfig = {
  flushSize: number
  flushIntervalMs: number
}

export const DEFAULT_SAMPLE_BUFFER_CONFIG: SampleBufferConfig = {
  flushSize: 60,
  flushIntervalMs: 10_000,
}

export type UploadBatch = (batch: SampleBatch) => Promise<void>

export type SampleBuffer = {
  add(sample: GpsSample): void
  flush(): Promise<void>
  stop(): Promise<void>
  readonly pendingCount: number
  readonly queuedBatches: number
}

export function createSampleBuffer(
  workoutId: string,
  upload: UploadBatch,
  config: Partial<SampleBufferConfig> = {},
): SampleBuffer {
  const { flushSize, flushIntervalMs } = { ...DEFAULT_SAMPLE_BUFFER_CONFIG, ...config }

  let pending: GpsSample[] = []
  const queue: SampleBatch[] = []
  let batchSeq = 0
  let draining = false
  let drainPromise: Promise<void> = Promise.resolve()

  function cut(): void {
    if (pending.length === 0) return
    queue.push({ workoutId, batchSeq: batchSeq++, samples: pending })
    pending = []
  }

  async function runDrain(): Promise<void> {
    draining = true
    try {
      while (queue.length > 0) {
        await upload(queue[0])
        queue.shift()
      }
    } catch {
      // Leave the failed batch at the head; next tick/flush/stop retries it.
    } finally {
      draining = false
    }
  }

  function kickDrain(): Promise<void> {
    if (!draining) drainPromise = runDrain()
    return drainPromise
  }

  const handle: ReturnType<typeof setInterval> = setInterval(() => {
    cut()
    void kickDrain()
  }, flushIntervalMs)

  return {
    add(sample: GpsSample): void {
      pending.push(sample)
      if (pending.length >= flushSize) {
        cut()
        void kickDrain()
      }
    },
    flush(): Promise<void> {
      cut()
      return kickDrain()
    },
    async stop(): Promise<void> {
      clearInterval(handle)
      cut()
      kickDrain()
      await drainPromise
    },
    get pendingCount(): number {
      return pending.length
    },
    get queuedBatches(): number {
      return queue.length
    },
  }
}
```

- [ ] **Step 2: Export from `packages/shared/src/running/index.ts`**

```typescript
export * from './types'
export * from './distance'
export * from './formatters'
export * from './sample-filter'
export * from './sample-buffer'
```

- [ ] **Step 3: Make `features/running/services/sample-buffer.ts` a re-export shim**

```typescript
/**
 * Re-export shim — sample buffer now lives in @stridequest/shared/running.
 * New code should import from '@stridequest/shared/running'.
 */
export {
  createSampleBuffer,
  DEFAULT_SAMPLE_BUFFER_CONFIG,
} from '@stridequest/shared/running'
export type {
  SampleBatch,
  SampleBufferConfig,
  UploadBatch,
  SampleBuffer,
} from '@stridequest/shared/running'
```

- [ ] **Step 4: Run existing sample-buffer tests to confirm they still pass**

```bash
npx jest tests/unit/features/running/services/sample-buffer.test.ts --no-coverage
```

Expected: all tests PASS

- [ ] **Step 5: Run full unit test suite and typecheck**

```bash
npx jest tests/unit --no-coverage && npm run typecheck
```

Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/running/sample-buffer.ts packages/shared/src/running/index.ts features/running/services/sample-buffer.ts
git commit -m "feat(shared): move sample-buffer engine to @stridequest/shared"
```

---

## Task 5: Install expo-location and update app.json

**Files:**
- Modify: `apps/mobile/app.json`
- Modify: `apps/mobile/package.json` (via expo install)

- [ ] **Step 1: Install expo-location**

```bash
cd apps/mobile && npx expo install expo-location
```

Expected: `expo-location` added to `apps/mobile/package.json` dependencies

- [ ] **Step 2: Update `apps/mobile/app.json` to add location permissions**

Replace the `"ios"` and `"android"` sections:

```json
{
  "expo": {
    "name": "StrideQuest",
    "slug": "stridequest",
    "version": "0.0.1",
    "scheme": "stridequest",
    "orientation": "portrait",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.stridequest.app",
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "StrideQuest needs your location to track your run."
      }
    },
    "android": {
      "package": "com.stridequest.app",
      "adaptiveIcon": {
        "backgroundColor": "#0b0b0f"
      },
      "permissions": ["ACCESS_FINE_LOCATION"]
    },
    "plugins": [
      "expo-router",
      "expo-asset",
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "StrideQuest needs your location to track your run."
        }
      ]
    ],
    "experiments": {
      "typedRoutes": true,
      "tsconfigPaths": true
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/package.json apps/mobile/package-lock.json apps/mobile/app.json
git commit -m "feat(mobile): install expo-location and add location permissions"
```

---

## Task 6: Create Edge Function shared territory files

**Files:**
- Create: `supabase/functions/_shared/types.ts`
- Create: `supabase/functions/_shared/grid.ts`
- Create: `supabase/functions/_shared/capture.ts`

These are Deno-compatible copies of the shared territory code. Deno cannot consume `@stridequest/shared` (a local npm package), so the Edge Function imports from `_shared/` instead. The algorithm is identical; only the import style differs (`npm:h3-js` for Deno).

- [ ] **Step 1: Create `supabase/functions/_shared/types.ts`**

```typescript
export type LatLng = { lat: number; lng: number }
export type CellId = string

export type CaptureRoutePoint = {
  lat: number
  lng: number
  recordedAt: string   // ISO-8601 — from DB recorded_at column
  batchSeq: number
  pointSeq: number
}
```

- [ ] **Step 2: Create `supabase/functions/_shared/grid.ts`**

```typescript
// deno-lint-ignore-file no-explicit-any
import { latLngToCell, gridPathCells, isValidCell } from 'npm:h3-js'
import type { LatLng, CellId } from './types.ts'

export const H3_RESOLUTION = 9

function assertValidCoordinate(point: LatLng): void {
  const { lat, lng } = point
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error(`Invalid coordinate: ${JSON.stringify(point)}`)
  }
}

function gridLine(from: CellId, to: CellId): CellId[] {
  try {
    return gridPathCells(from, to) as CellId[]
  } catch {
    return [from, to]
  }
}

export function pathToCells(path: readonly LatLng[]): CellId[] {
  if (path.length === 0) return []
  for (const point of path) assertValidCoordinate(point)
  const cells: CellId[] = []
  let previous: CellId | null = null
  for (const point of path) {
    const cell = latLngToCell(point.lat, point.lng, H3_RESOLUTION) as CellId
    if (previous === null) {
      cells.push(cell)
    } else if (cell !== previous) {
      const line = gridLine(previous, cell)
      for (let i = 1; i < line.length; i++) cells.push(line[i])
    }
    previous = cell
  }
  return cells
}

export function normalizeCellIds(cells: readonly CellId[]): CellId[] {
  const canonical = cells.map((c) => c.trim().toLowerCase())
  for (const cell of canonical) {
    if (!isValidCell(cell)) throw new Error(`Invalid H3 cell id: ${cell}`)
  }
  return Array.from(new Set(canonical)).sort()
}
```

- [ ] **Step 3: Create `supabase/functions/_shared/capture.ts`**

```typescript
import type { CaptureRoutePoint, CellId } from './types.ts'
import { pathToCells, normalizeCellIds } from './grid.ts'

function compareRoutePoints(a: CaptureRoutePoint, b: CaptureRoutePoint): number {
  if (a.recordedAt < b.recordedAt) return -1
  if (a.recordedAt > b.recordedAt) return 1
  if (a.batchSeq !== b.batchSeq) return a.batchSeq - b.batchSeq
  return a.pointSeq - b.pointSeq
}

export function captureCells(points: readonly CaptureRoutePoint[]): CellId[] {
  if (points.length === 0) return []
  const ordered = [...points].sort(compareRoutePoints)
  const path = ordered.map((p) => ({ lat: p.lat, lng: p.lng }))
  return normalizeCellIds(pathToCells(path))
}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/_shared/
git commit -m "feat(edge-fn): add shared territory capture for Deno environment"
```

---

## Task 7: Create Edge Function finalize-workout

**Files:**
- Create: `supabase/functions/finalize-workout/index.ts`

- [ ] **Step 1: Create `supabase/functions/finalize-workout/index.ts`**

```typescript
import { createClient } from 'npm:@supabase/supabase-js@2'
import { captureCells } from '../_shared/capture.ts'
import type { CaptureRoutePoint } from '../_shared/types.ts'

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
  let workoutId: string
  try {
    const body = await req.json() as { workoutId?: string }
    if (!body.workoutId || typeof body.workoutId !== 'string') throw new Error()
    workoutId = body.workoutId
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
  const cellIds = captureCells(points)

  // 6. Call finalize_workout RPC with service-role
  const { data: result, error: rpcError } = await adminClient.rpc('finalize_workout', {
    p_workout_id: workoutId,
    p_cell_ids: cellIds,
    p_user_id: user.id,
  })

  if (rpcError) {
    console.error('[finalize-workout] RPC error', rpcError)
    return new Response(JSON.stringify({ error: 'Finalization failed' }), { status: 500 })
  }

  const row = Array.isArray(result) ? result[0] : result
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
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
```

- [ ] **Step 2: Deploy the Edge Function**

```bash
npx supabase functions deploy finalize-workout
```

Expected: "Deployed Edge Function finalize-workout"

- [ ] **Step 3: Verify the function rejects unauthenticated calls**

```bash
curl -X POST https://xpxxtohwalqrqdjexolf.supabase.co/functions/v1/finalize-workout \
  -H "Content-Type: application/json" \
  -d '{"workoutId":"00000000-0000-0000-0000-000000000001"}'
```

Expected: `{"error":"Missing authorization"}` with HTTP 401

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/finalize-workout/
git commit -m "feat(edge-fn): add finalize-workout Edge Function"
```

---

## Task 8: Create mobile workout service

**Files:**
- Create: `apps/mobile/src/features/running/services/workout.ts`
- Create: `apps/mobile/tests/unit/running/workout-service.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/mobile/tests/unit/running/workout-service.test.ts`:

```typescript
import { startWorkout, discardWorkout, getActiveWorkout } from '@/features/running/services/workout'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getSession: jest.fn(),
    },
  },
}))

import { supabase } from '@/lib/supabase'
const mockSupabase = supabase as jest.Mocked<typeof supabase>

const mockFrom = (returnValue: unknown) => {
  const chain = {
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(returnValue),
    single: jest.fn().mockResolvedValue(returnValue),
  }
  ;(mockSupabase.from as jest.Mock).mockReturnValue(chain)
  return chain
}

describe('startWorkout', () => {
  it('returns workoutId on successful insert', async () => {
    const chain = mockFrom(null)
    chain.single.mockResolvedValue({ data: { id: 'workout-123' }, error: null })
    chain.insert.mockReturnValue(chain)

    const result = await startWorkout()
    expect(result.workoutId).toBe('workout-123')
  })

  it('throws on duplicate active workout (Postgres 23505)', async () => {
    const chain = mockFrom(null)
    chain.single.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    })
    chain.insert.mockReturnValue(chain)

    await expect(startWorkout()).rejects.toThrow('active workout')
  })
})

describe('discardWorkout', () => {
  it('resolves on successful update', async () => {
    const chain = mockFrom(null)
    chain.update.mockReturnValue(chain)
    chain.eq.mockResolvedValue({ error: null })

    await expect(discardWorkout('workout-123')).resolves.toBeUndefined()
  })
})

describe('getActiveWorkout', () => {
  it('returns null when no active workout exists', async () => {
    const chain = mockFrom({ data: null, error: null })
    ;(chain.maybeSingle as jest.Mock).mockResolvedValue({ data: null, error: null })

    const result = await getActiveWorkout()
    expect(result).toBeNull()
  })

  it('returns the active workout when one exists', async () => {
    const workout = { id: 'workout-abc', started_at: '2026-06-21T10:00:00Z', status: 'recording' }
    const chain = mockFrom({ data: workout, error: null })
    ;(chain.maybeSingle as jest.Mock).mockResolvedValue({ data: workout, error: null })

    const result = await getActiveWorkout()
    expect(result?.id).toBe('workout-abc')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/mobile && npx jest tests/unit/running/workout-service.test.ts --no-coverage
```

Expected: FAIL — "Cannot find module '@/features/running/services/workout'"

- [ ] **Step 3: Create `apps/mobile/src/features/running/services/workout.ts`**

```typescript
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
}

export async function startWorkout(): Promise<{ workoutId: string }> {
  const { data, error } = await supabase
    .from('workouts')
    .insert({ status: 'recording', source: 'mobile' })
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd apps/mobile && npx jest tests/unit/running/workout-service.test.ts --no-coverage
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/running/services/workout.ts apps/mobile/tests/unit/running/workout-service.test.ts
git commit -m "feat(mobile): add workout service (start/discard/getActive/finalize)"
```

---

## Task 9: Create mobile useLocation hook

**Files:**
- Create: `apps/mobile/src/features/running/hooks/useLocation.ts`
- Create: `apps/mobile/tests/unit/running/use-location.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/mobile/tests/unit/running/use-location.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react-native'
import { useLocation } from '@/features/running/hooks/useLocation'

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
  Accuracy: { BestForNavigation: 6 },
}))

import * as ExpoLocation from 'expo-location'
const mockExpoLocation = ExpoLocation as jest.Mocked<typeof ExpoLocation>

describe('useLocation', () => {
  it('starts in prompt permission state', () => {
    const { result } = renderHook(() => useLocation())
    expect(result.current.permissionStatus).toBe('prompt')
    expect(result.current.hasFix).toBe(false)
  })

  it('sets permissionStatus to denied when permission is refused', async () => {
    mockExpoLocation.requestForegroundPermissionsAsync.mockResolvedValue({
      status: 'denied',
      granted: false,
      canAskAgain: false,
      expires: 'never',
    })

    const { result } = renderHook(() => useLocation())
    await act(async () => {
      await result.current.requestPermission()
    })

    expect(result.current.permissionStatus).toBe('denied')
  })

  it('sets permissionStatus to granted when permission is granted', async () => {
    mockExpoLocation.requestForegroundPermissionsAsync.mockResolvedValue({
      status: 'granted',
      granted: true,
      canAskAgain: true,
      expires: 'never',
    })

    const { result } = renderHook(() => useLocation())
    await act(async () => {
      await result.current.requestPermission()
    })

    expect(result.current.permissionStatus).toBe('granted')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/mobile && npx jest tests/unit/running/use-location.test.ts --no-coverage
```

Expected: FAIL — "Cannot find module '@/features/running/hooks/useLocation'"

- [ ] **Step 3: Create `apps/mobile/src/features/running/hooks/useLocation.ts`**

```typescript
import { useCallback, useRef, useState } from 'react'
import * as Location from 'expo-location'
import type { GpsSample } from '@stridequest/shared/running'

export type LocationPermissionStatus = 'prompt' | 'granted' | 'denied'

export type UseLocationResult = {
  permissionStatus: LocationPermissionStatus
  hasFix: boolean
  requestPermission: () => Promise<void>
  startWatch: (onSample: (sample: GpsSample) => void) => Promise<void>
  stopWatch: () => void
}

export function useLocation(): UseLocationResult {
  const [permissionStatus, setPermissionStatus] = useState<LocationPermissionStatus>('prompt')
  const [hasFix, setHasFix] = useState(false)
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null)

  const requestPermission = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync()
    setPermissionStatus(status === 'granted' ? 'granted' : 'denied')
  }, [])

  const startWatch = useCallback(async (onSample: (sample: GpsSample) => void) => {
    if (permissionStatus !== 'granted') return

    subscriptionRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation },
      (location) => {
        setHasFix(true)
        const sample: GpsSample = {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          accuracy: location.coords.accuracy ?? 999,
          recordedAt: location.timestamp,
          altitude: location.coords.altitude ?? undefined,
          speed: location.coords.speed ?? undefined,
          heading: location.coords.heading ?? undefined,
        }
        onSample(sample)
      }
    )
  }, [permissionStatus])

  const stopWatch = useCallback(() => {
    subscriptionRef.current?.remove()
    subscriptionRef.current = null
  }, [])

  return { permissionStatus, hasFix, requestPermission, startWatch, stopWatch }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd apps/mobile && npx jest tests/unit/running/use-location.test.ts --no-coverage
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/running/hooks/useLocation.ts apps/mobile/tests/unit/running/use-location.test.ts
git commit -m "feat(mobile): add useLocation hook (wraps expo-location)"
```

---

## Task 10: Create mobile useWorkoutRecorder hook

**Files:**
- Create: `apps/mobile/src/features/running/hooks/useWorkoutRecorder.ts`
- Create: `apps/mobile/tests/unit/running/use-workout-recorder.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/mobile/tests/unit/running/use-workout-recorder.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react-native'
import { useWorkoutRecorder } from '@/features/running/hooks/useWorkoutRecorder'
import type { GpsSample } from '@stridequest/shared/running'

// Mock useLocation
jest.mock('@/features/running/hooks/useLocation', () => ({
  useLocation: jest.fn(() => ({
    permissionStatus: 'granted',
    hasFix: false,
    requestPermission: jest.fn().mockResolvedValue(undefined),
    startWatch: jest.fn().mockResolvedValue(undefined),
    stopWatch: jest.fn(),
  })),
}))

import { useLocation } from '@/features/running/hooks/useLocation'
const mockUseLocation = useLocation as jest.MockedFunction<typeof useLocation>

const makeSample = (overrides: Partial<GpsSample> = {}): GpsSample => ({
  lat: 0, lng: 0, accuracy: 5, recordedAt: Date.now(), ...overrides
})

describe('useWorkoutRecorder state machine', () => {
  const mockUpload = jest.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    mockUpload.mockClear()
    mockUseLocation.mockReturnValue({
      permissionStatus: 'granted',
      hasFix: false,
      requestPermission: jest.fn(),
      startWatch: jest.fn().mockResolvedValue(undefined),
      stopWatch: jest.fn(),
    })
  })

  it('starts in idle state', () => {
    const { result } = renderHook(() => useWorkoutRecorder({ upload: mockUpload }))
    expect(result.current.status).toBe('idle')
    expect(result.current.distanceMeters).toBe(0)
  })

  it('transitions idle → recording on start()', async () => {
    const { result } = renderHook(() => useWorkoutRecorder({ upload: mockUpload }))
    await act(async () => { result.current.start('workout-123') })
    expect(result.current.status).toBe('recording')
  })

  it('transitions recording → paused on pause()', async () => {
    const { result } = renderHook(() => useWorkoutRecorder({ upload: mockUpload }))
    await act(async () => { result.current.start('workout-123') })
    act(() => { result.current.pause() })
    expect(result.current.status).toBe('paused')
  })

  it('transitions paused → recording on resume()', async () => {
    const { result } = renderHook(() => useWorkoutRecorder({ upload: mockUpload }))
    await act(async () => { result.current.start('workout-123') })
    act(() => { result.current.pause() })
    await act(async () => { result.current.resume() })
    expect(result.current.status).toBe('recording')
  })

  it('transitions recording → stopped on stop()', async () => {
    const { result } = renderHook(() => useWorkoutRecorder({ upload: mockUpload }))
    await act(async () => { result.current.start('workout-123') })
    await act(async () => { await result.current.stop() })
    expect(result.current.status).toBe('stopped')
  })

  it('transitions to discarded on discard()', async () => {
    const { result } = renderHook(() => useWorkoutRecorder({ upload: mockUpload }))
    await act(async () => { result.current.start('workout-123') })
    act(() => { result.current.discard() })
    expect(result.current.status).toBe('discarded')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/mobile && npx jest tests/unit/running/use-workout-recorder.test.ts --no-coverage
```

Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Create `apps/mobile/src/features/running/hooks/useWorkoutRecorder.ts`**

```typescript
import { useCallback, useEffect, useRef, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  filterSamples,
  createSampleBuffer,
  haversineMeters,
} from '@stridequest/shared/running'
import type {
  GpsSample,
  SampleFilterConfig,
  SampleBufferConfig,
  SampleBuffer,
  UploadBatch,
} from '@stridequest/shared/running'
import { useLocation } from './useLocation'
import { supabase } from '@/lib/supabase'

export type RecorderStatus = 'idle' | 'recording' | 'paused' | 'stopped' | 'discarded'

export const RECORDER_STORAGE_KEY = '@stridequest/active-recorder'

export type PersistedRecorderState = {
  workoutId: string
  startedAt: string
  elapsedBeforePauseMs: number
}

export type UseWorkoutRecorderOptions = {
  upload?: UploadBatch
  filterConfig?: SampleFilterConfig
  bufferConfig?: Partial<SampleBufferConfig>
}

export type UseWorkoutRecorderResult = {
  status: RecorderStatus
  distanceMeters: number
  elapsedSeconds: number
  hasFix: boolean
  permissionStatus: 'prompt' | 'granted' | 'denied'
  workoutId: string | null
  start: (workoutId: string) => void
  /** Restore a previously-interrupted workout into paused state (crash recovery). */
  restore: (workoutId: string, elapsedBeforePauseMs: number) => void
  pause: () => void
  resume: () => void
  stop: () => Promise<void>
  discard: () => void
  requestPermission: () => Promise<void>
}

function buildMobileUpload(workoutId: string): UploadBatch {
  return async (batch) => {
    const rows = batch.samples.map((s, idx) => ({
      workout_id: workoutId,
      lat: s.lat,
      lng: s.lng,
      accuracy_m: s.accuracy,
      altitude_m: s.altitude ?? null,
      speed_mps: s.speed ?? null,
      heading_deg: s.heading ?? null,
      recorded_at: new Date(s.recordedAt).toISOString(),
      batch_seq: batch.batchSeq,
      point_seq: idx,
    }))

    const { error } = await supabase.from('route_points').insert(rows)
    if (error) throw new Error(error.message)
  }
}

export function useWorkoutRecorder(options: UseWorkoutRecorderOptions = {}): UseWorkoutRecorderResult {
  const { filterConfig, bufferConfig } = options

  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [distanceMeters, setDistanceMeters] = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [workoutId, setWorkoutId] = useState<string | null>(null)

  const statusRef = useRef<RecorderStatus>('idle')
  const anchorRef = useRef<GpsSample | null>(null)
  const bufferRef = useRef<SampleBuffer | null>(null)
  const workoutIdRef = useRef<string | null>(null)
  const startedAtRef = useRef<number | null>(null)
  const elapsedBeforePauseRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const filterConfigRef = useRef(filterConfig)
  const bufferConfigRef = useRef(bufferConfig)

  useEffect(() => {
    filterConfigRef.current = filterConfig
    bufferConfigRef.current = bufferConfig
  }, [filterConfig, bufferConfig])

  const enter = useCallback((next: RecorderStatus) => {
    statusRef.current = next
    setStatus(next)
  }, [])

  const { permissionStatus, hasFix, requestPermission, startWatch, stopWatch } = useLocation()

  const startTimer = useCallback(() => {
    startedAtRef.current = Date.now()
    timerRef.current = setInterval(() => {
      const elapsed = elapsedBeforePauseRef.current + (Date.now() - (startedAtRef.current ?? Date.now()))
      setElapsedSeconds(Math.floor(elapsed / 1000))
    }, 1000)
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (startedAtRef.current !== null) {
      elapsedBeforePauseRef.current += Date.now() - startedAtRef.current
      startedAtRef.current = null
    }
  }, [])

  const persistState = useCallback(async (id: string) => {
    const state: PersistedRecorderState = {
      workoutId: id,
      startedAt: new Date().toISOString(),
      elapsedBeforePauseMs: elapsedBeforePauseRef.current,
    }
    await AsyncStorage.setItem(RECORDER_STORAGE_KEY, JSON.stringify(state))
  }, [])

  const clearPersistedState = useCallback(async () => {
    await AsyncStorage.removeItem(RECORDER_STORAGE_KEY)
  }, [])

  const handleSample = useCallback((candidate: GpsSample) => {
    if (statusRef.current !== 'recording') return
    const anchor = anchorRef.current
    const accepted = filterSamples(
      anchor ? [anchor, candidate] : [candidate],
      filterConfigRef.current,
    )
    const survived = accepted[accepted.length - 1] === candidate
    if (!survived) return

    if (anchor) {
      setDistanceMeters((total) => total + haversineMeters(anchor, candidate))
    }
    anchorRef.current = candidate
    bufferRef.current?.add(candidate)
  }, [])

  const start = useCallback((id: string) => {
    if (statusRef.current !== 'idle') return
    workoutIdRef.current = id
    setWorkoutId(id)
    anchorRef.current = null
    elapsedBeforePauseRef.current = 0
    setDistanceMeters(0)
    setElapsedSeconds(0)
    bufferRef.current = createSampleBuffer(id, buildMobileUpload(id), bufferConfigRef.current)
    enter('recording')
    startTimer()
    void startWatch(handleSample)
    void persistState(id)
  }, [enter, startWatch, handleSample, startTimer, persistState])

  const pause = useCallback(() => {
    if (statusRef.current !== 'recording') return
    enter('paused')
    stopWatch()
    stopTimer()
    void bufferRef.current?.flush()
    if (workoutIdRef.current) void persistState(workoutIdRef.current)
  }, [enter, stopWatch, stopTimer, persistState])

  const resume = useCallback(() => {
    if (statusRef.current !== 'paused') return
    anchorRef.current = null
    enter('recording')
    startTimer()
    void startWatch(handleSample)
    if (workoutIdRef.current) void persistState(workoutIdRef.current)
  }, [enter, startWatch, handleSample, startTimer, persistState])

  const stop = useCallback(async () => {
    if (statusRef.current !== 'recording' && statusRef.current !== 'paused') return
    enter('stopped')
    stopWatch()
    stopTimer()
    await bufferRef.current?.stop()
    await clearPersistedState()
  }, [enter, stopWatch, stopTimer, clearPersistedState])

  const discard = useCallback(() => {
    if (statusRef.current !== 'recording' && statusRef.current !== 'paused') return
    enter('discarded')
    stopWatch()
    stopTimer()
    void bufferRef.current?.stop()
    void clearPersistedState()
  }, [enter, stopWatch, stopTimer, clearPersistedState])

  // Restores an interrupted workout (crash recovery). Initializes the recorder
  // in `paused` state with the previous elapsed time so the timer is continuous.
  // The buffer is re-created for the workout ID so resumed GPS points go to the right row.
  const restore = useCallback((id: string, elapsedBeforePauseMs: number) => {
    if (statusRef.current !== 'idle') return
    workoutIdRef.current = id
    setWorkoutId(id)
    elapsedBeforePauseRef.current = elapsedBeforePauseMs
    setElapsedSeconds(Math.floor(elapsedBeforePauseMs / 1000))
    bufferRef.current = createSampleBuffer(id, buildMobileUpload(id), bufferConfigRef.current)
    enter('paused')
  }, [enter])

  useEffect(() => {
    return () => {
      void bufferRef.current?.stop()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  return {
    status,
    distanceMeters,
    elapsedSeconds,
    hasFix,
    permissionStatus,
    workoutId,
    start,
    restore,
    pause,
    resume,
    stop,
    discard,
    requestPermission,
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd apps/mobile && npx jest tests/unit/running/use-workout-recorder.test.ts --no-coverage
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/running/hooks/useWorkoutRecorder.ts apps/mobile/tests/unit/running/use-workout-recorder.test.ts
git commit -m "feat(mobile): add useWorkoutRecorder hook (GPS + buffer state machine)"
```

---

## Task 11: Create the recording screen

**Files:**
- Create: `apps/mobile/app/(protected)/record.tsx`

- [ ] **Step 1: Create `apps/mobile/app/(protected)/record.tsx`**

```typescript
import { useState, useCallback, useEffect } from 'react'
import { View, Text, Pressable, ActivityIndicator } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useWorkoutRecorder, RECORDER_STORAGE_KEY } from '@/features/running/hooks/useWorkoutRecorder'
import type { PersistedRecorderState } from '@/features/running/hooks/useWorkoutRecorder'
import { startWorkout, discardWorkout, finalizeWorkout } from '@/features/running/services/workout'
import type { FinalizeResult } from '@/features/running/services/workout'
import { formatDistance, formatDuration, formatPace } from '@stridequest/shared/running'

export default function RecordScreen() {
  const router = useRouter()
  const [finalization, setFinalization] = useState<FinalizeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)

  const recorder = useWorkoutRecorder()

  // Recovery: on mount, check AsyncStorage for an interrupted run.
  // If found, restore the recorder into paused state with the correct elapsed time.
  useEffect(() => {
    AsyncStorage.getItem(RECORDER_STORAGE_KEY).then((json) => {
      if (!json) return
      try {
        const state = JSON.parse(json) as PersistedRecorderState
        recorder.restore(state.workoutId, state.elapsedBeforePauseMs)
      } catch {
        // Corrupt state — ignore and let user start fresh
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleStart = useCallback(async () => {
    setError(null)
    try {
      const { workoutId } = await startWorkout()
      recorder.start(workoutId)
      setWorkoutStarted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start run')
    }
  }, [recorder])

  const handleStop = useCallback(async () => {
    if (!recorder.workoutId) return
    await recorder.stop()
    try {
      const result = await finalizeWorkout(recorder.workoutId)
      setFinalization(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save run')
    }
  }, [recorder])

  const handleDiscardConfirm = useCallback(async () => {
    const id = recorder.workoutId
    recorder.discard()
    if (id) {
      await discardWorkout(id).catch(() => {})
    }
    setConfirmingDiscard(false)
  }, [recorder])

  const handleDone = useCallback(() => {
    router.back()
  }, [router])

  // --- Phase: idle ---
  if (recorder.status === 'idle') {
    return (
      <SafeAreaView className="flex-1 bg-[#0b0b0f] items-center justify-center px-6 gap-6">
        <Text className="text-3xl font-extrabold text-white">Ready to Run?</Text>

        {recorder.permissionStatus === 'denied' && (
          <Text className="text-sm text-red-400 text-center">
            Location permission denied. Enable it in Settings to start a run.
          </Text>
        )}

        {recorder.permissionStatus === 'prompt' && (
          <Pressable
            onPress={() => void recorder.requestPermission()}
            className="bg-neutral-800 rounded-full px-6 py-3"
          >
            <Text className="text-white font-semibold">Enable Location</Text>
          </Pressable>
        )}

        {recorder.permissionStatus === 'granted' && (
          <>
            {/* GPS status chip — informational only, does NOT block Start */}
            <View className="flex-row items-center gap-2">
              <View
                className={`w-2.5 h-2.5 rounded-full ${recorder.hasFix ? 'bg-emerald-400' : 'bg-yellow-400'}`}
              />
              <Text className="text-sm text-neutral-400">
                {recorder.hasFix ? 'GPS locked' : 'Acquiring GPS…'}
              </Text>
            </View>

            {/* Start is always available once location permission is granted.
                Recording begins immediately; GPS points arrive once a fix is obtained. */}
            <Pressable
              onPress={() => void handleStart()}
              className="bg-emerald-500 rounded-full w-28 h-28 items-center justify-center"
            >
              <Text className="text-white font-bold text-lg">START</Text>
            </Pressable>
          </>
        )}

        {error && <Text className="text-sm text-red-400 text-center">{error}</Text>}

        <Pressable onPress={handleDone} className="mt-4">
          <Text className="text-sm text-neutral-500">Cancel</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  // --- Phase: recording ---
  if (recorder.status === 'recording') {
    return (
      <SafeAreaView className="flex-1 bg-[#0b0b0f] items-center justify-center px-6 gap-8">
        {/* GPS acquisition indicator — shown until first fix arrives */}
        {!recorder.hasFix && (
          <View className="flex-row items-center gap-2 bg-yellow-900/30 px-4 py-2 rounded-full">
            <ActivityIndicator color="#fbbf24" size="small" />
            <Text className="text-yellow-400 text-xs font-medium">Waiting for GPS…</Text>
          </View>
        )}

        <View className="items-center gap-1">
          <Text className="text-5xl font-extrabold text-white tabular-nums">
            {formatDistance(recorder.distanceMeters)}
          </Text>
          <Text className="text-neutral-400 text-sm">distance</Text>
        </View>

        <View className="flex-row gap-10">
          <View className="items-center gap-1">
            <Text className="text-2xl font-bold text-white tabular-nums">
              {formatDuration(recorder.elapsedSeconds)}
            </Text>
            <Text className="text-neutral-400 text-xs">time</Text>
          </View>
          <View className="items-center gap-1">
            <Text className="text-2xl font-bold text-white">
              {recorder.elapsedSeconds > 0 && recorder.distanceMeters > 0
                ? formatPace((recorder.elapsedSeconds * 1000) / recorder.distanceMeters)
                : '--:--'}
            </Text>
            <Text className="text-neutral-400 text-xs">pace /km</Text>
          </View>
        </View>

        <View className="flex-row gap-4">
          <Pressable
            onPress={recorder.pause}
            className="bg-neutral-700 rounded-full px-8 py-4"
          >
            <Text className="text-white font-semibold text-base">Pause</Text>
          </Pressable>

          {!confirmingDiscard ? (
            <Pressable
              onPress={() => setConfirmingDiscard(true)}
              className="bg-neutral-800 rounded-full px-6 py-4"
            >
              <Text className="text-neutral-400 font-semibold text-base">Discard</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => void handleDiscardConfirm()}
              className="bg-red-700 rounded-full px-6 py-4"
            >
              <Text className="text-white font-semibold text-base">Confirm Discard</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    )
  }

  // --- Phase: paused ---
  if (recorder.status === 'paused') {
    return (
      <SafeAreaView className="flex-1 bg-[#0b0b0f] items-center justify-center px-6 gap-8">
        <Text className="text-neutral-400 text-sm tracking-widest uppercase">Paused</Text>

        <View className="items-center gap-1">
          <Text className="text-5xl font-extrabold text-white tabular-nums">
            {formatDistance(recorder.distanceMeters)}
          </Text>
          <Text className="text-neutral-400 text-sm">distance</Text>
        </View>

        <Text className="text-2xl font-bold text-white tabular-nums">
          {formatDuration(recorder.elapsedSeconds)}
        </Text>

        <View className="flex-row gap-4">
          <Pressable
            onPress={recorder.resume}
            className="bg-emerald-500 rounded-full px-8 py-4"
          >
            <Text className="text-white font-semibold text-base">Resume</Text>
          </Pressable>

          <Pressable
            onPress={() => void handleStop()}
            className="bg-neutral-700 rounded-full px-6 py-4"
          >
            <Text className="text-white font-semibold text-base">End Run</Text>
          </Pressable>
        </View>

        {!confirmingDiscard ? (
          <Pressable onPress={() => setConfirmingDiscard(true)}>
            <Text className="text-neutral-500 text-sm">Discard run</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => void handleDiscardConfirm()}>
            <Text className="text-red-400 text-sm font-semibold">Tap to confirm discard</Text>
          </Pressable>
        )}
      </SafeAreaView>
    )
  }

  // --- Phase: stopped (saving) ---
  if (recorder.status === 'stopped' && !finalization && !error) {
    return (
      <SafeAreaView className="flex-1 bg-[#0b0b0f] items-center justify-center gap-4">
        <ActivityIndicator color="#10b981" size="large" />
        <Text className="text-neutral-400 text-sm">Saving your run…</Text>
      </SafeAreaView>
    )
  }

  // --- Phase: completed ---
  if (recorder.status === 'stopped' && finalization) {
    return (
      <SafeAreaView className="flex-1 bg-[#0b0b0f] px-6 items-center justify-center gap-8">
        <Text className="text-2xl font-extrabold text-white">Run Complete</Text>

        <View className="bg-neutral-900 rounded-2xl p-6 w-full gap-4">
          <StatRow label="Distance" value={formatDistance(finalization.distanceM ?? 0)} />
          <StatRow label="Time" value={formatDuration(finalization.durationS ?? 0)} />
          {finalization.avgPaceSPerKm && (
            <StatRow label="Avg Pace" value={formatPace(finalization.avgPaceSPerKm)} />
          )}
          {(finalization.xpAwarded ?? 0) > 0 && (
            <StatRow label="XP Earned" value={`+${finalization.xpAwarded}`} highlight />
          )}
          {(finalization.cellsClaimed ?? 0) > 0 && (
            <StatRow label="Cells Claimed" value={String(finalization.cellsClaimed)} />
          )}
          {(finalization.cellsStolen ?? 0) > 0 && (
            <StatRow label="Cells Stolen" value={String(finalization.cellsStolen)} />
          )}
        </View>

        <Pressable
          onPress={handleDone}
          className="bg-emerald-500 rounded-full px-12 py-4"
        >
          <Text className="text-white font-bold text-base">Done</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  // --- Phase: discarded ---
  if (recorder.status === 'discarded') {
    return (
      <SafeAreaView className="flex-1 bg-[#0b0b0f] items-center justify-center px-6 gap-6">
        <Text className="text-xl font-bold text-white">Run Discarded</Text>
        <Text className="text-neutral-400 text-sm text-center">
          Your run was not saved.
        </Text>
        <Pressable onPress={handleDone} className="bg-neutral-800 rounded-full px-8 py-3">
          <Text className="text-white font-semibold">Back to History</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  // --- Error state ---
  return (
    <SafeAreaView className="flex-1 bg-[#0b0b0f] items-center justify-center px-6 gap-4">
      <Text className="text-red-400 text-base font-semibold">Something went wrong</Text>
      <Text className="text-neutral-400 text-sm text-center">{error}</Text>
      <Pressable onPress={handleDone} className="bg-neutral-800 rounded-full px-8 py-3">
        <Text className="text-white font-semibold">Go Back</Text>
      </Pressable>
    </SafeAreaView>
  )
}

function StatRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View className="flex-row justify-between items-center">
      <Text className="text-neutral-400 text-sm">{label}</Text>
      <Text className={`font-bold text-base ${highlight ? 'text-emerald-400' : 'text-white'}`}>
        {value}
      </Text>
    </View>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/(protected)/record.tsx
git commit -m "feat(mobile): add run recording screen (all phases)"
```

---

## Task 12: Add Start Run button to history screen

**Files:**
- Modify: `apps/mobile/app/(protected)/(tabs)/run/index.tsx`

- [ ] **Step 1: Add Start Run button (with active-workout check) to `apps/mobile/app/(protected)/(tabs)/run/index.tsx`**

The button must check for an existing active workout before navigating. If one exists, navigating to /record will load the recovery flow. If none exists, /record starts fresh.

Add imports at the top:
```typescript
import { getActiveWorkout } from '@/features/running/services/workout'
```

Add a handler before the return statement:
```typescript
const handleStartRun = useCallback(async () => {
  // If an active workout already exists, navigate to /record — the screen
  // will detect it via AsyncStorage and restore the paused state.
  // If not, /record starts fresh. Either way, /record is the entry point.
  router.push('/(protected)/record' as never)
}, [router])
```

Find the existing `return` statement (after the loading guard) and replace it:

```typescript
  return (
    <SafeAreaView className="flex-1 bg-[#0b0b0f]">
      <View className="px-5 pt-6 pb-3 gap-4">
        <View className="flex-row justify-between items-center">
          <Text className="text-2xl font-extrabold text-white">Activity</Text>
          <Pressable
            onPress={() => void handleStartRun()}
            className="bg-emerald-500 rounded-full px-5 py-2"
          >
            <Text className="text-white font-bold text-sm">Start Run</Text>
          </Pressable>
        </View>

        {/* Sort chips */}
        <View className="flex-row gap-2">
          {SORT_OPTIONS.map(({ label, field }) => (
            <Pressable
              key={field}
              onPress={() => void handleSortChange(field)}
              className={`rounded-full px-4 py-1.5 ${
                sort === field ? 'bg-emerald-500' : 'bg-neutral-800'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  sort === field ? 'text-white' : 'text-neutral-400'
                }`}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        data={workouts}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-5 gap-3 pb-12"
        refreshing={loading}
        onRefresh={handleRefresh}
        renderItem={({ item }) => (
          <WorkoutActivityCard
            workout={item}
            onPress={() => router.push(`/(protected)/(tabs)/run/${item.id}` as never)}
          />
        )}
        ListEmptyComponent={<EmptyState />}
        ListFooterComponent={
          hasMore && workouts.length > 0 ? (
            <Pressable
              onPress={() => void handleLoadMore()}
              disabled={loadingMore}
              className="mt-3 items-center py-4"
            >
              {loadingMore ? (
                <ActivityIndicator color="#10b981" />
              ) : (
                <Text className="text-sm font-semibold text-emerald-400">Load more</Text>
              )}
            </Pressable>
          ) : null
        }
      />
    </SafeAreaView>
  )
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/(protected)/(tabs)/run/index.tsx
git commit -m "feat(mobile): add Start Run button to activity history screen"
```

---

## Task 13: Add workout recovery flow

**Files:**
- Modify: `apps/mobile/app/(protected)/_layout.tsx`
- Create: `apps/mobile/tests/unit/running/recovery.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/mobile/tests/unit/running/recovery.test.ts`:

```typescript
import { getActiveWorkout } from '@/features/running/services/workout'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
    })),
  },
}))

import { supabase } from '@/lib/supabase'

describe('getActiveWorkout (recovery)', () => {
  it('returns null when no recording workout exists', async () => {
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    }
    ;(supabase.from as jest.Mock).mockReturnValue(chain)

    const result = await getActiveWorkout()
    expect(result).toBeNull()
  })

  it('returns the workout when a recording workout exists', async () => {
    const workout = { id: 'w-1', started_at: '2026-06-21T08:00:00Z', status: 'recording' }
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: workout, error: null }),
    }
    ;(supabase.from as jest.Mock).mockReturnValue(chain)

    const result = await getActiveWorkout()
    expect(result?.id).toBe('w-1')
    expect(result?.status).toBe('recording')
  })
})
```

- [ ] **Step 2: Run tests to confirm they pass** (getActiveWorkout already implemented in Task 8)

```bash
cd apps/mobile && npx jest tests/unit/running/recovery.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 3: Update `apps/mobile/app/(protected)/_layout.tsx` with recovery check**

```typescript
import { useEffect } from 'react'
import { View } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { useSession } from '@/features/auth/providers/SessionProvider'
import { getActiveWorkout } from '@/features/running/services/workout'

export default function ProtectedLayout() {
  const { session, loading } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !session) {
      router.replace('/(auth)/login')
    }
  }, [session, loading, router])

  // Recovery: if an active workout exists in the DB when the app loads,
  // navigate to the recording screen so the user can resume or end it.
  useEffect(() => {
    if (loading || !session) return
    void getActiveWorkout().then((workout) => {
      if (workout) {
        router.push('/(protected)/record' as never)
      }
    })
  }, [session, loading, router])

  if (loading || !session) {
    return <View className="flex-1 bg-[#0b0b0f]" />
  }

  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0b0b0f' } }}
    />
  )
}
```

- [ ] **Step 4: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/(protected)/_layout.tsx apps/mobile/tests/unit/running/recovery.test.ts
git commit -m "feat(mobile): add workout recovery flow on app launch"
```

---

## Task 14: Final verification

- [ ] **Step 1: Run all mobile tests**

```bash
cd apps/mobile && npx jest --no-coverage
```

Expected: all pass

- [ ] **Step 2: Run mobile typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Run web unit tests and typecheck**

```bash
npx jest tests/unit --no-coverage && npm run typecheck
```

Expected: all pass

- [ ] **Step 4: Manual gameplay-loop verification (on device or simulator)**

Follow the verification checklist in the spec `docs/superpowers/specs/2026-06-21-mobile-run-recording-design.md` Section 15:

1. Tap "Start Run" → permission prompt appears (first time)
2. Grant permission → GPS chip shows; button activates on fix
3. Start run, walk 50–100 m → distance and timer update
4. Pause → metrics freeze, Resume / End Run buttons appear
5. Resume → timer continues from where it left off (not reset to zero)
6. Stop → "Saving your run…" spinner
7. Finalization → summary shows distance / duration / XP / territory
8. Navigate to history → new run appears at top
9. Kill app mid-run, reopen → "recovery" navigates to record screen
10. Discard → workout absent from history

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: finalize mobile run recording (verification passed)"
```

---

---

## Task 15: Record tech-debt for territory duplication

**Files:**
- No code change

- [ ] **Step 1: Create a tech-debt tracking comment in `supabase/functions/_shared/capture.ts`**

Add at the top of `supabase/functions/_shared/capture.ts`:

```typescript
// TECH-DEBT: This file duplicates packages/shared/src/territory/{types,grid,capture}.ts.
// They must stay in sync. Unify once a Deno-compatible import path exists for the
// shared npm package (e.g., via an npm registry or JSR publication).
// Tracked as: TECH-DEBT-001
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/_shared/capture.ts
git commit -m "chore: document territory capture duplication tech-debt (TECH-DEBT-001)"
```

---

## Self-Review

**Spec coverage check:**

| Spec section | Covered by |
|---|---|
| §2 Security pre-condition | Task 1 |
| §3 Architecture | Tasks 7, 8 |
| §4.1 sample-filter to shared | Task 3 |
| §4.2 sample-buffer engine to shared | Task 4 |
| §4.3 RLS audit | Pre-condition (already verified, no code change) |
| §4.4 Shared exports | Tasks 2-4 |
| §5 Edge Function | Tasks 6, 7 |
| §6 useLocation hook | Task 9 |
| §7 useWorkoutRecorder hook | Task 10 |
| §8 Workout service | Task 8 |
| §9 Recording screen + phases | Task 11, 12 |
| §10 Recovery flow | Task 13 |
| §11 AsyncStorage state | Task 10 (inside useWorkoutRecorder) |
| §12 Web changes | Tasks 3, 4 (re-export shims) |
| §13 Permissions in app.json | Task 5 |
| §14 Dependencies | Task 5 |
| §15 Verification gates | Task 14 |
| §16 Test coverage | Tasks 3, 4, 8, 9, 10, 13 |
| §17 Out of scope | Not implemented (correct) |
| §18 Pre-conditions | Tasks 1, 5 |

**Review adjustments applied from feedback (2026-06-21):**
- Territory duplication tech-debt noted → Task 15
- Recovery bug fixed → Task 10 adds `restore()`, Task 11 reads AsyncStorage on mount
- Edge Function defense in depth → `.eq('user_id', user.id)` added in Task 7
- Active workout gate on Start Run → Task 12 routes through /record (recovery handles it)
- Start before GPS lock → Task 11 idle phase allows start; recording phase shows "Waiting for GPS…"
