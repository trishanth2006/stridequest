# Phase 02 Master Specification — Single Entry Point

**Audience.** Every future Claude Code session working on StrideQuest Phase 02.
**Purpose.** One canonical place to start. Open this first; follow the links from here.
**Status.** Planning. Implementation has NOT begun. The Architecture Approval Gate
must close (see §3) before any migration or code in Phase 02 scope.

> If you are starting a new session, **read this file end-to-end first**, then read
> the linked docs in the order shown in §1. Do not begin work without that pass.

---

## 1. Documentation Index

The full Phase 02 documentation set. Read in this order for first-time onboarding:

1. [`../phase-01-completion-report.md`](../phase-01-completion-report.md) — what already exists, why it exists that way, and what the test pyramid + folder layout look like.
2. [`phase-02-architecture.md`](./phase-02-architecture.md) — the approved-direction architecture. Source of truth for *every* design decision in Phase 02.
3. [`phase-02-requirements.md`](./phase-02-requirements.md) — functional + non-functional requirements with acceptance criteria.
4. [`phase-02-execution-plan.md`](./phase-02-execution-plan.md) — milestones (02A–02E), task IDs, dependencies, complexity, verification gates.
5. [`phase-02-database-plan.md`](./phase-02-database-plan.md) — six planned migrations (purpose, tables, indexes, RLS, verification, rollback). Planning only — no SQL.
6. [`phase-02-testing-strategy.md`](./phase-02-testing-strategy.md) — unit / integration / Playwright matrix and coverage targets.
7. [`phase-02-risk-register.md`](./phase-02-risk-register.md) — 13 risks with likelihood / impact / mitigation / owner / status.
8. [`phase-02-implementation-order.md`](./phase-02-implementation-order.md) — strict build order, per-task prerequisites / files / tests / verification commands.

Project-level files referenced from every Phase 02 doc:

- [`../../CLAUDE.md`](../../CLAUDE.md) — behavioral guidelines and StrideQuest engineering rules (file size, TypeScript strictness, feature-first architecture, MVP scope, testing discipline).
- [`../../requirements.md`](../../requirements.md) — Phase 01 product requirements (kept for historical context; **does not** govern Phase 02 scope).

If a new Phase 02 planning artifact is added later (e.g. ADRs, decision logs, a completion report), it lives in `docs/phase-02/` and is linked from this index.

---

## 2. Source-of-Truth Hierarchy

When two documents disagree, resolve **upward**: the higher tier wins. Lower tiers are derived artifacts; if they conflict with a higher tier, the lower tier is wrong and must be updated.

```
┌─────────────────────────────────────────────────────────────────────┐
│ TIER 0 — Behavioral / process rules                                  │
│   CLAUDE.md                                                          │
│   (file size, TS strictness, feature-first, MCP migrations,          │
│    centralized tests, "no business logic under app/", TDD posture,   │
│    MVP scope discipline)                                             │
└─────────────────────────────────────────────────────────────────────┘
                                  │  governs ↓
┌─────────────────────────────────────────────────────────────────────┐
│ TIER 1 — Architecture (the design)                                   │
│   docs/phase-02/phase-02-architecture.md                             │
│   (GPS tracking, route model, finalize trust boundary, capture       │
│    model A, contention rule, grid options, schema proposal, API      │
│    boundaries, folder tree, remaining risks)                         │
└─────────────────────────────────────────────────────────────────────┘
                                  │  governs ↓
┌─────────────────────────────────────────────────────────────────────┐
│ TIER 2 — Requirements (the contract)                                 │
│   docs/phase-02/phase-02-requirements.md                             │
│   (FR-WL, FR-GPS, FR-RR, FR-RP, FR-TC, FR-OW, FR-XP,                 │
│    NFR-Performance, NFR-Scalability, NFR-Reliability,                │
│    NFR-Battery, NFR-Security; acceptance criteria per item)          │
└─────────────────────────────────────────────────────────────────────┘
                                  │  governs ↓
┌─────────────────────────────────────────────────────────────────────┐
│ TIER 3 — Plans (the how / when / verify)                             │
│   docs/phase-02/phase-02-execution-plan.md                           │
│   docs/phase-02/phase-02-database-plan.md                            │
│   docs/phase-02/phase-02-testing-strategy.md                         │
│   docs/phase-02/phase-02-implementation-order.md                     │
│   docs/phase-02/phase-02-risk-register.md                            │
└─────────────────────────────────────────────────────────────────────┘
                                  │  governs ↓
┌─────────────────────────────────────────────────────────────────────┐
│ TIER 4 — Source code, migrations, tests                              │
│   features/, app/, infrastructure/, lib/, tests/,                    │
│   supabase/migrations/                                               │
│   (the live state — what actually exists in the repo)                │
└─────────────────────────────────────────────────────────────────────┘
                                  │  governs ↓
┌─────────────────────────────────────────────────────────────────────┐
│ TIER 5 — Live database (Supabase)                                    │
│   ← always reconciled back to Tier 4 via migrations                  │
└─────────────────────────────────────────────────────────────────────┘
```

