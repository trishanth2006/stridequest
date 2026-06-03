# Phase 02 Architecture — GPS, Running, Territory

> **Status: PROPOSAL — NOT APPROVED FOR IMPLEMENTATION.**
> This document is forward-looking design only. Every capability described here
> (GPS, Maps, Workouts, Territory capture, XP) is currently listed under
> **"Not allowed yet"** in the StrideQuest MVP Scope (`CLAUDE.md`). Nothing here
> is to be built until it passes the Architecture Approval Gate.
> **No code accompanies this document by design.**

---

## 0. Goals & Non-Goals

### Goals of Phase 02

1. Record a running workout from a live GPS stream on a mobile-grade device.
2. Persist the route (the ordered geographic path) durably and queryably.
3. Convert routes into **captured territory** on a shared world grid.
4. Compute XP from workout + territory outcomes.
5. Lay clean integration boundaries for Mapbox (rendering) and Health Connect
   (Android health data) **without building them yet**.

### Non-Goals (explicitly out of scope for Phase 02)

- Leaderboards, social, AI coaching (later phases).
- Deep Mapbox / Health Connect implementations — **interfaces only**.
- Real-time multiplayer territory contests. Phase 02 resolves contention with a
  simple last-writer rule (see §4.4); live PvP is later.

### Success criteria (verifiable)

- A workout can be started, streamed, stopped, and reloaded with its full route.
- A completed route deterministically yields the same set of captured cells.
- XP for a given workout is a pure function of its inputs (unit-testable).
- All spatial tables have RLS policies with tests (per CLAUDE.md required
  coverage: territory capture logic, XP calculations, DB access layers).

---

## 1. Current State (what Phase 02 builds on)

```
features/auth/                 ← established feature pattern to mirror
  ├── actions/  (login, signup, logout — server actions)
  ├── components/
  └── types/
infrastructure/supabase/       ← client.ts, server.ts, middleware.ts, database.types.ts
supabase/migrations/           ← repo is source of truth (one concern per migration)
profiles (table)               ← id (FK auth.users), username, total_distance_m, total_xp, ...
```

Stack (from `package.json`): **Next.js 16.2.6** App Router, **React 19.2**,
`@supabase/ssr` 0.10, **Zod 4**, Jest 30 + Testing Library, Playwright. Mapbox
types (`@types/mapbox-gl`) are already a devDependency — a forward hint, but no
Mapbox runtime is installed. **No PostGIS yet.**

Observations that shape this plan:

- The existing migration set is granular — one concern per file
  (`..._create_profiles_table`, `..._enable_rls_profiles`, etc.). Phase 02
  migrations follow the same one-concern-per-file convention.
- `profiles` already carries `total_distance_m` and `total_xp` — Phase 02
  aggregates roll **up** into these existing columns at finalize.

Phase 02 introduces the first **write-heavy, geospatial** domain — a structural
shift from the read-light auth/profile work of Phase 01.

---

## 2. GPS Tracking Architecture

### 2.1 Where tracking runs

GPS is a **client concern**. The browser/device produces the position stream; the
server only ever receives batches. Tracking therefore lives in a client feature
module, not in a server component.

```
features/running/
├── hooks/
│   ├── useGeolocation.ts        // wraps navigator.geolocation.watchPosition
│   └── useWorkoutRecorder.ts    // state machine: idle→recording→paused→stopped
├── services/
│   ├── sample-buffer.ts         // in-memory buffer + batching
│   ├── sample-filter.ts         // accuracy gate, dedupe, smoothing (pure)
│   └── distance.ts              // haversine / cumulative distance (pure)
├── components/
│   └── WorkoutControls.tsx      // start / pause / stop UI
├── schemas.ts                   // zod: batch payload, start/stop inputs
└── types.ts
```

### 2.2 Sample model

A raw GPS sample captured client-side:

```
GpsSample {
  lat: number
  lng: number
  accuracy: number      // meters; samples above threshold are dropped
  altitude?: number
  speed?: number        // m/s, device-reported
  heading?: number
  recordedAt: number    // epoch ms, client clock
}
```

