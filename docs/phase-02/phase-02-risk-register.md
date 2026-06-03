# Phase 02 Risk Register

**Status:** Planning artifact. Maintained throughout Phase 02 implementation; closed out in the completion report.
**Source of truth (architecture):** [`docs/phase-02/phase-02-architecture.md`](./phase-02-architecture.md), §12 ("Remaining Risks") expanded here.

Scales:

- **Likelihood:** Low (unlikely under normal Phase 02 work) · Medium (plausible if uncautious) · High (will happen unless mitigated).
- **Impact:** Low (annoyance, recoverable in-PR) · Medium (rework of a milestone) · High (rework across milestones, possible data integrity hit) · Critical (data loss, security breach, blocks Phase 02 close).

Owner is a role, not a person, in this planning doc; assign names when work begins.

---

## R-01 — GPS accuracy in the wild

| Field | Value |
|---|---|
| **What** | Consumer-device GPS is noisy: 5–50 m typical accuracy in urban canyons, drifts when stationary, occasional teleport spikes. Naïve cumulative-distance math will inflate distance and contaminate captures. |
| **Likelihood** | High |
| **Impact** | Medium — distorts every authoritative metric (distance, capture set, XP). |
| **Architecture coupling** | arch §2.3 (filter pipeline), §3.3 (finalize is the trust boundary). |
| **Mitigation** | (1) Filter pipeline mandatory: accuracy gate, min-distance dedupe, speed sanity. (2) Filter is a pure function and unit-tested with noisy fixtures. (3) Finalize re-derives metrics server-side. (4) Smoothing (Kalman/MA) deliberately deferred — flag as Phase 03 if field data shows it's needed. |
| **Detection** | Unit tests assert filter rejects synthetic noise; manual field runs after 02B compare raw vs. filtered totals. |
| **Owner** | Running feature lead. |
| **Status** | Open. Mitigation is in the plan; effectiveness verified during 02B. |

---

## R-02 — Battery drain & background-tab suspension

| Field | Value |
|---|---|
| **What** | Continuous `watchPosition` is power-hungry. Mobile browsers suspend background tabs (and may throttle even in foreground), pausing position updates and breaking long runs. |
| **Likelihood** | High |
| **Impact** | Medium-High — silent data loss on the most important runs (long ones). |
| **Architecture coupling** | arch §2.5 (acknowledged limitation), §9.2 (Health Connect as eventual native fix). |
| **Mitigation** | (1) Document the limit in product copy: "keep the run tab in foreground". (2) Buffer + idempotent ingest so reconnects don't lose batches. (3) Filter reduces upload volume (NFR-B-2). (4) Native shell + Health Connect is the structural fix — out of Phase 02 by design. |
| **Detection** | Manual test on phone with screen-off / app-switch; review buffer state. |
| **Owner** | Running feature lead + Product (copy). |
| **Status** | Open structurally (web cannot fix); accepted limitation; carry into Phase 03 planning. |

---

## R-03 — PostGIS operational complexity

| Field | Value |
|---|---|
| **What** | PostGIS is new to this project. GiST indexing, `geography` vs `geometry`, SRID hygiene, and (if used) `h3-pg` extension all add surface area to operate and debug. |
| **Likelihood** | Medium |
| **Impact** | Medium — slow queries, confusing migration failures, type-generation surprises. |
| **Architecture coupling** | arch §8.1 (enable PostGIS), §8.3 (GiST). |
| **Mitigation** | (1) PostGIS lands in its own migration ahead of any table that uses it (database plan, migration 1) so failure surfaces in isolation. (2) Use `geography(LineString,4326)` consistently — meters, no SRID confusion. (3) GiST indexes declared in `create_workouts`; verified via MCP introspection. (4) `get_advisors` checked after each migration. |
| **Detection** | MCP migration verification reports; query plans on the canonical reads. |
| **Owner** | Database lead. |
| **Status** | Open until migration 2 verified clean. |

---

## R-04 — Grid choice is unmade (sign-off blocker)

| Field | Value |
|---|---|
| **What** | The architecture proposal recommends H3 but leaves the decision open (arch §5). Every downstream artifact (territory tables, capture service, RPC, tests) depends on it. |
| **Likelihood** | High (the decision **must** happen) |
| **Impact** | Critical — blocks 02D / 02E entirely. |
| **Architecture coupling** | arch §5, §13. |
| **Mitigation** | (1) Execution plan assumption A1 explicitly names H3 as the working assumption pending sign-off. (2) Grid math is isolated in `features/territory/services/grid.ts` so the choice is swappable behind one module (arch §11). (3) `cell_id` column type is set at migration 4 time to match the decision; the migration cannot be written before sign-off. |
| **Detection** | Pre-implementation: no kickoff to 02D until decision is recorded in `phase-02-architecture.md` (or a sibling ADR). |
| **Owner** | Tech lead (sign-off authority). |
| **Status** | **Open. Must be closed before 02A migration 4.** |

---

## R-05 — Spatial RLS on contended `cell_ownership`