**Rules of the road**

- Repository (Tier 4) is the source of truth for the database; the live DB (Tier 5) must always be reconcilable from `supabase/migrations/`.
- Architecture (Tier 1) is approved direction; do **not** redesign it inside a planning doc or PR. Open an architecture amendment instead.
- Phase 01's `requirements.md` is historical for Phase 02 purposes; it does not override Phase 02 docs. Phase 02 requirements live at Tier 2 here.
- `phase-01-completion-report.md` is also historical — it records final state and rationale for Phase 01, but it does not govern Phase 02.

---

## 3. Current Project Status

### Phase 01

**Status:** ✅ COMPLETE.

- 5 migrations applied and verified; repo is the source of truth.
- 37 Jest tests (unit + integration) and 14 Playwright tests, **all green**.
- Lint and typecheck clean.
- See [`../phase-01-completion-report.md`](../phase-01-completion-report.md) for the full record.

### Phase 02

**Status:** 📋 **PLANNING COMPLETE — AWAITING ARCHITECTURE APPROVAL GATE.**

What exists today (in this repo):

- Architecture proposal: [`phase-02-architecture.md`](./phase-02-architecture.md).
- Requirements, execution plan, database plan, testing strategy, risk register, implementation order — all in this folder.
- This master spec.

What does **not** exist yet (and must not be created until the gate closes):

- Any Phase 02 migration (PostGIS, workouts, route_points, territory_*, finalize RPC).
- Any code under `features/running/`, `features/territory/`, `app/(protected)/run/`, `app/(protected)/territory/`, `app/api/workouts/`.
- Any Phase 02 tests.

### Gating decisions (must close before implementation)

| ID | Decision | Default / recommendation | Where it lives once decided |
|---|---|---|---|
| **A1** | Grid system (arch §5). | **H3 at resolution ~9** (recommended). | Append to `phase-02-architecture.md` or sibling ADR. |
| **A2** | Capture model. | Path coverage (model A) — already declared in arch §4.1. | No further sign-off needed. |
| **A3** | Contention rule. | Last-writer-wins — already declared in arch §4.4. | No further sign-off needed. |
| **A5** | XP weights (initial). | TBD, set as constants in `features/running/services/xp.ts` at 02E start. | Header of that file. |
| **R-07** | H3 in DB (`h3-pg`) vs. cell ids precomputed in TS. | Decision required at start of 02D. | Append to architecture doc / ADR. |

Until A1 and R-07 close, no Phase 02 migration is written.

---

## 4. Phase 02 Milestone Summary

Five sequential milestones. Each exits green only when **all six verification gates** pass for its scope (lint, typecheck, Jest, Playwright, MCP migration verification, generated-types-in-sync). Source: [`phase-02-execution-plan.md`](./phase-02-execution-plan.md) §§2 and 10.

