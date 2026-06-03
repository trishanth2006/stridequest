# Phase 02 Execution Plan — GPS, Running, Territory

**Status:** Planning artifact. Implementation has NOT begun.
**Source of truth:** [`docs/phase-02/phase-02-architecture.md`](./phase-02-architecture.md).
**Companion docs:** requirements, database plan, testing strategy, risk register,
implementation order (all `phase-02-*.md`).

This document is the executable spine of Phase 02. It breaks the approved
architecture into milestones, tasks, and verification gates. It does **not**
redesign the architecture; every decision here is downstream of `phase-02-architecture.md`.

---

## 1. Working Assumptions (must be confirmed before kickoff)

| # | Assumption | Source | Confirmation needed |
|---|---|---|---|
| A1 | Grid system = **H3** at resolution ~9 (~174 m edge). | arch §5 recommendation | Architecture Approval Gate sign-off (R-04 in risk register). |
| A2 | Capture model = **path coverage (model A)**. Enclosure deferred. | arch §4.1 | None — already declared the Phase 02 choice. |
| A3 | Contention rule = **last valid capture wins**, resolved inside the finalize transaction. | arch §4.4 | None. |
| A4 | Single web (PWA-class) client. No native shell in Phase 02. | arch §2.5, §9.2 | None. Risk R-08 documents the limitation. |
| A5 | XP formula weights are tunable constants exported from one pure module. Exact weights TBD before XP milestone. | arch §7 | Product-side tuning before Phase 02E. |

If any of A1–A5 changes, the execution plan must be revisited before the
affected milestone.

---

## 2. Milestone Breakdown

Five milestones mirror the implementation order in
[`phase-02-implementation-order.md`](./phase-02-implementation-order.md).
Each milestone is a slice that ends green on lint / typecheck / Jest / Playwright.

| Milestone | Name | Outcome | Exit verification |
|---|---|---|---|
| **02A** | Workout Foundation | DB schema + start/stop/discard server actions + thin `(protected)/run` page. | Lint ✅ · Typecheck ✅ · Jest unit (workout actions, schemas) ✅ · Playwright (start/stop happy path) ✅ · Migrations verified via MCP ✅ |
| **02B** | GPS Engine | Client-side recorder, sample filter, buffer, batch upload, idempotent ingest route handler. | + Jest unit (sample-filter, distance, buffer) ✅ · Integration (ingest idempotency) ✅ |
| **02C** | Route Processing | Finalize composes canonical LINESTRING from raw points; derived metrics written; status `completed`. | + Jest unit (path-to-linestring assembly) ✅ · Integration (finalize transaction, RLS read) ✅ · Playwright (history list) ✅ |
| **02D** | Territory System | Grid abstraction + capture (path coverage) + ownership upsert under row lock + territory read view. | + Jest unit (grid conversion, capture determinism) ✅ · Integration (ownership updates, contention) ✅ · Playwright (territory board) ✅ |
| **02E** | XP System | Pure XP function wired into finalize; profile rollup of `total_xp` and `total_distance_m`. | + Jest unit (XP formula edge cases) ✅ · Integration (profile rollup) ✅ · Playwright (XP visible on dashboard) ✅ |

Milestones are strictly sequential. No 02B work merges before 02A is green; no
02C before 02B; etc. This matches arch §13 recommended order.

---

## 3. Task ID Scheme

`<MILESTONE>-<NN>`, e.g. `02A-03`. IDs are stable across the lifetime of Phase 02
and may be referenced from commit messages, PR titles, and test names.

Complexity scale: **XS** (<½ day) · **S** (½–1 day) · **M** (1–2 days) ·
**L** (2–4 days) · **XL** (>4 days; if reached, decompose).

---

## 4. Milestone 02A — Workout Foundation

