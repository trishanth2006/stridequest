# Phase 02D-02 Verification Report — `territory_rls`

**Date:** 2026-06-03
**Verdict:** ✅ **PASS — RLS policies applied and verified.** Trust boundary intact (SELECT-only; writes RPC-only).
**Method:** MCP catalog introspection (authoritative per `phase-02-testing-strategy.md` §5),
plus lint / typecheck / `npm test`.

---

## Files created
- `supabase/migrations/20260603125740_territory_rls.sql` — RLS for both territory tables (one concern).

## Files modified
- `tests/integration/security/rls.test.ts` — added `describe('RLS: territory tables (02D-02)')`
  (10 tests) reusing existing `createTestUser` / `createWorkout` helpers; updated the file
  header comment to include 02D-02. No new helper files.
- **No `database.types.ts` regeneration** — RLS is not represented in generated types.

## Policy definitions (as applied)
```sql
-- territory_captures (owner-scoped read; append-only; writes RPC-only)
alter table public.territory_captures enable row level security;
create policy "users_read_own_territory_captures"
  on public.territory_captures for select to authenticated
  using ((select auth.uid()) = user_id);

-- cell_ownership (world-readable board; writes RPC-only, maintained by finalize_workout)
alter table public.cell_ownership enable row level security;
create policy "authenticated_read_cell_ownership"
  on public.cell_ownership for select to authenticated
  using (true);
```
No INSERT / UPDATE / DELETE policy on either table (deliberate — the trust boundary).

## MCP policy verification (live `xpxxtohwalqrqdjexolf`)

| Table | RLS enabled | RLS forced | SELECT policies | Write policies |
|---|---|---|---|---|
| `territory_captures` | ✅ true | false | **1** | **0** |
| `cell_ownership` | ✅ true | false | **1** | **0** |

`pg_policies` confirms:
- `territory_captures.users_read_own_territory_captures` — `cmd=SELECT`, `roles={authenticated}`,
  `qual=((SELECT auth.uid()) = user_id)`, `with_check=null`.
- `cell_ownership.authenticated_read_cell_ownership` — `cmd=SELECT`, `roles={authenticated}`,
  `qual=true`, `with_check=null`.

`list_migrations` ends with **`20260603125740 / territory_rls`** — exact match to the on-disk
filename (applied via execute_sql + history-row insert, the same method as 02D-01, since
CLI/`db push` remain unavailable). `relforcerowsecurity=false` preserved (FORCE RLS not enabled).

### Table privileges (GRANTs) — read path confirmed end-to-end
RLS sits *on top of* SQL privileges, so the world-readable claim was confirmed at the grant
layer too: `information_schema.role_table_grants` shows `territory_captures` and `cell_ownership`
carry **identical** privileges to the working sibling tables `workouts` / `route_points` —
`authenticated` (and `anon`) hold `SELECT`+`INSERT`+`UPDATE`+`DELETE`. Therefore:
- **Read works end-to-end** for `authenticated` (grant ✓ + SELECT policy ✓) — `cell_ownership`
  is genuinely readable, not blocked by a missing grant.
- **Write protection is RLS-enforced, not grant-enforced.** `authenticated`/`anon` hold permissive
  write grants (Supabase default), so "no client writes" rests entirely on RLS having **0 write
  policies** — exactly as verified, and the same model as `workouts`/`route_points`.
- **`anon` cannot read** despite its SELECT grant: RLS is enabled and no `anon`-facing policy
  exists (both policies are `to authenticated`), so anon requests are filtered to nothing.

## Advisor results (`get_advisors` security)
- ✅ The two **`rls_enabled_no_policy`** INFO findings recorded in the 02D-01 report
  (`cell_ownership`, `territory_captures`) are **cleared** — both tables now have a policy.
- No new findings introduced by 02D-02.
- Remaining WARNs are **pre-existing and out of scope**: `SECURITY DEFINER` EXECUTE on
  `finalize_workout` (02C) and `rls_auto_enable` (project event-trigger mechanism), and Auth
  "leaked password protection disabled."

## Test results
- **Red→green loop (authoritative):** MCP introspection showed **0 policies** before applying
  (deny-all) and the exact expected policies after — the observable RED→GREEN for this DB task.
- **`npm test`:** **205 passed, 39 skipped, 0 failed.** The 5 DB-integration suites (incl.
  `rls.test.ts`) skip locally because `.env` has no `SUPABASE_SERVICE_ROLE_KEY`
  (`describeDb → describe.skip`) — identical gate to 02D-01. The 10 new territory tests were
  authored test-first and transpile cleanly; their behavioral execution requires a service-role
  key (CI / a dedicated branch).
- New tests cover: territory_captures owner-read / non-owner-blocked / INSERT denied / UPDATE
  blocked / DELETE blocked; cell_ownership world-read (FR-OW-1) / owner_user_id filter (FR-OW-2)
  / INSERT denied (NFR-Sec-2) / UPDATE blocked / DELETE blocked.

## Lint results
- `npm run lint` (eslint) — **clean**, no warnings or errors.

## Typecheck results
- `npm run typecheck` (`tsc --noEmit`) — **clean**. Validates the new test block (`TablesInsert<'territory_captures'>`,
  `TablesInsert<'cell_ownership'>`) under strict mode; no `any`.

## Remaining risks
1. **RLS behavioral tests skip locally** (no `SUPABASE_SERVICE_ROLE_KEY`) — same constraint as
   02D-01. MCP introspection is the authoritative verification (testing-strategy §5). **Action:**
   run `rls.test.ts` in an environment with a service-role key to exercise the 10 assertions.
2. **Trust boundary depends on invariants that 02D-02 cannot enforce alone.** When `finalize_rpc`
   v2 (02D-05) lands it MUST: write as a `BYPASSRLS` `SECURITY DEFINER` role, NOT enable FORCE
   RLS, and NOT add a client write policy. These are documented in the migration comments and the
   02D-02 design review. (R-05 partially addressed; closed by the 02D-05 contention test.)
3. **`cell_ownership` exposes `owner_user_id` to all authenticated users** — intentional per
   FR-OW-1 (public board), documented so it reads as a decision, not a latent BOLA/IDOR finding.
4. **git:** `supabase/` and `infrastructure/` remain untracked (pre-existing — all of Phase 02 is
   uncommitted). The "repository == source of truth" invariant isn't fully closed until committed.
   Out of scope for this task; flagged.

---

**Constraints honored:** 02D-03 not started; no capture logic; `finalize_workout` unmodified;
no write policies added; FORCE RLS not enabled; trust boundary (RPC-only writes) intact.

**Status: 02D-02 applied and verified. Paused after verification.**
