# Phase 02 Implementation Order — Build Sequence

**Status:** Planning artifact. No code written.
**Source of truth:** [`docs/phase-02/phase-02-architecture.md`](./phase-02-architecture.md), §13 ("Recommended Next Step").
**Companions:** [`phase-02-execution-plan.md`](./phase-02-execution-plan.md) (task IDs, acceptance criteria), [`phase-02-testing-strategy.md`](./phase-02-testing-strategy.md), [`phase-02-database-plan.md`](./phase-02-database-plan.md), [`phase-02-risk-register.md`](./phase-02-risk-register.md).

This is the **strict build order**. No task starts until its prerequisites are green per the verification gates defined in the execution plan §10.

---

## Pre-kickoff gate (must be done first)

Before any Phase 02 code or migration:

1. **Grid decision (risk R-04 / arch §5).** H3 is the working assumption. Sign-off recorded in `phase-02-architecture.md` (or in a sibling ADR) before migration 4 is written. Resolution constant (e.g. H3 res 9) recorded at the same time.
2. **XP weights (assumption A5).** Initial weights recorded in the XP services file's header constants before 02E begins (they can be tuned later; they must exist).
3. **Phase 01 status.** All Phase 01 gates green (already true per `phase-01-completion-report.md`).
4. **Architecture Approval Gate.** This document and its companions reviewed and approved as a planning suite.

---

## Phase 02A — Workout Foundation

**Goal.** Database can record a workout's lifecycle; start/stop/discard server actions work; a thin `/run` page can transition state. No GPS yet.

### 02A-01 — Enable PostGIS

- **Prerequisites:** Pre-kickoff gate green. Phase 01 schema present.
- **Files:** `supabase/migrations/<ts>_enable_postgis.sql` (planning only — SQL written at impl time).
- **Tests:** Migration-verification integration test asserts extension enabled.
- **Verification commands:**
  ```
  MCP: list_extensions  (postgis present)
  MCP: get_advisors     (no new high-severity findings)
  ```
- **Risks touched:** R-03.

### 02A-02 — Create `workouts` table + indexes

- **Prerequisites:** 02A-01 green.
- **Files:** `supabase/migrations/<ts>_create_workouts.sql`; regenerated `infrastructure/supabase/database.types.ts`.
- **Tests:** Migration-verification integration test (table, columns, GiST on `path`, history index, partial-unique index for active workout).
- **Verification commands:**
  ```
  MCP: list_tables          (workouts present, columns/types match)
  npm run typecheck         (database.types.ts in sync)
  MCP: get_advisors         (clean)
  ```
- **Risks touched:** R-03, R-13.

### 02A-03 — RLS on `workouts`

- **Prerequisites:** 02A-02 green.
- **Files:** `supabase/migrations/<ts>_workouts_rls.sql` *(may be merged with 02A-02 per implementer judgment; both conform to "one concern per file")*.
- **Tests:** `tests/integration/security/rls.test.ts` — own SELECT/INSERT/UPDATE; deny others.
- **Verification commands:**
  ```
  MCP: policy introspection (4 policies present, predicates match)
  npm test -- tests/integration/security/rls.test.ts
  ```

### 02A-04 — Workout schemas

- **Prerequisites:** 02A-02.
- **Files:** `features/running/schemas.ts`, `features/running/types.ts`.
- **Tests:** `tests/unit/features/running/schemas.test.ts`.
- **Verification commands:**
  ```
  npm test -- tests/unit/features/running/schemas.test.ts
  npm run typecheck
  ```

### 02A-05 — `startWorkout` server action

- **Prerequisites:** 02A-03, 02A-04.
- **Files:** `features/running/actions/start.ts`, `features/running/actions/index.ts` (barrel).
- **Tests:** Unit test mocks Supabase server client; integration test asserts row is created and FR-WL-2 enforced.
- **Verification commands:**
  ```
  npm test -- tests/unit/features/running/actions/start.test.ts
  npm test -- tests/integration/running/start-workout.test.ts
  ```

### 02A-06 — `stopWorkout` (stub) + `discardWorkout`

- **Prerequisites:** 02A-05.
- **Files:** `features/running/actions/stop.ts` (stub: sets status `completed`, no real finalize yet), `features/running/actions/discard.ts`.
- **Tests:** Unit + integration; idempotency of `stop`.
- **Verification commands:**
  ```
  npm test -- tests/unit/features/running/actions
  ```
- **Note:** `stop` becomes a thin wrapper over the finalize RPC in 02C. The stub keeps lifecycle testable now.

### 02A-07 — `WorkoutControls` UI + `/run` page

