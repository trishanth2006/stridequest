# Phase 02E-02 - XP Profile & Progress UI - Verification Report

**Date:** 2026-06-05  
**Scope:** Read-only XP profile UI and visualization only. No changes to `finalize_workout`, XP
award rules, `user_xp`, `xp_events`, territory logic, ownership logic, capture logic, GPS, workout
write paths, heatmap, or world view.

---

## Summary verdict

**02E-02 is implemented and green within its own scope.**

- `npm run typecheck` -> **exit 0**
- `npm run lint` -> **exit 0**
- focused XP unit suite -> **33/33 passing**

The new page and components now show:

- Current Level
- Total XP
- Progress to Next Level
- XP Needed for Next Level
- Recent XP Events
- Workout XP History

The full `npm test` run is still **not all green**, but the failures are **not caused by the XP UI
work**. They are the same older DB-gated integration failures already seen in a credentials-present
environment: multiple non-XP integration suites still create auth users without the username
metadata required by the live `handle_new_user` trigger.

---

## Files Created

| File | Purpose |
|---|---|
| `app/(protected)/xp/page.tsx` | Protected XP profile page. Loads the signed-in user's XP summary, recent events, and workout XP history. |
| `features/xp/components/LevelBadge.tsx` | Compact level display chip. |
| `features/xp/components/XPCard.tsx` | Reusable summary metric card used by the dashboard. |
| `features/xp/components/XPProgressBar.tsx` | Progress visualization for current XP, next-level target, XP remaining, and progress %. |
| `features/xp/components/XPEventList.tsx` | Recent XP event feed with empty state. |
| `features/xp/components/XPDashboard.tsx` | Main XP dashboard composition layer. |
| `tests/unit/features/xp/components/LevelBadge.test.tsx` | Level display test coverage. |
| `tests/unit/features/xp/components/XPEventList.test.tsx` | Recent event rendering + empty-state coverage. |
| `tests/unit/features/xp/components/XPDashboard.test.tsx` | Dashboard progress/summary + workout-history empty-state coverage. |
| `tests/unit/features/xp/xp-progress.test.ts` | Pure XP progress calculation coverage. |
| `docs/phase-02/phase-02E-02-verification-report.md` | This report. |

## Files Modified

| File | Change |
|---|---|
| `features/xp/services/profile.ts` | Extended the read-only XP service with `getWorkoutXpHistory(...)` using `workouts.xp_awarded`. |
| `features/xp/services/xp.ts` | Added pure `getXpProgress(...)` helper for current level / next level / percent / XP remaining calculations. |
| `features/xp/types.ts` | Added `WorkoutXpHistoryEntry` read model for the UI history section. |
| `tests/unit/features/xp/profile.test.ts` | Added service coverage for `getWorkoutXpHistory(...)`; extended the mock builder to support `.not(...)`. |
| `components/layout/Navbar.tsx` | Added an `XP` nav entry so the new page is reachable from the protected shell. |

## Data sources used

- `user_xp`
- `xp_events`
- `workouts.xp_awarded`

No new schema objects, policies, functions, or migrations were introduced for this phase.

## UI behavior delivered

### Summary area

- Current Level
- Total XP
- Next milestone / XP remaining

### Progress area

Uses the existing MVP thresholds:

- L1 = 0
- L2 = 100
- L3 = 250
- L4 = 500
- L5 = 1000

Displays:

- Current XP
- Current Level XP floor
- Next Level XP
- XP Needed
- Progress %

Top-tier behavior:

- At level 5 and above, the UI shows max-tier state with no next level and `100%` progress.

### Activity area

- Recent XP events from `xp_events`
- Workout XP history from completed workouts with non-null `xp_awarded`
- Empty states for both event feed and workout history

## Test results

### Focused XP unit suite

`npx jest tests/unit/features/xp`

- **Suites:** 7 passed
- **Tests:** 33 passed, 0 failed

Coverage added in this phase:

- XP progress calculation
- level display
- recent event rendering
- empty-state handling
- workout XP history query mapping

### Typecheck

`npm run typecheck`

- **Exit code:** `0`
- **Result:** 0 errors

### Lint

`npm run lint`

- **Exit code:** `0`
- **Result:** 0 errors / 0 warnings

### Full Jest run

`npm test`

- **Suites:** 43 passed, 7 failed, 50 total
- **Tests:** 366 passed, 50 failed, 416 total
- **Exit code:** `1`

## Full-test failure classification

**XP UI failures observed:** `0`

**Failing suites:**

- `tests/integration/running/start-workout.test.ts`
- `tests/integration/running/ingest.test.ts`
- `tests/integration/running/finalize.test.ts`
- `tests/integration/territory/capture-determinism.test.ts`
- `tests/integration/territory/ownership.test.ts`
- `tests/integration/territory/contention.test.ts`
- `tests/integration/security/rls.test.ts`

**Observed root cause:**

Older integration helpers in those suites still call `admin.auth.admin.createUser(...)` without the
username metadata required by the live auth trigger, which produces:

- `Database error creating new user`

Cleanup then cascades into:

- `Expected parameter to be UUID but is not`

This is outside 02E-02 scope and unaffected by the XP page. The new XP unit slice is fully green.

## Remaining risks

1. **The XP page is unit-tested, not browser-screenshot verified in this pass.** The component and
   service paths are green, but no Playwright/manual viewport capture was taken here.
2. **Full `npm test` remains red for out-of-scope reasons.** Until the older DB-gated integration
   helpers supply username metadata, repo-wide green in a creds-present environment will remain
   blocked independently of the XP dashboard.
3. **Dashboard surface remains read-only by design.** That is correct for this phase, but any later
   product additions like achievements or comparisons will need separate scope and tests.

## Final state

- XP dashboard page created
- read-only XP service extended
- progress helper added
- level, progress, event feed, and workout XP history UI shipped
- typecheck green
- lint green
- focused XP unit coverage green
- full-test failures classified as unrelated

**Paused after verification.**
