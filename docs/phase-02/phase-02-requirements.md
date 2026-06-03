# Phase 02 Requirements — GPS, Running, Territory

**Status:** Planning artifact. Implementation has NOT begun.
**Source of truth (architecture):** [`docs/phase-02/phase-02-architecture.md`](./phase-02-architecture.md).
**Companion docs:** execution plan, database plan, testing strategy, risk register, implementation order.

This document lists *what* Phase 02 must deliver. *How* is in the architecture doc;
*when/in-what-order* is in the execution and implementation-order docs.

---

## 1. Glossary

| Term | Definition |
|---|---|
| **Workout** | One running session, modeled by a `workouts` row. Lifecycle: `recording` → (`completed` \| `discarded`). |
| **Sample** | One raw GPS reading from the device (`lat`, `lng`, `accuracy`, optional altitude/speed/heading, timestamps). |
| **Batch** | An ordered group of samples uploaded in one HTTP request (`batch_seq` enforces idempotency). |
| **Route** | The ordered geographic path of one workout. Stored raw as `route_points`; canonical as `workouts.path` (`LINESTRING`). |
| **Cell** | One unit of the global territory grid (H3 hex at the agreed resolution). |
| **Capture** | The act of a workout claiming a cell (`territory_captures` row + `cell_ownership` upsert). |
| **Finalize** | The atomic server-side transition from `recording` to `completed`: derives metrics, captures territory, computes XP, rolls up `profiles`. |
| **Authoritative metric** | A value computed server-side at finalize. The client may compute live estimates for UX, never authoritative truth. |

---

## 2. Functional Requirements

### FR-WL — Workout Lifecycle

**FR-WL-1.** An authenticated user can start a workout. The system creates exactly one `workouts` row with `status='recording'`, `user_id=auth.uid()`, `started_at=now()`.

**FR-WL-2.** A user may have at most one active (`recording`) workout at a time. Starting a new workout while one is active is rejected with a typed error result.

**FR-WL-3.** An authenticated user can stop their own active workout. Stop triggers finalize (FR-FN-1). Stop is **idempotent**: stopping an already-completed workout returns success with no state change.

**FR-WL-4.** An authenticated user can discard their own active workout. Discard sets `status='discarded'`, performs no finalize, awards no XP, captures no territory.

**FR-WL-5.** A user cannot start/stop/discard another user's workout (enforced by RLS + server action checks).

**Acceptance criteria.**
- A → ends with: one `workouts` row exists, owned by caller, status `recording`.
- A → A → ends with: second call returns "active workout exists" error; only one row.
- A → stop → status is `completed`, all derived metrics non-null.
- A → stop → stop → second stop is a no-op success.
- A → discard → status `discarded`; no `territory_captures`; no `xp_awarded`.
- User U1's row cannot be modified by U2 (RLS test).

---

### FR-GPS — GPS Tracking (client)

**FR-GPS-1.** While a workout is `recording`, the client subscribes to `navigator.geolocation.watchPosition` (via the `useGeolocation` hook) and emits typed samples.

**FR-GPS-2.** Samples pass through the filter pipeline (arch §2.3) before buffering: accuracy gate (drop > N m, default ~30 m), min-distance dedupe (drop < ~5 m from last accepted), speed-sanity (drop teleports).

**FR-GPS-3.** The filter is a **pure function** of `(samples, config)`; identical inputs produce identical outputs.

**FR-GPS-4.** The recorder is a state machine: `idle → recording → paused → recording → … → stopped`. State transitions are explicit; invalid transitions are rejected at the hook level.

**FR-GPS-5.** The client computes and displays a **live distance estimate** during recording. This is explicitly **non-authoritative** (server value at finalize is canonical — arch §3.3). The UI must not call it "your distance"; it is a live estimate.

**Acceptance criteria.**
- Unit test feeds a sample stream including high-accuracy values; filter rejects them per FR-GPS-2.
- Unit test asserts pause→resume preserves prior samples; no duplicate emission on resume.
- Unit test asserts identical input streams yield identical accepted-sample arrays.
- Manual test (Playwright with a stubbed geolocation source) shows live distance ticking.

---

### FR-RR — Route Recording (server)

**FR-RR-1.** Samples are uploaded in **batches** to `POST /api/workouts/[id]/points`. Payloads are Zod-validated.

**FR-RR-2.** Each batch carries a monotonically-increasing `batch_seq` per workout. Re-sending a batch with an existing `(workout_id, batch_seq)` is a no-op (idempotent ingest — arch §2.4).

**FR-RR-3.** The server stamps `received_at` on every sample. Client `recorded_at` is preserved but **never trusted for cross-user ordering** (arch §2.4).

**FR-RR-4.** Ingest never finalizes. Ingest only appends to `route_points`.

**FR-RR-5.** Ingest enforces ownership: the workout's `user_id` must equal `auth.uid()`. A user cannot ingest into another user's workout.

**FR-RR-6.** Buffered samples are not lost on transient network failure: the client retries unsent batches; idempotency (FR-RR-2) makes retries safe (arch §2.4).

