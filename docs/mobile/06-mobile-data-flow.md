# Mobile Data Flow

## Supabase Client on Mobile

Mobile uses a **publishable key only** — never the service-role key. All queries are RLS-scoped to `auth.uid()`.

```ts
// src/lib/supabase.ts
const supabase = createClient(url, publishableKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

**Implication:** Any operation requiring service-role (finalize_workout RPC, cross-user reads) must go through a Supabase Edge Function.

---

## Dashboard Data Flow

```
DashboardScreen
  └─ useEffect on mount
      ├─ supabase.from('user_xp')
      │     .select('total_xp, level')
      │     .eq('user_id', session.user.id)
      │     .single()
      │     → { total_xp, level }
      │
      ├─ supabase.from('workouts')
      │     .select('distance_m, started_at')
      │     .eq('user_id', session.user.id)
      │     .eq('status', 'completed')
      │     → sum(distance_m), last 5 workouts
      │
      └─ supabase.from('xp_events')
            .select('xp_awarded, created_at')
            .eq('user_id', session.user.id)
            .gte('created_at', 7 days ago)
            → weekly_xp sum

Derived in component:
  - getXpProgress(total_xp)      → { level, currentLevelXp, nextLevelXp, percent }
  - formatDistance(total_distance_m) → "42.19 km"
  - recent activity list (last 5 workouts)
```

**Tables read:** `user_xp`, `workouts`, `xp_events`
**Computed:** XP progress via `@stridequest/shared/xp`

---

## Profile Data Flow

```
ProfileScreen
  └─ useEffect on mount
      ├─ supabase.from('profiles')
      │     .select('username')
      │     .eq('id', session.user.id)
      │     .single()
      │     → { username }
      │
      ├─ supabase.from('user_xp')
      │     .select('total_xp, level')
      │     .eq('user_id', session.user.id)
      │     .single()
      │     → { total_xp, level }
      │
      ├─ supabase.from('workouts')
      │     .select('id, distance_m')
      │     .eq('user_id', session.user.id)
      │     .eq('status', 'completed')
      │     → { count, sum(distance_m) }
      │
      └─ supabase.from('cell_ownership')
            .select('cell_id', { count: 'exact' })
            .eq('owner_user_id', session.user.id)
            → { territory_count }
```

**Tables read:** `profiles`, `user_xp`, `workouts`, `cell_ownership`

---

## XP Data Flow

```
XPScreen
  └─ useEffect on mount
      ├─ supabase.from('user_xp')
      │     .select('total_xp, level, updated_at')
      │     .eq('user_id', session.user.id)
      │     .single()
      │     → { total_xp, level }
      │
      └─ supabase.from('xp_events')
            .select('event_type, xp_awarded, workout_id, created_at')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false })
            .limit(50)
            → recent XP events

Derived in component:
  - getXpProgress(total_xp)            → level progress bar
  - group events by event_type         → breakdown by source
  - sum by type (workout/capture/steal) → XP breakdown card
```

**Tables read:** `user_xp`, `xp_events`

---

## Run Recording Data Flow

```
RunRecordScreen
  │
  ├─ START RUN
  │   └─ supabase.from('workouts').insert({
  │         user_id, status: 'recording', started_at: now()
  │       })
  │       → { id: workoutId }
  │
  ├─ DURING RUN (continuous)
  │   └─ useLocation hook
  │       └─ Location.watchPositionAsync() (expo-location)
  │           → raw GPS fix { coords: { lat, lng, accuracy, altitude, speed, heading } }
  │           → accuracy filter: skip if accuracy > 30m
  │           → sampleBuffer.push(sample)
  │
  ├─ FLUSH (every 10 samples or 10 seconds)
  │   └─ supabase.from('route_points').insert(bufferedSamples)
  │       Fields: workout_id, lat, lng, accuracy_m, altitude_m,
  │               speed_mps, heading_deg, recorded_at, batch_seq, point_seq
  │
  ├─ STOP RUN
  │   └─ sampleBuffer.flush()     ← drain any remaining samples
  │   └─ call Edge Function: finalize-workout
  │       Payload: { workoutId, userId }
  │       Edge Function:
  │         1. Verify JWT (auth.uid() === userId)
  │         2. Read route_points for workoutId
  │         3. captureCells(routePoints) → cell_ids[]
  │         4. finalize_workout(workoutId, cell_ids, userId) [service-role RPC]
  │         5. Return { xpAwarded, cellsClaimed, cellsStolen, cellsDefended, newLevel, prevLevel }
  │   └─ navigate to summary screen with result
  │
  └─ DISCARD RUN
      └─ supabase.from('workouts').update({ status: 'discarded' }).eq('id', workoutId)
          → navigate to run entry point