| Milestone | Name | What ships | Key risks closed | Exit gate (in words) |
|---|---|---|---|---|
| **02A** | Workout Foundation | PostGIS enabled · `workouts` table + indexes + RLS · workout schemas/types · `startWorkout` / `stopWorkout` (stub) / `discardWorkout` server actions · `WorkoutControls` UI · `(protected)/run` page. | R-03 (PostGIS installed cleanly), R-13 (types-regen flow established). | Start/stop/discard happy path passes Playwright; RLS integration test passes; migration verification clean. |
| **02B** | GPS Engine | `route_points` table + RLS · `sample-filter` (pure) · `distance` (pure) · `sample-buffer` · `useGeolocation` · `useWorkoutRecorder` state machine · `POST /api/workouts/[id]/points` idempotent ingest · live distance estimate. | R-01 (filter), R-02 (buffer + idempotent ingest), R-10 (buffer resilience), R-12 (UNIQUE `(workout_id, batch_seq, point_seq)`). | Duplicate `batch_seq` ingest integration test proves idempotency. |
| **02C** | Route Processing | `finalize_rpc v1` (compose LINESTRING, derive distance/duration/pace) · `stopWorkout` wired to RPC · `(protected)/run/history` page. | R-11 (raw/processed split formalized). | A real start → stream → stop flow produces a `completed` workout with non-null derived metrics; re-finalize is a no-op. |
| **02D** | Territory System | `territory_captures` + `cell_ownership` tables · `territory_rls` (board-readable, RPC-only writes) · `grid.ts` (H3 abstraction) · `capture.ts` (path→cells, deterministic) · `finalize_rpc v2` (capture + ownership upsert under row lock) · ownership read helper · `(protected)/territory` page. | R-04 (closed via implementation), R-05 (spatial RLS), R-06 (contention), R-07 (H3 path chosen). | Contention integration test reproduces last-writer-wins with full audit; direct client write to `cell_ownership` rejected. |
| **02E** | XP System | Pure `xp()` function · `finalize_rpc v3` (XP + profile rollup) · dashboard reflects new `total_xp` / `total_distance_m`. | R-09 (TS↔SQL parity), R-08 (no anti-grind creep). | E2E Playwright: start → emit synthetic samples → stop → dashboard shows updated XP; parity integration test green. |

Milestones are strictly sequential. No work on milestone *n+1* begins until milestone *n* is closed green.

---

## 5. Definition of Done — Phase 02

Phase 02 is closed only when **all** of the following are true. There is no partial close.

### Functional / acceptance

- All `FR-*` acceptance criteria in `phase-02-requirements.md` pass at the appropriate test tier.
- All `NFR-*` targets are met or have a documented, accepted variance recorded in the completion report.
- All tasks `02A-01 … 02E-03` in `phase-02-execution-plan.md` are complete with their acceptance criteria met.

### Database

- Six (or seven, if `workouts_rls` is split) migrations committed under `supabase/migrations/`, MCP-applied, MCP-verified.
- `infrastructure/supabase/database.types.ts` regenerated from the live schema and committed; matches on-disk.
- MCP `get_advisors` shows no high-severity findings.
- MCP `list_migrations` matches the committed file list.

### Code quality (per CLAUDE.md)

- `npm run lint` — clean.
- `npm run typecheck` — clean. No `any`. No `@ts-ignore` without a one-line justification.
- No file over 300 lines.
- No dead code; no duplicated logic; reuse over duplication.

### Tests

- `npm test` — all unit + integration tests green.
- `npm run test:e2e` — all Playwright tests green.
- Coverage targets met: ≥ 80% overall; 100% acceptance-criteria coverage on critical paths; 100% branch coverage on pure logic modules (`sample-filter`, `distance`, `xp`, `grid`, `capture`).
- Parity test for TS XP function vs. SQL implementation is present and green (R-09).

### Security