**Acceptance criteria.**
- Integration test: send batch `seq=5`; resend `seq=5`; row count unchanged, response success.
- Integration test: send batch as user U2 with U1's `workout_id` → rejected (403/forbidden equivalent).
- Integration test: Zod-invalid payload → rejected with typed error.

---

### FR-RP — Route Replay (read side)

**FR-RP-1.** A completed workout exposes its canonical `path` (`LINESTRING`), derived metrics, and audit `territory_captures`.

**FR-RP-2.** A workout history view lists the caller's workouts ordered by `started_at desc`, with summary metrics.

**FR-RP-3.** RLS ensures a user can only read their own `workouts` and `route_points`.

**FR-RP-4.** Re-finalizing the same workout (re-running the RPC) is a no-op when status is already `completed`. This makes replay/recompute safe (arch §4.3).

**Acceptance criteria.**
- Integration test: U1 reads U2's workout → empty result set (RLS).
- Playwright: history page renders the workouts table for an authenticated user.
- Integration test: re-invoke finalize RPC on a completed workout → status unchanged, no duplicate captures.

---

### FR-TC — Territory Capture

**FR-TC-1.** Capture model for Phase 02 is **path coverage** (arch §4.1 model A): every cell the canonical `LINESTRING` intersects is claimed.

**FR-TC-2.** Capture is **deterministic** given the same geometry and grid resolution (arch §4.3). Two finalizes of the same path produce the same cell set.

**FR-TC-3.** Capture runs **inside the finalize transaction** (arch §4.2 / §8.5). It is impossible to have a half-captured workout.

**FR-TC-4.** Each captured cell produces one `territory_captures` audit row tagged with action `claim` (no prior owner), `steal` (had a different owner), or `defend` (same owner re-covered).

**FR-TC-5.** `cell_ownership` holds the **live board** — one row per cell. Phase 02 contention rule (arch §4.4): **last valid capture wins**; the owner is the user whose finalize most recently completed.

**FR-TC-6.** Ownership writes are only possible through the `security definer` finalize RPC. Direct client writes to `cell_ownership` are forbidden by RLS.

**Acceptance criteria.**
- Unit test (fixture geometry): capture produces the expected set of cell ids — deterministic.
- Integration test: U1 finalizes a path; cells X,Y,Z are owned by U1 with action `claim`.
- Integration test: U2 finalizes a path overlapping cell Y; final `cell_ownership.owner_user_id` for Y is U2; `territory_captures` contains rows for both U1 (claim) and U2 (steal).
- Integration test: a direct `INSERT into cell_ownership` from a normal client is rejected by RLS.

---

### FR-OW — Ownership (read)

**FR-OW-1.** `cell_ownership` is world-readable (arch §8.4): any authenticated user can read who owns any cell. Phase 02 does not implement viewport queries; a basic "all cells owned by me" + "all cells" read is sufficient.

**FR-OW-2.** A user can list **their owned cells** (filtered by `owner_user_id = auth.uid()`).

**FR-OW-3.** A territory board page renders ownership data in a placeholder form. Mapbox rendering is out of scope (arch §9.1) — text/grid placeholder is acceptable.

**Acceptance criteria.**
- Integration test: any authenticated user can `SELECT` from `cell_ownership`.
- Integration test: U1's "my territory" read returns only rows where they own the cell.
- Playwright: the territory page loads and renders without error.

---

### FR-XP — XP Calculation

**FR-XP-1.** XP is computed by a **pure function** `xp(WorkoutMetrics, CaptureSummary): number` (arch §7). No I/O. No side effects.

**FR-XP-2.** XP is computed **at finalize**, server-side, and written to `workouts.xp_awarded`. The client must not derive authoritative XP.

**FR-XP-3.** XP rules in Phase 02:
- Base contribution from distance (and moving duration, when available).
- Territory bonus weighted by action: `claim` > `defend` ≥ `re-cover`.
- Anti-grind tuning is **deferred**; the function must not include diminishing-returns or daily-cap logic in Phase 02.

**FR-XP-4.** Finalize rolls up the workout's distance and XP into the existing `profiles.total_distance_m` and `profiles.total_xp` columns (arch §6).

**FR-XP-5.** TS pure function and SQL implementation inside the RPC must produce identical XP for identical inputs (numerical parity — risk R-09).

**Acceptance criteria.**
- Unit test: identical inputs → identical XP. Reordering capture-action input does not change result (function is order-invariant where intended).
- Unit test: zero-distance workout with zero captures → 0 XP (no negative, no NaN).
- Integration test: complete a workout → `workouts.xp_awarded` matches the pure function's output for those metrics.
- Integration test: profile rollup increments by exactly the workout's distance and XP.

---

## 3. Non-Functional Requirements

### NFR-Performance