| Field | Value |
|---|---|
| **What** | `cell_ownership` is shared, world-readable, and writable only via the `security definer` finalize RPC. Getting this wrong leaks game-state writes to clients, or breaks legitimate reads. Highest correctness + security surface in Phase 02. |
| **Likelihood** | Medium |
| **Impact** | Critical — direct path to data integrity / security incident. |
| **Architecture coupling** | arch §4.4, §8.4, §8.5. |
| **Mitigation** | (1) `territory_rls` is its own migration (database plan, migration 5) so policies are reviewed in isolation. (2) Integration tests (testing strategy §3.4) explicitly try direct client writes to `cell_ownership` and assert rejection. (3) `get_advisors` run after migration 5. (4) RPC is `SECURITY DEFINER` with locked `search_path` (Phase 01 pattern). (5) RPC verifies `workouts.user_id = auth.uid()` internally before any write. |
| **Detection** | Test suite (RLS tests will go red); MCP advisor pre-deploy. |
| **Owner** | Database lead + Security review. |
| **Status** | Open until 02D-02 lands green with all RLS tests. |

---

## R-06 — Territory contention & concurrency

| Field | Value |
|---|---|
| **What** | Two users finalizing workouts that cover the same cell can race. Doing resolution in app code creates lost-update windows; doing it wrong causes inconsistent ownership and orphan audit rows. |
| **Likelihood** | Low in Phase 02 (small user base) but **certain at scale** |
| **Impact** | High — board correctness is the core game state. |
| **Architecture coupling** | arch §4.4. |
| **Mitigation** | (1) Resolution lives in the DB transaction (`finalize_workout` RPC), not in app code. (2) Row-locked upsert on `cell_ownership` resolves concurrency atomically. (3) Phase 02 rule is the simplest possible — last-writer-wins — making the implementation a single upsert plus an audit insert. (4) Integration test reproduces the contention scenario and asserts last-writer-wins with full audit. |
| **Detection** | Contention integration test (testing strategy §3.5). |
| **Owner** | Database lead. |
| **Status** | Open until 02D-05 green. |

---

## R-07 — H3 server-side dependency (or substitute)

| Field | Value |
|---|---|
| **What** | If grid is H3 (R-04 → A1), the finalize RPC needs H3 functions inside Postgres — either via `h3-pg` extension or by precomputing cell ids on the client and passing them in. Each approach has trade-offs. |
| **Likelihood** | Medium |
| **Impact** | Medium — affects RPC structure and operational install footprint. |
| **Architecture coupling** | arch §5 (Option A), §8.5 (finalize is one transaction). |
| **Mitigation** | (1) Two acceptable paths, picked at implementation: (a) install `h3-pg` extension via migration; (b) compute cell ids server-side in TypeScript before invoking the RPC, passing the precomputed cell array to the RPC. Both keep the **upsert** + **audit** inside one DB transaction. (2) Whichever path is picked, the grid abstraction (`features/territory/services/grid.ts`) is the only TS surface that changes; the RPC contract stays the same. (3) Capture determinism test (testing strategy §3.6) catches drift between client and server cell ids. |
| **Detection** | Migration verification + capture determinism test. |
| **Owner** | Database lead + Territory feature lead. |
| **Status** | Open. Decision required at the start of 02D. |

---

## R-08 — Anti-cheat scope creep

| Field | Value |
|---|---|
| **What** | Trust-boundary design (arch §3.3) is sound but seductive — easy to over-build anti-cheat (replay attack detection, plausibility heuristics, ML-based outlier detection) inside Phase 02. CLAUDE.md ("simplicity first") forbids this. |
| **Likelihood** | Medium |
| **Impact** | Medium — schedule slip; complex code in the trust seam that's hard to remove. |
| **Architecture coupling** | arch §3.3, §7 ("anti-grind guards … deferred"), §12. |
| **Mitigation** | (1) Phase 02 trust boundary == finalize re-derives all authoritative metrics. That is the entire anti-cheat surface for now. (2) The XP function is forbidden from including anti-grind logic in Phase 02 (requirements FR-XP-3). (3) Any "we should also detect…" idea goes into a Phase 03 candidate list, not into the RPC. |
| **Detection** | PR review against this register. |
| **Owner** | Tech lead. |
| **Status** | Open as a discipline risk; resolved by reviewer vigilance. |

---

## R-09 — TS / SQL XP parity drift

| Field | Value |
|---|---|
| **What** | XP is implemented twice: once as a TS pure function (for tests and clarity), once as SQL inside the RPC (for atomicity). The two implementations can drift silently as weights change. |
| **Likelihood** | Medium (rises every time weights change) |
| **Impact** | High — silent correctness bug; users' XP differs from what tests assert. |
| **Architecture coupling** | arch §7, §8.5. |
| **Mitigation** | (1) Parity integration test (testing strategy §3.8) runs a battery of fixtures through both and asserts equality. **Non-optional.** (2) XP weights live as named constants in one TS file; the SQL re-declares them and the parity test catches any divergence. (3) Future Phase 03 candidate: move XP to a stored function or to a `LANGUAGE plv8`/external function to single-source it — out of Phase 02. |
| **Detection** | Parity test (red on any drift). |
| **Owner** | Running feature lead. |
| **Status** | Open until 02E green. |