| ID | Task | Files (planned) | Depends on | Complexity | Acceptance criteria |
|---|---|---|---|---|---|
| 02A-01 | Migration: `enable_postgis` (extension only, no tables). | `supabase/migrations/<ts>_enable_postgis.sql` | — | S | PostGIS extension present (verify via MCP); types regenerated (no schema yet, but pipeline exercised). |
| 02A-02 | Migration: `create_workouts` table + indexes. | `supabase/migrations/<ts>_create_workouts.sql` | 02A-01 | M | `workouts` exists with columns per arch §8.2; GiST on `path`; index `(user_id, started_at desc)`; types regenerated. |
| 02A-03 | RLS on `workouts` (owner-scoped CRUD). | `supabase/migrations/<ts>_workouts_rls.sql` | 02A-02 | S | Owner can SELECT/INSERT/UPDATE own; non-owner cannot; tested in integration. |
| 02A-04 | Zod schemas for workout start/stop/discard payloads. | `features/running/schemas.ts` | 02A-02 | XS | All inputs typed and validated; tests for invalid inputs reject. |
| 02A-05 | Types module for workout domain. | `features/running/types.ts` | 02A-02 | XS | No `any`; mirrors DB row shape and action result shapes. |
| 02A-06 | Server action: `startWorkout`. | `features/running/actions/start.ts` | 02A-03, 02A-04 | M | Authenticated user creates `workouts` row with status `recording`; returns workout id; non-authed call rejected. |
| 02A-07 | Server action: `stopWorkout` (calls finalize RPC — placeholder until 02C). | `features/running/actions/stop.ts` | 02A-06 | S | Transitions row to `completed` via RPC stub; idempotent if already stopped. |
| 02A-08 | Server action: `discardWorkout`. | `features/running/actions/discard.ts` | 02A-06 | S | Transitions row to `discarded`; cannot discard another user's workout. |
| 02A-09 | Thin route: `app/(protected)/run/page.tsx`. | as listed | 02A-06 | S | Renders `WorkoutControls`; no business logic. |
| 02A-10 | UI: `WorkoutControls` (start/stop/discard buttons, no GPS yet). | `features/running/components/WorkoutControls.tsx` | 02A-06..08 | M | Form-shaped actions via `useActionState`; pending and error states surface. |

**02A exit gate:** all five gates in §2 green for 02A scope.

---

## 5. Milestone 02B — GPS Engine

| ID | Task | Files (planned) | Depends on | Complexity | Acceptance criteria |
|---|---|---|---|---|---|
| 02B-01 | Migration: `create_route_points` + index `(workout_id, batch_seq)` + RLS. | `supabase/migrations/<ts>_create_route_points.sql` | 02A | M | Append-only table per arch §3.2 / §8.2; RLS owner-only INSERT/SELECT; originally shipped `UNIQUE (workout_id, batch_seq)` to enforce idempotency, **superseded by the Phase 02B-07 forward-fix to `UNIQUE (workout_id, batch_seq, point_seq)`** (see database-plan M3 — the two-column form could not store a multi-sample batch). This row records the original 02B-01 deliverable. |
| 02B-02 | Pure module: `sample-filter.ts` (accuracy gate → min-distance dedupe → speed sanity). | `features/running/services/sample-filter.ts` | — | M | Pure function `(samples, config) => acceptedSamples`; unit-tested for each rule; deterministic. |
| 02B-03 | Pure module: `distance.ts` (haversine + cumulative). | `features/running/services/distance.ts` | — | S | Pure; unit-tested against known fixtures. |
| 02B-04 | Client buffer/batcher: `sample-buffer.ts`. | `features/running/services/sample-buffer.ts` | — | M | In-memory queue with size + interval triggers; supplies upload caller with batches; preserves order; unit-tested. |
| 02B-05 | Hook: `useGeolocation`. | `features/running/hooks/useGeolocation.ts` | — | S | Thin wrapper over `navigator.geolocation.watchPosition`; cleanup on unmount; emits typed samples. |
| 02B-06 | Hook: `useWorkoutRecorder` (state machine idle→recording→paused→stopped). | `features/running/hooks/useWorkoutRecorder.ts` | 02B-02..05 | L | Composes geolocation + filter + buffer; exposes start/pause/resume/stop; unit-tested with a fake geolocation source. |
| 02B-07 | Route handler: `POST /api/workouts/[id]/points` (idempotent batch ingest). | `app/api/workouts/[id]/points/route.ts` | 02B-01 | M | Validates payload with Zod; rejects mismatched user; idempotent on duplicate `batch_seq`; integration-tested. |
| 02B-08 | Wire `WorkoutControls` to the recorder + uploader. | existing component | 02B-06, 02B-07 | M | UI shows live distance estimate (client only — NOT authoritative); batches flow to server. |