```

**Tables written:** `workouts`, `route_points`
**Edge Function called:** `finalize-workout` (handles: territory capture, XP award, metric finalization)

---

## Run History Data Flow

```
RunHistoryScreen
  └─ useEffect on mount
      └─ supabase.from('workouts')
            .select('id, distance_m, duration_s, avg_pace_s_per_km, started_at, ended_at')
            .eq('user_id', session.user.id)
            .eq('status', 'completed')
            .order('started_at', { ascending: false })
            .range(0, 19)                         ← first page
            → workouts[]

Tap workout → navigate to /run/[id]

Load more → .range(20, 39)    ← infinite scroll
```

**Tables read:** `workouts`

---

## Run Detail Data Flow

```
RunDetailScreen (workoutId from route params)
  └─ Parallel fetches on mount:
      │
      ├─ supabase.from('workouts')
      │     .select('*')
      │     .eq('id', workoutId)
      │     .single()
      │     → workout metadata
      │
      ├─ supabase.from('route_points')
      │     .select('lat, lng, altitude_m, speed_mps, recorded_at')
      │     .eq('workout_id', workoutId)
      │     .order('point_seq')
      │     → routePoints[]
      │
      ├─ supabase.from('territory_captures')
      │     .select('cell_id, action, captured_at')
      │     .eq('workout_id', workoutId)
      │     → territoryCaptures[]
      │
      └─ supabase.from('xp_events')
            .select('event_type, xp_awarded')
            .eq('workout_id', workoutId)
            .eq('user_id', session.user.id)
            → xpEvents[]

Derived:
  - Route polyline: routePoints → LatLng[]
  - Elevation profile: routePoints.altitude_m[] (apply smoothing)
  - Pace chart: routePoints → pace per segment
  - Splits: group routePoints by km
  - XP breakdown: group xpEvents by event_type
  - Territory summary: count by action (claim/steal/defend)
```

**Tables read:** `workouts`, `route_points`, `territory_captures`, `xp_events`

---

## Territory Data Flow

```
TerritoryScreen
  └─ useEffect on mount
      ├─ supabase.from('cell_ownership')
      │     .select('cell_id, owned_since, updated_at')
      │     .eq('owner_user_id', session.user.id)
      │     → ownedCells[]
      │
      └─ supabase.from('territory_captures')
            .select('cell_id, action, captured_at')
            .eq('user_id', session.user.id)
            .order('captured_at', { ascending: false })
            .limit(200)
            → recentCaptures[] (for heatmap)

