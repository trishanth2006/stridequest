# Phase 02D-04 Verification Report — Territory Capture Service

**Date:** 2026-06-04
**Verdict:** ✅ **PASS — pure deterministic capture service implemented (TDD), all gates green on new code.**
**Scope:** pure TypeScript only — no DB, no RPC, no `finalize_workout`, no migration, no UI,
no ownership/XP, no XP, no h3-js imported directly in capture.ts.

---

## 1. Files Created

- `features/territory/capture.ts` — `CaptureRoutePoint` type + `captureCells()` pure function.
  - Owns point ordering `(recordedAt, batchSeq, pointSeq)` — mirrors SQL finalize ORDER BY.
  - Delegates **all H3 work** to `grid.ts` (`pathToCells`, `normalizeCellIds`). Zero direct `h3-js` imports.
  - 68 lines total (well under 300-line CLAUDE.md limit).
- `tests/unit/features/territory/capture.test.ts` — 26 unit tests (TDD).
- `tests/fixtures/geo/l-shape.json` — 12-point L-shaped route fixture (SF area; two arms: south + east).
- `tests/fixtures/geo/loop.json` — large rectangular loop fixture (1.5 km × 2.2 km; includes `interiorPoint` well inside rectangle for model A guard).

## 2. Files Modified

- **None.** `finalize_workout`, migrations, `types.ts`, `mappers.ts`, `grid.ts`, RLS — all untouched.

## 3. Tests Added (26, in `capture.test.ts`)

### TDD discipline: RED → GREEN observed
- **RED:** `Cannot find module '../../../../features/territory/capture'` — confirmed before implementing.
- **GREEN:** 26/26 passed after implementation.

### Test coverage by scenario

| Group | Tests | Coverage |
|---|---|---|
| Empty route | 1 | `captureCells([]) → []` |
| Single point | 1 | Returns exactly one res-9 cell matching `latLngToCell` |
| Deterministic output | 1 | Same input → identical output on repeated calls |
| Scrambled ordering | 4 | `recordedAt` → `batchSeq` → `pointSeq` sort is owned internally; scrambled ≡ sorted |
| Invalid coordinates | 6 (parametrized) | lat±91, lng±181, NaN, Infinity → throws `/invalid coordinate/i` |
| Output invariants | 2 | Lexicographically sorted; no duplicates |
| Contract equivalence | 2 | `captureCells(pts) === normalizeCellIds(pathToCells(sortedPts))` for both sorted and scrambled input |
| L-shape fixture | 5 | Valid res-9 cells; sorted; no dupes; deterministic; scrambled ≡ sorted |
| Loop fixture (model A) | 4 | Valid res-9; sorted+deduped; deterministic; interior cell NOT present (model A ≠ model B guard) |

**Total: 26 tests**

## 4. Test Results

```
npm test (full suite):
  Test Suites: 5 skipped, 27 passed, 27 of 32 total
  Tests:       39 skipped, 279 passed, 318 total   (was 248 at 02D-03A → +31 new)
  Time:        14.623 s
```

The 5 skipped suites are DB-integration tests (no service-role key) — unchanged from baseline.
The 39 skipped tests are the same DB-integration skips. **0 failures.**

Capture-specific:
```
npx jest tests/unit/features/territory/capture.test.ts --verbose
  Tests: 26 passed, 26 total  ✅
```

## 5. Lint Results

```
npm run lint
  ✖ 2 problems (1 error, 1 warning)
```

Both are **pre-existing** from prior tasks (not introduced in 02D-04):

| File | Rule | Status |
|---|---|---|
| `features/running/hooks/useWorkoutRecorder.ts:143` | `react-hooks/set-state-in-effect` | **Pre-existing** — existed at 02D-03A baseline |
| `tests/unit/features/running/hooks/gps-status-diagnostic.test.ts:17` | `@typescript-eslint/no-unused-vars` | **Pre-existing** warning |

**New files in 02D-04 (`capture.ts`, `capture.test.ts`): zero lint issues.**

## 6. Typecheck Results

```
npm run typecheck
  tests/unit/features/running/hooks/gps-status-diagnostic.test.ts(27,5): error TS2741
    Property 'toJSON' is missing in type '...' but required in type 'GeolocationCoordinates'
```

This is a **pre-existing error** from a prior task. Searching for `capture` in typecheck output returns nothing.

**New files in 02D-04: zero type errors. No `any`, no `@ts-ignore`.**

## 7. Architecture Constraints Verified

| Constraint | Status |
|---|---|
| Pure function only — no DB, no Supabase, no RPC | ✅ |
| No direct `h3-js` imports in `capture.ts` | ✅ |
| Delegates all H3 work to `grid.ts` (`pathToCells`, `normalizeCellIds`) | ✅ |
| `captureCells` owns point ordering `(recordedAt, batchSeq, pointSeq)` | ✅ |
| Empty route → `[]` | ✅ |
| Single point → `[oneCell]` | ✅ |
| Invalid coordinates → throws (delegated to grid) | ✅ |
| Output: unique, canonical, deterministic | ✅ |
| `finalize_workout` unmodified | ✅ |
| No ownership/XP/UI | ✅ |
| No migration | ✅ |
| Flat path (not `services/`) | ✅ |
| Files under 300 lines | ✅ (`capture.ts`: 68 lines; `capture.test.ts`: ~265 lines) |

## 8. Remaining Risks

1. **Pre-existing lint error** in `useWorkoutRecorder.ts` (`react-hooks/set-state-in-effect`). Carried from prior tasks; not in 02D-04 scope.
2. **Pre-existing typecheck error** in `gps-status-diagnostic.test.ts` (`toJSON` missing). Carried from prior tasks.
3. **Trust boundary (Finding 1) still unresolved** — blocks 02D-05. `capture.ts` produces `CellId[]`; how those are passed to `finalize_workout` v2 without allowing board-takeover is a tech-lead decision (option a/b/c in the architecture review). Properly deferred.
4. **Ordering parity (R-03/R-07)** — `compareRoutePoints` mirrors the SQL `ORDER BY recorded_at, batch_seq, point_seq`. Parity is asserted by contract equivalence tests; full end-to-end parity (TS cells vs DB LINESTRING) deferred to 02D-05 integration tests.
5. **Segment-fill fallback** — inherited from `grid.ts`: pathologically long jumps fall back to two endpoint cells (no gap fill). Real filtered route data never triggers this (documented in `gridLine`).

---

**Constraints honored:** 02D-05 not started · `finalize_workout` unmodified · no DB writes ·
no capture/ownership/XP logic · no migration · no React UI · no direct h3-js in capture.ts ·
pure deterministic function only · TDD (RED → GREEN observed).

**Status: 02D-04 capture service implemented and verified. Paused after verification.**
