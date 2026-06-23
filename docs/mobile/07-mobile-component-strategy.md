# Mobile Component Strategy

## Principles

1. **Screen components own data fetching.** Screens (`app/`) call Supabase and pass data down as props.
2. **Feature components own presentation.** Components in `src/features/` receive props; no Supabase calls inside them.
3. **UI primitives are stateless.** Components in `src/components/ui/` receive style props; no business logic.
4. **No component exceeds 300 lines.** Split when approaching the limit.
5. **Reuse before creating.** Check existing components before writing new ones.

---

## Directory Ownership

```
src/
├── components/
│   ├── ui/                    # Stateless, reusable primitives
│   │   ├── Button.tsx          ✅ Exists
│   │   ├── Input.tsx           ✅ Exists
│   │   ├── FormError.tsx       ✅ Exists
│   │   ├── Card.tsx            — To create
│   │   ├── Badge.tsx           — To create
│   │   ├── ProgressBar.tsx     — To create (XP progress)
│   │   ├── StatRow.tsx         — To create (label + value row)
│   │   ├── Divider.tsx         — To create
│   │   ├── LoadingScreen.tsx   — To create (full-screen spinner)
│   │   ├── EmptyState.tsx      — To create (empty list placeholder)
│   │   └── ErrorState.tsx      — To create (error with retry)
│   │
│   ├── map/                   # Map primitives (all Mapbox-based)
│   │   ├── BaseMap.tsx         — To create (MapView wrapper)
│   │   ├── RouteLayer.tsx      — To create (LineLayer from points)
│   │   ├── TerritoryLayer.tsx  — To create (FillLayer from H3 cells)
│   │   └── UserMarker.tsx      — To create (current location dot)
│   │
│   └── layout/                # Structural layout components
│       ├── ScreenHeader.tsx    — To create (title + back button)
│       └── TabBarIcon.tsx      — To create (icon + label for tab bar)
│
└── features/
    ├── auth/                  # Auth feature (complete)
    │   ├── components/
    │   │   ├── LoginForm.tsx   ✅ Exists
    │   │   └── SignupForm.tsx  ✅ Exists
    │   ├── providers/
    │   │   └── SessionProvider.tsx ✅ Exists
    │   ├── hooks/
    │   │   └── useSession.ts   ✅ Exists (via SessionProvider)
    │   └── types/
    │       └── index.ts        ✅ Exists
    │
    ├── running/               # Run recording + history + detail
    │   ├── components/
    │   │   ├── RecordingControls.tsx   — To create (Start/Stop/Discard buttons)
    │   │   ├── LiveMetrics.tsx         — To create (distance + duration + pace + GPS quality)
    │   │   ├── WorkoutCard.tsx         — To create (single workout row in history)
    │   │   ├── WorkoutDetailHeader.tsx — To create (summary stats header)
    │   │   ├── SplitsTable.tsx         — To create (per-km splits)
    │   │   ├── TerritoryBattleReport.tsx — To create (claim/steal/defend summary)
    │   │   ├── WorkoutXpSummary.tsx    — To create (XP earned breakdown)
    │   │   └── PostRunSummary.tsx      — To create (full post-run modal screen)
    │   ├── hooks/
    │   │   ├── useWorkoutRecorder.ts   — To create (state machine)
    │   │   └── useLocation.ts          — To create (expo-location wrapper)
    │   ├── services/
    │   │   ├── workout.ts              — To create (start/discard/finalize)
    │   │   └── sampleBuffer.ts         — To create (GPS buffering + upload)
    │   └── utils/
    │       ├── distanceTracker.ts      — To create (running Haversine sum)
    │       └── accuracyFilter.ts       — To create (mirrors web sample-filter.ts)
    │
    ├── territory/             # Territory map + ownership
    │   ├── components/
    │   │   ├── TerritoryStats.tsx      — To create (stats overlay card)
    │   │   └── TerritoryMap.tsx        — To create (BaseMap + TerritoryLayer composed)
    │   └── services/
    │       └── ownership.ts            — To create (cell_ownership queries)
    │
    ├── xp/                    # XP + leveling
    │   ├── components/
    │   │   ├── LevelBadge.tsx          — To create (level number in colored badge)
    │   │   ├── XpProgressBar.tsx       — To create (bar with level labels)
    │   │   ├── XpEventRow.tsx          — To create (single event in list)
    │   │   ├── XpBreakdown.tsx         — To create (by type totals)
    │   │   └── LevelUpModal.tsx        — To create (overlay on level up)
    │   └── services/
    │       └── xp.ts                   — To create (user_xp + xp_events queries)
    │
    ├── achievements/          # Achievements + personal records
    │   ├── components/
    │   │   ├── AchievementCard.tsx     — To create (badge card locked/unlocked)
    │   │   ├── AchievementGrid.tsx     — To create (FlatList of AchievementCards)
    │   │   └── PersonalRecordsCard.tsx — To create (PR summary)
    │   └── services/
    │       └── achievements.ts         — To create (mirror web computation logic)
    │
    ├── leaderboards/          # Rankings (requires Edge Function)
    │   ├── components/
    │   │   ├── LeaderboardRow.tsx      — To create (rank + username + value)
    │   │   └── LeaderboardTabs.tsx     — To create (tab selector: XP/Territory/Distance/Weekly)
    │   └── services/
    │       └── leaderboards.ts         — To create (calls get-leaderboards Edge Function)
    │
    └── profiles/              # My profile + public profiles
        ├── components/
        │   ├── ProfileHeader.tsx       — To create (username + level badge + avatar placeholder)
        │   ├── ProfileStats.tsx        — To create (XP, distance, workouts, territory)
        │   └── RecentActivityFeed.tsx  — To create (workouts + XP events timeline)
        └── services/
            └── profile.ts              — To create (profile data queries)
```

