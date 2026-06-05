# Phase 02D-07B — Territory Heatmap & Activity Visualization — Verification Report

**Date:** 2026-06-05
**Scope:** Visualization layer only, on top of the existing H3 territory system. No changes to
capture logic, ownership logic, `finalize_workout`, territory tables, RLS, XP, workouts, run
tracking, or the GPS pipeline. No migrations, schema changes, RPC changes, or DB writes.
**Data sources:** `cell_ownership`, `territory_captures` (read-only, RLS-scoped to the signed-in user).

---

## Summary verdict

**02D-07B is implemented and green within its scope:** typecheck **0 errors**, lint **0 errors**,
and **all 316 unit tests pass (32 suites, 0 failures)** — including the new heatmap service and
component tests.

**One honest caveat (not a 02D-07B regression):** the full `npm test` run is **not** all-green
because the **DB-gated integration suites now execute** this session (Supabase creds are present,
whereas they were *skipped* in every prior phase) and surface a **pre-existing latent test-infra
defect** — the integration `createTestUser` helpers have been broken against the current
`handle_new_user` trigger all along; skipping masked it, creds exposed it. It will fail every run
until the helpers are fixed (it is not an intermittent flake). It affects suites 02D-07B never
touched (`start-workout`, `ingest`, `finalize`), sits outside this phase's allowed modify-scope, and
is **test-only — production signup is unaffected** (real signup supplies a username via the UI). It
was diagnosed but not fixed.

---

## Files Created

| File | Purpose |
|---|---|
| `features/territory/services/heatmap.ts` | `getCellCaptureCounts`, `getUserHeatmap`, `heatmapSummary` — aggregate the user's own captures by cell. |
| `features/territory/components/TerritoryHeatmapControls.tsx` | Controlled `[ Territory | Heatmap ]` toggle (client). |
| `tests/unit/features/territory/services/heatmap.test.ts` | 7 unit tests (aggregation, empty, sort, error, summary). |
| `tests/unit/features/territory/components/TerritoryMap.heatmap.test.tsx` | 6 unit tests (mode rendering, color interpolation, tooltip data, empty state). |
| `docs/phase-02/phase-02D-07B-verification-report.md` | This report. |

## Files Modified

| File | Change |
|---|---|
| `features/territory/types.ts` | Added `HeatmapCell { cellId; captures }` (reused `CellId`). |
| `features/territory/utils/map.ts` | Added `captureColor()`, `cellsToHeatmapGeoJSON()`, `buildTooltip()`; extracted a shared `closedBoundaryRing()` helper (de-duplicates the existing `cellsToGeoJSON`). |
| `features/territory/components/TerritoryMap.tsx` | Added `mode` + `heatmapCells` props; heatmap fill layer (`['get','color']`); hover tooltip via `Popup`; `data-mode` attribute. |
| `features/territory/components/TerritoryBoard.tsx` | Now `'use client'`; holds the view-mode state (instant, reload-free toggle); renders the toggle + passes heatmap data to the map. |
| `features/territory/components/TerritoryStats.tsx` | Extended to 3 stat cards: Total Cells Owned (unchanged testid), **Total Captures**, **Most Captured Cell**. |
| `app/(protected)/territory/page.tsx` | Fetches `getUserHeatmap`; computes `heatmapSummary` server-side; passes ownership + heatmap + stats to the board. |
| `tests/unit/features/territory/components/TerritoryStats.test.tsx` | Updated for the new 3-stat signature (02D-07A test my change required updating) + new-stat assertions. |
| `tests/unit/features/territory/components/TerritoryBoard.test.tsx` | Updated for the new props (`heatmapCells`, extended `stats`) + toggle-presence assertions. |
| `tests/e2e/territory/territory-board.spec.ts` | Empty-state regression hardened (asserts map + toggle hidden); added a documented, `test.skip` populated-state toggle test (needs seeding + Mapbox token). |

## Design decisions

- **Heatmap = graduated fill choropleth** on H3 polygons, colored by capture count via the pure
  `captureColor()` (`1→#86efac`, `2–5→#4ade80`, `6–10→#22c55e`, `11+→#16a34a`; `0`→neutral). Not a
  Mapbox point-density layer — the spec's discrete buckets map to a per-cell fill.
- **RLS-scoped to the user's own captures.** `territory_captures` is owner-scoped, so the heatmap
  only ever reflects the signed-in user ("where do I run most often?"). Aggregation is done in TS —
  no RPC or schema change.
- **`getUserHeatmap` delegates to `getCellCaptureCounts`**; `heatmapSummary` is pure and computed
  **server-side** in the page, so the client board does not import the data layer.
- **Tooltip** owner = "Owned by You" when the cell is in the owned set, else "Neutral Territory".
  jsdom can't run Mapbox GL, so unit tests cover the pure color/tooltip/aggregation logic + per-mode
  layer rendering (via a mocked map); the live hover popup is verified manually / E2E.

