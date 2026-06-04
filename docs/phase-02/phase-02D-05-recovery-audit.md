# Phase 02D-05 — Recovery & Verification Audit

**Date:** 2026-06-04
**Type:** Verification-only recovery pass after an interrupted implementation. **No code, tests, migrations, or DB state were modified.**
**Bottom line:** The security-critical core (finalize v2 migration + Option A trust boundary) is **complete and verified live**. The verification layer is **broken/incomplete**: a one-character syntax error red-lines typecheck + lint + one suite, two companion unit suites were never migrated to the v2 signature, two required tests are absent, and the gating **ADR document does not exist** (yet is referenced by shipped code).

**Estimated completion of 02D-05: ~72%** (derivation in the final section).

---

## How this audit was performed

- Static read of every touched file in the working tree.
- Live DB introspection via Supabase MCP (`pg_proc`, `has_function_privilege`, `information_schema.attributes`, `pg_get_functiondef`, `supabase_migrations.schema_migrations`) — read-only.
- Quality gates executed exactly as defined in `package.json`: `npm run typecheck`, `npm run lint`, `npm test`.

> **Important framing:** *skipped ≠ verified.* All territory/finalize **integration** suites are guarded by `describe.skip` when service-role creds are absent (they are absent here). The migration being live proves the function **exists, parses, and contains the capture logic** — it does **not** prove the claim/steal/defend counts are runtime-correct, because no integration test executed. Provisioning creds and running them was deliberately **not** done (it mutates live data; out of scope for "verification only").

---

## Step 1 — Working Tree Audit

| File | Exists | Modified | Syntactically valid | Refs compile | Impl complete | TODO markers | Broken imports |
|---|---|---|---|---|---|---|---|
| `supabase/migrations/20260604121656_finalize_rpc_v2.sql` | ✅ (untracked) | new | ✅ (parses; live body confirmed) | n/a (SQL) | ✅ | none | n/a |
| `infrastructure/supabase/service-role.ts` | ✅ (untracked) | new | ✅ | ✅ | ✅ | none | none |
| `features/running/services/finalize.ts` | ✅ | ✅ M | ✅ | ✅ | ✅ (v2 4-arg) | none | none |
| `features/running/actions/stop.ts` | ✅ | ✅ M | ✅ | ✅ | ✅ (getUser → service-role → captureCells → RPC) | none | none |
| `infrastructure/supabase/database.types.ts` | ✅ | ✅ M | ✅ | ✅ | ✅ (matches live) | none | none |
| `features/territory/capture.ts` | ✅ (untracked) | new | ✅ | ✅ | ✅ | none | none |
| `tests/integration/running/finalize.test.ts` | ✅ | ✅ M | ❌ **parse error L213** | ❌ | ⚠️ written, won't compile | none | none |
| `tests/integration/territory/contention.test.ts` | ✅ (untracked) | new | ✅ | ✅ | ✅ (skipped at runtime) | none | none |
| `tests/integration/territory/capture-determinism.test.ts` | ✅ (untracked) | new | ✅ | ✅ | ✅ (skipped at runtime) | none | none |
| `tests/integration/security/rls.test.ts` | ✅ (untracked) | new | ✅ | ✅ | ⚠️ table-RLS only; **no RPC-execute rejection** | none | none |
| `tests/integration/db/migration-verification.test.ts` | ✅ (untracked) | new | ✅ | ✅ | ⚠️ covers 02A/02B/02D-01; **not updated for finalize v2** | none | none |
| `docs/phase-02/02D-05-trust-boundary-adr.md` | ❌ **MISSING** | — | — | — | ❌ | — | — |