| ID | Requirement | Verification |
|---|---|---|
| NFR-P-1 | Ingest endpoint p95 latency under 300 ms for a 60-sample batch at expected production load. | Load-style integration test or local benchmark with timing assertions. |
| NFR-P-2 | Finalize RPC completes under 2 s for a 60-minute workout (~3600 raw points → canonical LINESTRING + capture + XP). | Integration timing assertion against a synthetic fixture. |
| NFR-P-3 | History page renders under 1 s for a user with up to 100 workouts. | Playwright timing assertion or RSC query cost review. |
| NFR-P-4 | Live distance estimate updates at least every 2 s during recording on a modern mobile browser. | Manual / Playwright smoke. |

### NFR-Scalability

| ID | Requirement | Verification |
|---|---|---|
| NFR-S-1 | `route_points` indexed by `(workout_id, batch_seq)` — replay and dedupe queries do not table-scan. | Migration verification (index exists). |
| NFR-S-2 | `workouts` indexed by `(user_id, started_at desc)` — history queries scale per-user. | Migration verification. |
| NFR-S-3 | Spatial queries use GiST on `workouts.path`. | Migration verification. |
| NFR-S-4 | Raw points table is append-only; no per-row updates from app code (arch §3.2). | Code review + RLS allows only INSERT/SELECT for owners. |

### NFR-Reliability

| ID | Requirement | Verification |
|---|---|---|
| NFR-R-1 | Idempotent ingest (FR-RR-2): no batch loss or duplication under retry. | Integration test resends `batch_seq`. |
| NFR-R-2 | Finalize is **transactional**: capture + ownership + XP + profile rollup in one DB transaction (arch §8.5). A failure rolls the whole thing back. | Integration test injects a forced failure mid-RPC; asserts no partial state. |
| NFR-R-3 | Re-finalize is a no-op on completed workouts (FR-RP-4). | Integration test. |
| NFR-R-4 | Client buffer survives transient network failure: unsent batches are retried; no data loss for at least N minutes of disconnect (N TBD by product, default 15 min). | Unit test of buffer/retry policy + manual smoke. |

### NFR-Battery / Mobile

| ID | Requirement | Verification |
|---|---|---|
| NFR-B-1 | `useGeolocation` cleans up the watcher on unmount and on state transition out of `recording`. No leaked watchers. | Unit test asserts `clearWatch` is called. |
| NFR-B-2 | Filter (FR-GPS-2) reduces the number of accepted samples vs. raw to limit upload volume. | Unit test on a synthetic noisy stream: ≥30% reduction. |
| NFR-B-3 | Batch uploads coalesce samples (size + interval triggers in `sample-buffer.ts`). No per-sample HTTP request. | Unit test of buffer policy. |
| NFR-B-4 | Background-tab suspension is documented as a known platform limit (arch §2.5, risk R-08). The product copy warns the user. | Docs + UI copy review. |

### NFR-Security

| ID | Requirement | Verification |
|---|---|---|
| NFR-Sec-1 | All write paths to `workouts`, `route_points`, `territory_captures` are owner-scoped via RLS (`user_id = auth.uid()`). | Integration tests with two users. |
| NFR-Sec-2 | `cell_ownership` is **not** client-writable. All writes go through the `security definer` finalize RPC. | Integration test asserts a direct client INSERT is rejected. |
| NFR-Sec-3 | The finalize RPC is `security definer` with a locked `search_path` (same pattern as Phase 01 `handle_new_user`). | Migration review + advisor check. |
| NFR-Sec-4 | No service-role key in app code. Phase 02 introduces no new secrets. | Code review (grep). |
| NFR-Sec-5 | Authoritative metrics (distance, capture, XP) are server-computed at finalize. Client-supplied values are never persisted as authoritative (anti-cheat seam — arch §3.3). | Code review of the RPC + integration test asserting client-supplied "distance" is ignored. |
| NFR-Sec-6 | Zod validation on every external input (start payload, ingest payload, stop payload). | Unit tests on each schema. |

---

## 4. Out of Scope (explicit non-requirements)

The following are **explicitly not** Phase 02 requirements (architecture §0, §9, §13). They must not creep in:

- Real-time multiplayer / PvP territory contests.
- Live leaderboards, social feed, friends, AI coaching.
- Mapbox runtime — interface boundary only.
- Health Connect runtime — interface boundary only.
- Enclosure-style capture (model B).
- Decay-over-time ownership, defense strength, contested cooldowns.
- Anti-grind XP heuristics (daily caps, diminishing returns).
- Background-tab GPS workarounds; native shell.
- App-level rate limiting and structured monitoring (deferred from Phase 01).

A change request that pulls any of the above into Phase 02 must first revisit the
architecture gate.

---

## 5. Phase 02 Acceptance — top-level

Phase 02 is accepted when:

1. All FR-* acceptance criteria pass in the relevant test tier.
2. All NFR-* targets are met or have a documented, accepted variance.
3. Migrations are committed, MCP-verified, types regenerated, and `database.types.ts` is in sync.
4. The Architecture Approval Gate decisions (notably the grid choice — arch §5) are recorded.
5. The completion-report doc (mirroring `phase-01-completion-report.md`) exists and lists all the above.