- **Prerequisites:** 02A-05, 02A-06.
- **Files:** `features/running/components/WorkoutControls.tsx`, `app/(protected)/run/page.tsx`.
- **Tests:** RTL unit tests for the component; Playwright happy path (start → stop → discard transitions).
- **Verification commands:**
  ```
  npm test -- tests/unit/features/running/components/WorkoutControls.test.tsx
  npm run test:e2e -- tests/e2e/run/start-workout.spec.ts
  ```

**02A exit gate:** all five gates from execution plan §10 green for 02A scope; close 02A in the milestone tracker.

---

## Phase 02B — GPS Engine

**Goal.** Client records and uploads filtered samples to an idempotent ingest endpoint.

### 02B-01 — Create `route_points` (table + RLS)

- **Prerequisites:** 02A closed.
- **Files:** `supabase/migrations/<ts>_create_route_points.sql`; regenerate `database.types.ts`.
- **Tests:** Migration-verification; RLS integration test (own-only INSERT/SELECT; no UPDATE/DELETE policies).
- **Verification commands:**
  ```
  MCP: list_tables, policy introspection
  npm run typecheck
  npm test -- tests/integration/security/rls.test.ts
  ```
- **Risks touched:** R-12 (UNIQUE constraint).

### 02B-02 — Pure module: `sample-filter`

- **Prerequisites:** None (pure logic).
- **Files:** `features/running/services/sample-filter.ts`.
- **Tests:** `tests/unit/features/running/services/sample-filter.test.ts`.
- **Verification commands:**
  ```
  npm test -- tests/unit/features/running/services/sample-filter.test.ts
  ```
- **Risks touched:** R-01.

### 02B-03 — Pure module: `distance`

- **Prerequisites:** None.
- **Files:** `features/running/services/distance.ts`.
- **Tests:** `tests/unit/features/running/services/distance.test.ts`.
- **Verification commands:**
  ```
  npm test -- tests/unit/features/running/services/distance.test.ts
  ```

### 02B-04 — Buffer/batcher

- **Prerequisites:** 02B-02.
- **Files:** `features/running/services/sample-buffer.ts`.
- **Tests:** Unit tests using Jest fake timers; size + interval triggers; retry idempotency.
- **Verification commands:**
  ```
  npm test -- tests/unit/features/running/services/sample-buffer.test.ts
  ```
- **Risks touched:** R-10, R-12.

### 02B-05 — `useGeolocation` hook

- **Prerequisites:** None.
- **Files:** `features/running/hooks/useGeolocation.ts`.
- **Tests:** Unit test with a fake geolocation source; asserts watch/clearWatch lifecycle.
- **Verification commands:**
  ```
  npm test -- tests/unit/features/running/hooks/useGeolocation.test.ts
  ```

### 02B-06 — `useWorkoutRecorder` state machine

- **Prerequisites:** 02B-02, 02B-04, 02B-05.
- **Files:** `features/running/hooks/useWorkoutRecorder.ts`.
- **Tests:** Unit tests cover idle→recording→paused→recording→stopped; invalid transitions rejected.
- **Verification commands:**
  ```
  npm test -- tests/unit/features/running/hooks/useWorkoutRecorder.test.ts
  ```

### 02B-07 — Route handler: idempotent ingest

- **Prerequisites:** 02B-01.
- **Files:** `app/api/workouts/[id]/points/route.ts`.
- **Tests:** Integration test for happy path, duplicate `batch_seq`, mismatched-user rejection, Zod failure.
- **Verification commands:**
  ```
  npm test -- tests/integration/running/ingest.test.ts
  ```
- **Risks touched:** R-12.

### 02B-08 — Wire recorder + uploader to `WorkoutControls`

- **Prerequisites:** 02B-06, 02B-07, 02A-07.
- **Files:** existing `WorkoutControls.tsx` (extended).
- **Tests:** Component unit test; Playwright with stubbed geolocation showing live distance estimate.
- **Verification commands:**
  ```
  npm test -- tests/unit/features/running/components/WorkoutControls.test.tsx
  npm run test:e2e -- tests/e2e/run/start-workout.spec.ts
  ```

**02B exit gate:** all execution-plan gates green; idempotent ingest demonstrated.

---

## Phase 02C — Route Processing

**Goal.** Finalize composes canonical geometry and derived metrics inside a transactional RPC. (Capture + XP added in 02D / 02E.)

### 02C-01 — Migration: `finalize_rpc` v1

- **Prerequisites:** 02B closed.
- **Files:** `supabase/migrations/<ts>_finalize_rpc.sql`; regenerate `database.types.ts`.
- **Tests:** Integration test: start → ingest → call RPC → status `completed`, `path`/`distance_m`/`duration_s` non-null; idempotency on re-call; forced failure rolls back.
- **Verification commands:**
  ```
  MCP: introspect function (SECURITY DEFINER, search_path '', EXECUTE revoked from PUBLIC, granted to authenticated)
  MCP: get_advisors
  npm test -- tests/integration/running/finalize.test.ts
  ```
