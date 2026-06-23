# Sprint 4.5 Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up Sprint 4.5 by exporting shared analytics, deleting dead web utility duplicates, fixing React version mismatch in mobile, and documenting the remaining heatmap tech debt.

**Architecture:** The shared analytics package (`packages/shared/src/analytics/`) already exists with all logic. The web dashboard page and `workout-detail.ts` already import from it. Two utility files (`dashboard-stats.ts`, `insights.ts`) in `features/running/utils/` are now dead code — nothing in `app/` or `features/` imports them, but their unit tests still point at them. We update those two test imports, delete the dead files, then expose analytics via the shared root index.

**Tech Stack:** TypeScript, Next.js 15, Expo SDK 54, Jest, packages/shared monorepo package

---

## File Map

| Action | File |
|--------|------|
| Modify | `packages/shared/src/index.ts` |
| Modify (test) | `tests/unit/features/running/utils/dashboard-stats.test.ts` |
| Modify (test) | `tests/unit/features/running/utils/insights.test.ts` |
| Delete | `features/running/utils/dashboard-stats.ts` |
| Delete | `features/running/utils/insights.ts` |
| Create | `docs/tech-debt/TECH-DEBT-MAP-001.md` |
| No change | `apps/mobile/package.json` (already says react 19.2.4) |
| Fix (lockfile) | `apps/mobile/package-lock.json` via `npm install` |

---

## Task 1: Export analytics from shared root index

**Files:**
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Add analytics export**

  Replace the full contents of `packages/shared/src/index.ts` with:

  ```ts
  export * from './xp'
  export * from './running'
  export * from './territory'
  export * from './analytics'
  ```

- [ ] **Step 2: Verify no naming conflicts by typechecking the shared package**

  ```bash
  cd packages/shared && npx tsc --noEmit
  ```

  Expected: exits 0 with no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add packages/shared/src/index.ts
  git commit -m "feat(shared): export analytics from shared root index"
  ```

---

## Task 2: Update dashboard-stats test to import from shared

**Files:**
- Modify: `tests/unit/features/running/utils/dashboard-stats.test.ts`

Context: `computeDashboardStats` in the shared package has the same signature as the local one. The shared version adds `longestStreakDays` to the return type — existing assertions don't check for that field, so they pass unchanged. `DashboardActivityRow` is structurally identical in both locations; keeping the import from `features/running/services/history` is fine because TypeScript's structural typing accepts it.

- [ ] **Step 1: Update the import line**

  In `tests/unit/features/running/utils/dashboard-stats.test.ts`, change line 4:

  ```ts
  // Before
  import { computeDashboardStats } from '@/features/running/utils/dashboard-stats'
  ```

  ```ts
  // After
  import { computeDashboardStats } from '@stridequest/shared/analytics'
  ```

  Leave the `DashboardActivityRow` import on line 5 untouched — it's still used as a helper type for building test fixtures.

- [ ] **Step 2: Run the test to verify it passes**

  ```bash
  npx jest tests/unit/features/running/utils/dashboard-stats.test.ts --no-coverage
  ```

  Expected: all tests in that file pass.

- [ ] **Step 3: Commit**

  ```bash
  git add tests/unit/features/running/utils/dashboard-stats.test.ts
  git commit -m "test: import computeDashboardStats from shared/analytics"
  ```

---

## Task 3: Update insights test to import from shared

**Files:**
- Modify: `tests/unit/features/running/utils/insights.test.ts`

Context: `buildInsights` and `WorkoutSplit` from shared analytics are structurally identical to the web versions. The shared `WorkoutSplit` has fields: `index, distanceM, durationS, paceSPerKm, isFastest, isSlowest` — same as `features/running/types/workout-detail`.

- [ ] **Step 1: Update both import lines**

  In `tests/unit/features/running/utils/insights.test.ts`, change lines 1-2:

  ```ts
  // Before
  import { buildInsights } from '@/features/running/utils/insights'
  import type { WorkoutSplit } from '@/features/running/types/workout-detail'
  ```

  ```ts
  // After
  import { buildInsights } from '@stridequest/shared/analytics'
  import type { WorkoutSplit } from '@stridequest/shared/analytics'
  ```

- [ ] **Step 2: Run the test to verify it passes**

  ```bash
  npx jest tests/unit/features/running/utils/insights.test.ts --no-coverage
  ```

  Expected: all tests in that file pass.

- [ ] **Step 3: Commit**

  ```bash
  git add tests/unit/features/running/utils/insights.test.ts
  git commit -m "test: import buildInsights from shared/analytics"
  ```

---

## Task 4: Delete the dead web utility files

**Files:**
- Delete: `features/running/utils/dashboard-stats.ts`
- Delete: `features/running/utils/insights.ts`

Prerequisite: Tasks 2 and 3 must be complete. Nothing in `app/` or `features/` imports these files — the dashboard page and `workout-detail.ts` already import from `@stridequest/shared/analytics` directly.

- [ ] **Step 1: Confirm no remaining imports (safety check)**

  ```bash
  grep -rn "from.*utils/dashboard-stats\|from.*utils/insights" features/ app/ --include="*.ts" --include="*.tsx"
  ```

  Expected: no output (zero matches).

- [ ] **Step 2: Delete the files**

  ```bash
  rm features/running/utils/dashboard-stats.ts
  rm features/running/utils/insights.ts
  ```

- [ ] **Step 3: Run full unit tests to verify nothing broke**

  ```bash
  npx jest --testPathPatterns="tests/unit" --no-coverage
  ```

  Expected: 569 passed (or current count), 0 failed.

- [ ] **Step 4: Run typecheck**

  ```bash
  npm run typecheck
  ```

  Expected: exits 0 with no errors.

- [ ] **Step 5: Commit**

  ```bash
  git add -A
  git commit -m "refactor: delete dead dashboard-stats and insights web utils (logic lives in shared/analytics)"
  ```

---

## Task 5: Fix React version alignment in mobile

**Files:**
- Fix (lockfile): `apps/mobile/package-lock.json`

Context: `apps/mobile/package.json` already declares `"react": "19.2.4"` but `npm install` was run with an older lockfile that pinned `react@19.1.0` in `apps/mobile/node_modules/react`. The root has `react@19.2.4`. This causes the `expo-doctor` duplicate-react failure. Running `npm install` inside `apps/mobile` refreshes the lockfile to match the declared version.

- [ ] **Step 1: Run npm install inside mobile**

  ```bash
  cd apps/mobile && npm install
  ```

  Expected: lockfile updates, react 19.2.4 resolves.

- [ ] **Step 2: Confirm react version**

  ```bash
  node -e "console.log(require('./apps/mobile/node_modules/react/package.json').version)"
  ```

  Expected output: `19.2.4`

- [ ] **Step 3: Run expo-doctor**

  ```bash
  cd apps/mobile && npx expo-doctor
  ```

  Expected: `18/18 checks passed` (or current count), no duplicate-react warning.

- [ ] **Step 4: Run mobile tests to verify nothing regressed**

  ```bash
  cd apps/mobile && npx jest --no-coverage
  ```

  Expected: 57 passed, 0 failed.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/mobile/package-lock.json
  git commit -m "fix(mobile): update lockfile to resolve react@19.2.4 (was pinned at 19.1.0)"
  ```

