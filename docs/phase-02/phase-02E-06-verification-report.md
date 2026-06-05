# Phase 02E-06 — Leaderboards & Territory Rankings (Read-Only MVP) — Verification Report

**Status:** ✅ Complete (read-only; no DB changes)
**Date:** 2026-06-05

---

## 1. What was built

A read-only, dynamically-computed leaderboard system over existing data:

- **XP**, **Territory**, **Distance**, and **Weekly** rankings (highest first).
- The signed-in user's own rank (even when outside the top 10) and total participants per category.
- The reigning **Territory King** (top cell owner).
- A protected `/leaderboards` page with a header, the Territory King card, and a tabbed table view; a new **Leaderboards** nav link.
- Dev seed data producing four distinct category leaders.

No migrations, RPCs, views, triggers, or DB writes were created — every ranking is computed at request time from `profiles`, `user_xp`, `workouts`, `cell_ownership`, and `xp_events`.

### Key architectural decision (cross-user reads vs. RLS)

The phase requires global rankings, but every relevant table **except `cell_ownership` is read-own under RLS** (`workouts`, `user_xp`, `xp_events`, and even `profiles`). The phase also forbids migrations/RPCs/views. These constraints collide: an RLS-scoped client can only see the caller's own rows, so XP/distance/weekly boards would each contain a single user.

Per user approval (**Option A**), cross-user data is read by the existing **service-role client** (which bypasses RLS), isolated in a single server-only module (`features/leaderboards/data/load-leaderboards.ts`). It is never imported under `app/(protected)/` components nor any browser-reachable barrel — only the server-component page imports it. Only aggregated rankings (rank/username/value) ever reach the client. This honors the spec's "no DB changes" literally while respecting the 02D-05 trust-boundary entry-point rule.

---

## 2. Files created

| File | Purpose |
|---|---|
| `features/leaderboards/types.ts` | Output + input row types |
| `features/leaderboards/services/leaderboards.ts` | **Pure** ranking functions (no I/O) |
| `features/leaderboards/data/load-leaderboards.ts` | Server-only service-role data loader (I/O only) |
| `features/leaderboards/components/LeaderboardCard.tsx` | One ranked row (rank/username/value, current-user highlight) |
| `features/leaderboards/components/LeaderboardTable.tsx` | Top 10 + appended current-user row when outside top 10 |
| `features/leaderboards/components/TerritoryKingCard.tsx` | 👑 Territory King + empty state |
| `features/leaderboards/components/LeaderboardTabs.tsx` | Client tab switcher (XP/Territory/Distance/Weekly) |
| `app/(protected)/leaderboards/page.tsx` | Thin server page: auth → load → pure rank → render |
| `scripts/dev/seed-leaderboards.ts` | Competitor-user seeding (extracted to keep files < 300 lines) |
| `tests/unit/features/leaderboards/services/leaderboards.test.ts` | Ranking + tie-break + rank tests |
| `tests/unit/features/leaderboards/components/LeaderboardCard.test.tsx` | Rendering + current-user highlight |
| `tests/unit/features/leaderboards/components/LeaderboardTable.test.tsx` | Top 10 + outside-top-10 visibility |
| `tests/unit/features/leaderboards/components/TerritoryKingCard.test.tsx` | King + empty state |
| `tests/unit/features/leaderboards/data/load-leaderboards.test.ts` | Loader row→shape mapping + error propagation (mocked client) |
| `docs/phase-02/phase-02E-06-verification-report.md` | This report |

## 3. Files modified

| File | Change |
|---|---|
| `components/layout/Navbar.tsx` | Added `Leaderboards` nav link |
| `scripts/dev/seed-xp.ts` | Orchestrates primary + competitor seeding; no-user case is now non-fatal so competitor seeding still runs on a fresh DB |

---

## 4. Tests added & results

New: **29 tests** across 5 suites (16 service, 5 card, 4 table, 2 king, 2 loader).

```
npm run typecheck   ✅ pass (tsc --noEmit, 0 errors)
npm run lint        ✅ pass (eslint, 0 warnings)
npx jest tests/unit ✅ 59 suites / 440 tests passed
npm run build       ✅ pass (next build, exit 0) — validates the RSC server/client
                       boundary; `/leaderboards` compiles as a dynamic (ƒ) route
```

### Unrelated failures (documented separately)

`npx jest` (full) reports **7 failing suites, all under `tests/integration/`**:
`security/rls`, `running/finalize`, `running/ingest`, `running/start-workout`,
`territory/capture-determinism`, `territory/contention`, `territory/ownership`.

These require a **live Supabase backend**; they fail in `beforeAll` user provisioning
(`auth.admin.deleteUser` receives a non-UUID because user creation never ran), i.e. no
configured live env in this environment. None reference leaderboards and none import or share
code paths changed in this phase (changes are confined to `features/leaderboards/`,
`app/(protected)/leaderboards/`, the Navbar link, and the dev seed scripts). They were not
exercised here against a live backend.

