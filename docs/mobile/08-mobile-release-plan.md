# Mobile Release Plan

## MVP (Internal Testing)

**Goal:** One complete loop — user can record a run, earn XP, and see territory captured.

**What ships:**
- Auth (login, signup, logout) ✅ Done
- Bottom tab navigation (Home, Run, Territory, Profile)
- Dashboard with live XP + distance data (fixes stale data bug)
- Run recording: start → GPS → stop → finalize via Edge Function
- Post-run summary: XP earned + territory impact
- Run history: list of past workouts
- Territory screen: map with owned H3 cells
- Profile: live stats (XP, level, distance, workouts, territory count)

**What does NOT ship in MVP:**
- Run detail screen (route map, splits, charts)
- Achievements screen
- Leaderboards screen
- Public profiles
- Push notifications
- Share cards
- Settings screen

**Distribution:** Internal TestFlight (iOS) + internal APK (Android). Not listed on App Store.

**Gate criteria:**
- Full run flow completes without crash on both iOS and Android
- XP and territory correctly finalized after run
- Auth persists across app restarts
- No TypeScript errors (`npx tsc --noEmit` passes)
- `npx expo-doctor` passes
- `npx expo export -p android` succeeds

---

## Beta (Closed Beta)

**Goal:** Feature-complete for solo users. Every screen is usable. Leaderboards are live.

**What ships (incremental from MVP):**
- Run detail screen with route map and splits table
- XP screen with event history and breakdown
- Achievements screen with badges and personal records
- Leaderboards screen (all 4 tabs) via Edge Function
- Level-up modal on run completion
- Dashboard: weekly XP, streak, recent activity feed
- Profile: personal records, recent activity feed
- Basic settings screen (theme toggle, account info)
- Pull-to-refresh on all list screens

**Distribution:** TestFlight (up to 1,000 external testers). Google Play internal testing track.

**Gate criteria:**
- All screens load without error on test device
- Leaderboard Edge Function deployed and returning correct data
- Achievements compute correctly (verified against web)
- Run detail map shows correct route on 3 test runs
- Level-up modal appears on level crossing
- Performance: no screen takes >2 seconds to load data on 4G

---

## v1.0 (Public Release)

**Goal:** App Store / Google Play submission. Feature parity with web.

**What ships (incremental from Beta):**
- Live map during recording (route drawn in real-time)
- Heatmap toggle on territory screen
- Pace + elevation charts in run detail
- Workout insights in run detail
- Public profile by username (deep link support)
- Share workout card (react-native-view-shot export)
- Push notifications: level-up, territory steal, weekly summary
- Offline GPS buffer (MMKV or SQLite queue for route_points when offline)
- Comparison vs previous run in run detail
- App Store screenshots and metadata

**Distribution:** App Store (iOS) + Google Play (Android). Public listing.

**Gate criteria:**
- App Store Review Guidelines compliance verified (location permission justification, privacy policy)
- Privacy manifest submitted (iOS 17+ requirement for `expo-location`)
- All Expo-required entitlements declared in `app.json`
- `npx expo-doctor` passes with no warnings
- `eas build --platform all` succeeds
- Crash-free rate >99% on 48-hour beta soak
- Push notifications deliver within 30 seconds on iOS and Android

---

## Post-Launch Roadmap

Features ranked by user value, implemented after v1.0 ships.

### P0 — Immediate (v1.1)

| Feature | Rationale |
|---|---|
| Background GPS tracking | Users want to lock screen during runs; foreground-only is a UX friction point |
| Run segments: pause/resume | Core running app expectation |
| Workout deletion | Users will want to remove test/bad runs |
| Apple Health / Google Health Connect integration | Distribution + retention driver |

### P1 — Near-Term (v1.2 – v1.3)

| Feature | Rationale |
|---|---|
| Social: follow other runners | Engagement and retention |
| Friend activity feed | See friends' recent runs and XP |
| Challenge a friend | Competitive feature; drives daily active use |
| Realtime leaderboard updates | Supabase Realtime subscription on leaderboard view |
| Run route replay animation | Delight feature; differentiates from plain GPS apps |

### P2 — Medium-Term (v2.0)

| Feature | Rationale |
|---|---|
| AI coaching summary post-run | Differentiator; summarizes run in natural language with Claude |
| Weekly training plan | Retention driver; gives users goals |
| Workout editing (note, rename) | User-driven feedback |
| Custom territory challenge events | Time-limited territory capture events (gamification) |
| Watch app (watchOS / Wear OS) | Premium feature; users expect it from established running apps |

### P3 — Long-Term (Post v2.0)

| Feature | Rationale |
|---|---|
| Leaderboard clans / teams | Community building |
| Global territory map (all users) | Showcase feature; shows the app's data density |
| Running club support | B2B expansion |
| Offline map tiles | Run tracking without connectivity |
| Multi-sport tracking (cycling, walking) | Expand addressable market |

---

## Release Checklist Template

For each milestone release:

```
[ ] npm run typecheck (in apps/mobile) passes
[ ] npx expo-doctor passes with no errors
[ ] npx expo export -p android succeeds
[ ] All manual test flows verified on iOS simulator
[ ] All manual test flows verified on Android emulator
[ ] All manual test flows verified on physical device (iOS)
[ ] All manual test flows verified on physical device (Android)
[ ] Run history shows correct workouts after 3 test runs
[ ] XP values match web dashboard for same user
[ ] Territory cells match web territory board for same user
[ ] Level-up modal fires on level crossing
[ ] Session persists after force-close and reopen
[ ] Auth redirect fires correctly when session expires
[ ] No console errors or warnings in release build
[ ] EAS build (production profile) succeeds for both platforms
[ ] CHANGELOG updated
```

---

## Versioning

| Release | Version | Build |
|---|---|---|
| MVP | 0.1.0 | 1 |
| Beta | 0.5.0 | 10+ |
| v1.0 Public | 1.0.0 | 100+ |
| Post-launch patches | 1.x.x | Increment per release |

Follows semantic versioning. Increment major on breaking auth or data schema changes that require forced update.
