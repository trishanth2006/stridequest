# Phase 02D-04 — Territory Capture Service — Architecture Review

**Date:** 2026-06-03
**Type:** pre-implementation review (no code written).
**Bottom line:** **02D-04 = GO** (pure module, needed under every downstream resolution).
**02D-05 = NO-GO until a trust-boundary decision is recorded** (see Finding 1).

---

## 1. Architecture Review

### 1.1 Predecessor completeness (confirmed)

| Task | Status | Evidence (repo reality) |
|---|---|---|
| 02D-01 territory tables | ✅ | Live `territory_captures` + `cell_ownership` verified; `list_migrations` has `20260603113038`. (`phase-02D-01-verification-report.md`) |
| 02D-02 territory RLS | ✅ | Both tables RLS-on, SELECT-only, 0 write policies; `rls_enabled_no_policy` cleared. (`phase-02D-02-verification-report.md`) |
| 02D-03 types & contracts | ✅ | `features/territory/types.ts`, `mappers.ts`; 19 unit tests. |
| 02D-03A grid abstraction | ✅ | `features/territory/grid.ts` (`pathToCells`, `dedupeCells`, `normalizeCellIds`, `H3_RESOLUTION=9`); 24 unit tests; `h3-js@4.4.0`. |

All four green; full suite 248 passed / 39 skipped / 0 failed. **Predecessors are complete.**

### 1.2 Capture pipeline trace (annotated by *where it runs* and *which milestone*)

```
route_points (DB, raw, authoritative)                       [exists, 02B]
   │  read server-side (TS)                                 ← 02D-05 wiring
   ▼
ordered samples  (order by recorded_at, batch_seq, point_seq)
   │  capture.ts: order → LatLng[] → grid.pathToCells → grid.normalizeCellIds
   ▼
captured cell set : CellId[]  (canonical, sorted, unique)   ← 02D-04  (PURE TS, this task)
   │  passed as a parameter to the finalize RPC
   ▼
finalize_workout v2 (SQL, SECURITY DEFINER, one txn):       ← 02D-05  (DEFERRED)
   • classify each cell vs current cell_ownership → claim|steal|defend
   • INSERT territory_captures (audit)
   • UPSERT cell_ownership under row lock (last-writer-wins, FR-TC-5)
   • return cells_claimed / cells_stolen / cells_defended
   ▼
cell_ownership / territory_captures (DB)                    ← 02D-05
   ▼
board read (ownership.ts → /territory page)                 ← 02D-06 / 02D-07
```

Canonical `workouts.path` (LINESTRING) is still composed **in SQL** by finalize (v1 already
does this). Under the approved decision, **cells are computed in TS** (R-07 path (b)), so path
and cells are two independent derivations of the same `route_points` — see Risk 3 (ordering parity).

### 1.3 ⚠ FINDING 1 (central) — the trust boundary breaks under "TS-side generation"

Three approved decisions are **mutually incompatible as stated**:

1. *"TypeScript-side generation"* → finalize v2 must accept a precomputed `p_cell_ids text[]`.
2. *"finalize_workout remains the trust boundary."*
3. The RPC is **`authenticated`-executable** via PostgREST — `grant execute on function
   public.finalize_workout(...) to authenticated` ([finalize_rpc.sql:129](../../supabase/migrations/20260602184810_finalize_rpc.sql#L129)), reachable at `/rest/v1/rpc/finalize_workout`.

The moment v2 takes a caller-supplied cell array, **any authenticated user can call the RPC
directly with arbitrary cells and claim the entire board.** The internal check
`workouts.user_id = auth.uid()` proves they own the *workout*, not that they *ran through those
cells*. The RPC **cannot** re-validate cells against the path — there is no H3 in SQL (that is
the entire point of path (b)). Computing cells "server-side in the action" does **not** help:
PostgREST exposes the RPC independently of the server action.

This is an R-05 × R-07 × R-08 intersection and is the **discriminating decision for 02D-05**.
Option space (a **tech-lead call** — this review does not pick):

- **(a) Lock the entry point.** Revoke `EXECUTE` from `authenticated`; invoke v2 only from a
  privileged server context (service-role / secret), so the cell-accepting endpoint is not
  client-reachable. Keeps the approved TS decision; changes how the RPC is called.
- **(b) Compute in-RPC.** Install `h3-pg` and derive cells inside the RPC from the path (R-07
  path (a)) — **reverses** the approved "TS-side generation" decision; restores a clean trust
  boundary.
- **(c) In-RPC plausibility check** of supplied cells against the path — unreliable without H3,
  and squarely the anti-cheat scope-creep R-08 warns against. Not recommended.

**Consequence:** 02D-05 must not begin until this is recorded (ADR / architecture amendment).
**It does not affect 02D-04** — `capture.ts` returning `CellId[]` is required under (a), (b),
and (c) alike, has no side effects, and is not yet wired into finalize.

### 1.4 What belongs in 02D-04 vs what must stay in 02D-05

| Concern | Where | Why |
|---|---|---|
| path → canonical cell set (`CellId[]`) | **02D-04** (`capture.ts`, pure TS) | deterministic, no DB |
| point ordering before cell conversion | **02D-04** | correctness of segment fill (see 1.5) |
| action classification `claim/steal/defend` | **02D-05** (SQL) | needs *current* `cell_ownership` |
| `territory_captures` INSERT | **02D-05** (RPC) | RPC-write-only (NFR-Sec-2) |
| `cell_ownership` UPSERT, row lock, last-writer-wins | **02D-05** (RPC) | R-06; DB transaction only |
| capture summary counts | **02D-05** | derived during classification |
| finalize v2 signature + trust mitigation | **02D-05** | Finding 1 |
| ownership read / board | 02D-06 / 02D-07 | downstream |

02D-04 produces **candidate** captured cells. They become *captures* (with actions + ownership)
only in 02D-05.

### 1.5 Duplication check vs 02D-03A (the user's explicit concern)

`capture.ts` must **compose** grid primitives, never re-implement them. A bare
`normalizeCellIds(pathToCells(path))` would be a redundant one-line wrapper. `capture.ts` earns
its existence by owning **point ordering**, which is **load-bearing for correctness, not just
SQL parity:** `grid.pathToCells` fills the segment between *consecutive* points via
`gridPathCells`, so **out-of-order input produces wrong intermediate cells.** Ordering by
`(recorded_at, batch_seq, point_seq)` is therefore a capture responsibility (and, secondarily,
keeps the TS cell set aligned with the SQL LINESTRING ordering). With that, `capture.ts` =
ordering + adaptation + the single canonical "route → captured cells" operation. **No
duplication**, provided it delegates all H3 to `grid.ts`.

### 1.6 Doc ↔ code mismatches found + proposed reconciliation

1. **R-07 was treated as a settled "pick TS," but its security consequence (Finding 1) was
   never recorded.** *Reconcile:* add an ADR resolving R-07 to the chosen option (a/b/c) and
   note the trust-boundary handling; update `phase-02-database-plan.md` migration 6 step 5 and
   `phase-02-architecture.md` §4.2/§8.5, which currently describe H3 **inside** the RPC only.
2. **File-path drift (flat vs `services/`).** Shipped territory layout is flat
   (`features/territory/types.ts`, `mappers.ts`, `grid.ts`), but the docs say
   `features/territory/services/{grid,capture}.ts` (execution-plan L113–114, implementation-order
   §02D-03A/§02D-04). *Reconcile:* update those doc entries to the flat paths (recommend
   `features/territory/capture.ts`, `tests/unit/features/territory/capture.test.ts`). Minor;
   carried from the 02D-03A report.
3. **R-07's "the RPC contract stays the same" remark** is inaccurate for path (b) (the contract
   gains a `p_cell_ids` parameter). *Reconcile:* note in the ADR.

---

## 2. Implementation Plan — 02D-04 (pure capture service)

### Files to create
- `features/territory/capture.ts` (flat path; **not** `services/` — matches shipped layout).
- `tests/unit/features/territory/capture.test.ts`.
- `tests/fixtures/geo/*.json` (e.g. `l-shape.json`, `loop.json`) — per testing-strategy §6.3.

### Files to modify
- **None required.** Not `database.types.ts`, not `finalize_workout`, not migrations, not
  `types.ts`/`mappers.ts`/`grid.ts`. (If a shared route-point input type is preferred in
  `types.ts`, that is the only optional modify — otherwise the type lives in `capture.ts`.)

### Domain model
- **Input — ordered route samples.** Minimal shape so capture owns ordering:
  `CaptureRoutePoint = { lat: number; lng: number; recordedAt: string; batchSeq: number; pointSeq: number }`.
- **Output — `CellId[]`**: the canonical (sorted, unique) captured cell set. *Candidate* cells;
  no action, no ownership.

### Service API / signatures
```ts
// features/territory/capture.ts
export type CaptureRoutePoint = {
  lat: number; lng: number; recordedAt: string; batchSeq: number; pointSeq: number
}

// Pure, deterministic, server-side. Orders by (recordedAt, batchSeq, pointSeq) — parity with
// finalize's SQL LINESTRING composition — then delegates all H3 to grid.ts.
export function captureCells(points: readonly CaptureRoutePoint[]): CellId[]
//  empty -> []; throws (via grid) on invalid coordinates.
//  ≡ normalizeCellIds(pathToCells(orderedPoints.map(toLatLng)))
```

### Expected inputs / outputs
- `[]` → `[]`.
- one point → `[oneCell]`.
- scrambled order → **identical** result to sorted order (ordering owned internally).
- invalid coordinate (out of range / non-finite) → throws (delegated to `grid`).
- output always: lower-cased, valid res-9, de-duplicated, lexicographically sorted.

### Explicitly out of 02D-04 (deferred to 02D-05+)
No ownership reads/writes · no `claim/steal/defend` classification · no summary counts · no XP ·
no UI · no `finalize_workout` change · no migration · no DB access.

---

## 3. Test Plan

### Unit — **02D-04 (this task)** → `tests/unit/features/territory/capture.test.ts`
- determinism: same input → identical output.
- **ordering**: scrambled input → identical cells to ordered input (proves ordering + fill correctness).
- empty route → `[]`; single point → one valid res-9 cell.
- L-shape fixture: covers the path's cells (all valid res-9, sorted, contiguous along arms).
- loop fixture (model A): includes cells the loop **crosses**, **excludes** a known interior
  point's cell (assert `result` does not contain `latLngToCell(interiorPoint)`). This is the
  model-A vs model-B guard from testing-strategy §2.5.
- contract: `captureCells(pts) === normalizeCellIds(pathToCells(orderedLatLng))`.
- invalid coordinate → throws.
- *Fixture note:* hand-deriving exact H3 cells is impractical; assert **properties** + a
  **frozen snapshot** generated once and reviewed (strategy §6.3 "hand-checked once and frozen").

### Integration — **DEFERRED to 02D-05** (not in this task)
`tests/integration/territory/contention.test.ts` (last-writer-wins, audit), `…/capture-determinism.test.ts`
(TS cells vs DB effects), `tests/integration/security/rls.test.ts` (direct client write to
`cell_ownership`/`territory_captures` rejected), `tests/integration/running/finalize.test.ts`
(updated: captures + ownership effects).

### E2E — **DEFERRED to 02D-07**
`tests/e2e/territory/board.spec.ts` (board renders owned cells; anon redirects).

---

## 4. Risks

| # | Risk | Sev | Mitigation / owner |
|---|---|---|---|
| 1 | **Trust boundary breaks** (Finding 1): authenticated-executable RPC + caller-supplied cells = board takeover. | **Critical** | Record option (a)/(b)/(c) before 02D-05; tech-lead + security. Gates 02D-05. |
| 2 | Out-of-order input → wrong fill cells. | High | `capture.ts` owns ordering; scrambled-input unit test. |
| 3 | TS-capture vs SQL-path ordering parity (both from `route_points`). | Medium | Replicate `order by recorded_at, batch_seq, point_seq` exactly; document. |
| 4 | Doc↔code path drift (`services/` vs flat). | Low | Sync 02D-04 + 02D-03A doc entries to flat paths. |
| 5 | R-07 recorded as "pick TS" without its security consequence. | Medium | ADR + update database-plan M6 / arch §4.2,§8.5. |
| 6 | Exact H3 fixtures infeasible by hand. | Low | Property assertions + frozen snapshot. |
| 7 | `capture.ts` becomes a thin duplicate of `grid.ts`. | Low | Justified only if it owns ordering + adaptation; else fold into grid. |

---

## 5. Go / No-Go

- **02D-04 (pure capture service): GO (conditional).** It is required under *every* resolution
  of Finding 1, has no side effects, and is not wired into finalize. Conditions: (i) `capture.ts`
  owns point ordering and returns `CellId[]` only; (ii) flat path; (iii) classification /
  ownership / counts stay out; (iv) all H3 delegated to `grid.ts` (no duplication).
- **02D-05 (finalize v2 capture + ownership): NO-GO** until the **trust-boundary decision**
  (Finding 1) is recorded as an ADR, and R-07 / database-plan M6 / arch §4.2,§8.5 are reconciled.

**Verification of the user's guardrails (item 8):** the 02D-04 plan involves **no duplication
with 02D-03A** (delegates to grid), **no ownership writes**, **no XP**, **no UI**, and **no
`finalize_workout` modification**. ✅

---

**Recommendation:** proceed to implement **02D-04 only** (pure `capture.ts` + unit tests) on
approval; open a separate trust-boundary decision before 02D-05. No code written in this review.
**Paused.**