Map rendering:
  - ownedCells → h3.cellToBoundary(cellId) → GeoJSON polygons
  - Render as FillLayer (Mapbox)
  - Color: emerald (#10b981) for owned, gray for others

Stats overlay:
  - count(ownedCells) → total cells owned
  - count(recentCaptures WHERE action='claim') → cells claimed
  - count(recentCaptures WHERE action='steal') → cells stolen
```

**Tables read:** `cell_ownership`, `territory_captures`

---

## Achievement Data Flow

```
AchievementsScreen
  └─ useEffect on mount
      ├─ supabase.from('workouts')
      │     .select('distance_m, started_at, avg_pace_s_per_km, duration_s')
      │     .eq('user_id', session.user.id)
      │     .eq('status', 'completed')
      │     → workouts[]
      │
      ├─ supabase.from('user_xp')
      │     .select('total_xp, level')
      │     .eq('user_id', session.user.id)
      │     .single()
      │     → { total_xp, level }
      │
      └─ supabase.from('cell_ownership')
            .select('cell_id', { count: 'exact' })
            .eq('owner_user_id', session.user.id)
            → { territory_count }

Computed locally (no separate DB table):
  - getAchievements(workouts, total_xp, level, territory_count)
      → Achievement[] with locked/unlocked state
  - getPersonalRecords(workouts)
      → { fastest1k, fastest5k, fastest10k, longestRun }
```

**Tables read:** `workouts`, `user_xp`, `cell_ownership`
**Computed:** All achievement logic runs client-side from raw data

---

## Leaderboard Data Flow

```
LeaderboardsScreen
  └─ Call Edge Function: get-leaderboards
      Payload: { category: 'xp' | 'territory' | 'distance' | 'weekly' }

      Edge Function (runs with service-role — cross-user reads):
        XP:        SELECT p.username, u.total_xp, u.level
                   FROM user_xp u JOIN profiles p ON p.id = u.user_id
                   ORDER BY u.total_xp DESC LIMIT 50

        Territory: SELECT p.username, COUNT(c.cell_id) AS cell_count
                   FROM cell_ownership c JOIN profiles p ON p.id = c.owner_user_id
                   GROUP BY p.username ORDER BY cell_count DESC LIMIT 50

        Distance:  SELECT p.username, SUM(w.distance_m) AS total_distance
                   FROM workouts w JOIN profiles p ON p.id = w.user_id
                   WHERE w.status = 'completed'
                   GROUP BY p.username ORDER BY total_distance DESC LIMIT 50

        Weekly:    SELECT p.username, SUM(e.xp_awarded) AS weekly_xp
                   FROM xp_events e JOIN profiles p ON p.id = e.user_id
                   WHERE e.created_at >= NOW() - INTERVAL '7 days'
                   GROUP BY p.username ORDER BY weekly_xp DESC LIMIT 50

      Returns: { rankings: LeaderboardEntry[], currentUserRank: number }
```

**Edge Function required:** `get-leaderboards` (cross-user data needs service-role)
**Tables read (server-side):** `user_xp`, `profiles`, `cell_ownership`, `workouts`, `xp_events`

---

## State Management Summary

Mobile uses **no global state library** (no Redux, no Zustand). All state is:

| State Type | Mechanism |
|---|---|
| Auth session | `SessionProvider` React context (wraps entire app) |
| Screen data | `useState` + `useEffect` in each screen |
| Run recording state machine | `useWorkoutRecorder` hook (screen-local) |
| GPS stream | `useLocation` hook (screen-local) |
| Sample buffer | `sampleBuffer` service singleton (module-level) |
| Navigation | Expo Router (file-based, automatic) |
| Persisted session | Supabase AsyncStorage adapter |

---

## Error Handling Conventions

| Scenario | Handling |
|---|---|
| Supabase query error | Show error card in screen; allow retry |
| GPS permission denied | Show permission prompt; degrade gracefully (no recording) |
| Network unavailable during run | Buffer route_points locally; show "offline" indicator; retry on reconnect |
| Edge Function timeout | Show "Finalizing run…" retry option; never lose GPS data |
| Session expired mid-run | Buffer flush before redirect to login |

---

## Data Freshness

Most screens fetch on mount. No real-time subscriptions in MVP.

| Screen | Refresh Strategy |
|---|---|
| Dashboard | Mount + `useFocusEffect` (refresh on tab return) |
| Run history | Mount; pull-to-refresh |
| Territory map | Mount; manual refresh button |
| XP screen | Mount |
| Achievements | Mount |
| Leaderboards | Mount; manual refresh |
| Profile | Mount + `useFocusEffect` |