### 2.3 Filtering pipeline (client, before upload)

Raw GPS is noisy. Each sample passes through, in order:

1. **Accuracy gate** — drop samples with `accuracy > N` meters (config, ~30m).
2. **Dedup / min-distance** — drop samples closer than ~5m to the previous
   accepted point (avoids "GPS jitter" inflating distance while standing still).
3. **Speed sanity** — drop samples implying impossible speed (teleport spikes).
4. **(Optional, later) smoothing** — Kalman/moving-average. **Deferred.**

Output is a cleaned, monotonically-timed point list. This logic is a **pure
function** (`sample-filter.ts`) so it is unit-testable independent of the device.

### 2.4 Resilience requirements

- **Buffer locally first.** Samples accumulate in memory (and optionally
  IndexedDB) and upload in batches. A dropped network connection must not lose a
  run.
- **Idempotent upload.** Each batch carries the `workoutId` + a client batch
  sequence number so the server can dedupe replays.
- **Clock trust.** Store the client `recordedAt`, but also stamp a server
  `received_at`. Never trust client clocks for ordering across users.

### 2.5 Risk

Battery / background-tab suspension will pause `watchPosition`. A browser PWA
cannot match a native foreground-service. This is a **known platform limitation**
for the web client and a primary reason Health Connect / native is on the
roadmap (§9.2).

---

## 3. Route Recording Architecture

A **route** is the ordered geographic path of one workout.

### 3.1 Lifecycle

```
start → [stream batches] → (pause/resume)* → stop → finalize
```

- **start**: create a `workouts` row (status `recording`).
- **stream**: append batches to `route_points` (raw) — append-only, cheap inserts.
- **stop / finalize**: server assembles the cleaned path, computes derived
  metrics (distance, duration, elevation), writes the canonical geometry, and
  triggers territory capture (§4) and XP (§7) **once**, transactionally.

### 3.2 Raw vs. processed split (important)

Do **not** put high-frequency points in the same table as the finalized route.
At ~1 sample/sec a one-hour run is ~3600 rows. Keep two representations:

| Layer        | Table          | Shape                              | Purpose                              |
|--------------|----------------|------------------------------------|--------------------------------------|
| Raw stream   | `route_points` | one row per accepted GPS sample    | durability, replay, audit, recompute |
| Canonical    | `workouts.path`| single `geography(LINESTRING)`     | rendering, spatial queries, capture  |

The canonical `LINESTRING` is derived at finalize-time from `route_points`.
Recompute is always possible from raw. Rendering and capture only ever read the
canonical geometry — never scan raw points.

### 3.3 Finalize is the trust boundary

Distance/duration/territory/XP are computed **server-side at finalize**, never
trusted from the client. The client may show a live estimate; the server result
is authoritative. This is the anti-cheat seam.

---

## 4. Territory Capture Architecture

Territory is the game's core loop: a route claims **cells** on a shared world
grid. The grid choice (§5) is the pivotal decision; capture semantics are below.

### 4.1 Two capture models

- **(A) Path coverage** — claim every grid cell the route passes through.
  Simple, deterministic, cheap. **Recommended for Phase 02.**
- **(B) Enclosure** — a closed loop claims its *interior* cells (paper.io /
  Splatoon style). Richer game, much harder: requires loop detection,
  polygonization, point-in-polygon fill, and self-intersection handling.
  **Deferred**; the schema (§8) is designed not to preclude it.

### 4.2 Capture pipeline (model A, at finalize)

```
canonical LINESTRING
   → map path to the set of grid cells it intersects   (grid lib, §5)
   → for each cell: upsert ownership for this user/workout
   → resolve contention against existing owners        (§4.4)
   → write territory_captures + update cell_ownership   (single transaction)
   → emit capture summary (new cells, stolen cells, defended cells)
```

### 4.3 Determinism

Given the same canonical geometry and the same grid resolution, capture **must**
produce the same cell set. This makes capture unit-testable (a CLAUDE.md
required-coverage area) and makes recompute safe after schema/grid migrations.

### 4.4 Contention & concurrency (a real risk, not just schema)