---

## Task 6: Create TECH-DEBT-MAP-001 documentation

**Files:**
- Create: `docs/tech-debt/TECH-DEBT-MAP-001.md`

Context: `apps/mobile/src/features/maps/services/heatmap.ts` already carries an inline comment `// TECH-DEBT-MAP-001: Create user_heatmap materialized view or RPC...`. This task creates the formal ticket document so the debt is discoverable outside the source file.

- [ ] **Step 1: Create the tech-debt directory and document**

  Create `docs/tech-debt/TECH-DEBT-MAP-001.md` with this content:

  ```markdown
  # TECH-DEBT-MAP-001: Heatmap Full-Scan Performance

  **Status:** Open  
  **Severity:** Medium (correctness over performance; no data loss)  
  **Source file:** `apps/mobile/src/features/maps/services/heatmap.ts`

  ## Issue

  `getUserHeatmap()` fetches all `territory_captures` rows for the current user with no time or row-count limit, then aggregates them in-memory. As capture history grows (long-term users, high-frequency captures), this query will degrade.

  The heatmap service on web (`features/territory/services/heatmap.ts`) has the same scan pattern.

  ## Impact

  - Query latency grows linearly with total lifetime captures per user.
  - No data is lost or truncated — correctness is maintained at the cost of speed.
  - Current MVP user base: negligible impact. Risk horizon: >10,000 captures per user.

  ## Acceptance Criteria for Resolution

  - Create a `user_heatmap` Postgres view or materialized view that pre-aggregates `count(*)` per `(user_id, cell_id)`.
  - Alternatively, expose a `get_user_heatmap(user_id)` RPC that returns the aggregated rows directly.
  - Both mobile (`getUserHeatmap`) and web heatmap services should be updated to use the new endpoint.
  - No arbitrary row limits should be introduced — the fix must preserve complete data.

  ## Target Sprint

  Sprint 5 (post-stabilization, once RPC/view infrastructure for territory is established).

  ## Related

  - `TECH-DEBT-ACH-001` (inline comment in `apps/mobile/src/features/achievements/services/achievements.ts`) — same scan pattern for achievement aggregation.
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add docs/tech-debt/TECH-DEBT-MAP-001.md
  git commit -m "docs: add TECH-DEBT-MAP-001 heatmap full-scan performance ticket"
  ```

---

## Task 7: Full verification run

Run every required check and record the output. Do NOT claim success — paste the actual output.

- [ ] **Step 1: Root typecheck**

  ```bash
  npm run typecheck
  ```

  Expected: exits 0.

- [ ] **Step 2: Root unit tests**

  ```bash
  npx jest --testPathPatterns="tests/unit" --no-coverage
  ```

  Expected: all tests pass.

- [ ] **Step 3: Mobile tests**

  ```bash
  cd apps/mobile && npx jest --no-coverage
  ```

  Expected: 57 passed.

- [ ] **Step 4: expo-doctor**

  ```bash
  cd apps/mobile && npx expo-doctor
  ```

  Expected: all checks passed, no duplicate-react warning.

- [ ] **Step 5: Android export**

  ```bash
  cd apps/mobile && npx expo export -p android
  ```

  Expected: export completes with no errors.

- [ ] **Step 6: Confirm git diff is clean**

  ```bash
  git diff --stat HEAD~6 HEAD
  ```

  Summarise what changed. Sprint 4.5 is complete only when every check above passes.

---

## Sprint 4.5 Definition of Done

- [ ] `packages/shared/src/index.ts` exports analytics
- [ ] `features/running/utils/dashboard-stats.ts` deleted
- [ ] `features/running/utils/insights.ts` deleted
- [ ] `apps/mobile/node_modules/react` is 19.2.4 (no expo-doctor duplicate warning)
- [ ] `docs/tech-debt/TECH-DEBT-MAP-001.md` exists and is committed
- [ ] Root unit tests: all pass
- [ ] Mobile tests: 57/57 pass
- [ ] `npm run typecheck` exits 0
- [ ] `npx expo export -p android` exits 0
