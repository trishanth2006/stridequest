# Phase 02 Database Plan — Migrations, Indexes, RLS, Verification

**Status:** Planning artifact. No SQL in this document. No migrations have been written.
**Source of truth (architecture):** [`docs/phase-02/phase-02-architecture.md`](./phase-02-architecture.md), §§8, 4.4, 9.
**Conventions inherited from Phase 01:**
- Repository is the source of truth (CLAUDE.md).
- One concern per migration file.
- Migrations applied via MCP, committed under `supabase/migrations/`.
- After every schema change, regenerate `infrastructure/supabase/database.types.ts`.

Six migrations are planned. They must be applied in the order below.

---

## Migration sequence overview

| # | Name | Concern | Depends on |
|---|---|---|---|
| 1 | `enable_postgis` | Enable PostGIS extension. | Phase 01 schema. |
| 2 | `create_workouts` | `workouts` table + indexes (RLS in a follow-up). | 1 |
| 3 | `create_route_points` | `route_points` table + indexes + RLS. | 2 |
| 4 | `create_territory_tables` | `territory_captures` + `cell_ownership`. | 3 |
| 5 | `territory_rls` | RLS for both territory tables (the contended case). | 4 |
| 6 | `finalize_rpc` | `security definer` RPC: composes LINESTRING, captures, computes XP, rolls up profile. | 5 |

> An additional `workouts_rls` migration is sized as part of (2). It can be a separate file (`<ts>_workouts_rls.sql`) to honor "one concern per file" — recommended. If split, the count becomes 7. The decision (one-or-two files for workouts + RLS) is delegated to the implementer; both options conform to the convention.

---

## Migration 1 — `enable_postgis`

**Purpose.** Install the PostGIS extension so subsequent migrations can declare `geography` columns and use spatial functions.

**Tables.** None.

**Indexes.** None.

**RLS.** N/A.

**Constraints.** N/A.

**Verification (via MCP).**
- Query `list_extensions` and confirm `postgis` is present and enabled in the appropriate schema.
- Confirm `geography` is an available type by introspecting `pg_type` (or via a no-op DDL parse check).
- `get_advisors` reports no new high-severity findings.

**Rollback strategy.** Drop the extension. Safe **only** because no later migration has run yet. After migration 2 declares spatial columns, rolling back PostGIS is no longer trivial — at that point a forward-fix migration is preferred over a rollback. This is the primary reason migration 1 lands alone in its own commit.

---

## Migration 2 — `create_workouts`

**Purpose.** Persist one row per running session with the canonical geometry and derived metrics.

**Table: `workouts`.**

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, default generated. |
| `user_id` | `uuid` | NOT NULL; FK → `profiles(id) ON DELETE CASCADE`. |
| `status` | `text` (or enum) | NOT NULL; CHECK in (`recording`, `completed`, `discarded`). |
| `started_at` | `timestamptz` | NOT NULL; default `now()`. |
| `ended_at` | `timestamptz` | NULL until finalize. |
| `path` | `geography(LineString,4326)` | NULL until finalize. |
| `distance_m` | `integer` | NULL until finalize; CHECK `>= 0`. |
| `duration_s` | `integer` | NULL until finalize; CHECK `>= 0`. |
| `avg_pace_s_per_km` | `integer` | NULL until finalize; nullable. |
| `elevation_gain_m` | `integer` | NULL; deferred metric, allowed to be null in Phase 02. |
| `xp_awarded` | `integer` | NULL until finalize; CHECK `>= 0`. |
| `source` | `text` | Nullable forward-hook for Health Connect (arch §9.2); default `'web'`. |
| `created_at` | `timestamptz` | NOT NULL; default `now()`. |
| `updated_at` | `timestamptz` | NOT NULL; maintained by trigger (reuse Phase 01 `handle_updated_at` pattern). |

**Constraints.**
- Status CHECK as above.
- Non-negative CHECKs on `distance_m`, `duration_s`, `xp_awarded`.
- Optional partial unique index `(user_id) WHERE status='recording'` to enforce FR-WL-2 (at most one active workout per user) at the DB layer. **Recommended.**

