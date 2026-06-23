# Mobile Feature Parity Audit

## Web Feature Inventory & Parity Classification

### Legend

| Classification | Meaning |
|---|---|
| **Required** | Core to the mobile value proposition; must ship before public release |
| **Recommended** | Significantly improves the experience; target for v1 |
| **Optional** | Nice-to-have; post-launch roadmap |
| **Web Only** | Technically infeasible or irrelevant on mobile; skip |

---

## Authentication & Session

| Feature | Web Route | Classification | Difficulty | Dependencies | Risks |
|---|---|---|---|---|---|
| Email/password login | `/(auth)/login` | **Required** ✅ Done | - | Supabase Auth | - |
| Email/password signup | `/(auth)/signup` | **Required** ✅ Done | - | Supabase Auth | - |
| Logout | Navbar | **Required** ✅ Done | - | Supabase Auth | - |
| Session persistence | Middleware | **Required** ✅ Done | - | AsyncStorage | - |
| Protected route guard | Layout | **Required** ✅ Done | - | SessionProvider | - |

**Notes:** Auth is complete on mobile. No gaps.

---

## Dashboard

| Feature | Web Route | Classification | Difficulty | Dependencies | Risks |
|---|---|---|---|---|---|
| Greeting + username | `/dashboard` | **Required** ✅ Partial | Low | profiles table | - |
| Lifetime XP display | `/dashboard` | **Required** ✅ Partial | Low | user_xp table | total_xp may be stale (see memory) |
| Lifetime distance display | `/dashboard` | **Required** ✅ Partial | Low | profiles/workouts | profiles.total_distance_m unmaintained |
| Current level + XP progress | `/dashboard` | **Required** ✅ Done | Low | @stridequest/shared/xp | - |
| Weekly progress | `/dashboard` | Recommended | Medium | xp_events (last 7 days) | Requires date-filtered query |
| Streak display | `/dashboard` | Recommended | Medium | workouts (dates) | Streak logic needed |
| Recent activity feed | `/dashboard` | Recommended | Medium | workouts + xp_events | Multiple tables |
| "Start Run" CTA | `/dashboard` | **Required** | Low | Navigation | - |
| Explore section links | `/dashboard` | **Optional** | Low | Navigation | - |

**Notes:** Dashboard scaffold exists but shows stale `profiles.total_xp` and `profiles.total_distance_m`. These should be replaced with live queries from `user_xp` and `SUM(workouts.distance_m)`.

---

## Run Recording (GPS Workout Tracking)

| Feature | Web Route | Classification | Difficulty | Dependencies | Risks |
|---|---|---|---|---|---|
| Start workout | `/run` | **Required** | Medium | expo-location, Supabase | Needs dev build (no Expo Go) |
| GPS tracking (foreground) | `/run` | **Required** | Medium | expo-location | Permission prompt UX |
| Live distance display | `/run` | **Required** | Medium | @stridequest/shared/running | Accuracy filtering needed |
| Live duration timer | `/run` | **Required** | Low | Local state | - |
| GPS quality indicator | `/run` | Recommended | Low | expo-location accuracy | - |
| Pause/resume run | `/run` | Recommended | Medium | expo-location | State machine complexity |
| Stop run | `/run` | **Required** | Medium | Supabase RPC | Service-role not available on client |
| Discard run | `/run` | **Required** | Low | Supabase | - |
| GPS route batching | `/api/workouts/[id]/points` | **Required** | High | Supabase direct write | Web uses POST API; mobile writes route_points directly |
| Accuracy filter (30m gate) | Client | **Required** | Low | @stridequest/shared | Logic exists in shared |
| Sample buffering | Client | **Required** | Medium | Periodic flush | Background timer behavior on iOS |
| Post-run summary modal | `/run` | **Required** | Medium | finalize_workout RPC | RPC is service-role; needs Edge Function proxy |
| Level-up modal on run end | `/run` | Recommended | Low | getLevelUpResult() | - |
| Background location tracking | `/run` | **Optional** | High | expo-location (background mode) | Requires special entitlements + privacy strings |

**Critical Risk — Service-Role on Mobile:**
The web app's `stopWorkout()` calls `finalize_workout` RPC via a service-role client. Mobile must **never** hold the service-role key. Two options:
1. Call a Supabase Edge Function (preferred) that runs the RPC server-side.
2. Create a new public RPC that uses `auth.uid()` for security (no service-role needed).

---

## Run History

| Feature | Web Route | Classification | Difficulty | Dependencies | Risks |
|---|---|---|---|---|---|
| Completed workouts list | `/run/history` | **Required** | Low | workouts table | - |
| Date/distance/duration display | `/run/history` | **Required** | Low | workouts table | - |
| Pagination / infinite scroll | `/run/history` | Recommended | Medium | Supabase range queries | - |
| Filtering by date | `/run/history` | Optional | Medium | - | - |

