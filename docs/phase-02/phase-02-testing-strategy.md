# Phase 02 Testing Strategy — Matrix, Targets, Conventions

**Status:** Planning artifact. No tests written yet.
**Source of truth (architecture):** [`docs/phase-02/phase-02-architecture.md`](./phase-02-architecture.md).
**Inherits from Phase 01:** centralized `tests/{unit,integration,e2e}` tree, Jest 30 + Testing Library, Playwright, `moduleNameMapper` configured for `@/` (see Phase 01 §7.5 #3).

This document is the **matrix** of what gets tested, at which tier, and what coverage targets the phase must hit. It does not include test code; per CLAUDE.md, tests are written test-first inside the relevant milestone.

---

## 1. Tier responsibilities

| Tier | What it tests | What it must NOT test |
|---|---|---|
| **Unit** | Pure functions, schemas, components in isolation, hook behavior with stubbed device APIs. | DB behavior, network, real Supabase. |
| **Integration** | DB-touching paths (RLS, RPC, idempotency, transactions) via Supabase test project (preferably a local stack or a dedicated remote branch). | Browser UI; full user journeys. |
| **E2E (Playwright)** | User journeys end-to-end against `next dev` + a real Supabase backend, mirroring Phase 01 conventions. | Pure function correctness (unit's job); cross-user RLS contention (integration's job). |

Phase 01 lessons that carry forward (do not relitigate):

- Trust E2E when E2E and unit disagree.
- `jest.mock('@/...')` requires the `moduleNameMapper`; this is configured. New unit tests inherit it.
- Use `getUser()` (server-validated) in any new server-side check, never `getSession()`.

---

## 2. Unit Test Matrix

All paths are under `tests/unit/`. File names mirror the source module they cover.

### 2.1 Distance calculations — `tests/unit/features/running/services/distance.test.ts`

| Test | Asserts |
|---|---|
| haversine on two known points | Returns the documented great-circle distance within tolerance. |
| haversine on identical points | Returns 0. |
| haversine on antipodal points | Returns ~half-circumference. |
| cumulative distance over an empty list | Returns 0. |
| cumulative distance over a one-point list | Returns 0. |
| cumulative distance is order-dependent | Reordering produces different totals (sanity). |
| accuracy: distance never negative | Property test over random inputs. |

### 2.2 Sample filtering — `tests/unit/features/running/services/sample-filter.test.ts`

| Test | Asserts |
|---|---|
| accuracy gate drops samples above threshold | `accuracy_m > N` → rejected. |
| accuracy gate keeps samples below threshold | Boundary cases at `N` and `N-ε`. |
| min-distance dedupe drops near-duplicate points | Two points <5m apart → second rejected. |
| min-distance keeps points beyond threshold | Boundary at the configured min. |
| speed sanity drops teleports | Implied speed > human max → rejected. |
| pure function: same input → same output | Two calls with identical input produce equal arrays. |
| ordering preserved among accepted samples | No reshuffle. |
| empty input → empty output | Edge. |

### 2.3 XP calculations — `tests/unit/features/running/services/xp.test.ts`

| Test | Asserts |
|---|---|
| zero distance + zero captures → 0 | No negative, no NaN. |
| pure base XP scales with distance | Fixture inputs vs. expected. |
| capture bonus weighting: claim > defend ≥ re-cover | Comparative assertion. |
| order-invariance where intended | Reordering capture summary doesn't change result. |
| returns an integer | (Or documented numeric type — no float surprises in DB rollup.) |
| parity stub against SQL fixture | Given a JSON fixture mirroring an RPC run, TS function matches expected XP. (See R-09; full parity is asserted at integration tier.) |
| no anti-grind logic present | Negative test: feeding a high-frequency identical run does not return diminishing values (Phase 02 deliberately omits anti-grind). |

### 2.4 Grid conversion — `tests/unit/features/territory/services/grid.test.ts`

| Test | Asserts |
|---|---|
| `pathToCells` is deterministic | Same LINESTRING + resolution → same cell set across runs. |
| `pathToCells` on a single-point degenerate path | Returns the singleton cell containing the point. |
| `pathToCells` across a known grid boundary | Returns both adjacent cells. |
| `cellToCenter` round-trips approximately | The point returned is contained by the cell. |
| resolution is a fixed constant (not user input) | Module exports the constant; mismatched resolutions are not accepted. |

### 2.5 Territory capture (pure side) — `tests/unit/features/territory/services/capture.test.ts`

| Test | Asserts |
|---|---|
| capture set equals grid-conversion output | `capture(linestring) == pathToCells(linestring, RES)`. |
| determinism | Re-running on same input yields the same set. |
| fixture: an L-shaped path | Captures the documented hand-checked cells. |
| fixture: a loop | Captures only the cells the loop *crosses* in Phase 02 (model A), not interior (model B is deferred). |

### 2.6 Workout schemas — `tests/unit/features/running/schemas.test.ts`

| Test | Asserts |
|---|---|
| valid start payload | Accepted. |
| missing fields rejected | Each required field individually. |
| invalid lat/lng rejected | Range violations. |
| `batch_seq` non-negative | Boundary at 0, negative rejected. |
| Zod-normalized fields are normalized | (E.g. trim where applicable.) |

### 2.7 Hooks — `tests/unit/features/running/hooks/*.test.ts`

| Hook | Test focus |
|---|---|
| `useGeolocation` | Subscribes on mount; calls `clearWatch` on unmount; emits typed samples; rejects when API unavailable. |
| `useWorkoutRecorder` | State machine transitions are valid; pause preserves accumulated samples; resume continues without duplication; stop emits a final flush. |

### 2.8 Sample buffer — `tests/unit/features/running/services/sample-buffer.test.ts`

| Test | Asserts |
|---|---|
| size trigger | Buffer flushes at configured size. |
| interval trigger | Buffer flushes at configured interval (use fake timers). |
| order preserved | Output order matches push order. |
| retry preserves idempotency | A failed batch can be resubmitted with the same `batch_seq`. |

### 2.9 Components — `tests/unit/features/running/components/WorkoutControls.test.tsx`

| Test | Asserts |
|---|---|
| renders start / stop / discard | Buttons exist with accessible names. |
| pending state disables actions | `useActionState` pending → buttons disabled. |
| server error surfaces in UI | `useActionState` error → message rendered. |

---

## 3. Integration Test Matrix

All paths are under `tests/integration/`. These tests hit a real Postgres (Supabase local or a dedicated remote branch). They run **without** the browser. Supabase clients are real; tests authenticate as test users.

### 3.1 Workout creation — `tests/integration/running/start-workout.test.ts`

- Authenticated user can start; row exists, status `recording`.
- Starting twice rejects (FR-WL-2).
- Anonymous request rejected.
- RLS: U2 cannot read U1's `recording` row.

### 3.2 Route ingestion — `tests/integration/running/ingest.test.ts`

- Valid batch persisted in order.
- Duplicate `batch_seq` is a no-op (FR-RR-2 / NFR-R-1).
- Mismatched user rejected (FR-RR-5).
- Zod-invalid payload rejected.
- Append-only: UPDATE on `route_points` is rejected by RLS.

### 3.3 Finalize transaction — `tests/integration/running/finalize.test.ts`

- start → ingest N batches → stop → `workouts` row is `completed`, `path` non-null, `distance_m` non-null, `duration_s` non-null.
- Re-finalize is idempotent (FR-RP-4).
- Forced failure mid-transaction rolls back fully (NFR-R-2): no `territory_captures`, no `cell_ownership` change, no profile rollup, status remains `recording`.
- Stop on a discarded workout rejected.

### 3.4 RLS — `tests/integration/security/rls.test.ts`

- `workouts`: owner-only SELECT/INSERT/UPDATE.
- `route_points`: owner-only SELECT/INSERT; UPDATE/DELETE absent.
- `territory_captures`: owner-only SELECT; INSERT only via RPC (direct client INSERT rejected).
- `cell_ownership`: SELECT for any authenticated user; INSERT/UPDATE/DELETE rejected from clients.
- `profiles`: re-asserts Phase 01 invariants are still intact after schema additions.

### 3.5 Ownership updates / contention — `tests/integration/territory/contention.test.ts`

- Single user captures cells X, Y, Z; `cell_ownership` reflects them with action `claim`.
- Second user captures overlapping cell Y; ownership flips to U2 with `steal`; audit row exists for U1's earlier `claim`.
- Same-user re-cover: action `defend`; ownership unchanged.
- Concurrency: two RPCs racing for the same cell complete without lost updates; last-writer-wins is reproducible by ordering finalize timestamps; both audit rows exist.

### 3.6 Capture determinism — `tests/integration/territory/capture-determinism.test.ts`

- Finalize the same workout twice (after manually resetting status in a test fixture) → identical cell set.
- Two workouts with identical raw points → identical cell set in `territory_captures`.

### 3.7 Profile rollup — `tests/integration/running/profile-rollup.test.ts`

- Finalize increments `profiles.total_distance_m` by exactly the workout's distance.
- Finalize increments `profiles.total_xp` by exactly the workout's XP.
- Idempotent re-finalize does not double-increment.

### 3.8 XP parity (TS vs. RPC) — `tests/integration/running/xp-parity.test.ts`

- For a battery of workout fixtures, the TS `xp()` function and the RPC produce identical `xp_awarded` values (FR-XP-5 / R-09).
- This test is **not optional**. Drift between TS and SQL XP would be a silent correctness bug.

### 3.9 Migration verification — `tests/integration/db/migration-verification.test.ts`

- Programmatic introspection (via the Supabase client / MCP) confirms:
  - All six tables/extensions in the database plan exist.
  - Indexes from migrations 2–4 exist.
  - RLS policies from migrations 2, 3, 5 exist and match expected predicates.
  - The `finalize_workout` RPC exists with `SECURITY DEFINER`, locked `search_path`, and revoked PUBLIC EXECUTE.

---

## 4. Playwright E2E Matrix

All paths are under `tests/e2e/`. They run against `next dev` and a real Supabase backend, like Phase 01.

### 4.1 Start workout — `tests/e2e/run/start-workout.spec.ts`

- Authenticated user navigates to `/run`, clicks Start, the UI transitions to a "recording" state, and a live distance estimate becomes visible.
- Unauthenticated visit to `/run` redirects to `/login` (inherits Phase 01 route protection).

### 4.2 Stop workout — `tests/e2e/run/stop-workout.spec.ts`

- After starting and feeding the page a stubbed geolocation stream, clicking Stop yields a "completed" state and surfaces a workout summary (distance, duration, XP).
- The summary values originate server-side (NFR-Sec-5 trust boundary): the test feeds in deterministic samples and asserts the displayed values match the expected server-computed values (within tolerance).

### 4.3 History — `tests/e2e/run/history.spec.ts`

- After at least one completed workout, the history page lists it with `started_at`, `distance_m`, `duration_s`.
- A user with no workouts sees an empty state.
- RLS smoke: a second user does not see the first user's history.

### 4.4 Territory board — `tests/e2e/territory/board.spec.ts`

- After at least one finalize, the territory page loads without error and shows the user's owned cells in a placeholder representation.
- Anonymous visit redirects to `/login`.

### 4.5 Dashboard reflects XP — `tests/e2e/run/dashboard-xp.spec.ts`

- After a successful finalize, the dashboard shows `total_xp` and `total_distance_m` updated by exactly the workout's contribution.

> Playwright tests use a **stubbed geolocation source** via Playwright's geolocation API or an injected sample generator. Phase 02 does not include real-device GPS testing; that is operational/manual.

---

## 5. Coverage Targets

Per CLAUDE.md and Phase 01 conventions:

| Scope | Target |
|---|---|
| Overall line coverage (Jest, unit + integration) | **≥ 80%** |
| Critical paths (auth, route protection, DB access layers, territory capture, XP calculations) | **100%** of named acceptance criteria covered by at least one test |
| Pure logic modules (`sample-filter`, `distance`, `xp`, `grid`, `capture`) | **100%** branch coverage |
| Migrations | 100% **verification** (MCP introspection asserts every expected object exists) — not "coverage" in the Jest sense, but every migration produces a verifiable artifact |

Coverage is monitored per milestone; a milestone does not close green until its scope hits these targets.

---

## 6. Test Infrastructure & Conventions

### 6.1 Layout

```
tests/
├── unit/
│   └── features/{running,territory}/...
│       └── services|hooks|components|schemas/
├── integration/
│   ├── running/    # start, ingest, finalize, profile-rollup, xp-parity
│   ├── territory/  # contention, capture-determinism
│   ├── security/   # rls
│   └── db/         # migration-verification
└── e2e/
    ├── run/        # start, stop, history, dashboard-xp
    └── territory/  # board
```

No `__tests__/` folders anywhere — Phase 01 rule, enforced by CLAUDE.md.

### 6.2 Naming

- File name: `<unit>.test.ts(x)` or `<scenario>.spec.ts` (Playwright).
- Top-level `describe` block names the module (`describe('xp', ...)`).
- Test names reference the requirement ID when applicable (`it('FR-RR-2: duplicate batch_seq is a no-op')`).

### 6.3 Fixtures

- Geographic fixtures (LINESTRINGs, sample streams, captured-cell sets) live in `tests/fixtures/geo/` as JSON.
- Fixtures are hand-checked once and frozen. Capture/XP/distance tests assert against them. Changing a fixture is a deliberate change to the spec and requires PR justification.

### 6.4 Test data lifecycle

- Integration tests create their own users via Supabase Auth at setup, run within a per-test schema or transaction-rollback wrapper, and clean up at teardown.
- No shared mutable state between integration tests.
- E2E tests follow the Phase 01 pattern (`tests/e2e/helpers.ts`): create disposable users, log in, run, tear down.

### 6.5 Mocking discipline

- Unit: mock at the **module seam** (`@/infrastructure/supabase/server`), never inside the module under test.
- Integration: do **not** mock Supabase. The DB is the SUT.
- E2E: do not mock anything except external APIs that don't exist (none in Phase 02 — no Mapbox, no Health Connect).

### 6.6 Determinism rules

- Time: use Jest fake timers for buffer-interval tests; provide a clock injection point in `sample-buffer` rather than calling `Date.now()` directly.
- Randomness: there is none in Phase 02 logic. If a test introduces randomness, that is a smell; fix the test, not the SUT.
- Geolocation: in Playwright, set deterministic coordinates via the page-level geolocation override or a stubbed `useGeolocation`.

### 6.7 Type safety in tests

- Tests are `.ts(x)` and respect strict mode. No `any`. No `@ts-ignore` unless paired with a one-line justification comment.
- Test files do **not** import `Database` types loosely; they use the same typed clients as production code (so a schema change forces test updates — desired).

---

## 7. What this strategy does NOT cover

- Production load / soak testing — out of Phase 02 scope.
- Real-device GPS field testing — operational, not in the test suite.
- Cross-browser matrix beyond what Playwright runs by default — addressed before public launch, not in Phase 02.
- CI configuration — deferred (Phase 01 §9.4 still applies).
- Visual regression — no Mapbox rendering in Phase 02.

If any test in the matrix above cannot be expressed without one of these, escalate; do not silently expand scope.
