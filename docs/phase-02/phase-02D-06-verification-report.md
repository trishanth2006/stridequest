# Phase 02D-06 — Ownership Queries & Services — Verification Report

**Date:** 2026-06-04
**Scope:** Read-side territory ownership services only. No mutations, no RPCs, no ownership changes,
no XP, no React UI. 02D-05 was not revisited; `finalize_workout` and capture logic untouched.
**Reference:** `phase-02-master-spec.md`, `phase-02-execution-plan.md`, `phase-02-testing-strategy.md`.

---

## Files Created

| File | Purpose |
|---|---|
| `features/territory/services/ownership.ts` | The 02D-06 read service: `getOwnedCells`, `getCellOwnership`, `getOwnershipStats`. Pure query logic over an injected Supabase client; read-only. |
| `tests/unit/features/territory/services/ownership.test.ts` | 10 unit tests (mocked client). |
| `tests/integration/territory/ownership.test.ts` | 5 integration tests against live Postgres (DB-gated). |
| `docs/phase-02/phase-02D-06-verification-report.md` | This report. |

## Files Modified

**None.** The phase reused existing types and mappers without editing them:

- `TerritoryOwnership`, `CellId` — reused from `features/territory/types.ts` (no new domain types).
- `toTerritoryOwnership()` — reused from `features/territory/mappers.ts` for row→domain mapping.

`getOwnershipStats` returns the spec's inline shape `{ totalCells: number }` rather than introducing a
new named type, honoring "reuse existing / do not duplicate types."

## Design decisions (stated)

1. **Client injection.** Signatures are `getOwnedCells(supabase, userId)`,
   `getCellOwnership(supabase, cellIds)`, `getOwnershipStats(supabase, userId)` — the same
   dependency-injection pattern as `features/running/services/{finalize,history}.ts`. The spec wrote
   `getOwnedCells(userId)`; the client is injected as the first arg per the established repo convention
   (keeps services unit-testable and server/client-agnostic; the server caller owns client creation).
2. **Throw on DB error → return clean domain models.** Mirrors `finalizeWorkout`. "DB error
   propagation" means the error surfaces as a thrown `Error`.
3. **`getCellOwnership([])` short-circuits to `[]`** without issuing a query.
4. **`getOwnershipStats` uses a `head` + `count: 'exact'` query** — counts without transferring rows.
5. **Layout:** placed under `features/territory/services/` per the spec. This introduces a `services/`
   subdir to a territory feature that was previously flat (`types.ts`, `mappers.ts`, `grid.ts`,
   `capture.ts`). Existing flat files were left in place (surgical — no refactor of working code). The
   `features/<feature>/services/` location is explicitly sanctioned by the architecture rules.

## Tests Added

**Unit (10, all executed + passing):**
- `getOwnedCells`: empty ownership → `[]`; owned cells mapped to `TerritoryOwnership` + filtered by
  `owner_user_id`; DB error throws.
- `getCellOwnership`: `IN (cell_id)` filter + mapping; partial (unowned cells absent); empty input
  short-circuits with no query; DB error throws.
- `getOwnershipStats`: returns `{ totalCells: count }`; null count → `0`; DB error throws.

**Integration (5, DB-gated — skipped without service-role creds):**
- `getOwnedCells` — a user sees the cells they own (owner-scoped).
- `getOwnershipStats` — `totalCells` matches owned count (u1=2, u2=1).
- **FR-OW-1 world-readable board** — any authenticated user can read another user's cells via both
  `getOwnedCells` and `getCellOwnership`.
- `getCellOwnership` — unowned cells absent from the result.
- **RLS (02D-02)** — an anonymous caller reads zero ownership rows.

**Live verification of the anon-RLS assertion (MCP, read-only, 2026-06-04).** Because the service
throws on any query error, the anon test's `[]` expectation needed confirming against the real grant +
policy (not assumed): `has_table_privilege('anon','public.cell_ownership','SELECT') = true` (so anon
gets no permission error → the service does **not** throw), and the only SELECT policy is
`authenticated_read_cell_ownership` (`roles={authenticated}`, `qual=true`) with RLS enabled — anon
matches no policy, so it reads **0 rows → `[]`**. The assertion is therefore correct.

## Verification Results

TDD cycle followed: unit test written first and **watched fail** (`Cannot find module …/ownership`),
then minimal implementation made it pass.

Final gates (fresh run, after all changes):

| Gate | Command | Result |
|---|---|---|
| Typecheck | `tsc --noEmit` | **exit 0**, 0 errors |
| Lint | `eslint` | **exit 0**, 0 errors/warnings |
| Tests | `jest` | **exit 0** — `Test Suites: 8 skipped, 28 passed`; `Tests: 56 skipped, 294 passed, 350 total`; **0 failed** |

- New ownership unit suite: **10/10 passing**.
- New ownership integration suite: 5 tests, DB-gated → skipped locally (run in CI with creds).
- No regressions: all previously-passing suites still pass (baseline 284 → 294 passed; the +10 are this
  phase's unit tests; +5 skipped are this phase's integration tests).

## Remaining Risks

1. **Integration tests skipped locally.** The world-readable (FR-OW-1) and anonymous-RLS assertions run
   only with service-role + anon creds (CI). They are written, typecheck-clean, and parse, but were not
   executed here. The anon-RLS assertion was additionally confirmed against the live grant + policy via
   MCP (see "Live verification" above); the authenticated assertions rest on the existing passing
   cross-user reads in `rls.test.ts`. *Recommendation: run the integration suite in CI to confirm the
   full flow against the live board.*
2. **`getOwnershipStats` exact-count behavior** is verified by unit mock and exercised against the live
   DB only in the (skipped) integration test — confirm in CI.
3. **Mixed territory layout** (`services/ownership.ts` alongside flat peers). Cosmetic; per spec.
   Existing files intentionally not moved. Could be reconciled in a later layout pass if desired.
4. **No shared `OwnershipStats` type.** Inlined per spec; if the board UI later needs the shape in
   multiple places, promote it to `features/territory/types.ts`.

## Out of scope (confirmed not touched)

`finalize_workout` / 02D-05 · territory capture logic · XP logic · any mutation/RPC/ownership change ·
any React UI. This phase is query/read-only.

---

**Paused. 02D-07 not started. XP work not started. No UI built.**