---

## Run Detail

| Feature | Web Route | Classification | Difficulty | Dependencies | Risks |
|---|---|---|---|---|---|
| Summary stats (distance, duration, pace) | `/run/[id]` | **Required** | Low | workouts table | - |
| Route map visualization | `/run/[id]` | **Required** | High | @rnmapbox/maps or react-native-maps | Web uses Leaflet; mobile needs RN map lib |
| Territory captures on map | `/run/[id]` | Recommended | High | territory_captures + map layer | Depends on map lib |
| Pace/speed chart | `/run/[id]` | Recommended | High | route_points + charting lib | Need React Native chart library |
| Elevation profile | `/run/[id]` | Optional | High | route_points.altitude_m | Data often noisy; needs smoothing |
| Per-km splits table | `/run/[id]` | Recommended | Medium | route_points aggregate | - |
| Workout insights | `/run/[id]` | Optional | Medium | Computed from route_points | - |
| Comparison vs previous/PB | `/run/[id]` | Optional | High | Multiple workout queries | - |
| Achievements unlocked this run | `/run/[id]` | Recommended | Medium | xp_events + achievements logic | - |
| Personal records this run | `/run/[id]` | Recommended | Medium | workouts comparison | - |
| Territory battle report | `/run/[id]` | Recommended | Medium | territory_captures | - |
| Share workout card | `/run/[id]` | Optional | High | Canvas/image export | Web uses HTML canvas; mobile needs different approach |
| Route replay animation | `/run/[id]` | Optional | High | route_points + map animation | Complex; post-v1 |

---

## Territory

| Feature | Web Route | Classification | Difficulty | Dependencies | Risks |
|---|---|---|---|---|---|
| Owned cells map | `/territory` | **Required** | High | @rnmapbox/maps + H3 | H3 renders as polygons on map |
| Owned cell count | `/territory` | Recommended | Low | cell_ownership count | - |
| Total captures count | `/territory` | Recommended | Low | territory_captures count | - |
| Heatmap toggle | `/territory` | Optional | High | Map layer + territory_captures | Complex layer management |
| Territory stats cards | `/territory` | Recommended | Low | cell_ownership | - |
| Most captured cell | `/territory` | Optional | Medium | territory_captures aggregate | - |

---

## XP System

| Feature | Web Route | Classification | Difficulty | Dependencies | Risks |
|---|---|---|---|---|---|
| Current level display | `/xp` | **Required** ✅ Done | Low | @stridequest/shared/xp | - |
| XP progress bar | `/xp` | **Required** ✅ Done | Low | @stridequest/shared/xp | - |
| Total XP value | `/xp` | **Required** ✅ Partial | Low | user_xp table | - |
| Recent XP events list | `/xp` | Recommended | Low | xp_events table | - |
| XP breakdown by source | `/xp` | Recommended | Medium | xp_events group by type | - |
| Workout XP history | `/xp` | Optional | Medium | xp_events + workouts join | - |
| Level badge | Multiple | **Required** | Low | @stridequest/shared/xp | - |
| Level-up notification/modal | Client | Recommended | Medium | getLevelUpResult() | - |

---

## Achievements

| Feature | Web Route | Classification | Difficulty | Dependencies | Risks |
|---|---|---|---|---|---|
| Achievement badges grid | `/achievements` | Recommended | Medium | getAchievements() computed logic | No DB; computed from workouts/xp/territory |
| Locked/unlocked state | `/achievements` | Recommended | Low | Same as above | - |
| Achievement categories | `/achievements` | Optional | Low | - | - |
| Personal records display | `/achievements` | Recommended | Medium | workouts comparison queries | - |
| Fastest 1K/5K/10K | `/achievements` | Recommended | Medium | workouts table | - |
| Longest run record | `/achievements` | Recommended | Low | workouts table | - |

---

## Leaderboards

| Feature | Web Route | Classification | Difficulty | Dependencies | Risks |
|---|---|---|---|---|---|
| XP leaderboard | `/leaderboards` | **Required** | Medium | profiles + user_xp | Service-role for cross-user reads (see memory) |
| Territory leaderboard | `/leaderboards` | **Required** | Medium | cell_ownership | Service-role |
| Distance leaderboard | `/leaderboards` | Recommended | Medium | workouts aggregate | Service-role |
| Weekly XP leaderboard | `/leaderboards` | Recommended | Medium | xp_events (7-day window) | Service-role |
| Reigning champion card | `/leaderboards` | Optional | Low | Territory leaderboard top-1 | - |
| Current user rank display | `/leaderboards` | Recommended | Low | Computed from leaderboard | - |
| Click-through to public profile | `/leaderboards` | Optional | Medium | Navigation | - |