**Root-cause of the parse error** — [finalize.test.ts:213](../../tests/integration/running/finalize.test.ts#L213):
```js
it('FR-RP-3: a non-owner cannot finalize another user's workout (p_user_id mismatch)', async () => {
```
The apostrophe in `user's` closes the single-quoted string early. This single character fails `tsc`, `eslint`, **and** makes Jest unable to parse the suite.

**Changes present in the tree but outside the 02D-05 expected set** (will be bundled into any 02D-05 commit — flagged, not judged):
`features/running/hooks/useWorkoutRecorder.ts` (M, ~42 lines), `tests/unit/features/running/hooks/useWorkoutRecorder.test.ts` (M), and untracked `tests/unit/features/running/hooks/gps-status-diagnostic.test.ts`. These appear to belong to the GPS/recorder workstream, not finalize/territory. Doc edits `phase-02-execution-plan.md` (M) and `phase-02-implementation-order.md` (M) are in-scope reconciliation.

---

## Step 2 — Migration Verification

**File:** `supabase/migrations/20260604121656_finalize_rpc_v2.sql` — exists, parses.

| Check | Result | Evidence |
|---|---|---|
| v1 `(uuid)` dropped (idempotent guard) | ✅ | `do $$ … drop function public.finalize_workout(uuid)` block present; live DB has **no** `(uuid)` overload |
| v2 signature `(p_workout_id uuid, p_cell_ids text[], p_user_id uuid)` | ✅ | live `pg_get_function_identity_arguments` = `p_workout_id uuid, p_cell_ids text[], p_user_id uuid` |
| `SECURITY DEFINER` preserved | ✅ | `prosecdef = true` |
| `set search_path = ''` | ✅ | `proconfig = {search_path=""}` |
| `p_user_id` required (replaces `auth.uid()`) | ✅ | `if p_user_id is null then raise … 42501` |
| claim / steal / defend classification | ✅ | live body confirmed (`pg_get_functiondef`) |
| `territory_captures` INSERT | ✅ | live body confirmed |
| `cell_ownership` UPSERT (last-writer-wins) | ✅ | live body: `on conflict (cell_id) do update` |
| Row locks (`FOR UPDATE`) | ✅ | live body confirmed |

**Applied state: (B) — applied to the live DB.** Verified two ways:
- `supabase_migrations.schema_migrations` contains the migration.
- Live function body (`pg_get_functiondef`, 3922 chars) contains the cell loop + both writes + classification + locks — i.e. the file is not merely present locally; its logic is the live function.

⚠️ **Migration-history drift (real, low-severity).** The local file is `20260604121656_finalize_rpc_v2.sql`, but the **remote migration version is `20260604074931`** with `name = "20260604121656_finalize_rpc_v2"`. This is the signature of applying via MCP `apply_migration` (which stamps its own timestamp and stores the supplied name) rather than `supabase db push`. Consequence: `supabase migration list` will show the local `20260604121656` as pending and the remote `20260604074931` as unknown-locally — a drift that violates the repo's "repository is the source of truth / MCP-applied migrations must exist locally with matching versions" rule.

---

## Step 3 — Trust Boundary Verification

**Has the approved Option A security model actually been enforced on the live DB? → YES.**

| Property | Live value | Source |
|---|---|---|
| `finalize_workout` owner | `postgres` | `pg_get_userbyid(proowner)` |
| `SECURITY DEFINER` | `true` | `prosecdef` |
| `authenticated` EXECUTE | **false** | `has_function_privilege('authenticated', …, 'EXECUTE')` |
| `service_role` EXECUTE | **true** | `has_function_privilege('service_role', …, 'EXECUTE')` |
| `anon` EXECUTE | **false** | `has_function_privilege('anon', …, 'EXECUTE')` |
| `PUBLIC` EXECUTE | **false** | `proacl = {postgres=X/postgres, service_role=X/postgres}` — no PUBLIC (`=X/…`) entry |

The cell-accepting RPC is therefore **not reachable via PostgREST by any client role** (`/rest/v1/rpc/finalize_workout` returns permission-denied for `anon`/`authenticated`). Only a holder of the service-role key (the Next.js server action) can invoke it. This is exactly the board-takeover mitigation Finding 1 of the 02D-04 review required, and it matches the code: `stop.ts` verifies identity via `getUser()` on the user-scoped client, then switches to `createServiceRoleClient()` solely to call the RPC, passing the verified `user.id` as `p_user_id`.

⚠️ The model is enforced **at the DB** but has **no automated regression test** guarding it (see Step 5). And the document that was supposed to *authorize* this model (the ADR) does not exist (see Missing).

---

## Step 4 — Code Quality Gates

| Gate | Result | Detail |
|---|---|---|
| `npm run typecheck` | ❌ **FAIL** | 8 errors, all cascading from `finalize.test.ts:213` (`TS1005 ',' expected`, `TS1002 unterminated string`, `TS1128`) — the unescaped apostrophe |
| `npm run lint` | ❌ **FAIL** | 1 error: `finalize.test.ts 213:56 Parsing error: ',' expected` (same cause) |
| `npm test` | ❌ **FAIL** | Suites: **3 failed**, 6 skipped, 25 passed (34 total). Tests: **14 failed**, 41 skipped, 265 passed (320 total) |

**Failing suites and exact root causes:**

1. **`tests/integration/running/finalize.test.ts`** — parse failure (apostrophe at L213). Suite cannot load. *Even once fixed, it is DB-gated and would be **skipped** locally (no creds).*
2. **`tests/unit/features/running/services/finalize.test.ts`** — **7 failures.** Calls the v1 2-arg signature `finalizeWorkout(client, validId)` ([L33, L56, L87, L101, L112, L123, L144](../../tests/unit/features/running/services/finalize.test.ts)). The v2 service is `finalizeWorkout(client, workoutId, cellIds, userId)`; with `cellIds` undefined, `[...cellIds]` throws **`cellIds is not iterable`**. The unit test was never migrated to v2.
3. **`tests/unit/features/running/actions/stop.test.ts`** — **7 failures.** `TypeError: Cannot read properties of undefined (reading 'getUser')` at [stop.ts:55](../../features/running/actions/stop.ts#L55). The test's `mockClient` returns only `{ from }` (no `auth.getUser`), does not mock `@/infrastructure/supabase/service-role`, and still asserts the old `toHaveBeenCalledWith(client, validId)`. The unit test was never migrated to the v2 service-role flow.

All 14 failures are interrupted-implementation collateral: production code was migrated to v2; its companion unit tests and the new integration suite's syntax were not finished.

---

## Step 5 — Integration Coverage Audit

| Required test | Status | Notes |
|---|---|---|
| `contention.test.ts` (last-writer-wins + audit log) | **Implemented** (syntactically valid) — **runtime-unverified** | DB-gated; skipped locally |
| `capture-determinism.test.ts` (claim→defend, audit grows) | **Implemented** (syntactically valid) — **runtime-unverified** | DB-gated; skipped locally |
| Direct RPC rejection (authenticated caller → permission denied) | **ABSENT** | Every `rpc('finalize_workout')` in the suite uses the `admin` (service-role) client. No user-scoped/JWT call asserting denial. This is the only automated proof of Option A — and it is missing. |
| Migration-verification updates for v2 | **ABSENT / incomplete** | `migration-verification.test.ts` covers 02A/02B-01/02D-01 table reachability only; nothing asserts the finalize v2 signature, the v1 drop, or the revoked-grant posture. (The file notes catalog-level verification is done via MCP — which this audit performed manually, but no committed test guards it.) |

`tests/integration/security/rls.test.ts` **is** present and thorough for **table-level** RLS on `territory_captures`/`cell_ownership` (direct client INSERT/UPDATE/DELETE denied) — but that asserts the 02D-02 table policies, **not** the 02D-05 RPC-execute boundary.

---

## Step 6 — Database Types Audit

**`database.types.ts` matches the live DB. ✅**

- Only diff vs. committed: `finalize_workout.Args` changed from `{ p_workout_id }` → `{ p_cell_ids: string[]; p_user_id: string; p_workout_id: string }` — exactly the live signature.
- `CompositeTypes.finalize_workout_result` (9 fields: `workout_id, status, distance_m, duration_s, avg_pace_s_per_km, xp_awarded, cells_claimed, cells_stolen, cells_defended`) matches `information_schema.attributes` for the live composite type, field-for-field and in order.
- No mismatch between types ↔ live DB ↔ migration file.

---

## Deliverable Summary

### Completed
- **finalize v2 migration** written, applied, and **live-body-verified** (cell loop, `territory_captures` write, `cell_ownership` upsert/last-writer-wins, claim/steal/defend, row locks, `SECURITY DEFINER`, `search_path=''`, v1 dropped).
- **Option A trust boundary enforced on the live DB** (EXECUTE: service_role ✅; authenticated/anon/PUBLIC ❌).
- **`service-role.ts`** server-only client — complete.
- **`finalize.ts`** v2 service (4-arg, maps composite → `FinalizeResult`) — complete.
- **`stop.ts`** wiring (getUser identity → service-role client → `captureCells` → RPC) — complete.
- **`capture.ts`** (02D-04 dependency) — present and used.
- **`database.types.ts`** regenerated; matches live DB.

### Partially Complete
- **Integration suites `contention` + `capture-determinism`** — written and valid, but **never executed** (DB-gated, skipped). Runtime correctness of claim/steal/defend counts is **unproven by any run**.
- **`finalize.test.ts` (integration, v2)** — written but **does not compile** (apostrophe). Also DB-gated.
- **`migration-verification.test.ts`** — exists but **not extended** for finalize v2 / grants.
- **Doc reconciliation** — `execution-plan` + `implementation-order` edited; the ADR and the R-07 / database-plan M6 / arch §4.2,§8.5 updates the 02D-04 review demanded are not evidenced.

### Missing
- **`docs/phase-02/02D-05-trust-boundary-adr.md`** — **does not exist anywhere in the repo**, yet is cited by [`service-role.ts` §5.3](../../infrastructure/supabase/service-role.ts#L17) and `stop.ts`. The 02D-04 review made 02D-05 **NO-GO until this ADR is recorded**; the implementation shipped Option A but the **gating artifact was never authored**, leaving dangling references in shipped code.
- **Direct-RPC-rejection integration test** (authenticated caller denied EXECUTE) — the only automated guard of Option A.
- **v2 assertions in `migration-verification.test.ts`.**
- **Migrated unit tests** for `finalize.ts` and `stop.ts` (currently red on the v1 contract).

### Live DB Status
- Migration **applied**. Live function = v2, owner `postgres`, `SECURITY DEFINER`, `search_path=''`.
- Grants: `service_role` only. `authenticated`/`anon`/`PUBLIC` revoked.
- ⚠️ **History drift:** local version `20260604121656` vs remote version `20260604074931` (MCP-apply artifact).

### Test Status
- `typecheck`: ❌ FAIL (1 root cause). `lint`: ❌ FAIL (same). `test`: ❌ FAIL — 3 suites / 14 tests (7 finalize-unit on v1 signature, 7 stop-unit on missing `auth`/service-role mock, +1 integration suite parse failure).
- 41 tests skipped (all DB-gated integration, incl. the territory suites) — **unverified, not passing.**
- 265 unit/integration tests passing (everything not touching the v2 contract).

### Security Status
- **Option A enforced live: YES** (evidence in Step 3). Strong posture at the DB layer.
- **Gaps:** no regression test locks the boundary in; the authorizing **ADR is missing**; shipped code references that non-existent ADR.

### Remaining Work
1. Fix `finalize.test.ts:213` (escape the apostrophe / use double quotes). *Unblocks typecheck + lint + the suite parse simultaneously.*
2. Migrate `tests/unit/.../services/finalize.test.ts` to the 4-arg signature (`cellIds`, `userId`).
3. Migrate `tests/unit/.../actions/stop.test.ts`: mock `auth.getUser`, mock `createServiceRoleClient`, update `toHaveBeenCalledWith`.
4. Author `docs/phase-02/02D-05-trust-boundary-adr.md` (Option A) and reconcile R-07 / database-plan M6 / arch §4.2,§8.5.
5. Add the direct-RPC-rejection integration test (authenticated client → permission denied).
6. Extend `migration-verification.test.ts` for the v2 signature + revoked-grant posture.
7. Resolve migration-history drift (align local filename/version with the remote `schema_migrations` entry).
8. Decide whether the out-of-scope `useWorkoutRecorder` / `gps-status-diagnostic` changes belong in the 02D-05 commit.
9. Re-run all three gates to green.

### Recommended Next Action
**Start with the 1-character fix at `finalize.test.ts:213`** — it clears typecheck, lint, and the integration-suite parse error in one move and gives a clean baseline. Then, in order: migrate the two unit suites (3) → author the ADR (4) → add the absent direct-RPC-rejection + migration-verification-v2 tests (5–6) → re-run gates (9). The DB and production code need **no** changes; the remaining work is the verification/documentation layer that the interruption left unfinished.

---

## Completion Estimate — ~72%

Weighted so the reader can check the arithmetic:

| Dimension | Weight | Done | Contribution |
|---|---|---|---|
| Migration + live DB + Option A enforcement (security-critical core) | 35% | ~100% | 35 |
| Production code (`service-role`, `finalize`, `stop`, types) | 25% | ~100% | 25 |
| Integration tests (written but unrun; 1 broken; 1 absent) | 20% | ~45% | 9 |
| Unit tests migrated to v2 | 10% | 0% | 0 |
| ADR + doc reconciliation (gating artifact) | 10% | ~30% | 3 |
| **Total** | **100%** | | **≈72%** |

**Tension to surface, not hide:** the security-critical half (migration + live Option A) is done and verified live, which argues *higher*. But CLAUDE.md defines "complete" as **lint + typecheck + tests all pass** — all three are red — and the required ADR is absent, which argues *lower*. **72%** sits between those, weighted toward the fact that the hard, irreversible, security-bearing work is finished and the remainder is mechanical (fix one char, migrate tests, write docs).

---

**Audit complete. Nothing in the working tree, test suite, migrations, or database was modified. Pausing for review.**