- All write paths to `workouts`, `route_points`, `territory_captures` are owner-scoped via RLS.
- `cell_ownership` is world-readable to authenticated users and **not** client-writable; all writes flow through the `security definer` finalize RPC.
- Finalize RPC has `SECURITY DEFINER`, locked `search_path = ''`, `EXECUTE` revoked from `PUBLIC` and granted to `authenticated`.
- No service-role key in app code.

### Documentation

- All risks in `phase-02-risk-register.md` are either resolved (status updated) or explicitly carried forward into Phase 03 with an owner.
- All gating decisions in §3 above are recorded (in the architecture doc or a sibling ADR).
- `docs/phase-02/phase-02-completion-report.md` exists, mirroring the shape of `docs/phase-01-completion-report.md` (history, decisions, lessons, metrics).

Phase 02 is not "done" because code runs. It is done when every item above is checked, reproducible, and committed.

---

## 6. Next Approved Action

> The Architecture Approval Gate has not closed. Until it does, the only approved
> action is to close the gate.

**Step 1 — Architecture Approval Gate (blocks everything else).**

Decisions to record (in `phase-02-architecture.md` or a sibling ADR):

1. **A1 — Grid choice.** Recommended: H3 at resolution ~9. Either confirm or amend.
2. **A2 — Capture model.** Already declared as path coverage (model A) in the architecture doc; sign-off acknowledged here for completeness.
3. **A3 — Contention rule.** Already declared as last-writer-wins; sign-off acknowledged here for completeness.
4. **Folder tree.** The proposed structure in `phase-02-architecture.md` §11 is approved as-is, or amended.
5. **Approval of this planning suite** (the seven docs in `docs/phase-02/` plus this master spec).

Once approval is recorded, the **only** next step is task **02A-01** from `phase-02-implementation-order.md`:

> **02A-01 — Enable PostGIS.**
> Write the migration via MCP. Commit `supabase/migrations/<ts>_enable_postgis.sql`. Regenerate `infrastructure/supabase/database.types.ts`. Verify via MCP (`list_extensions`, `get_advisors`). Add a migration-verification integration test asserting the extension is enabled. No other work begins in parallel.

After 02A-01 is green, follow `phase-02-implementation-order.md` task-by-task, in the order listed. Do not skip ahead. Do not bundle migrations.

**What NOT to do, by default**

- Do not write migrations before A1 has closed.
- Do not start `features/running/` code before the migration in 02A-01 is verified.
- Do not implement Mapbox, Health Connect, leaderboards, social, or any feature explicitly flagged out-of-scope in `phase-02-requirements.md` §4 or `phase-02-architecture.md` §0.
- Do not introduce anti-grind XP logic; FR-XP-3 explicitly defers it.
- Do not hand-edit `database.types.ts`; always regenerate.

If a request seems to require any of the above, stop and revisit the Architecture Approval Gate before continuing.

---

## 7. How to use this spec in a new session

1. Read this file completely.
2. Read [`phase-02-architecture.md`](./phase-02-architecture.md) — it is the design.
3. Open the doc relevant to your task:
   - Working on a migration? → [`phase-02-database-plan.md`](./phase-02-database-plan.md) + [`phase-02-implementation-order.md`](./phase-02-implementation-order.md).
   - Working on a feature module? → [`phase-02-execution-plan.md`](./phase-02-execution-plan.md) (find the task ID) + [`phase-02-implementation-order.md`](./phase-02-implementation-order.md) (prerequisites + verification commands).
   - Writing tests? → [`phase-02-testing-strategy.md`](./phase-02-testing-strategy.md).
   - Unsure if something is in scope? → [`phase-02-requirements.md`](./phase-02-requirements.md) §4 ("Out of Scope") and `phase-02-architecture.md` §0 ("Non-Goals").
4. Before claiming a task done, run the verification gates from `phase-02-execution-plan.md` §10 for the relevant scope.
5. After any schema change, regenerate `infrastructure/supabase/database.types.ts` and commit it in the same PR as the migration.