**Critical Risk — Cross-User Data:**
Leaderboard queries read other users' data. RLS blocks this by default. Web uses `createServiceRoleClient()` server-side. Mobile must proxy via Edge Function or a dedicated SQL view with `SECURITY DEFINER`.

---

## Profiles

| Feature | Web Route | Classification | Difficulty | Dependencies | Risks |
|---|---|---|---|---|---|
| My profile view | `/profile` | **Required** ✅ Partial | Low | profiles + user_xp | - |
| Profile stats (XP, distance, workouts, territories) | `/profile` | **Required** | Low | Multiple tables | - |
| Personal records section | `/profile` | Recommended | Medium | workouts queries | - |
| Recent activity feed | `/profile` | Recommended | Medium | workouts + xp_events | - |
| Leaderboard rank | `/profile` | Optional | High | Full leaderboard computation | Service-role risk |
| Public profile by username | `/profile/[username]` | Optional | Medium | profiles.username lookup | Service-role to read other users |
| Profile editing | Not implemented on web | Optional | Low | profiles UPDATE | - |

---

## Share Feature

| Feature | Web Route | Classification | Difficulty | Dependencies | Risks |
|---|---|---|---|---|---|
| Workout share card | `/run/[id]` | Optional | High | react-native-view-shot or Skia | Web uses HTML canvas; mobile needs different lib |
| Level-up share card | Post-run | Optional | High | Same as above | - |
| Achievement share card | `/achievements` | Optional | High | Same | - |
| PR share card | `/achievements` | Optional | High | Same | - |
| Download as image | Client | Optional | High | react-native-share | - |
| Theme/layout picker | Client | Optional | Medium | - | - |

---

## Map Feature

| Feature | Web Location | Classification | Difficulty | Dependencies | Risks |
|---|---|---|---|---|---|
| Base map rendering | Multiple | **Required** | High | @rnmapbox/maps (preferred) | Requires dev build; Mapbox token already in .env |
| Route polyline overlay | Run detail | **Required** | Medium | Map lib | Depends on base map |
| Territory cell layer (H3) | Territory | **Required** | High | H3 + map polygon layer | H3 is in shared; polygon rendering is map-lib-specific |
| Markers (start/end/captures) | Run detail | Recommended | Medium | Map lib | - |

---

## Settings / Admin

| Feature | Web Location | Classification | Difficulty | Dependencies | Risks |
|---|---|---|---|---|---|
| Settings page | Not yet built on web | Optional | Low | - | - |
| Account management | Not yet built on web | Optional | Low | - | - |
| Admin features | Not on web | Web Only | - | - | Skip entirely |
| Dark/light theme | Navbar toggle | Optional | Low | React Native appearance API | - |

---

## Implementation Difficulty Summary

| Difficulty | Features |
|---|---|
| ✅ Done | Auth (all), Dashboard scaffold, Profile scaffold |
| Low | Dashboard live data fix, Run history list, XP events list, Achievement display |
| Medium | Run recording (GPS + lifecycle), Run history pagination, Leaderboard queries, Profile stats |
| High | Map rendering, Territory map, Run detail map + charts, Share cards, Background GPS |
| Critical Blocker | finalize_workout service-role proxy (Edge Function), cross-user leaderboard data (Edge Function or SECURITY DEFINER view) |

---

## Risk Register

| Risk | Severity | Mitigation |
|---|---|---|
| Service-role key must not exist on device | Critical | Proxy via Supabase Edge Function for finalize_workout and leaderboard reads |
| Expo Go cannot run expo-location or @rnmapbox/maps | High | All GPS/map work requires dev build (EAS or local prebuild) |
| Map library choice lock-in | High | Commit to @rnmapbox/maps early (token already configured); Mapbox > react-native-maps for H3 polygon support |
| H3 polygon rendering on mobile | Medium | Test H3 cell → GeoJSON polygon conversion; use Mapbox FillLayer |
| Background GPS on iOS | High | Requires background location entitlement + NSLocationAlwaysAndWhenInUseUsageDescription; defer to post-MVP |
| profiles.total_xp / total_distance_m are stale | Medium | Replace all reads with live user_xp table + SUM(workouts.distance_m) |
| React 19 on mobile (Expo 54) | Medium | Expo 54 uses React 19; verify all RN libraries are compatible before adding deps |
| Cross-user RLS blocks leaderboard | Medium | Design Edge Function or SECURITY DEFINER view before leaderboard sprint |