---

## 5. Sources & rules

| Board | Source | Notes |
|---|---|---|
| XP | `user_xp.total_xp` | `profiles.total_xp` is **not** maintained by `finalize_workout_v3` (stays 0), so `user_xp` is the correct source. |
| Territory | owned-cell count from `cell_ownership` | The only world-readable table. |
| Distance | `sum(distance_m)` over completed workouts | `profiles.total_distance_m` is likewise unmaintained. |
| Weekly | `xp_events` with `created_at` in the current ISO week | Week = Monday 00:00:00 UTC → now. |

**Tie-break (deterministic total order)** applied to equal values:
1. earlier **achievement date** wins — the moment the user reached the value (latest contributing timestamp: `user_xp.updated_at` for XP, latest in-week `xp_events.created_at` for weekly, latest `cell_ownership.updated_at` for territory, latest `workouts.started_at` for distance);
2. earlier **account creation** (`profiles.created_at`);
3. ascending **userId**.

Users with a non-positive value in a category are excluded from that board; `totalParticipants` counts users with a positive value.

---

## 6. Examples

### XP leaderboard (seed personas)

| Rank | User | XP |
|---|---|---|
| 1 | xp_titan | 2400 |
| 2 | mile_crusher | 1200 |
| 3 | week_warrior | 900 |
| 4 | land_baron | 600 |

### Territory leaderboard

| Rank | User | Cells |
|---|---|---|
| 1 | land_baron | 70 |
| 2 | xp_titan | 12 |
| 3 | week_warrior | 8 |
| 4 | mile_crusher | 5 |

### Distance leaderboard

| Rank | User | Distance |
|---|---|---|
| 1 | mile_crusher | 95 km |
| 2 | xp_titan | 23 km |
| 3 | week_warrior | 13.5 km |
| 4 | land_baron | 9 km |

### Weekly leaderboard (current ISO week)

| Rank | User | Weekly XP |
|---|---|---|
| 1 | week_warrior | 900 |
| 2 | xp_titan | 120 |
| 3 | land_baron | 80 |
| 4 | mile_crusher | 60 |

> Approximate — depends on the run date. Each persona's seeded `weeklyXp` event is dated
> "today", but recent workout XP events (e.g. `daysAgo: 6`/`9`) may also fall inside the
> current ISO week and add to a persona's weekly total. The leaders remain distinct.

(The signed-in dev user also appears in each board according to their own data.)

### Tie-break example (from tests)

Three users each at **200 XP**, `user_xp.updated_at` of `06-01`/`06-02`/`06-03` →
ranked by earliest achievement date: **bob (06-01), carol (06-02), alice (06-03)**.
With equal achievement dates, the earlier `profiles.created_at` wins; with those equal too,
ascending `userId`.

### Territory King example

`getTerritoryKing(...)` → `{ username: 'land_baron', territoryCount: 70 }`.
With no owned cells it returns `null`, and the card renders its empty state.

---

## 7. Empty states

- No participants in a category → table shows a category-specific empty message.
- Current user not ranked → header shows "Unranked"; tab summary shows "You are not ranked here yet".
- No territory owned → Territory King card shows its empty state.

---

## 8. Migration status

**None.** This is a read-only phase. No migrations, schema changes, RPCs, triggers, views, or DB writes were created (verified: `supabase/migrations/` is unchanged).

---

## 9. Remaining risks

1. **Trust boundary / privacy:** the service-role read path (Option A) intentionally exposes every user's XP, distance, and username to any authenticated user — inherent to a public leaderboard, accepted by the user. The bypass is confined to one server-only loader reading minimal columns.
2. **Unbounded fan-out:** the loader reads all profiles, all `user_xp`, all completed workouts, all `cell_ownership`, and this-week `xp_events`, then aggregates in JS. Fine at MVP scale; at large scale this is O(N) transfer/memory and is also subject to PostgREST's default 1000-row cap (no pagination). DB-side aggregation would require a view/RPC, which this phase forbids — left for future work.
3. **Weekly window is UTC:** the ISO week boundary is Monday 00:00 UTC; users in other timezones see a UTC-aligned week.
4. **Seed prerequisites:** competitor seeding creates auth users via the admin API and requires `SUPABASE_SERVICE_ROLE_KEY` and `NODE_ENV=development`.

---

## 10. Recommended next step

Manual smoke test: run `npm run seed:xp` against a dev project, then visit `/leaderboards`
to confirm the four boards, tab switching, current-user highlight, and Territory King render
with the seeded leaders. (Automated component/service coverage is already green.)

Per the phase instruction, **paused after verification** — no future-work items (rewards,
streaks, guilds, friends, notifications, seasons) were implemented.
