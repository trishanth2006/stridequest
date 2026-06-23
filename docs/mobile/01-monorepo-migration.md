# Mobile Monorepo Migration — Phase 1 Report

Converts StrideQuest into an npm-workspaces monorepo so a React Native (Expo)
app can reuse the web app's domain logic. **Additive and reversible** — the web
app stays at the repo root; shared code is extracted behind re-export shims so no
web import site changed.

## Decisions (approved)

| Decision | Choice | Why |
|---|---|---|
| Workspace tooling | **npm workspaces** | Already on npm; officially supported by Expo/Metro; avoids pnpm symlink friction. |
| Mobile finalize path | **Supabase Edge Function** (planned) | `finalize_workout` is `SECURITY DEFINER`, `EXECUTE` granted only to `service_role`. A device must never hold the service-role key, so finalize runs server-side in the same Supabase project — no second backend. |
| Web placement | **Stays at root** | Additive migration = lowest blast radius. `app/`, `features/`, `supabase/` untouched in place. |
| Shared extraction | **Move + re-export shim** | Old `@/...` paths keep resolving; web compiles unchanged. |

## Topology

```
stridequest/
├── app/ features/ components/ infrastructure/ lib/   # WEB (Next 16) — unchanged location
├── supabase/                                          # single backend (DB + RLS + RPC)
├── packages/shared/        # @stridequest/shared — source-only TS, no build step
│   └── src/{xp,running,territory}/…
└── apps/mobile/            # @stridequest/mobile — Expo Router + NativeWind + Supabase
```

Dependency rule (acyclic): `web → shared`, `mobile → shared`, both → Supabase.
`shared` depends on nothing app-specific.

## What was extracted to `@stridequest/shared`

Pure, framework-free logic + the two structural types it needs. The
`database.types.ts` anchor and the DI services were intentionally **left in place**
for the next phase (see Deferred).

| Module | Old location (now a shim) | Shared location |
|---|---|---|
| XP rules & leveling | `features/xp/services/xp.ts` | `src/xp/xp.ts` |
| Haversine distance | `features/running/services/distance.ts` | `src/running/distance.ts` |
| Distance/duration/pace formatters | `features/running/utils/formatters.ts` | `src/running/formatters.ts` |
| `LatLng` type | `features/running/types.ts` (re-exports) | `src/running/types.ts` |
| H3 territory grid | `features/territory/grid.ts` | `src/territory/grid.ts` |
| Territory cell derivation | `features/territory/capture.ts` | `src/territory/capture.ts` |
| `CellId`, `TerritoryAction` types | `features/territory/types.ts` (re-exports) | `src/territory/types.ts` |

Resolution wiring: tsconfig `paths`, Jest `moduleNameMapper`, Next
`transpilePackages`, and the package `exports` map all point at the same source
`.ts` — no compile step. Mobile resolves it via the workspace symlink + Metro.

## Verification (all green)

| Surface | Command | Result |
|---|---|---|
| Shared standalone | `tsc -p packages/shared/tsconfig.json --noEmit` | pass |
| Web typecheck | `tsc --noEmit` | pass |
| Web unit tests | `jest tests/unit` | 75 suites / 527 tests pass (baseline unchanged) |
| Web lint (touched files) | `eslint <files>` | pass |
| **Web production build** | `next build` | **pass — Turbopack resolves `@stridequest/shared/*` (proves the bundler, not just type resolution)** |
| Mobile typecheck | `cd apps/mobile && npm run typecheck` | pass (consumes shared) |
| Mobile Metro bundle | `cd apps/mobile && npx expo export -p android` | **pass** — 1102 modules, Hermes `.hbc` emitted, `dist` exported |
| Mobile `expo-doctor` | `npx expo-doctor` | **18/18 checks pass** |

### Metro bundle — resolved via app isolation

`expo export` was blocked by a **systemic** workspace-hoisting split, not the single
`ajv` issue first observed. Because the web root pins **React 19** and mobile needs
**React 18.3**, npm cannot hoist the Expo runtime (`expo`, `expo-asset`, `expo-router`,
`react-native`) to the root, so it stays nested under `apps/mobile`. But the
React-peer-free build tools (`babel-preset-expo`, `metro`, `@expo/cli`,
`@expo/metro-config`) *do* hoist to root. Every point where the root toolchain
bare-`require`s a nested runtime package then fails — observed across three pipeline
stages: `babel-preset-expo`→`expo/config`, metro→`expo-asset/tools/hashAssetFiles`,
and `@expo/metro-config`→`react-native/sdks/hermesc`. Most have no config hook, so
per-package workarounds are whack-a-mole.

**Fix: isolate `apps/mobile` from the npm workspace** so its toolchain and runtime
install together into one `node_modules`, eliminating the split entirely:

- Root `package.json` `workspaces` is now `["packages/*"]` only (mobile removed).
- `apps/mobile` consumes shared via `"@stridequest/shared": "file:../../packages/shared"`
  (npm symlinks it — same mechanism as the previous workspace link; Metro reads the
  live source through it).
- Mobile-specific version pins (`nativewind`/`react-native-css-interop` → Tailwind v3,
  `ajv-keywords` → ajv 8) moved from the root `overrides` into `apps/mobile`'s own
  `overrides`. Direct-dep versions (`expo`, `react-native`, screens, safe-area-context)
  no longer need overrides — the standalone tree resolves them directly and dedupes
  `react-native` to a single `0.76.9`.

**Install workflow (changed):** mobile is no longer installed by the root `npm install`.
Run `npm install` **inside `apps/mobile`** to build its self-contained tree. The web
root install is unaffected and is now leaner (the Expo toolchain is no longer hoisted
into it).

## Deferred (next gated phases)

1. **`database.types.ts` → `@stridequest/shared/supabase`** + typed mobile client
   (`createClient<Database>`). High fan-in; do with the services extraction.
2. **DI services** (`workout-detail`, `history`, `ingest`, `finalize`, achievements,
   leaderboards, profiles) → shared. They already take an injected `SupabaseClient`,
   so they move cleanly once the anchor moves.
3. **Run-detail builders** (`telemetry`, `insights`, `comparison`) → shared (Phase 9).
4. **`finalize-workout` Edge Function** (Phase 5/7) — reuses shared `captureCells`,
   calls the existing RPC with service-role. Verify `h3-js` runs on Deno.
5. **Mobile MVP** (Phase 6): auth, dashboard, territory map (`@rnmapbox/maps`),
   run tracking. **Reuse principle:** share the data builder, reimplement the view.
6. **Native build / EAS** — not run here (needs device/emulator). See mobile README.

## Risks

- `h3-js` on Hermes (RN) and Deno (Edge Function) — verify before Phase 6/7.
- `mapbox-gl`/Recharts are web-only — mobile needs native libs + a dev build (no Expo Go).
- React 18 (mobile) vs 19 (web) — resolved by isolating `apps/mobile` from the npm
  workspace (see "Metro bundle — resolved via app isolation"); the two React versions
  never share a `node_modules` level.
- Secrets: `.env*` is gitignored; mobile gets the publishable key only.
