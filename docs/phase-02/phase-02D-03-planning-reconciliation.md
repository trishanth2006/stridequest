# Phase 02D Planning Reconciliation — 02D-03 label drift

**Date:** 2026-06-03
**Trigger:** 02D-03 shipped as *Territory Domain Types & Contracts*, but the planning
docs still defined 02D-03 as the *Grid Abstraction*. (Flagged as remaining-risk #1 in
`phase-02D-03-verification-report.md`.)
**Decision:** **Option C** — redefine `02D-03` = Types & Contracts (done) and insert
`02D-03A` = Grid Abstraction, leaving `02D-04…07` untouched.

---

## 1. References to 02D-03 found (before)

| Doc | Location | Said |
|---|---|---|
| `phase-02-implementation-order.md` | §02D-03 (L275) | "Grid abstraction (`grid.ts`)" — files `grid.ts` **+ `types.ts`**, tests `grid.test.ts` |
| `phase-02-implementation-order.md` | §02D-04 prereq (L287) | Capture depends on `02D-03` |
| `phase-02-implementation-order.md` | summary list (L425) | "02D-03 grid abstraction" |
| `phase-02-execution-plan.md` | 02D table row (L112) | "Grid abstraction module" — `grid.ts`, `pathToCells`/`cellToCenter` |
| `phase-02-execution-plan.md` | 02D table row (L113) | Capture depends on `02D-03` |
| `phase-02-master-spec.md` | §4 milestone table | 02D milestone prose only (`grid.ts`/`capture.ts` as deliverables) — **no task-level 02D-03 ID** |

**Planned 02D-03 deliverables/files:** `features/territory/services/grid.ts` (+ `types.ts`);
`pathToCells(linestring, resolution)`, `cellToCenter(id)`; H3 behind the interface; `grid.test.ts`.

## 2. Planned vs implemented

| | Planned 02D-03 (grid) | Implemented 02D-03 (shipped) |
|---|---|---|
| Files | `services/grid.ts` (+ `types.ts`) | `types.ts`, `mappers.ts` |
| Content | H3 path→cells conversion | `CellId`, `TerritoryAction`, domain types, row aliases, pure mappers |
| Tests | `services/grid.test.ts` | `mappers.test.ts` (19 passing) |

The original 02D-03 bundled **both** `grid.ts` and `types.ts`. What shipped is the
`types.ts` half (expanded into types + mappers); the `grid.ts` half is still pending.

## 3. Why Option C (not A or B)

- **Option B (renumber grid→04, cascade finalize→06): rejected.** `02D-05 = finalize_rpc
  (capture+ownership)` is referenced in **shipped code that this task may not modify** —
  `supabase/migrations/20260603125740_territory_rls.sql` (L4, L29, L48),
  `features/territory/types.ts` (L50), `tests/integration/security/rls.test.ts` (L257).
  Cascading would make the docs say "06=finalize" while the code says "05=finalize" — new
  drift, unfixable here.
- **Option A literally ("03A = Types"): rejected.** Reality already fixed `02D-03 = Types`
  (three verification reports, this conversation). Calling the *done* work "03A" while
  "03" stayed "grid (pending)" would contradict what shipped.
- **Option C: chosen.** Matches shipped reality, preserves every downstream ID the shipped
  code references, and re-slots grid between 03 and 04 (capture depends on grid).
- **Precedent:** the project already uses letter-suffix inserts — see "Phase 02C-02A
  race-condition fix" in the current status. `02D-03A` is the established pattern for
  inserting a task without renumbering its successors, not a new convention.

## 4. Files modified + exact wording changed

### `docs/phase-02/phase-02-implementation-order.md`
1. **§02D-03 heading + body** — was `### 02D-03 — Grid abstraction (`grid.ts`)` (prereq
   R-04/R-07; files `grid.ts, types.ts`; tests `grid.test.ts`). Now
   `### 02D-03 — Territory domain types & contracts ✅ done` (prereq 02D-01; files
   `types.ts, mappers.ts`; tests `mappers.test.ts`; deliverables list; note that it was
   split from the grid task).
2. **Inserted** a new `### 02D-03A — Grid abstraction (`grid.ts`)` section (prereq R-04,
   R-07, **02D-03**; file `grid.ts`; tests `grid.test.ts`) — the relocated grid deliverable.
3. **§02D-04 prerequisite** — `- **Prerequisites:** 02D-03.` → `- **Prerequisites:** 02D-03A.`
4. **Summary list** — `02D-03 grid abstraction` → `02D-03 territory types & contracts` +
   new line `02D-03A grid abstraction`.

### `docs/phase-02/phase-02-execution-plan.md`
5. **02D table, 02D-03 row** — was `| 02D-03 | Grid abstraction module. | ...grid.ts | A1
   confirmed | M | ... |`. Now `| 02D-03 | Territory domain types & contracts (✅ done). |
   types.ts, mappers.ts | 02D-01 | S | ... |`, and **inserted** `| 02D-03A | Grid
   abstraction module. | ...grid.ts | 02D-03, A1 confirmed | M | ... |`.
6. **02D table, 02D-04 row** — dependency `02D-03` → `02D-03A`.

### Docs read, **no change required**
- `phase-02-master-spec.md` — references 02D only at the *milestone* level (prose lists
  `grid.ts`/`capture.ts` as deliverables); no task-level `02D-03` ID. Prose still accurate.
- (Out of scope, checked for consistency) `phase-02-risk-register.md` L101 "Open until
  02D-05 green" stays correct (05 is still finalize/contention under C); execution-plan
  L40 milestone prose and L140/L148 (`02D-04` capture, `02D-05` contention) remain correct.

## 5. Updated milestone ordering (02D)

| ID | Task | Status |
|---|---|---|
| 02D-01 | `create_territory_tables` migration | ✅ |
| 02D-02 | `territory_rls` migration | ✅ |
| 02D-03 | Territory domain types & contracts | ✅ |
| **02D-03A** | **Grid abstraction (`grid.ts`)** | ⬜ next |
| 02D-04 | Capture service (`capture.ts`) | ⬜ |
| 02D-05 | `finalize_rpc` v2 (capture + ownership) | ⬜ |
| 02D-06 | Ownership read helper | ⬜ |
| 02D-07 | Territory board page | ⬜ |

Dependency chain after reconciliation: `02D-03 → 02D-03A → 02D-04 → 02D-05 → 02D-06 → 02D-07`.

## 6. Confirmation: future sessions will not be confused

- A session reading **any** of the three docs now sees `02D-03 = Types & Contracts (done)`
  and `02D-03A = Grid Abstraction (pending)` — consistent with the shipped code and the
  `phase-02D-03-verification-report.md`.
- `grep 02D-03` → types & contracts; `grep 02D-03A` → grid. No doc still maps 02D-03 to grid.
- Downstream IDs `02D-04…07` are unchanged, so shipped code comments that reference
  `02D-05 = finalize` remain correct — **no code was modified** and none needed to be.
- The letter-suffix insert matches existing project precedent (`02C-02A`), so the scheme
  reads as intentional, not as an anomaly.

---

**Constraints honored:** no code modified · grid abstraction not implemented · 02D-04 not
started · only planning docs edited. **Paused after reconciliation.**