**Indexes.**
- `(user_id, started_at DESC)` — history queries (NFR-S-2).
- GiST index on `path` — spatial queries (NFR-S-3).
- Trigger to maintain `updated_at` (mirrors Phase 01).

**RLS.** Enabled here. Policies (target `to authenticated`, pattern from Phase 01):
- SELECT own: `(select auth.uid()) = user_id`.
- INSERT own: `with check ((select auth.uid()) = user_id)`.
- UPDATE own: `using` + `with check ((select auth.uid()) = user_id)`.
- DELETE: not exposed in Phase 02 (discard is an UPDATE).

**Verification (via MCP).**
- `list_tables` shows `workouts` with expected columns and types.
- Introspection confirms indexes (history btree + path GiST + partial-unique-on-recording).
- Introspection confirms all four RLS policies present.
- `get_advisors` reports no high-severity findings on the new table.

**Rollback strategy.** Forward-fix preferred over rollback once data exists. If executed pre-data: drop policies → drop indexes → drop trigger → drop table. Document in the migration header.

---

## Migration 3 — `create_route_points`

**Purpose.** Raw, append-only stream of accepted GPS samples per workout.

**Table: `route_points`.**

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` or `bigint` | PK. |
| `workout_id` | `uuid` | NOT NULL; FK → `workouts(id) ON DELETE CASCADE`. |
| `lat` | `double precision` | NOT NULL; CHECK in `[-90, 90]`. |
| `lng` | `double precision` | NOT NULL; CHECK in `[-180, 180]`. |
| `accuracy_m` | `real` | NOT NULL; CHECK `>= 0`. |
| `altitude_m` | `real` | NULL. |
| `speed_mps` | `real` | NULL; CHECK `>= 0` when present. |
| `heading_deg` | `real` | NULL. |
| `recorded_at` | `timestamptz` | NOT NULL; client clock (FR-RR-3). |
| `received_at` | `timestamptz` | NOT NULL; default `now()`. |
| `batch_seq` | `integer` | NOT NULL; CHECK `>= 0`. |
| `point_seq` | `integer` | NOT NULL; CHECK `>= 0`. Sample's index within its batch — the per-sample idempotency key (added by the 02B-07 forward-fix migration). |

**Constraints.**
- Range CHECKs on `lat`, `lng`.
- Non-negative CHECK on `accuracy_m`, `batch_seq`, `point_seq`.
- **UNIQUE `(workout_id, batch_seq, point_seq)`** — enforces idempotency at the per-sample grain (FR-RR-2 / NFR-R-1): re-sending an identical batch conflicts on every row, so the ingest endpoint's `ON CONFLICT DO NOTHING` makes the replay a no-op. The DB is the final defense; ingest also checks. (This grain was set by the 02B-07 forward-fix migration `route_points_point_seq`; `route_points` originally shipped `UNIQUE (workout_id, batch_seq)`, which could not store a multi-sample batch — **do not revert to the two-column form**.)

**Indexes.**
- The unique `(workout_id, batch_seq, point_seq)` index — via its `(workout_id, batch_seq)` prefix — supports ordered replay and dedupe (NFR-S-1).

**RLS.** Enabled here. Policies:
- SELECT own (join via `workouts.user_id = auth.uid()`).
- INSERT own (CHECK that the `workout_id` belongs to caller).
- No UPDATE policy. No DELETE policy. Append-only at the app layer (arch §3.2).

**Verification (via MCP).**
- `list_tables` shows `route_points`.
- Unique index present.
- RLS policies present; UPDATE/DELETE explicitly absent.
- Insertion as wrong owner fails (smoke via SQL with a switched JWT, or covered by integration test once the action exists).

**Rollback strategy.** Drop policies → drop unique index → drop table. Cascades from `workouts` will not orphan rows here because FK is `ON DELETE CASCADE`.

---

## Migration 4 — `create_territory_tables`

**Purpose.** Audit log of claims (`territory_captures`) and the live game board (`cell_ownership`). RLS is **deferred to migration 5** so this file is purely structural.

> Depends on the grid decision (architecture §5, assumption A1 in the execution plan). **H3 is assumed**; `cell_id` therefore is `bigint` (H3 64-bit index) — alternatively `text` if hex-string representation is preferred. The chosen type is fixed for the lifetime of the schema; no re-tiling.

**Table: `territory_captures`.**

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK. |
| `workout_id` | `uuid` | NOT NULL; FK → `workouts(id) ON DELETE CASCADE`. |
| `user_id` | `uuid` | NOT NULL; FK → `profiles(id) ON DELETE CASCADE`. |
| `cell_id` | `bigint` (or `text`) | NOT NULL. |
| `action` | `text` (or enum) | NOT NULL; CHECK in (`claim`, `steal`, `defend`). |
| `captured_at` | `timestamptz` | NOT NULL; default `now()`. |

**Indexes (`territory_captures`).**
- `(cell_id)` — "who has ever captured X".
- `(user_id, captured_at DESC)` — "my capture history".
- `(workout_id)` — capture summary per workout.

**Table: `cell_ownership`.**

| Column | Type | Notes |
|---|---|---|
| `cell_id` | `bigint` (or `text`) | PK. **One row per cell.** |
| `owner_user_id` | `uuid` | NOT NULL; FK → `profiles(id)`. |
| `owned_since_workout_id` | `uuid` | NOT NULL; FK → `workouts(id)`. |
| `updated_at` | `timestamptz` | NOT NULL; default `now()`. |

**Indexes (`cell_ownership`).**
- `(owner_user_id)` — "my territory".

**Constraints.**
- Action CHECK as above.
- FKs cascade from `workouts`/`profiles` per Phase 01 patterns.

**Verification (via MCP).**
- `list_tables` shows both tables with expected columns.
- All four indexes present.
- `get_advisors` reports no high-severity findings (RLS-not-enabled will appear here — that is expected and is fixed in migration 5).

**Rollback strategy.** Drop indexes → drop tables in reverse FK order (`cell_ownership` then `territory_captures`).

---

## Migration 5 — `territory_rls`

**Purpose.** Apply RLS to the two territory tables. This is the **hard correctness/security surface** flagged in arch §8.4 and risk R-05; it gets its own migration so policy text is reviewed independently.

**Policies on `territory_captures`** (owner-scoped, like `route_points`):
- SELECT own: `(select auth.uid()) = user_id`.
- INSERT: **not granted to clients**; rows are inserted by the `security definer` finalize RPC only (migration 6).
- No UPDATE / DELETE policy.

**Policies on `cell_ownership`** (the shared-board case):
- SELECT: world-readable for authenticated users (FR-OW-1).
- INSERT / UPDATE / DELETE: **no client-facing policy**. All writes go through the finalize RPC. The RPC bypasses RLS by virtue of `security definer` + a privileged role, while clients are denied direct mutation.

**Verification (via MCP).**
- Policy introspection: `territory_captures` has SELECT-own only; `cell_ownership` has SELECT-only (world-readable to authenticated).
- Integration smoke (covered in tests): direct client INSERT into `cell_ownership` fails; direct client INSERT into `territory_captures` fails.
- `get_advisors` reports no RLS-disabled findings.

**Rollback strategy.** Drop the new policies. Tables remain. Forward-fix preferred once the RPC depends on this configuration.

---

## Migration 6 — `finalize_rpc`

**Purpose.** The single atomic transition from `recording` → `completed`. Composes the canonical `LINESTRING`, computes derived metrics, performs capture (path coverage on H3 cells), upserts ownership under row locks, computes XP, and rolls up `profiles.total_distance_m` / `profiles.total_xp`. All in one transaction (arch §8.5).

**Signature (conceptual).**
```
finalize_workout(workout_id uuid) → record(
  status text,
  distance_m int,
  duration_s int,
  xp_awarded int,
  cells_claimed int,
  cells_stolen int,
  cells_defended int
)
```

The RPC accepts only the `workout_id`. The caller identity is read from `auth.uid()`; the RPC verifies the workout belongs to that user.

**Behavior.**
1. Lock the `workouts` row for update.
2. Reject if `status != 'recording'` (no-op on `completed` — FR-RP-4).
3. Read all `route_points` for the workout in order; assemble `LINESTRING` (after the points are already filtered client-side; minor server-side sanity is acceptable but the canonical filter has already run).
4. Compute `distance_m`, `duration_s`, `avg_pace_s_per_km` from the geometry and timestamps.
5. Convert the LINESTRING to the H3 cell set (path coverage). The H3 logic is invoked inside the RPC — either via a Postgres extension binding (`h3-pg`) or via a pre-installed PL/PG function bundle. The exact mechanism is an implementation decision flagged in risk R-07.
6. For each cell:
   - INSERT into `territory_captures` with action determined by current `cell_ownership`:
     - no row → `claim`.
     - row with different owner → `steal`.
     - row with same owner → `defend`.
   - UPSERT `cell_ownership` (last-writer-wins, FR-TC-5) — uses row lock implicitly through the upsert; resolves concurrency at the DB layer (arch §4.4).
7. Compute XP via the SQL implementation of the formula (FR-XP-5; parity-tested against the TS pure function).
8. UPDATE `workouts`: set `status='completed'`, write `ended_at`, `path`, `distance_m`, `duration_s`, `avg_pace_s_per_km`, `xp_awarded`.
9. UPDATE `profiles`: increment `total_distance_m` and `total_xp` by this workout's values.
10. Return the result record.

**Security properties.**
- `SECURITY DEFINER` with `SET search_path = ''` (Phase 01 pattern).
- `EXECUTE` revoked from `PUBLIC`; granted to `authenticated`.
- Verifies `workouts.user_id = auth.uid()` inside the function and raises if not.

**Constraints.**
- Idempotency: re-invocation on `completed` returns the existing record without re-incrementing profile totals.
- Atomicity: any failure aborts; partial state is impossible (NFR-R-2).
- Determinism: same inputs (same raw points, same H3 resolution constant) yield the same outputs (FR-TC-2).

**Verification (via MCP).**
- Function exists with the declared signature; `SECURITY DEFINER` set; `search_path` locked to `''`.
- `EXECUTE` permissions: `PUBLIC` revoked; `authenticated` granted.
- Integration tests (testing-strategy doc) cover: happy path, idempotent re-finalize, two-user contention, RLS-direct-write rejection, profile rollup correctness, parity against the TS XP function.
- `get_advisors` shows no security warnings related to the RPC.
- `get_logs` reviewed post-deploy for unexpected errors.

**Rollback strategy.** `DROP FUNCTION` — the function is the only piece of stateful behavior. Stored data (workouts, captures, ownership) is unaffected by dropping the RPC. Re-applying a corrected version is the standard "forward-fix" path. If the RPC is re-issued, callers (server actions) keep the same function name to remain backwards-compatible.

---

## Cross-migration invariants

These hold across the whole Phase 02 schema and must be re-checked after each migration:

1. **Repository == source of truth.** Every change applied via MCP must exist in a committed migration file. Verified by `list_migrations` matching the on-disk migration list.
2. **Types regenerated.** After each migration, `infrastructure/supabase/database.types.ts` is regenerated; the committed file matches the live schema.
3. **One concern per file.** No migration mixes structural and policy changes (workouts-RLS may stay with `create_workouts` only if the implementer judges it tight; otherwise split — both conform to convention).
4. **`get_advisors` clean.** After each migration, `get_advisors` reports no high-severity issues.
5. **No `any` type in generated/consumer code.** The TS that consumes `Database` types must compile under strict mode (verified by `npm run typecheck`).
6. **No client-side authoritative writes.** No client write touches `cell_ownership`. No client write inserts into `territory_captures`. All such writes flow through `finalize_workout`.

---

## What this document does NOT contain

- SQL. By instruction, no DDL/DML is written here. SQL is produced at implementation time, per migration, after the Architecture Approval Gate.
- The exact H3 resolution (R-04). H3 is the assumed grid; the resolution is a one-line constant inside migrations 4 and 6 and is set at implementation time after sign-off.
- Final XP weights (A5). Weights live as constants in the TS pure function and (mirrored) inside the RPC; both are set at implementation time.

If any of these change before implementation begins, this document is the first to update.
