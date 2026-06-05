# Phase 02E-06 — Leaderboards & Territory Rankings (Read-Only MVP) Verification Report

## Objective
The objective was to introduce multiplayer visibility and ranking systems without creating new tables, modifying the database schema, or using materialized views. Leaderboards and the "Territory King" are dynamically computed from existing data sources (`workouts`, `territory_captures`, `cell_ownership`, `user_xp`).

## Files Created / Modified
The following files implement the features and tests for the leaderboards:

- `features/leaderboards/types.ts`
- `features/leaderboards/services/leaderboards.ts`
- `features/leaderboards/data/load-leaderboards.ts`
- `features/leaderboards/components/LeaderboardCard.tsx`
- `features/leaderboards/components/LeaderboardTable.tsx`
- `features/leaderboards/components/TerritoryKingCard.tsx`
- `features/leaderboards/components/LeaderboardTabs.tsx`
- `app/(protected)/leaderboards/page.tsx`
- `components/layout/Navbar.tsx` (Added Leaderboards navigation)
- `scripts/dev/seed-xp.ts` (Extended to include leaderboard competitor users)
- `scripts/dev/seed-leaderboards.ts` (New file for creating leaderboard personas)
- `tests/unit/features/leaderboards/services/leaderboards.test.ts`
- `tests/unit/features/leaderboards/data/load-leaderboards.test.ts`
- `tests/unit/features/leaderboards/components/LeaderboardCard.test.tsx`
- `tests/unit/features/leaderboards/components/LeaderboardTable.test.tsx`
- `tests/unit/features/leaderboards/components/TerritoryKingCard.test.tsx`

## Verification Results

### Typecheck Results
`npm run typecheck` completed successfully.

### Lint Results
`npm run lint` completed successfully with no errors or warnings.

### Test Results
`npm test -- tests/unit/features/leaderboards` completed successfully:
- **Test Suites:** 5 passed, 5 total
- **Tests:** 29 passed, 29 total
- **Time:** 3.725 s

**Unrelated Failures Documented:** 
When running the full test suite (`npm test`), there are 50 unrelated failures originating entirely from `tests/integration/security/rls.test.ts`. The errors (`Failed to create test user (tc1): Database error creating new user`) stem from `admin.auth.signInWithPassword` and `admin.auth.admin.createUser` failing to provision test users for RLS checks. These are known environment/integration-level failures not introduced by or related to the leaderboards code.

## Functional Examples

### Leaderboard Examples
Four ranking dimensions are fully functional:
- **XP:** Ranked by `user_xp.total_xp`.
- **Territory:** Ranked by the sum of owned cells from `cell_ownership`.
- **Distance:** Ranked by `sum(distance_m)` across completed workouts.
- **Weekly:** Ranked by XP awarded specifically in the current ISO week from `xp_events`.

### Tie-Break Examples
The `rankScored` function in the leaderboards service handles tie-breaks dynamically and deterministically. If multiple athletes have the same value (e.g., exactly 1200 XP), the tie-break resolves as follows:
1. **Earlier Achievement Date Wins:** The athlete who reached the value first (determined by the latest contributing timestamp).
2. **Earlier Account Creation Date Wins:** If the achievement date is identical, the older account wins.
3. **Ascending userId:** A final stable fallback.

### Territory King Example
The "Territory King" is identified by aggregating `cell_ownership` rows. The `getTerritoryKing` service returns the absolute top territory owner (e.g., the `land_baron` persona), displaying their username and total territory count directly on the dashboard's "Reigning Champion" card.

## Dev Data Seed
The development seed (`npm run seed:dev` or executing `seed-xp.ts`) was updated. The seed now creates multiple personas, each dominating a different leaderboard category (e.g., `xp_titan`, `land_baron`, `mile_crusher`, `week_warrior`), ensuring realistic multi-user rankings in the local environment.

## Remaining Risks
- **Read-Only Performance:** Currently, the ranking logic pulls all rows and aggregates them dynamically. While perfectly fine for an MVP and initial player base, scaling to thousands of users or workouts will eventually necessitate caching, pagination, or materialized views to maintain response times.
- **Integration Test Environment:** The `rls.test.ts` auth creation issues remain an open environmental configuration problem that might block a fully green CI pipeline in the future.