---

## R-10 — Mobile browser limitations beyond GPS

| Field | Value |
|---|---|
| **What** | Beyond background suspension (R-02), mobile browsers introduce: aggressive memory eviction (in-memory buffer loss on tab switch), inconsistent geolocation permission UX, and Safari-specific PWA quirks. |
| **Likelihood** | Medium |
| **Impact** | Medium — partially-lost workouts; user friction around permissions. |
| **Architecture coupling** | arch §2.4 (resilience), §2.5. |
| **Mitigation** | (1) Buffer flushes early/often; the upload path is idempotent so re-sending after restoration is safe. (2) **Optional**: persist the in-flight buffer to IndexedDB as a backup. Treat as Phase 02 stretch; do not block on it. (3) Permission UX: explicit pre-prompt in the start workflow before invoking `watchPosition`. (4) Document supported browsers; defer Safari/PWA hardening unless field data demands it. |
| **Detection** | Manual cross-device smoke before close-out; Playwright covers the happy path. |
| **Owner** | Running feature lead + Product. |
| **Status** | Open structurally; partially mitigated by buffer + idempotency. |

---

## R-11 — `route_points` volume & query cost

| Field | Value |
|---|---|
| **What** | ~1 sample/sec × 3600 s = ~3600 rows per one-hour run. Over time, this is the largest table in the system. Bad query patterns (e.g. scanning raw for history reads) will degrade. |
| **Likelihood** | Medium |
| **Impact** | Medium — performance, not correctness. |
| **Architecture coupling** | arch §3.2 (raw/processed split). |
| **Mitigation** | (1) Reads of `route_points` happen only at finalize and (rarely) for recompute/audit — never on the hot read path. (2) Canonical `workouts.path` carries all rendering data. (3) `route_points` is indexed only by `(workout_id, batch_seq, point_seq)` (uniqueness + ordered-replay prefix) — no global indexes that would make inserts expensive. (4) Append-only at the app layer; UPDATE/DELETE policies absent. |
| **Detection** | Query review during PRs touching new read paths; explain-plan on finalize SQL. |
| **Owner** | Database lead. |
| **Status** | Open; revisit if and when retention policy is needed (out of Phase 02). |

---

## R-12 — Idempotency assumptions break

| Field | Value |
|---|---|
| **What** | Idempotent ingest hinges on the client producing strictly monotonic `batch_seq` per workout. A buggy client (or future native client) that resets the counter would either skip or duplicate batches. |
| **Likelihood** | Low |
| **Impact** | High — silent data loss or duplication. |
| **Architecture coupling** | arch §2.4. |
| **Mitigation** | (1) DB-level `UNIQUE (workout_id, batch_seq, point_seq)` constraint (per the 02B-07 forward-fix migration) hard-fails duplicate per-sample rows; the ingest endpoint uses `ON CONFLICT DO NOTHING`, so an identical replay is a no-op. (2) Integration test forces a duplicate `batch_seq` and asserts behavior. (3) Client buffer assigns `batch_seq` from a monotonic counter held alongside `workoutId`; never resets. (4) Future native client: same contract, verified by integration tests. |
| **Detection** | Integration test (testing strategy §3.2). |
| **Owner** | Running feature lead. |
| **Status** | Mitigated by DB constraint; open for client-side discipline. |

---

## R-13 — Type generation drift

| Field | Value |
|---|---|
| **What** | If `infrastructure/supabase/database.types.ts` is not regenerated after a migration, the codebase compiles against stale types and ships subtle correctness bugs (esp. for new columns / RPC return shapes). |
| **Likelihood** | Medium (process discipline risk) |
| **Impact** | Medium |
| **Architecture coupling** | Phase 01 conventions / CLAUDE.md. |
| **Mitigation** | (1) Verification gate in the execution plan: regenerated `database.types.ts` must match committed file for a milestone to close. (2) PR checklist for any migration includes types regen. (3) Future Phase 03 candidate: a CI check that diffs regenerated types against the repo. |
| **Detection** | Local typecheck after regeneration; PR review. |
| **Owner** | Tech lead. |
| **Status** | Open as a discipline risk. |

---

## Risk-to-mitigation mapping (cheat sheet)

| Milestone | Risks primarily mitigated here |
|---|---|
| Pre-kickoff (Architecture Gate) | R-04 (grid sign-off) |
| 02A | R-03 (PostGIS install), R-13 (types regen flow established) |
| 02B | R-01 (filter), R-02 (buffer + idempotent ingest), R-10 (buffer resilience), R-12 (UNIQUE constraint) |
| 02C | R-11 (raw/processed split formalized) |
| 02D | R-04 (closed via implementation), R-05 (RLS for ownership), R-06 (contention), R-07 (H3 path) |
| 02E | R-09 (parity test), R-08 (no anti-grind) |

A risk being "primarily mitigated" in a milestone does **not** mean it can be ignored before or after. It means that's where the test or implementation that resolves it lands.