- **Risks touched:** R-09 (parity test deferred to 02E), R-11.

### 02C-02 — Wire `stopWorkout` to the RPC

- **Prerequisites:** 02C-01.
- **Files:** `features/running/actions/stop.ts` (replace stub), `features/running/services/finalize.ts`.
- **Tests:** Unit (mocked client) + integration (real RPC).
- **Verification commands:**
  ```
  npm test -- tests/unit/features/running/actions
  npm test -- tests/integration/running/finalize.test.ts
  ```

### 02C-03 — History page (RSC)

- **Prerequisites:** 02C-02.
- **Files:** `app/(protected)/run/history/page.tsx` (plus a small server-side query helper in `features/running/services/`).
- **Tests:** Playwright (`tests/e2e/run/history.spec.ts`) — list rendering, empty state, RLS smoke.
- **Verification commands:**
  ```
  npm run test:e2e -- tests/e2e/run/history.spec.ts
  ```

**02C exit gate:** a started → streamed → stopped flow produces a fully-derived workout row.

---

## Phase 02D — Territory System

**Goal.** Path-coverage capture, ownership writes under row lock, territory read view.

### 02D-01 — Migration: `create_territory_tables`

- **Prerequisites:** 02C closed; R-04 closed (grid decision recorded); R-07 decision recorded (H3 in DB vs. cell ids precomputed in app).
- **Files:** `supabase/migrations/<ts>_create_territory_tables.sql`; regenerate `database.types.ts`.
- **Tests:** Migration-verification (tables, indexes).
- **Verification commands:**
  ```
  MCP: list_tables, index introspection
  npm run typecheck
  ```

### 02D-02 — Migration: `territory_rls`

- **Prerequisites:** 02D-01.
- **Files:** `supabase/migrations/<ts>_territory_rls.sql`.
- **Tests:** `tests/integration/security/rls.test.ts` — `cell_ownership` world-readable, no client write; `territory_captures` owner SELECT, no client INSERT.
- **Verification commands:**
  ```
  MCP: policy introspection
  npm test -- tests/integration/security/rls.test.ts
  MCP: get_advisors
  ```
- **Risks touched:** R-05.

### 02D-03 — Territory domain types & contracts ✅ done

- **Prerequisites:** 02D-01.
- **Files:** `features/territory/types.ts`, `features/territory/mappers.ts`.
- **Tests:** `tests/unit/features/territory/mappers.test.ts`.
- **Deliverables:** `CellId`, `TerritoryAction` union, `TerritoryCapture` /
  `TerritoryOwnership` / `CaptureSummary` domain types, `TerritoryCaptureRow` /
  `CellOwnershipRow` row aliases, and pure mappers (`isTerritoryAction`,
  `toTerritoryCapture`, `toTerritoryOwnership`, `toCaptureSummary`). No business
  logic, no H3.
- **Verification commands:**
  ```
  npm test -- tests/unit/features/territory/mappers.test.ts
  npm run lint && npm run typecheck
  ```
- **Note:** this was originally the `types.ts` half of the grid task below; it was
  split out and shipped first. The grid half is now **02D-03A**.

### 02D-03A — Grid abstraction (`grid.ts`)

- **Prerequisites:** R-04, R-07 decisions recorded; 02D-03.
- **Files:** `features/territory/services/grid.ts`.
- **Tests:** `tests/unit/features/territory/services/grid.test.ts`.
- **Verification commands:**
  ```
  npm test -- tests/unit/features/territory/services/grid.test.ts
  ```

### 02D-04 — Capture service

- **Prerequisites:** 02D-03A.
- **Files:** `features/territory/services/capture.ts`.
- **Tests:** `tests/unit/features/territory/services/capture.test.ts` (determinism + fixtures).
- **Verification commands:**
  ```
  npm test -- tests/unit/features/territory/services/capture.test.ts
  ```
- **Risks touched:** R-06 (logical input to contention).

### 02D-05 — Extend `finalize_rpc`: capture + ownership

- **Prerequisites:** 02D-01..04.
- **Files:** `supabase/migrations/<ts>_finalize_rpc_v2.sql` (additive — new function version, called by `stopWorkout`); regenerate types.
- **Tests:**
  - Integration: `tests/integration/territory/contention.test.ts`.
  - Integration: `tests/integration/territory/capture-determinism.test.ts`.
  - Integration: `tests/integration/running/finalize.test.ts` (updated: now also asserts captures + ownership effects).
