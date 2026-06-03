# Phase 02D-01 Verification Report — `create_territory_tables`

**Date:** 2026-06-03
**Verdict:** ✅ **PASS — migration applied and verified.** One benign discrepancy noted (RLS auto-enabled). Do not begin 02D-02.
**Method:** MCP catalog introspection against the live project `xpxxtohwalqrqdjexolf`
(authoritative path per `phase-02-testing-strategy.md` §5).

> **History note.** A prior verification pass found the migration had **never been
> applied** to this project (tables absent; version missing from `list_migrations`),
> even though `database.types.ts` already contained the types. This pass applied the
> existing migration and re-verified.

---

## Migration status

- **Applied** the existing file
  [`20260603113038_create_territory_tables.sql`](../../supabase/migrations/20260603113038_create_territory_tables.sql)
  **verbatim** (no new migration created, no edit to the file).
- CLI/`db push` was unavailable (CLI not installed, project unlinked, no access
  token), so application used MCP `execute_sql`, replicating exactly what `db push`
  does: run the DDL, then record the history row with the **on-disk version**.
  (`apply_migration` was avoided because it stamps a fresh timestamp, which would not
  equal `20260603113038` and would break the repo↔history invariant.)
- `list_migrations` now ends with **`20260603113038 / create_territory_tables`** —
  exact match to the on-disk filename. ✅

---

## Verification results (live schema vs. migration)

| Item | Result |
|---|---|
| `territory_captures` exists | ✅ |
| `cell_ownership` exists | ✅ |
| **Columns** | ✅ exact — `territory_captures(id, workout_id, user_id, cell_id, action, captured_at)`; `cell_ownership(cell_id, owner_user_id, owned_since_workout_id, updated_at)`; types/nullability/defaults (`gen_random_uuid()`, `now()`) all match |
| **Primary keys** | ✅ `territory_captures(id)`, `cell_ownership(cell_id)` |
| **Foreign keys** | ✅ `territory_captures` → `workouts(id)` & `profiles(id)` **ON DELETE CASCADE**; `cell_ownership` → `workouts(id)` & `profiles(id)` **no cascade** — matches the migration's differing intent |
| **CHECK constraints** | ✅ `action IN ('claim','steal','defend')` |
| **Indexes** | ✅ 4 named (`idx_territory_captures_cell_id`, `idx_territory_captures_user_id_captured_at` [`captured_at DESC`], `idx_territory_captures_workout_id`, `idx_cell_ownership_owner_user_id`) + 2 PK |
| **Triggers** | ✅ `cell_ownership_updated_at` BEFORE UPDATE FOR EACH ROW → `handle_updated_at()` |

**Schema ↔ migration:** ✅ PASS (all defined objects).

**Schema ↔ generated types (Requirement 6):** ✅ PASS. Regenerated types via MCP
`generate_typescript_types` and compared to the committed
[`database.types.ts`](../../infrastructure/supabase/database.types.ts) — **identical**
across every table, function, composite type, helper, and `Constants`. No write
needed; the committed file already matched the live schema.

**Migration-verification tests (Requirement 7):** ⏭️ **SKIPPED (honest state).**
`.env` has no `SUPABASE_SERVICE_ROLE_KEY` (and it isn't obtainable via MCP), so
`describeDb → describe.skip`. `npx jest …/migration-verification.test.ts` → "Tests: 6
skipped, 6 total." Skipped ≠ passed; MCP introspection above is the authoritative
verification. If a service-role key is later supplied, the territory cases would pass
(service role reaches both tables; RLS — see below — does not block it).

---

## Remaining discrepancies

1. **RLS is enabled on both new tables, though the migration does not enable it.**
   The migration header says "RLS is deferred to a subsequent migration," but live
   state is `rls_enabled = true, policy_count = 0` for both tables. Root cause: a
   **project-level event trigger `ensure_rls`** (`ddl_command_end`) runs
   `public.rls_auto_enable()` and flips RLS on for every newly created table.
   - **Severity:** benign. RLS-enabled + no-policy denies all access to
     `anon`/`authenticated`; `service_role` bypasses. `get_advisors` flags this only
     at **INFO** (`rls_enabled_no_policy`) — no high-severity finding on the new tables.
   - **Note for 02D-02 (`territory_rls`):** RLS is already on, so migration 5 only
     needs to add policies; any `ENABLE ROW LEVEL SECURITY` it contains is a harmless
     no-op. Implication: this migration file applied to a fresh DB **without** the
     `ensure_rls` trigger would leave RLS *disabled* — the file is not self-contained
     on RLS.
   - **Not "fixed" here:** disabling RLS would fight the project's deliberate
     mechanism. Surfaced, not altered.

2. **Pre-existing advisor WARNINGs (not from this migration):** public/authenticated
   EXECUTE on `SECURITY DEFINER` functions `finalize_workout` (02C) and
   `rls_auto_enable`, and Auth "leaked password protection disabled." Listed for
   completeness; out of scope for 02D-01.

---

**Status: 02D-01 migration applied and verified. Paused after verification. 02D-02 not started.**
