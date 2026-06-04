# Phase 02D-03 Verification Report — Territory Domain Types & Contracts

**Date:** 2026-06-03
**Verdict:** ✅ **PASS — territory domain layer implemented (types + pure mappers), TDD, all gates green.**
**Scope:** types/contracts only — no business logic, no H3, no RPC/finalize/migration/UI changes.

> **Sequencing note (remaining risk #1):** both planning docs
> (`phase-02-execution-plan.md` §7, `phase-02-implementation-order.md`) label **02D-03
> as the grid abstraction (`grid.ts`)**. This task delivered a *domain-types slice*
> under the 02D-03 label instead, ahead of grid/capture. The grid abstraction remains
> unbuilt. Recommend updating the planning docs to record this inserted slice (or
> renumber) so doc↔reality stays reconcilable.

---

## Files created
- `features/territory/types.ts` — pure types: `CellId`, `TerritoryAction`,
  `TerritoryCapture`, `TerritoryOwnership`, `CaptureSummary`, `CaptureSummarySource`,
  and DB row aliases `TerritoryCaptureRow` / `CellOwnershipRow` (`= Tables<…>`).
- `features/territory/mappers.ts` — pure helpers: `TERRITORY_ACTIONS` const,
  `isTerritoryAction` guard, `toTerritoryCapture`, `toTerritoryOwnership`, `toCaptureSummary`.
- `tests/unit/features/territory/mappers.test.ts` — 19 unit tests (TDD).

## Files modified
- **None.** New feature directory `features/territory/`. No migration, so
  `database.types.ts` is untouched; `finalize_workout` and the RPC are untouched.

## Tests added (19, in `mappers.test.ts`)
- **Action classification:** `isTerritoryAction` accepts `claim`/`steal`/`defend`,
  rejects invalid strings (`''`, `CLAIM`, `capture`, `stolen`) and non-strings
  (`null`, `undefined`, `123`, `{}`, `['claim']`); `TERRITORY_ACTIONS` equals the three.
- **Deserialization / type contracts:** `toTerritoryCapture` and `toTerritoryOwnership`
  map a strongly-typed snake_case row fixture to the camelCase domain shape (the row
  alias + mapper + domain type are exercised together, so `tsc` enforces the contract).
- **Defensive narrowing:** `toTerritoryCapture` throws on an action outside the union
  (the `string`→union boundary; unreachable given the DB CHECK, but fails loud).
- **Summary normalization (serialization edge):** `toCaptureSummary` coalesces null
  cell counts to `0` and passes present counts through.

## Test results
- `npx jest …/territory/mappers.test.ts` → **19 passed / 19**.
- Full suite `npm test` → **224 passed, 39 skipped, 0 failed** (was 205 before this
  task; +19 territory tests). The 39 skips are the 5 DB-integration suites
  (no `SUPABASE_SERVICE_ROLE_KEY`) — unchanged by this task.
- TDD observed: RED (`Cannot find module '@/features/territory/mappers'`) → created
  modules → GREEN.

## Lint results
- `npm run lint` (eslint) — **clean**, no warnings or errors.

## Typecheck results
- `npm run typecheck` (`tsc --noEmit`) — **clean**. No `any`. The `as const satisfies
  readonly TerritoryAction[]` keeps `TERRITORY_ACTIONS` in sync with the union at
  compile time.

## Key decisions (surfaced)
1. **`CellId` is a plain `type CellId = string` alias, not branded.** Matches the
   project's plain-string id convention (`workoutId`, `userId` are plain strings in
   `running`); CLAUDE.md §3 "match existing style" outranks the appeal of nominal
   typing, and branding only `CellId` (while `workoutId`/`userId` stay plain) would be
   internally inconsistent. Single rename point if branding ever earns its keep.
2. **camelCase domain types + snake_case row aliases**, mirroring `features/running`
   (`Workout = Tables<…>`, `FinalizeResult` camelCase). Mappers do row→domain only —
   the write direction is RPC-only, so no domain→row serializer (avoids dead code).
3. **`CaptureSummarySource`** is a local nullable shape, structurally compatible with
   `running`'s `FinalizeResult` cell fields — lets `toCaptureSummary` consume a finalize
   result without a cross-feature import.

## Remaining risks
1. **02D-03 label vs. docs** — see sequencing note above; grid abstraction still
   pending. Update planning docs.
2. **`CaptureSummarySource` couples by shape** to `FinalizeResult`'s cell fields; if
   those field names/nullability change, the input contract drifts silently. Low risk
   (both derive from the `finalize_workout_result` composite).
3. **`CellId` gives no compile-time protection** against an arbitrary string (accepted,
   per decision 1).
4. **`toTerritoryCapture` throw branch is unreachable** while the DB CHECK exists;
   intentional fail-loud if the CHECK were ever removed.
5. **Not committed to git** (consistent with prior Phase 02 tasks; `features/` is
   untracked along with the rest of Phase 02).

---

**Constraints honored:** 02D-04 not started · no capture logic · no H3 conversion ·
`finalize_workout` unmodified · XP untouched · no migration · no React UI.

**Status: 02D-03 (territory domain layer) implemented and verified. Paused after report.**
