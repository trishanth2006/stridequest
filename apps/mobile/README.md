# StrideQuest Mobile (`@stridequest/mobile`)

Expo (React Native) app that reuses the web app's domain logic from
`@stridequest/shared` and the **same** Supabase backend.

## Stack

- Expo SDK 52 + Expo Router (file-based routing in `app/`)
- NativeWind v4 (Tailwind classes on native)
- `@supabase/supabase-js` + AsyncStorage session persistence
- `@stridequest/shared` for XP / distance / territory logic (one source of truth)

## Setup

From the **repo root** (workspaces install everything together):

```bash
npm install
```

Then configure env:

```bash
cp apps/mobile/.env.example apps/mobile/.env
# Fill EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
# (same project as the web app — never the service-role key)
```

## Run

```bash
npm run start   -w @stridequest/mobile     # Metro / Expo dev server
npm run android -w @stridequest/mobile
npm run ios     -w @stridequest/mobile
npm run typecheck -w @stridequest/mobile   # tsc --noEmit (CI-safe, no device)
```

> **Native build note:** maps (`@rnmapbox/maps`) and background GPS (`expo-location`)
> require a **development build** (EAS or local prebuild) — they do **not** run in
> Expo Go. The scaffold itself runs in Expo Go; feature work (Phase 6+) will need a
> dev build. CI can verify the app with `typecheck` without a device.

## Reuse principle

**Share the data builder, reimplement the view.** Import calculations from
`@stridequest/shared` (e.g. `getXpProgress`, `formatDistance`, `captureCells`);
render with native components — never import web `.tsx` (Tailwind/Recharts/mapbox-gl).

```ts
import { getXpProgress } from '@stridequest/shared/xp'
import { formatDistance } from '@stridequest/shared/running'
```

See `docs/mobile/01-monorepo-migration.md` for the full migration report.