Two users will claim the same cell. Phase 02 uses a **deliberately simple** rule:

- Ownership is a single row per cell (`cell_ownership`), updated transactionally.
- Resolution rule (MVP): **last valid capture wins** (most-recent finalized
  workout owns the cell), recorded with provenance so history is auditable.
- Concurrency is handled at the DB level (row lock / upsert inside the finalize
  transaction), **not** in application code, to avoid lost-update races.

Richer rules (defense strength, decay over time, contested PvP) are explicitly
out of scope and must not be designed-in now.

---

## 5. Grid Cell System Design — **DECISION REQUIRED**

This is the single most consequential Phase 02 decision. Per CLAUDE.md
("present interpretations, don't pick silently"), three options follow with a
recommendation — **this needs your sign-off, not a unilateral pick.**

### Option A — H3 (Uber hexagonal grid) — *recommended*

- Hexagons: uniform adjacency (6 neighbors), no diagonal ambiguity, visually
  natural for territory games.
- Hierarchical resolutions; a single value (`h3index`) identifies a cell.
- Mature libs (`h3-js` client; `h3-pg` / bindings server-side).
- **Cons:** added dependency; cell area varies by latitude; an extra Postgres
  extension if done in-DB.

### Option B — Geohash / quantized square grid

- No new dependency — derive a cell id by rounding lat/lng to a fixed precision.
- Trivial to compute on both client and server.
- **Cons:** rectangular cells distort badly by latitude; diagonal-neighbor
  ambiguity complicates enclosure (model B) later; less "game-like".

### Option C — PostGIS-native vector grid

- Generate a grid as real PostGIS polygons; capture via `ST_Intersects`.
- Most powerful spatially; no app-side grid math.
- **Cons:** heaviest; world-wide grid generation/storage is non-trivial; couples
  the core game loop tightly to PostGIS internals.

### Recommendation

**Option A (H3)** at a fixed resolution (proposed res ~9–10; final value tuned
against target run lengths). It gives the cleanest path from model A (coverage)
to model B (enclosure) later, and the cell id is a compact, indexable value.
Decision **and** resolution are open for your approval before implementation.

### Cross-cutting grid rules (whichever option)

- The grid is **global and fixed** — a cell id must mean the same place forever.
  Never re-tile; that would orphan all captured territory.
- Resolution is a **migration-versioned constant**, not user-configurable.

---

## 6. Workout Data Model (domain)

Conceptual entities (storage in §8):

```
Workout {
  id, userId
  status: 'recording' | 'completed' | 'discarded'
  startedAt, endedAt
  distanceMeters        // derived, server-authoritative
  durationSeconds       // derived (track moving time vs elapsed time)
  avgPaceSecPerKm       // derived
  elevationGainMeters?  // derived
  path: LINESTRING      // canonical geometry
  xpAwarded             // derived (§7)
}

RoutePoint {            // raw stream, append-only
  id, workoutId, lat, lng, accuracy, altitude?, speed?,
  recordedAt (client), receivedAt (server), batchSeq
}

TerritoryCapture {      // one per (workout, cell) claimed
  id, workoutId, userId, cellId, capturedAt, action: 'claim'|'steal'|'defend'
}

CellOwnership {         // current owner per cell (the live game board)
  cellId (PK), ownerUserId, ownedSinceWorkoutId, updatedAt
}
```

Derived metrics live on `Workout` (computed at finalize), never recomputed on
read. `RoutePoint` is the source of truth for recompute. At finalize, per-workout
totals also roll up into the existing `profiles.total_distance_m` /
`profiles.total_xp` columns.

---

## 7. XP Calculation Architecture

XP must be a **pure, deterministic, unit-tested function** (CLAUDE.md required
coverage). It is computed server-side at finalize, alongside capture.

```
features/running/services/xp.ts   // pure: (WorkoutMetrics, CaptureSummary) → xp
```

Proposed initial formula inputs (weights TBD, all server-side):

- Base: distance and moving duration.
- Territory bonus: new cells claimed > cells defended > cells merely re-covered.
- Anti-grind guards (e.g. diminishing returns) — **flagged but deferred**; do
  not over-engineer in Phase 02.

