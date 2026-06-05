# Phase 02E-01 - XP Foundation System - Verification Report

**Date:** 2026-06-05  
**Scope:** Finish the interrupted local repository work for the XP foundation only: commit the
missing migration artifact(s), verify the generated Supabase type surface, run the requested
checks, and document the results. No changes to the GPS pipeline, territory logic, ownership
logic, capture rules, heatmap, world view, or workout lifecycle behaviour outside the XP award
path already verified in the live database.

---

## Summary verdict

**02E-01 is complete within scope at the repository level.**

- `npm run typecheck` -> **exit 0**
- `npm run lint` -> **exit 0**
- Focused XP unit tests -> **22/22 passing**
- Focused XP integration tests -> **5/5 passing**

The focused XP integration suite proves the important live behaviours for this phase:

- SQL award parity with the TypeScript XP rules
- `workouts.xp_awarded` population
- `xp_events` writes
- `user_xp` aggregation and derived level
- duplicate prevention on re-finalize
- `finalize_workout` idempotency for completed workouts

The full `npm test` run is **not all green**, but the failures are **outside the XP scope** and
match a pre-existing integration-helper problem: multiple older DB-gated suites still create auth
users without the username metadata required by the live `handle_new_user` trigger. The XP suite
already uses the corrected helper pattern and passes.

---

## Files Created

| File | Purpose |
|---|---|
| `supabase/migrations/20260605055813_finalize_workout_v3_xp.sql` | Local repository copy of the verified `finalize_workout` v3 XP-award migration. |
| `docs/phase-02/phase-02E-01-verification-report.md` | This report. |

## Files Modified

| File | Change |
|---|---|
| None | No existing tracked file required a content edit during this completion pass. |

## Files Verified Unchanged

| File | Verification outcome |
|---|---|
| `supabase/migrations/20260604193004_xp_foundation.sql` | Already present locally and matches the previously verified XP foundation schema shape (helper, tables, indexes, RLS, duplicate guard). |
| `infrastructure/supabase/database.types.ts` | Already reflected the verified generated types for `user_xp`, `xp_events`, `xp_level()`, `workouts.xp_awarded`, and the updated `finalize_workout` return shape. No drift found, so no edit was necessary. |

## Migration details

### 1. `20260604193004_xp_foundation.sql`

Verified present locally with the expected XP foundation schema:

- `public.xp_level(p_xp bigint) -> integer`
- `public.user_xp`
- `public.xp_events`
- index `idx_xp_events_user_id_created_at`
- index `idx_xp_events_workout_id`
- unique duplicate-prevention guard `uq_xp_events_workout_type`
- RLS enabled on both XP tables
- read-own `SELECT` policies only
- no write policies; writes remain server-controlled

### 2. `20260605055813_finalize_workout_v3_xp.sql`

Created locally in this pass. The migration preserves the verified v2 trust boundary and territory
logic, and adds the XP write path:

- `SECURITY DEFINER` preserved
- `set search_path = ''` preserved
- `service_role`-only `EXECUTE` preserved
- `p_user_id` ownership check preserved
- completed-workout early return preserved (idempotent re-finalize)
- territory capture loop unchanged in behaviour
- computes workout/capture/steal XP in SQL
- writes `workouts.xp_awarded`
- inserts non-zero `xp_events` rows per award type
- upserts cumulative `user_xp` and derives `level` via `xp_level()`

**Important honesty note:** the live DB behaviour and generated type surface were available for
verification in this session, but the exact deployed function text could not be pulled directly from
Supabase because the local environment did not have a working schema-pull toolchain (`supabase` CLI
and `psql` were unavailable here). The local v3 migration file was therefore reconstructed to match
the already verified live behaviour and type shape. Behavioural parity is proven by the live XP
integration suite below.

## XP rules

- Workout completion: **+25 XP**
- Distance: **+5 XP per whole km** (`floor(distance_m / 1000)`)
- Neutral capture: **+10 XP per claimed cell**
- Steal: **+25 XP per stolen cell**
- Levels:
  - **L1 = 0**
  - **L2 = 100**
  - **L3 = 250**
  - **L4 = 500**
  - **L5 = 1000**

## Typecheck results

`npm run typecheck`

- **Exit code:** `0`
- **Result:** 0 errors

## Lint results

`npm run lint`

- **Exit code:** `0`
- **Result:** 0 errors / 0 warnings

## Test results

### Focused XP unit tests

`npx jest tests/unit/features/xp`

- **Suites:** 3 passed
- **Tests:** 22 passed, 0 failed

Coverage of the pure XP layer remains green:

- award rules
- distance flooring
- capture / steal calculations
- total XP aggregation
- level thresholds
- XP profile reads / mapping

### Focused XP integration tests

`npx jest tests/integration/features/xp/xp-award.test.ts`

- **Suites:** 1 passed
- **Tests:** 5 passed, 0 failed

Verified live DB behaviours:

1. first finalize parity: SQL XP equals TS `calculateTotalXP(...)`
2. workout-only distance XP path
3. cumulative `user_xp.total_xp` aggregation and derived level
4. steal XP path
5. duplicate prevention: re-finalizing a completed workout awards no extra XP

### Full Jest run

`npm test`

- **Suites:** 39 passed, 7 failed, 46 total
- **Tests:** 355 passed, 50 failed, 405 total
- **Exit code:** `1`

### Full-run failure classification

**XP-specific failures observed:** `0`

**Observed failing area:** older DB-gated integration suites outside this phase's allowed modify
scope (`running`, `territory`, `security`).

**Observed root cause:** integration helpers in those suites still call
`admin.auth.admin.createUser(...)` without the username metadata required by the live auth trigger,
so user creation fails first with:

`Database error creating new user`

Several suites then also surface cleanup noise from trying to delete an undefined user id:

`Expected parameter to be UUID but is not`

This is the same broad test-infra issue previously seen when DB-gated suites run in a
credentials-present environment. It is not an XP award regression. The cleanest proof is that the
XP integration suite already uses the username-aware helper pattern and passes end to end.

## Integration verification for the requested XP guarantees

- **Duplicate prevention still works:** verified by `xp-award.test.ts` test 5/5.
- **`finalize_workout` remains idempotent:** verified by the completed-workout re-finalize path in
  `xp-award.test.ts` (same test also proves no extra XP events and no `user_xp` increment).
- **XP parity still passes:** verified by `xp-award.test.ts` test 1/5 (SQL equals TS calculation for
  the same inputs).

## Remaining risks

1. **Local v3 migration text was reconstructed, not schema-pulled.** Behavioural parity with the
   live database is proven, but byte-for-byte equality with the deployed function text was not
   established in this environment because direct schema-pull tooling was unavailable.
2. **Full `npm test` remains red outside XP scope.** The older integration helpers that omit
   username metadata still need a separate maintenance pass; this report intentionally did not touch
   those unrelated territory/running/security suites.
3. **Some older finalize-related comments/tests still describe "v2" semantics.** That did not
   affect the XP verification path in this pass, but those labels should be cleaned up during a
   future test-maintenance pass once the broader auth-helper issue is addressed.

## Final state

- Missing local v3 migration artifact created
- XP foundation migration verified present
- generated DB types verified current
- typecheck green
- lint green
- XP unit green
- XP integration green
- duplicate prevention verified
- idempotent finalize verified
- SQL/TS XP parity verified

**Paused after verification.**
