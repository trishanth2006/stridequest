# Mobile Navigation Architecture

## Current State

The mobile app uses **Expo Router v6** with file-based routing. Currently implemented as nested stacks only — no tab navigator.

---

## Target Route Tree

```
app/
├── _layout.tsx                        # Root layout: SessionProvider, StatusBar, Stack
├── index.tsx                          # Entry: redirect to login or dashboard
│
├── (auth)/                            # Public routes — no session required
│   ├── _layout.tsx                    # Auth stack (no header)
│   ├── login.tsx                      # /login — Login form
│   └── signup.tsx                     # /signup — Signup form
│
└── (protected)/                       # Protected routes — session required
    ├── _layout.tsx                    # Auth guard + bottom tab navigator
    │
    ├── (tabs)/                        # Tab group (bottom navigation bar)
    │   ├── _layout.tsx                # Tab bar definition (4 tabs)
    │   ├── index.tsx                  # Tab: Home → Dashboard
    │   ├── run/
    │   │   ├── _layout.tsx            # Run stack (history + recording + detail)
    │   │   ├── index.tsx              # Tab: Run → history or record entry point
    │   │   ├── record.tsx             # Run recording screen (start/stop/discard)
    │   │   ├── summary.tsx            # Post-run summary (XP + territory)
    │   │   └── [id].tsx               # Run detail (route map, splits, charts)
    │   ├── territory.tsx              # Tab: Territory → full-screen map
    │   └── profile.tsx                # Tab: Profile → my stats + logout
    │
    └── (modals)/                      # Modal routes (full-screen overlays)
        ├── _layout.tsx                # Modal stack
        ├── xp.tsx                     # XP dashboard modal
        ├── achievements.tsx           # Achievements modal
        ├── leaderboards.tsx           # Leaderboards modal
        ├── settings.tsx               # Settings modal
        └── profile/
            └── [username].tsx         # Public profile modal
```

---

## Tab Bar Definition

Four tabs in `(protected)/(tabs)/_layout.tsx`:

| Tab | Icon | Route | Label |
|---|---|---|---|
| Home | `home` | `/(protected)/(tabs)/` | Home |
| Run | `play-circle` | `/(protected)/(tabs)/run` | Run |
| Territory | `map` | `/(protected)/(tabs)/territory` | Territory |
| Profile | `person` | `/(protected)/(tabs)/profile` | Profile |

**Tab bar style:** Dark background (`#0b0b0f`), emerald active tint (`#10b981`), gray inactive.

**Modals accessible from all tabs via navigation** — not tab-bar items:

- `/xp` — accessible from dashboard XP card tap
- `/achievements` — accessible from dashboard or profile
- `/leaderboards` — accessible from dashboard or profile
- `/settings` — accessible from profile screen
- `/profile/[username]` — accessible from leaderboard rows

---

## Protected Route Guard

The `(protected)/_layout.tsx` enforces authentication before rendering any protected content:

```tsx
// app/(protected)/_layout.tsx
export default function ProtectedLayout() {
  const { session, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) {
      router.replace('/(auth)/login');
    }
  }, [session, loading]);

  if (loading) return <LoadingScreen />;
  if (!session) return null;

  return <Slot />;
}
```

**No business logic in layout** — delegates to SessionProvider.

---

## Auth Routes

| Route | Description | Redirect if authenticated |
|---|---|---|
| `/(auth)/login` | Email + password login | → `/(protected)/(tabs)/` |
| `/(auth)/signup` | Create account | → `/(protected)/(tabs)/` |

Auth redirect is handled in `app/index.tsx`:

```tsx
// app/index.tsx
export default function Index() {
  const { session, loading } = useSession();
  
  if (loading) return <SplashScreen />;
  
  return <Redirect href={session ? '/(protected)/(tabs)/' : '/(auth)/login'} />;
}
```

---

## Run Flow Navigation

The run feature uses a nested stack within the `run/` tab:

```
(tabs)/run/index.tsx          # Entry: shows "Start Run" CTA + history list
  → tap "Start Run"
(tabs)/run/record.tsx         # Active recording: metrics + controls
  → tap "Stop"
(tabs)/run/summary.tsx        # Post-run summary with XP + territory
  → tap "View Detail"
(tabs)/run/[id].tsx           # Full workout detail
  → tap "Back"
(tabs)/run/index.tsx          # Returns to history list (now shows new workout)
```

History items also navigate directly to `[id].tsx`.

---

## Modal Navigation Strategy

Screens that are not primary tab destinations open as modals:

```tsx
// Navigating to XP screen from dashboard:
router.push('/xp');

// Opening public profile from leaderboard:
router.push(`/profile/${username}`);
```

Modal routes use `presentation: 'modal'` in their stack definition to slide up from bottom.

---

## Deep Linking Plan

Deep links follow the pattern: `stridequest://path`

| Deep Link | Target Screen | Use Case |
|---|---|---|
| `stridequest://dashboard` | Dashboard tab | Push notification tap |
| `stridequest://run/{id}` | Run detail | Shared workout link |
| `stridequest://profile/{username}` | Public profile | Social sharing |
| `stridequest://achievements` | Achievements | Achievement unlock notification |
| `stridequest://territory` | Territory map | Territory steal notification |
| `stridequest://leaderboards` | Leaderboards | Weekly summary notification |

**Configuration in `app.json`:**

```json
{
  "expo": {
    "scheme": "stridequest",
    "plugins": [
      ["expo-router", { "origin": "https://stridequest.app" }]
    ]
  }
}
```

Universal links (HTTPS-based deep links) can be added post-MVP when a web domain is stable.

---

## Navigation State Ownership

| Concern | Owner |
|---|---|
| Auth session | `SessionProvider` (React context, root layout) |
| Tab state | Expo Router (file-based, automatic) |
| Run recording state | `useWorkoutRecorder` hook (screen-local, passed via context if needed) |
| Route params | Expo Router typed params (auto-generated via typedRoutes experiment) |
| Modal visibility | Expo Router push/pop (no manual state needed) |

---

## Screen Transitions

| Transition | Type |
|---|---|
| Tab switch | Instant (no animation, native feel) |
| Push to run detail | Slide left (default stack) |
| Open modal (XP, achievements, leaderboards) | Slide up from bottom |
| Auth → protected redirect | Replace (no back button) |
| Post-run summary | Replace (can't go back to active recording) |

---

## Offline Considerations

- Protected route guard shows loading state while session is checked from AsyncStorage
- If session is cached in AsyncStorage but network is unavailable: allow access to cached screens
- Route points that fail to upload are queued locally (Phase 4 feature)
- Tab navigation and navigation state are entirely local; no network required

---

## Type Safety

Expo Router generates typed routes when `experiments.typedRoutes: true` is set in `app.json`. All `router.push()` calls and `<Link>` hrefs should use the typed variants:

```tsx
import { router } from 'expo-router';

// Typed — catches invalid routes at compile time
router.push('/xp');
router.push(`/profile/${username}` as const);
```

Run `npx expo export` or the typecheck command to regenerate route types after adding new files.