The formula is intentionally isolated behind one pure function so it can change
without touching ingestion, capture, or persistence.

---

## 8. Database Schema Proposal

> Migrations only, via MCP, committed to `supabase/migrations/`, one concern per
> file (matching the existing Phase 01 convention). Types regenerated to
> `infrastructure/supabase/database.types.ts` after every change. DDL below is a
> **proposal**; exact SQL is produced at implementation time after approval.

### 8.1 Prerequisite

- Enable the **PostGIS** extension (its own migration).
- Spatial columns use `geography` (WGS84, meters), not `geometry`.

### 8.2 Tables (proposed)

| Table               | Key columns                                                                                  | Notes |
|---------------------|----------------------------------------------------------------------------------------------|-------|
| `workouts`          | `id`, `user_id`→profiles, `status`, `started_at`, `ended_at`, `distance_m`, `duration_s`, `path geography(LineString,4326)`, `xp_awarded` | one per run |
| `route_points`      | `id`, `workout_id`, `lat`, `lng`, `accuracy`, `recorded_at`, `received_at`, `batch_seq`       | append-only, high volume |
| `territory_captures`| `id`, `workout_id`, `user_id`, `cell_id`, `action`, `captured_at`                             | audit/history of claims |
| `cell_ownership`    | `cell_id` PK, `owner_user_id`, `owned_since_workout_id`, `updated_at`                         | the live board, 1 row/cell |

`cell_id` type follows the §5 decision (e.g. `bigint`/`text` H3 index).

### 8.3 Indexes (proposed)

- `route_points (workout_id, batch_seq)` — ordered replay & dedupe.
- `workouts (user_id, started_at desc)` — user history.
- GiST index on `workouts.path` — spatial queries.
- `cell_ownership (owner_user_id)` — "my territory".
- `territory_captures (cell_id)` and `(user_id)`.

### 8.4 RLS (a non-trivial design area — flag)

- `workouts`, `route_points`, `territory_captures`: owner-scoped
  (`user_id = auth.uid()`) for writes; reads owner-only in Phase 02.
- `cell_ownership` is **shared/contended state** and is the hard case: the board
  is world-readable (everyone sees who owns what) but only writable through the
  server-side finalize path (a `security definer` RPC), never by direct client
  writes. RLS for contested ownership needs explicit test coverage and is called
  out as a **remaining risk**, not a solved problem.

### 8.5 Finalize as a transaction

Capture + ownership update + XP write + profile rollup happen in **one** DB
transaction (preferably a `security definer` RPC) so a run can never be
half-captured and contention is resolved under row locks.

---

## 9. Future Integration Boundaries (interfaces only — not built in Phase 02)

Per "Simplicity First", these are **boundaries**, not designs.

### 9.1 Mapbox (rendering)

```
infrastructure/mapbox/          // token mgmt, map init (adapter)
features/running/components/RouteMap.tsx   // consumes canonical LINESTRING + cells
```

Contract: the map layer **reads** canonical geometry (`workouts.path`) and a set
of cells with owners. It never produces game state. Capture/XP do not depend on
Mapbox — the game is fully playable headless. This keeps rendering swappable.
(`@types/mapbox-gl` is already present, but no Mapbox runtime is installed yet.)

### 9.2 Health Connect (Android health data)

```
infrastructure/health-connect/  // adapter behind a generic HealthSource interface
```

Strategy:

- Web/PWA cannot read Health Connect; this is a **native/Android** concern,
  pursued when a native shell exists (addresses the §2.5 background-GPS limit).
- Model it as an **adapter** implementing a generic `HealthSource` interface
  (`getWorkouts`, `getDistance`, …) so the running feature consumes a source
  abstraction, not a vendor SDK.
- Use it to **corroborate / import** workouts (anti-cheat, richer metrics), not
  as the primary live tracker initially.
- No Phase 02 schema couples to Health Connect; an optional `source` column on
  `workouts` is the only forward hook.

---

## 10. API Boundaries