**02B exit gate:** integration test proves replaying a batch with the same `batch_seq` is a no-op (idempotency).

---

## 6. Milestone 02C — Route Processing (finalize, part 1: no capture/XP yet)

| ID | Task | Files (planned) | Depends on | Complexity | Acceptance criteria |
|---|---|---|---|---|---|
| 02C-01 | Migration: `finalize_rpc` v1 — `security definer` RPC composing canonical `LINESTRING` from `route_points` and computing distance/duration/avg pace. (Capture + XP added in 02D / 02E.) | `supabase/migrations/<ts>_finalize_rpc.sql` | 02B-01 | L | RPC is owner-scoped via `auth.uid()`; idempotent (re-finalize is a no-op when status=completed); writes `workouts.path`, `distance_m`, `duration_s`, status=`completed`. |
| 02C-02 | Service: server-side helper that calls the RPC inside `stopWorkout`. | `features/running/services/finalize.ts` | 02C-01 | S | One function; no `any`; surfaces a typed result; integration-tested. |
| 02C-03 | History list page: `app/(protected)/run/history/page.tsx` (RSC). | as listed | 02C-01 | S | Lists own workouts ordered by `started_at desc`; RLS-enforced; tested with Playwright. |

**02C exit gate:** a started → streamed → stopped flow yields a row with non-null `path`, `distance_m`, `duration_s` and status `completed`.

---

## 7. Milestone 02D — Territory System

| ID | Task | Files (planned) | Depends on | Complexity | Acceptance criteria |
|---|---|---|---|---|---|
| 02D-01 | Migration: `create_territory_tables` (`territory_captures`, `cell_ownership`) + indexes. | `supabase/migrations/<ts>_create_territory_tables.sql` | 02C-01 | M | Tables match arch §8.2; indexes per §8.3; `cell_id` type follows A1 (H3 → `bigint` or `text`). |
| 02D-02 | Migration: `territory_rls` (`cell_ownership` world-readable, writes via RPC only; `territory_captures` owner-only). | `supabase/migrations/<ts>_territory_rls.sql` | 02D-01 | M | Direct client writes to `cell_ownership` rejected; reads succeed for anyone authenticated; explicitly tested. |
| 02D-03 | Grid abstraction module. | `features/territory/services/grid.ts` | A1 confirmed | M | Single module exposing `pathToCells(linestring, resolution)` and `cellToCenter(id)`; H3 is the implementation behind the interface; pure & unit-tested. |
| 02D-04 | Capture service. | `features/territory/services/capture.ts` | 02D-03 | M | Pure function `(linestring) => Set<cellId>`; deterministic; unit-tested with fixture geometries. |
| 02D-05 | Extend `finalize_rpc` to include capture + ownership upsert under row lock. | migration patch via new file | 02D-01..04 | L | Inside the same transaction: insert into `territory_captures`, upsert `cell_ownership`; contention test (two finalizes of same cell → last writer wins, audit row exists for both). |
| 02D-06 | Ownership service (read side). | `features/territory/services/ownership.ts` | 02D-05 | S | Server-side helper to fetch ownership by viewport / by user; typed. |
| 02D-07 | Territory board page. | `app/(protected)/territory/page.tsx` + `features/territory/components/TerritoryBoard.tsx` | 02D-06 | M | Renders ownership data (text/visual placeholder — Mapbox is out of scope). Playwright covers the page renders without error. |

**02D exit gate:** integration test reproduces the contention scenario from arch §4.4 and asserts last-writer-wins with full audit history.

---

## 8. Milestone 02E — XP System