---

## Screen Ownership

Each screen in `app/` owns exactly one concern:

| Screen File | Owns |
|---|---|
| `app/(auth)/login.tsx` | Login form + auth redirect |
| `app/(auth)/signup.tsx` | Signup form + auth redirect |
| `app/(protected)/(tabs)/index.tsx` | Dashboard data fetch + layout |
| `app/(protected)/(tabs)/run/index.tsx` | Run entry: history list + start CTA |
| `app/(protected)/(tabs)/run/record.tsx` | Active recording state machine |
| `app/(protected)/(tabs)/run/summary.tsx` | Post-run result display |
| `app/(protected)/(tabs)/run/[id].tsx` | Single workout detail data fetch |
| `app/(protected)/(tabs)/territory.tsx` | Territory data fetch + map render |
| `app/(protected)/(tabs)/profile.tsx` | My profile data fetch + logout |
| `app/(protected)/(modals)/xp.tsx` | XP data fetch + display |
| `app/(protected)/(modals)/achievements.tsx` | Achievement compute + display |
| `app/(protected)/(modals)/leaderboards.tsx` | Leaderboard data fetch + display |
| `app/(protected)/(modals)/settings.tsx` | Settings display + actions |
| `app/(protected)/(modals)/profile/[username].tsx` | Public profile data fetch |

**Screens do:** data fetching, error/loading states, navigation, prop passing.
**Screens do not:** render primitive UI, contain business logic, call each other.

---

## UI Composition Rules

### Building a Screen

```tsx
// Pattern: screen fetches → passes props to feature components
export default function DashboardScreen() {
  const { session } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData(session!.user.id)
      .then(setData)
      .catch(() => setError('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorState message={error} onRetry={() => { /* refetch */ }} />;
  if (!data) return null;

  return (
    <ScrollView>
      <ProfileHeader username={data.username} level={data.level} />
      <XpProgressBar progress={data.xpProgress} />
      <StatRow label="Total XP" value={data.totalXp.toLocaleString()} />
      <StatRow label="Distance" value={formatDistance(data.totalDistanceM)} />
    </ScrollView>
  );
}
```

### Building a Feature Component

```tsx
// Pattern: receives all data as props; no Supabase, no navigation
interface WorkoutCardProps {
  workout: CompletedWorkout;
  onPress: () => void;
}

export function WorkoutCard({ workout, onPress }: WorkoutCardProps) {
  return (
    <Pressable onPress={onPress}>
      <Card>
        <StatRow label="Distance" value={formatDistance(workout.distance_m)} />
        <StatRow label="Duration" value={formatDuration(workout.duration_s)} />
        <StatRow label="Pace" value={formatPace(workout.avg_pace_s_per_km)} />
      </Card>
    </Pressable>
  );
}
```

---

## Styling Rules

- All styles via **NativeWind** (Tailwind class names on React Native components)
- No inline `StyleSheet.create()` unless NativeWind cannot express the style (e.g., dynamic values)
- Color palette:
  - Background: `bg-zinc-950` (`#09090b`)
  - Card: `bg-zinc-900` (`#18181b`)
  - Border: `border-zinc-800` (`#27272a`)
  - Primary: `text-emerald-400` / `bg-emerald-500` (`#34d399` / `#10b981`)
  - Muted text: `text-zinc-400`
  - White: `text-white`
  - Error: `text-red-400` / `bg-red-500/10`
- Font sizes: `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`
- Radius: `rounded-lg` (cards), `rounded-full` (badges, buttons)

---

## Shared Package Usage

All business logic that is not UI-specific lives in `@stridequest/shared`:

| Shared Export | Mobile Usage |
|---|---|
| `getXpProgress(totalXp)` | Dashboard, Profile, XP screen |
| `getLevelFromXP(totalXp)` | Any component showing level |
| `getLevelUpResult(prevXp, newXp)` | Post-run summary (level-up detection) |
| `formatDistance(meters)` | WorkoutCard, DetailHeader, StatRow |
| `formatDuration(seconds)` | WorkoutCard, LiveMetrics |
| `formatPace(secPerKm)` | WorkoutCard, LiveMetrics, SplitsTable |
| `haversineMeters(a, b)` | distanceTracker.ts |
| `cumulativeDistanceMeters(points)` | Run detail, live distance estimate |
| `captureCells(points)` | Edge Function (not called on device) |
| `pathToCells(points)` | Edge Function (not called on device) |

**Do not add mobile-specific code to `packages/shared/`.** The shared package is consumed by both web and mobile; only universal, platform-agnostic logic belongs there.

---

## Component Size Budget

| Component Type | Max Lines | Split Strategy |
|---|---|---|
| Screen | 150 lines | Extract data fetching hook, split display into feature components |
| Feature component | 200 lines | Split into sub-components or extract render helpers |
| UI primitive | 100 lines | Split variant components (e.g., `ButtonPrimary`, `ButtonSecondary`) |
| Hook | 150 lines | Split into smaller hooks composed together |
| Service | 200 lines | Split by query domain (e.g., `profile-stats.ts` vs `profile-activity.ts`) |

---

## New Component Checklist

Before creating any new component:

1. Search `src/components/ui/` — does a primitive already exist?
2. Search `src/features/` — does a similar feature component exist to extend?
3. Verify the component receives all data as props (no Supabase inside)
4. Verify styles use NativeWind classes only
5. Verify the file will stay under 300 lines at completion
6. Add to the directory ownership table above