Mirror the established `features/<x>/actions` server-action pattern from auth,
with one deliberate exception for the hot path.

| Concern                        | Mechanism                                                    | Why |
|--------------------------------|-------------------------------------------------------------|-----|
| Start / stop / discard workout | Server Action (`features/running/actions`)                  | low frequency, form-like, matches auth pattern |
| **GPS batch ingest**           | **Route Handler** (`app/api/...`)                           | high-frequency, idempotent, body-heavy; not a form mutation |
| Finalize (capture + XP)        | Server-side RPC invoked at stop                             | must be one atomic transaction |
| Read workout / history         | Server Components / data layer in `features/running/services`| server-default rendering |
| Read territory board           | Server Component read of `cell_ownership`                   | shared read state |

Boundary rules:

- App Router files stay thin; logic lives in `features/running`.
- Infrastructure (Supabase, later Mapbox/Health) stays under `infrastructure/`.
- The **client never computes authoritative state** — distance, capture, XP are
  server-owned. The client computes only live estimates for UX.

---

## 11. Proposed Folder Tree (for the Approval Gate)

```
app/
├── (protected)/
│   ├── run/page.tsx                  // live workout screen (thin)
│   └── territory/page.tsx            // board view (thin)
└── api/
    └── workouts/[id]/points/route.ts // GPS batch ingest (hot path)

features/running/
├── actions/        start.ts, stop.ts, discard.ts
├── hooks/          useGeolocation.ts, useWorkoutRecorder.ts
├── services/       sample-buffer.ts, sample-filter.ts, distance.ts, xp.ts
├── components/     WorkoutControls.tsx, RouteMap.tsx
├── schemas.ts      // zod: batch payload, start/stop inputs
└── types.ts

features/territory/
├── services/       capture.ts (path→cells), grid.ts (grid abstraction), ownership.ts
├── components/     TerritoryBoard.tsx
└── types.ts

infrastructure/
├── supabase/       (existing) + regenerated database.types.ts
├── mapbox/         (future, boundary only)
└── health-connect/ (future, boundary only)

supabase/migrations/   (one concern per file, matching Phase 01)
├── <ts>_enable_postgis.sql
├── <ts>_create_workouts.sql
├── <ts>_create_route_points.sql
├── <ts>_create_territory_tables.sql   // captures + cell_ownership
├── <ts>_territory_rls.sql
└── <ts>_finalize_rpc.sql

tests/                 (centralized — no __tests__ folders)
├── unit/        xp, distance, capture (deterministic), sample-filter
└── integration/ ingest idempotency, finalize transaction, RLS
```

No business logic under `app/`. Grid math is isolated in
`features/territory/services/grid.ts` so the §5 decision is swappable behind one
module.

---

## 12. Remaining Risks (resolve before / during implementation)

1. **Grid decision is unmade (§5).** Blocks everything downstream. Needs sign-off.
2. **Spatial RLS on contended `cell_ownership` (§8.4)** — hardest correctness +
   security surface; needs explicit tests.
3. **GPS ingestion volume (§2, §3.2)** — raw/processed split and batching are
   mandatory, not optional.
4. **Territory contention/concurrency (§4.4)** — must be DB-transaction-safe;
   app-level resolution would race.
5. **Web background-GPS limitation (§2.5)** — a real product constraint; the web
   client cannot fully replace native tracking.
6. **PostGIS operational cost** — new extension, GiST indexing, geometry recompute
   paths; first geospatial surface in the project.
7. **Anti-cheat scope** — finalize-as-trust-boundary is the seam; deep anti-cheat
   is deferred and must not be over-built now.

---

## 13. Recommended Next Step

1. **Approve / amend the grid decision (§5)** — H3 recommended; confirm or choose.
2. Approve this architecture and folder tree (Architecture Approval Gate).
3. Only then begin TDD implementation, smallest slice first — proposed order:
   `enable PostGIS → workouts/route_points → ingest + buffer → finalize +
   capture (model A) → XP → territory read`. Each slice gated by tests per
   CLAUDE.md required coverage.

**No implementation proceeds until this document is approved.**