- **Verification commands:**
  ```
  MCP: introspect updated function; get_advisors
  npm test -- tests/integration/territory
  npm test -- tests/integration/running/finalize.test.ts
  ```
- **Risks touched:** R-05, R-06, R-07.

### 02D-06 — Ownership read helper

- **Prerequisites:** 02D-05.
- **Files:** `features/territory/services/ownership.ts`.
- **Tests:** Integration (FR-OW-1, FR-OW-2 via the helper).
- **Verification commands:**
  ```
  npm test -- tests/integration/territory
  ```

### 02D-07 — Territory page + board component

- **Prerequisites:** 02D-06.
- **Files:** `app/(protected)/territory/page.tsx`, `features/territory/components/TerritoryBoard.tsx`.
- **Tests:** Playwright (`tests/e2e/territory/board.spec.ts`) — page loads, owned cells render in placeholder form, anon redirect.
- **Verification commands:**
  ```
  npm run test:e2e -- tests/e2e/territory/board.spec.ts
  ```

**02D exit gate:** contention integration test reproduces last-writer-wins with full audit; all execution-plan gates green.

---

## Phase 02E — XP System

**Goal.** XP computed at finalize, rolled up to `profiles`, surfaced on the dashboard.

### 02E-01 — Pure XP function

- **Prerequisites:** XP weights recorded (Pre-kickoff item 2).
- **Files:** `features/running/services/xp.ts`.
- **Tests:** `tests/unit/features/running/services/xp.test.ts`.
- **Verification commands:**
  ```
  npm test -- tests/unit/features/running/services/xp.test.ts
  ```

### 02E-02 — Extend `finalize_rpc`: XP + profile rollup

- **Prerequisites:** 02E-01.
- **Files:** `supabase/migrations/<ts>_finalize_rpc_v3.sql` (additive new version); regenerate types.
- **Tests:**
  - Integration: `tests/integration/running/profile-rollup.test.ts`.
  - Integration: `tests/integration/running/xp-parity.test.ts` (TS vs. RPC parity — non-optional, R-09).
  - Integration: re-finalize idempotency (no double rollup).
- **Verification commands:**
  ```
  MCP: introspect updated function
  npm test -- tests/integration/running
  ```
- **Risks touched:** R-09.

### 02E-03 — Dashboard surfaces updated XP/distance

- **Prerequisites:** 02E-02.
- **Files:** existing dashboard page (no new query — `profiles` is already read).
- **Tests:** Playwright (`tests/e2e/run/dashboard-xp.spec.ts`) — start → emit synthetic samples → stop → dashboard reflects the increment.
- **Verification commands:**
  ```
  npm run test:e2e -- tests/e2e/run/dashboard-xp.spec.ts
  ```

**02E exit gate:** end-to-end Playwright passes; parity integration test green; all gates from execution plan §10 green.

---

## Whole-phase verification (run before closing Phase 02)

Run these at the very end, regardless of per-milestone gates:

```
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

Plus:

- MCP `list_migrations` matches the on-disk migration list under `supabase/migrations/`.
- MCP `get_advisors` shows no high-severity findings on any new object.
- `infrastructure/supabase/database.types.ts` regenerated from live schema; committed; matches on-disk.
- `docs/phase-02-completion-report.md` written, mirroring the Phase 01 report structure.

If any of the above is red, Phase 02 is not closed. No exception.

---

## Order summary (one line per task)

```
Pre-kickoff: grid decision · XP weights · arch gate
02A-01 enable_postgis
02A-02 create_workouts (+ indexes)
02A-03 workouts_rls
02A-04 schemas + types
02A-05 startWorkout
02A-06 stopWorkout (stub) + discardWorkout
02A-07 WorkoutControls + /run page
02B-01 create_route_points (+ RLS)
02B-02 sample-filter
02B-03 distance
02B-04 sample-buffer
02B-05 useGeolocation
02B-06 useWorkoutRecorder
02B-07 ingest route handler
02B-08 wire recorder + uploader
02C-01 finalize_rpc v1 (geometry + metrics)
02C-02 wire stopWorkout to RPC
02C-03 history page
02D-01 create_territory_tables
02D-02 territory_rls
02D-03 territory types & contracts
02D-03A grid abstraction
02D-04 capture service
02D-05 finalize_rpc v2 (capture + ownership)
02D-06 ownership read helper
02D-07 territory page + board
02E-01 pure xp() function
02E-02 finalize_rpc v3 (xp + profile rollup)
02E-03 dashboard reflects XP
Close-out: whole-phase verification + completion report
```

This is the build order. Deviations require revisiting the Architecture Approval Gate.