| ID | Task | Files (planned) | Depends on | Complexity | Acceptance criteria |
|---|---|---|---|---|---|
| 02E-01 | Pure XP function. | `features/running/services/xp.ts` | A5 confirmed | M | `(WorkoutMetrics, CaptureSummary) => xpAwarded`; pure; unit-tested for edge cases (zero distance, zero new cells, max realistic run). |
| 02E-02 | Extend `finalize_rpc` to call XP logic (replicated server-side as SQL or invoked from the RPC author's chosen pattern — but the JS module remains canonical for tests). | migration patch | 02E-01 | L | XP written to `workouts.xp_awarded`; profile rollup updates `profiles.total_xp` and `profiles.total_distance_m`; integration-tested. |
| 02E-03 | Dashboard surfaces updated XP/distance from the existing `profiles` read. | existing dashboard page | 02E-02 | XS | No new query — existing dashboard already reads `profiles`. Playwright confirms the values change after a finalize. |

**02E exit gate:** end-to-end Playwright: start → emit synthetic samples → stop → finalize → dashboard shows updated XP.

> **Important:** the XP rule lives in two places (TS pure function for tests; SQL inside the RPC for server execution). Both **must** agree numerically. A parity unit test (TS vs. a fixture matching what the RPC produced) is part of 02E-02 and is **not** optional. See risk R-09.

---

## 9. TDD Workflow (per CLAUDE.md required coverage)

Every task above follows the same loop:

1. **Red.** Write a failing test in `tests/unit` (or `tests/integration` for DB-touching work) that names the task ID, e.g. `02D-04 capture is deterministic`.
2. **Green.** Implement the minimum code that makes the test pass.
3. **Refactor.** Tighten types, extract helpers (no premature abstraction — CLAUDE.md §2). File ≤300 lines.
4. **Verify.** Run `npm run lint && npm run typecheck && npm test` locally before opening a PR. For DB tasks, regenerate types and commit them in the same PR as the migration.
5. **Migration discipline.** Apply via MCP; commit the local SQL under `supabase/migrations/`; regenerate `infrastructure/supabase/database.types.ts`. No exception.

Required-coverage areas from CLAUDE.md mapped to Phase 02 tasks:
- DB access layers → all action tests in 02A, 02C, 02D, 02E.
- Territory capture logic → 02D-04 (determinism), 02D-05 (contention).
- XP calculations → 02E-01 (formula), 02E-02 (parity).
- Route protection → already covered by Phase 01; new protected routes (`/run`, `/territory`) inherit it (smoke tests in Playwright).

---

## 10. Verification Gates (must be green to mark a milestone done)

| Gate | Command | Scope |
|---|---|---|
| Lint | `npm run lint` | Whole repo. |
| Typecheck | `npm run typecheck` (i.e. `tsc --noEmit`) | Whole repo. |
| Jest unit + integration | `npm test` | All `tests/unit/**` and `tests/integration/**`. |
| Playwright E2E | `npm run test:e2e` (Phase 01 convention) | All `tests/e2e/**`. |
| Migration verification | MCP `list_tables`, `list_migrations`, RLS introspection | Confirms tables, indexes, constraints, RLS policies match the migration intent. Report attached to milestone close-out. |
| Generated types in sync | Compare regenerated `database.types.ts` against committed file. | Must match; CI-equivalent local check. |

Until all six gates are green for a milestone, no work on the next milestone begins.

---

## 11. Out of Scope (do not pull in)

- Mapbox runtime — only the boundary interface (arch §9.1).
- Health Connect — only the boundary interface (arch §9.2).
- Real-time PvP, leaderboards, social — explicit non-goals (arch §0).
- Enclosure capture (model B) — schema admits it but no code in Phase 02.
- Background-GPS workarounds (service worker tricks). Documented as platform limitation (risk R-08).
- Rate limiting, CI, Sentry — Phase-01-deferred items remain deferred.

If a task starts pulling any of the above in, stop and revisit the architecture gate.

---

## 12. Definition of Done — Phase 02

Phase 02 closes when, and only when, all of the following are true:

1. All milestones 02A–02E exited green per §10.
2. All tasks 02A-01 … 02E-03 are complete with their acceptance criteria met.
3. Migrations: 6 files committed under `supabase/migrations/`, MCP-applied, MCP-verified.
4. `infrastructure/supabase/database.types.ts` regenerated from the live schema; committed.
5. Architecture Approval Gate decisions (A1 in particular) recorded in a short ADR note appended to `docs/phase-02-architecture.md` or in a sibling decision log.
6. Risks in `phase-02-risk-register.md` are either resolved or explicitly carried forward into Phase 03 with an owner.
7. A `docs/phase-02-completion-report.md` exists, mirroring the Phase 01 report shape (history, decisions, lessons).

Phase 02 is not "done" because code runs; it is done when all six items above are checked and reproducible.