## Screenshots

**Not produced in this environment** (agreed approach: build + unit/lint/typecheck green; document
screenshots as a manual step). Real Mapbox tiles require a running dev server, a valid
`NEXT_PUBLIC_MAPBOX_TOKEN`, an authenticated session, and seeded ownership/captures — and a live
browser to capture. To capture locally:

1. Ensure `.env` has a valid `NEXT_PUBLIC_MAPBOX_TOKEN` and Supabase keys.
2. Seed owned cells + captures for a test user (service-role insert into `cell_ownership` +
   `territory_captures`, or complete a real run).
3. `npm run dev`, sign in, open `/territory`.
4. **Territory screenshot:** default view (green ownership polygons).
5. **Heatmap screenshot:** click **Heatmap**; capture the graduated-intensity map + a hover tooltip
   ("Owned by You / Captures: N").

## Test Results

- **Unit scope (the phase's gate): `npx jest tests/unit` → 32 suites, 316 tests, 0 failures.**
  - New: `heatmap.test.ts` (7), `TerritoryMap.heatmap.test.tsx` (6). Updated: `TerritoryStats.test.tsx`,
    `TerritoryBoard.test.tsx`. Territory unit suites total 10 / 107 passing.
- **Full `npm test`:** `Test Suites: 7 failed, 35 passed`; `Tests: 50 failed, 328 passed`. **All 50
  failures are in DB-gated integration suites** (see below) — **zero unit failures, zero 02D-07B
  regressions.**
- **E2E (`npm run test:e2e`):** not run here (no Mapbox token / seeded data; agreed manual). The
  empty-state spec is hardened; the populated toggle test is `test.skip` pending seeding.

## Lint Results

`npm run lint` → **exit 0**, 0 errors/0 warnings.

## Typecheck Results

`npm run typecheck` → **exit 0**, 0 errors.

## Integration test status (environmental — pre-existing, out of scope)

The 7 failing suites — `running/{start-workout,ingest,finalize}`, `security/rls`,
`territory/{contention,capture-determinism,ownership}` — were **skipped in every prior phase**
(02D-05/02D-06 verification reports both show them skipped). They run now only because the test
runner has Supabase credentials this session. **Root cause (from `auth` logs):**

```
ERROR: Username is required (SQLSTATE P0001)
500: Database error creating new user   POST /admin/users
```

The `handle_new_user` trigger on `auth.users` requires a username, but the integration suites'
`createTestUser` helpers call `admin.auth.admin.createUser({ email, password })` **without** a
username in user metadata, so every suite throws in `beforeAll`. This is a **trigger ↔ test-helper
mismatch**, not a code defect in 02D-07B:

- **Production signup is unaffected** — the real signup flow (and the E2E `signupUser`) supplies a
  username via the UI; only the admin-API `createUser` calls in integration helpers omit it. This is
  a test-infrastructure defect, not a production auth bug.
- Corroborating: only the user-creating suites fail; the one integration suite that does **not**
  create users (`db/migration-verification`) flips from skipped to passing this session — confirming
  the root is user creation, not connectivity.
- It breaks suites 02D-07B never touched (`start-workout`, `ingest`, `finalize`).
- 02D-07B may not modify auth/triggers/RLS/run-tracking, and may make **no DB/schema changes** — so
  this is explicitly outside scope and was **not** fixed.
- **Recommended fix (separate maintenance task, not this phase):** update the integration
  `createTestUser` helpers to pass `user_metadata: { username: ... }` (the E2E `signupUser` already
  supplies a username via the UI, which is why E2E user creation is unaffected).

## Remaining Risks

1. **Live Mapbox/E2E/screenshots unverified here.** The map render, real hover popup, and the
   populated-board toggle E2E run only with a Mapbox token + seeded data (documented manual steps
   above). Unit tests cover the pure logic + per-mode rendering against a mocked map.
2. **Integration suite is red for an environmental reason** (above). Until the `createTestUser`
   helpers supply a username, the full `npm test` will not be green in a creds-present environment —
   independent of 02D-07B.
3. **Mixed territory layout** continues (`services/` + flat peers) — cosmetic, per prior phases.
4. **Heatmap excludes lost territory nuance:** counts include cells the user captured but no longer
   owns (correct for "activity density"); the tooltip distinguishes owner vs neutral.

## Out of scope (confirmed not touched)

`finalize_workout` / capture / ownership write logic · territory tables · RLS · XP · workouts · run
tracking · GPS pipeline · migrations / schema / RPC / DB writes · global territory view · battles /
guilds / friends / leaderboards / notifications.

---

**02D-07B implementation complete and green within scope (typecheck/lint/unit). Full `npm test` is
red only due to a pre-existing, environmental, out-of-scope Supabase auth-trigger/test-helper
mismatch. Paused — 02D-07 (next) and XP work not started; no further UI built.**
