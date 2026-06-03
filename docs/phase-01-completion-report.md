# Phase 01 Completion Report — Authentication Foundation

**Project:** StrideQuest
**Phase:** 01 — Authentication Foundation
**Status:** ✅ COMPLETE
**Report date:** 2026-05-31

> This document is the permanent historical record of Phase 01. It is written to
> stand alone: a new engineer should be able to read it without consulting the
> git history or chat transcripts and understand what exists today, why it was
> built that way, and what to verify before changing it.

---

## 1. Executive Summary

### Objective

Deliver the authentication foundation of StrideQuest:

- A working signup / login / logout flow on top of Supabase Auth.
- A `profiles` table backed by RLS and an auth-driven creation trigger.
- Route protection that distinguishes public from authenticated areas.
- A test pyramid (unit, integration, E2E) covering each of the above.
- A folder layout that future phases (running, territory, XP) can extend
  without restructuring.

### Scope delivered

| Area | Delivered |
|---|---|
| Database | `profiles` table, immutability + updated_at triggers, `handle_new_user` trigger, RLS policies, execute revocation |
| Supabase SSR | Browser client, server client (RSC + Server Action), middleware session refresh |
| Auth flows | Signup (with username), Login, Logout — all as Server Actions |
| Routing | `(auth)` and `(protected)` route groups with shared layouts |
| Middleware | Root delegates to `infrastructure/supabase/middleware.ts`; guards `/dashboard`, redirects logged-in users away from `/login` and `/signup` |
| Dashboard | Authenticated landing page reading the user's profile row |
| Validation | Zod schemas for signup and login, shared by Server Actions |
| Testing | 37 Jest tests (unit + integration) + 14 Playwright E2E tests |

### Final outcome

All verification gates green:

- Database migrations applied and verified (5 migrations, all committed locally).
- Jest: **37 / 37 passing**
- Playwright: **14 / 14 passing**
- ESLint: **passing**
- TypeScript (`tsc --noEmit`): **passing**

### Current project status

Phase 01 is closed. The codebase is ready for the Phase 02 *planning* gate
(GPS / running / territory). Phase 02 is **not** started; its architecture
proposal exists in [`docs/phase-02/phase-02-architecture.md`](./phase-02/phase-02-architecture.md)
and is awaiting the Architecture Approval Gate (in particular the grid
decision in §5 of that doc).

---

## 2. Architecture Decisions

Each subsection follows the same shape: **Decision → Reason → Alternatives
rejected.**

### 2.1 Feature-first architecture

- **Decision:** Business logic lives in `features/<domain>/{actions, components, types}`.
  `app/` files stay thin and only compose feature pieces.
- **Reason:** Phase 02+ adds running, territory, XP, social. A feature-first
  layout localizes change: adding "running" does not require editing shared
  `lib/`, `components/`, or page files. Phase 01 deliberately built the
  smallest possible feature (`features/auth`) so the pattern is proven before
  heavier features adopt it.
- **Rejected:** layer-first (`app/actions`, `app/components`, `lib/services`).
  That layout scales poorly past 3–4 domains because each feature's pieces
  scatter across the tree. Also rejected: `src/` wrapper — Next.js does not
  require it, CLAUDE.md forbids it, and it just adds a hop.

### 2.2 Infrastructure layer

- **Decision:** All external-service code lives under `infrastructure/<vendor>/`.
  Supabase clients (`client.ts`, `server.ts`, `middleware.ts`) and the generated
  `database.types.ts` live in `infrastructure/supabase/`.
- **Reason:** Keeps vendor SDK shape out of features. Swapping or upgrading
  Supabase touches one directory; features only depend on the small surface
  the infrastructure module exposes.
- **Rejected:** Putting clients in `lib/` (CLAUDE.md explicitly forbids it —
  `lib/` is reserved for cross-cutting utilities like validation). Also
  rejected: per-feature Supabase clients (would scatter SDK initialization).

### 2.3 Supabase architecture (`@supabase/ssr`)

- **Decision:** Three distinct clients, one per execution surface:
  - `infrastructure/supabase/client.ts` — browser (`createBrowserClient`).
  - `infrastructure/supabase/server.ts` — RSC / Server Action (`createServerClient` + `next/headers cookies()`).
  - `infrastructure/supabase/middleware.ts` — Edge middleware (`createServerClient` + `NextRequest.cookies` plumbing).
- **Reason:** The `@supabase/ssr` cookie contract differs between contexts.
  Sharing one client across all three causes silent session bugs; SSR-safe
  refresh **must** be done in middleware, and cookie writes in RSC must be
  swallowed (RSC cannot mutate response headers).
- **Rejected:** Single shared client with branching. Mixing surfaces was the
  primary source of "user is null on first load" bugs encountered during
  Playwright E2E debugging (see §7).

### 2.4 Server Actions for auth mutations

- **Decision:** Login, signup, and logout are Server Actions
  (`features/auth/actions/*.ts`), invoked from client components via
  `useActionState`.
- **Reason:** No client-side Supabase auth calls. Credentials never leave the
  server boundary. Validation, normalization, and Supabase calls happen in one
  trust boundary; client components only render the result. This is the same
  Server-Action pattern Phase 02's `features/running/actions` will use for
  start/stop/discard.
- **Rejected:** API route handlers (`app/api/auth/...`). Overkill for form-shaped
  mutations and forces hand-rolled fetch/state plumbing. Also rejected:
  client-side `supabase.auth.signIn` (would skip server-side validation and
  bypass the SSR cookie pipeline).

### 2.5 Testing architecture

- **Decision:** Three-tier pyramid in a single centralized `tests/` directory:
  - `tests/unit/` — Jest + Testing Library, schema and component logic.
  - `tests/integration/` — Jest, middleware behavior with mocked Supabase.
  - `tests/e2e/` — Playwright, real browser against `next dev`.
- **Reason:** Each tier validates a different invariant. CLAUDE.md mandates
  centralized test directories with no in-tree `__tests__/` folders. The
  pyramid lines up with required-coverage areas: auth, route protection, DB
  access (Phase 02), onboarding, territory (Phase 02), XP (Phase 02).
- **Rejected:** Co-located `__tests__/` (forbidden by CLAUDE.md, and scatters
  test config across the tree). Also rejected: Playwright-only (too slow and
  too coarse to drive feedback loops).

### 2.6 Middleware strategy

- **Decision:** Root `middleware.ts` is a one-line delegate to
  `infrastructure/supabase/middleware.ts::updateSession`. All routing logic and
  session refresh live in the infrastructure module.
- **Reason:** Next.js requires `middleware.ts` at the project root, but
  CLAUDE.md requires no business logic there. Delegation keeps the framework
  contract satisfied while keeping logic testable from the
  `infrastructure/supabase/` module.
- **Rejected:** Inlining everything into `middleware.ts` (would fail the
  architecture rule, and the matcher config would sit next to logic it doesn't
  belong with).

### 2.7 Route protection strategy

- **Decision:** Defense-in-depth, three layers:
  1. **Middleware**: redirects unauthenticated requests to `/dashboard` to
     `/login`, and redirects authenticated requests to `/login` or `/signup`
     to `/dashboard`. Runs at the edge before any RSC executes.
  2. **`(protected)` layout**: server-side `getUser()` check; redirects to
     `/login` if missing. Catches any route that joins the group without going
     through middleware (e.g., direct client navigation after a stale session).
  3. **Page-level**: the dashboard page also re-checks `getUser()` before
     reading `profiles`. Cheap, and keeps page-level RLS reads honest.
- **Reason:** Middleware alone is insufficient — middleware can run for a path
  that the matcher misses, or a session can expire between middleware and RSC.
  RLS on `profiles` is the final backstop; even a missed redirect can't leak
  another user's row.
- **Rejected:** Middleware-only protection. Edge auth is necessary but not
  sufficient. Also rejected: per-page protection only (would duplicate logic
  across every protected route).

---

## 3. Final Folder Structure

```
stridequest/
├── app/                                  # Thin App Router shell — no business logic
│   ├── (auth)/                           # Public route group
│   │   ├── layout.tsx                    # Centered auth card layout
│   │   ├── login/page.tsx                # Hosts LoginForm
│   │   └── signup/page.tsx               # Hosts SignupForm
│   ├── (protected)/                      # Authenticated route group
│   │   ├── layout.tsx                    # getUser() guard + Navbar shell
│   │   └── dashboard/page.tsx            # Reads profile, renders welcome
│   ├── layout.tsx                        # Root: fonts, <html>, <body>
│   ├── page.tsx                          # `/` → redirect('/dashboard')
│   └── globals.css
│
├── features/                             # Domain modules (feature-first)
│   └── auth/
│       ├── actions/
│       │   ├── index.ts                  # Barrel export
│       │   ├── login.ts                  # 'use server' loginAction
│       │   ├── logout.ts                 # 'use server' logoutAction
│       │   └── signup.ts                 # 'use server' signupAction
│       ├── components/
│       │   ├── LoginForm.tsx             # 'use client' + useActionState
│       │   ├── SignupForm.tsx
│       │   └── LogoutButton.tsx
│       └── types/
│           └── index.ts                  # AuthActionResult
│
├── infrastructure/                       # External services only
│   └── supabase/
│       ├── client.ts                     # Browser client
│       ├── server.ts                     # RSC / Server Action client
│       ├── middleware.ts                 # updateSession() + route guards
│       └── database.types.ts             # Generated from live schema
│
├── components/                           # Reusable UI only — no domain logic
│   ├── layout/
│   │   └── Navbar.tsx                    # Navbar with LogoutButton
│   └── ui/                               # shadcn-derived primitives
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       └── label.tsx
│
├── lib/                                  # Cross-cutting, infrastructure-free utils
│   ├── utils.ts                          # cn() etc.
│   └── validations/
│       └── auth.ts                       # Zod loginSchema + signupSchema
│
├── tests/                                # Centralized — no in-tree __tests__/
│   ├── unit/
│   │   ├── features/auth/
│   │   │   ├── actions.test.ts           # 9 tests
│   │   │   ├── LoginForm.test.tsx        # 5 tests
│   │   │   ├── SignupForm.test.tsx       # 6 tests
│   │   │   └── LogoutButton.test.tsx     # 1 test
│   │   └── lib/validations/
│   │       └── auth.test.ts              # 12 tests
│   ├── integration/
│   │   └── middleware.test.ts            # 4 tests
│   └── e2e/
│       ├── auth.spec.ts                  # 7 tests
│       ├── route-protection.spec.ts      # 7 tests
│       └── helpers.ts
│
├── supabase/
│   └── migrations/                       # Source of truth — all DDL committed
│       ├── 20260529131640_create_profiles_table.sql
│       ├── 20260529131709_create_table_triggers.sql
│       ├── 20260529131724_create_profile_creation_trigger.sql
│       ├── 20260529131739_enable_rls_profiles.sql
│       └── 20260529131850_revoke_handle_new_user_execute.sql
│
├── docs/
│   ├── phase-01-completion-report.md     # ← this document
│   └── phase-02-architecture.md          # Forward-looking, NOT APPROVED
│
├── middleware.ts                         # One-liner delegating to infrastructure
├── jest.config.ts
├── jest.setup.ts
├── playwright.config.ts
├── next.config.ts
├── tsconfig.json
└── package.json
```

### Purpose of each major directory

| Directory | Purpose | Phase 02+ growth |
|---|---|---|
| `app/` | Next.js route surface only. Thin pages and layouts. | New protected routes (`run`, `territory`); one API route for GPS batch ingest. |
| `features/` | One folder per domain. Owns its actions, components, hooks, services, types. | `running/`, `territory/`. |
| `infrastructure/` | Vendor SDK adapters. The only place external services are configured. | `mapbox/`, `health-connect/` (interfaces only in Phase 02). |
| `components/` | Reusable, domain-free UI. `ui/` (primitives), `layout/` (chrome), `shared/` (cross-feature widgets). | Map controls, run timer, territory swatch — only if used by multiple features. |
| `lib/` | Cross-cutting utilities with no infrastructure dependency. | Pure helpers (distance math is **not** here — it belongs to `features/running/services` per Phase 02 design). |
| `tests/` | Centralized Jest + Playwright. | `unit/`, `integration/`, `e2e/` continue to grow per CLAUDE.md required-coverage list. |
| `supabase/migrations/` | Repo is source of truth. One concern per file. | PostGIS enable, workouts, route_points, territory tables, finalize RPC. |
| `docs/` | Phase reports + forward-looking architecture proposals. | Future: `phase-02-completion-report.md`. |

---

## 4. Database Documentation

### 4.1 `profiles` table

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK; FK → `auth.users(id) ON DELETE CASCADE` |
| `username` | `text` | NOT NULL; `check (char_length(username) >= 3)` |
| `total_xp` | `integer` | NOT NULL; default `0`; `check (total_xp >= 0)` |
| `total_distance_m` | `integer` | NOT NULL; default `0`; `check (total_distance_m >= 0)` |
| `created_at` | `timestamptz` | NOT NULL; default `now()` |
| `updated_at` | `timestamptz` | NOT NULL; default `now()` (maintained by trigger) |

**Indexes**

| Index | Definition | Purpose |
|---|---|---|
| `profiles_pkey` | `(id)` | Primary key. |
| `profiles_username_lower_idx` | UNIQUE `(lower(username))` | Case-insensitive username uniqueness — supports "trishanth" == "Trishanth". |
| `profiles_created_at_idx` | `(created_at)` | Future leaderboard / cohort queries. |

**Constraints**

- `profiles_username_length` — minimum 3 characters at the DB layer (defense
  alongside the Zod schema and the trigger check).
- `profiles_total_xp_non_negative`, `profiles_total_distance_non_negative` —
  invariants that survive future bulk updates.

**RLS policies** (all `to authenticated`)

| Policy | Operation | Predicate |
|---|---|---|
| `users_read_own_profile` | SELECT | `(select auth.uid()) = id` |
| `users_insert_own_profile` | INSERT | `with check ((select auth.uid()) = id)` |
| `users_update_own_profile` | UPDATE | `using` + `with check ((select auth.uid()) = id)` |

> No DELETE policy exists. Profile removal is driven solely by
> `auth.users` deletion via the `ON DELETE CASCADE` FK — clients cannot
> directly delete profile rows.
>
> `auth.uid()` is wrapped in `(select …)` so the planner caches the call
> per-statement instead of per-row (Supabase RLS best practice).

### 4.2 Auth trigger — `handle_new_user`

**Purpose.** Atomically create a `profiles` row when a new `auth.users` row is
inserted, so a successful signup yields a complete user record without a
second round trip.

**Execution flow**

```
client SignupForm
   │
   ▼
signupAction (Server Action)
   │  zod validate → normalize username (trim+lower)
   ▼
supabase.auth.signUp({ email, password, options: { data: { username } } })
   │
   ▼
auth.users INSERT
   │
   ▼ (AFTER INSERT trigger: on_auth_user_created)
public.handle_new_user()
   │  - reads raw_user_meta_data->>'username'
   │  - lower()+trim(), re-checks length (3–30)
   │  - INSERT into public.profiles (id, username)
   ▼
profile row exists; signup transaction commits
```

**Security considerations**

- `SECURITY DEFINER` with `SET search_path = ''` so the function runs with
  fixed schema resolution and is not vulnerable to search-path tricks; all
  references are schema-qualified (`public.profiles`, `auth.users`).
- `EXECUTE` is revoked from `PUBLIC` (migration 005) so the function is only
  callable via the trigger. End-users cannot invoke it directly with crafted
  inputs.
- Length re-validation in the trigger means even a Server-Action bypass cannot
  insert a username shorter than 3 or longer than 30 characters.

### 4.3 Other triggers

- `profiles_updated_at` (BEFORE UPDATE) — sets `new.updated_at = now()`
  via `public.handle_updated_at()`.
- `profiles_username_immutable` (BEFORE UPDATE) — raises an exception if
  `new.username <> old.username`. Username choice is permanent in Phase 01
  (deliberate game-identity decision; revisitable later via a dedicated
  migration if needed).

### 4.4 Migration history

| # | Filename | Purpose | Status |
|---|---|---|---|
| 001 | `20260529131640_create_profiles_table.sql` | Create `profiles` table, indexes, check constraints | ✅ Applied + verified |
| 002 | `20260529131709_create_table_triggers.sql` | `handle_updated_at`, `handle_username_immutable`, attach to `profiles` | ✅ Applied + verified |
| 003 | `20260529131724_create_profile_creation_trigger.sql` | `handle_new_user` + `on_auth_user_created` AFTER INSERT trigger on `auth.users` | ✅ Applied + verified |
| 004 | `20260529131739_enable_rls_profiles.sql` | Enable RLS; SELECT / INSERT / UPDATE policies (owner-only) | ✅ Applied + verified |
| 005 | `20260529131850_revoke_handle_new_user_execute.sql` | `REVOKE EXECUTE … FROM PUBLIC` on `handle_new_user` | ✅ Applied + verified |

All migrations are committed under `supabase/migrations/`. The repository is
the source of truth (CLAUDE.md rule). Types were regenerated to
`infrastructure/supabase/database.types.ts` after the final migration.

---

## 5. Authentication Flow

### 5.1 Signup flow

```
User                 SignupForm (RCC)         signupAction (Server)         Supabase Auth            Postgres
 │                        │                          │                            │                      │
 │ enter email/pw/user    │                          │                            │                      │
 ├───────────────────────►│                          │                            │                      │
 │                        │ useActionState dispatch  │                            │                      │
 │                        ├─────────────────────────►│                            │                      │
 │                        │                          │ zod signupSchema           │                      │
 │                        │                          │  (trim+lower username,     │                      │
 │                        │                          │   length 3–30, valid email)│                      │
 │                        │                          │                            │                      │
 │                        │                          │ supabase.auth.signUp       │                      │
 │                        │                          ├───────────────────────────►│                      │
 │                        │                          │                            │ INSERT auth.users    │
 │                        │                          │                            ├─────────────────────►│
 │                        │                          │                            │                      │ on_auth_user_created
 │                        │                          │                            │                      │ → handle_new_user
 │                        │                          │                            │                      │ → INSERT public.profiles
 │                        │                          │                            │◄─────────────────────┤
 │                        │                          │ session cookies set        │                      │
 │                        │                          │◄───────────────────────────┤                      │
 │                        │                          │ redirect('/dashboard')     │                      │
 │                        │◄─────────────────────────┤                            │                      │
 │ /dashboard (RSC reads profile via RLS)            │                            │                      │
```

Failure paths surface as `AuthActionResult.error` strings:

- Validation failure (`!result.success`) → first Zod issue message.
- Duplicate email (Supabase `already registered`) → "An account with this email already exists".
- Anything else → generic "Signup failed. Please try again." (no leaked internals).

### 5.2 Login flow

```
User                LoginForm (RCC)          loginAction (Server)         Supabase Auth
 │ enter email/pw       │                          │                            │
 ├─────────────────────►│                          │                            │
 │                      │ useActionState dispatch  │                            │
 │                      ├─────────────────────────►│                            │
 │                      │                          │ zod loginSchema            │
 │                      │                          │ supabase.auth.             │
 │                      │                          │   signInWithPassword       │
 │                      │                          ├───────────────────────────►│
 │                      │                          │ session cookies set        │
 │                      │                          │◄───────────────────────────┤
 │                      │                          │ redirect('/dashboard')     │
 │                      │◄─────────────────────────┤                            │
```

Invalid credentials collapse to a single user-visible message ("Invalid email
or password") — no enumeration of "email exists but password wrong".

### 5.3 Logout flow

```
User           LogoutButton (RCC)        logoutAction (Server)       Supabase Auth
 │ click "Sign out"  │                          │                          │
 ├──────────────────►│                          │                          │
 │                   │ form action → POST       │                          │
 │                   ├─────────────────────────►│                          │
 │                   │                          │ supabase.auth.signOut    │
 │                   │                          ├─────────────────────────►│
 │                   │                          │ session cookies cleared  │
 │                   │                          │◄─────────────────────────┤
 │                   │                          │ redirect('/login')       │
 │                   │◄─────────────────────────┤                          │
```

### 5.4 Route protection flow

Triple-layer guard (cf. §2.7):

```
Request /dashboard
   │
   ▼
middleware.ts → updateSession(request)
   │  refresh Supabase cookies on response
   │  supabase.auth.getUser()
   │  no user? → 302 /login   ◄── Layer 1: edge guard
   │  user on /login or /signup? → 302 /dashboard
   ▼
(protected)/layout.tsx (RSC)
   │  supabase.auth.getUser()
   │  no user? → redirect('/login')   ◄── Layer 2: layout guard
   ▼
dashboard/page.tsx (RSC)
   │  supabase.auth.getUser()
   │  no user? → redirect('/login')   ◄── Layer 3: page guard
   │  select … from profiles where id = auth.uid()
   │    └─ enforced by RLS policy users_read_own_profile  ◄── Layer 4 (data)
   ▼
HTML response
```

Each layer is independently sufficient against a different failure mode
(stale cookie, missed matcher path, session expiry between hops, direct DB
access). The data layer is the irrevocable backstop.

---

## 6. Security Review

### RLS strategy

- `profiles` is fully RLS-enabled (migration 004). All three policies pin to
  `auth.uid() = id`, so a user can never read, insert, or update another
  user's row.
- The wrapped form `(select auth.uid()) = id` is used so the planner caches
  the call once per statement, not per row (Supabase guidance).
- No service-role usage in Phase 01. Every Supabase call in the app runs as
  the authenticated user, with RLS enforced.

### Auth boundaries

- The only place auth actually happens is the Server Action layer
  (`features/auth/actions/*.ts`). Client components never see Supabase auth
  APIs.
- The `(protected)` route group plus middleware means there is no
  authenticated page that can be loaded without `getUser()` being called.

### Server-side validation

- Every form input is validated server-side with Zod before it reaches
  Supabase. Client-side validation is presentational only.
- The DB has independent invariants (check constraints, immutability trigger)
  so even a deliberately crafted request that bypasses Zod cannot persist
  invalid state.

### Zod validation

- `signupSchema`: email format, password ≥ 8 chars, username present →
  `trim().toLowerCase()` → length 3–30. The `.pipe()` form is used so the
  normalized value is what gets validated and persisted.
- `loginSchema`: email format, password non-empty. Deliberately permissive on
  password (we don't enforce length here so legacy/short test passwords still
  attempt and fail at Supabase rather than at the client).

### Username normalization

- Normalization (`trim().toLowerCase()`) happens in Zod, again in the trigger,
  and is enforced by `UNIQUE (lower(username))`. Three layers, all consistent.

### Session handling

- `@supabase/ssr` cookies are written through three context-aware adapters
  (browser / RSC / middleware). The middleware path is the **only** place
  session refresh happens — RSC swallows cookie writes (it cannot mutate
  response headers).
- `getUser()` (server-validated) is used everywhere, never `getSession()`,
  for protection decisions.

### Secrets management

- The two Supabase env vars are `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Both are public by design — the
  publishable key is RLS-gated. No service-role key exists in the codebase.
- No secrets are committed.

### Remaining risks

| Risk | Severity | Mitigation / status |
|---|---|---|
| Email enumeration via Supabase `already registered` text | Low | Mapped to a generic message in `signupAction`; the surface is still "this email is taken", which is standard practice. Revisit if/when we add SSO. |
| No rate limiting in the app | Medium | Supabase provides default auth rate limits. App-level throttling will be needed before public launch — out of Phase 01 scope. |
| No email verification flow | Medium | Phase 01 ships with Supabase's default sign-up behavior; enforcing email confirmation is a Phase 03+ concern. |
| Username immutability is policy, not protection | Low | The immutability trigger means a username cannot change post-signup. If we later need a controlled rename flow, a dedicated migration + audit table is required. |
| Middleware → Proxy migration (Next.js 16 deprecation) | Low | Tracked in §9. Non-blocking. |

---

## 7. Testing Report

### 7.1 Unit tests — Jest + Testing Library

**Count:** 33 tests across 5 files.

| File | Tests | Coverage |
|---|---|---|
| `tests/unit/lib/validations/auth.test.ts` | 12 | `signupSchema` and `loginSchema` — valid input, each invalid email/password/username variant, whitespace trimming, lowercase normalization, length boundaries. |
| `tests/unit/features/auth/actions.test.ts` | 9 | `loginAction`, `signupAction`, `logoutAction` — Zod failures, Supabase failures (invalid creds, duplicate email, generic), success → redirect, FormData edge cases (missing fields). Supabase client mocked. |
| `tests/unit/features/auth/LoginForm.test.tsx` | 5 | Field rendering, server error display via `useActionState`, disabled state during pending, submit dispatch shape, accessibility labels. |
| `tests/unit/features/auth/SignupForm.test.tsx` | 6 | Same shape as Login + username field, normalization happens server-side (component does not pre-normalize), validation error surface. |
| `tests/unit/features/auth/LogoutButton.test.tsx` | 1 | Form action wiring to `logoutAction`. |

### 7.2 Integration tests — Jest

**Count:** 4 tests in 1 file.

| File | Tests | Coverage |
|---|---|---|
| `tests/integration/middleware.test.ts` | 4 | `updateSession()` behavior with a mocked Supabase client + simulated `NextRequest`: unauth user on `/dashboard` → 302 `/login`; auth user on `/login` → 302 `/dashboard`; auth user on `/signup` → 302 `/dashboard`; public path passes through untouched. |

### 7.3 Playwright E2E

**Count:** 14 tests across 2 spec files.

| File | Tests | Coverage |
|---|---|---|
| `tests/e2e/auth.spec.ts` | 7 | Signup happy path, login happy path, login bad creds → error message, signup duplicate email → error message, logout returns to `/login`, validation errors surface in the UI, form fields preserve content on validation error. |
| `tests/e2e/route-protection.spec.ts` | 7 | Anonymous → `/dashboard` redirects to `/login`; anonymous → other protected paths redirect; authenticated → `/login` redirects to `/dashboard`; authenticated → `/signup` redirects to `/dashboard`; deep links survive auth round-trip; logout immediately blocks dashboard re-entry; session persistence across reload. |

### 7.4 Final results

| Tier | Result |
|---|---|
| Jest (unit + integration) | **37 / 37 passing** |
| Playwright (E2E) | **14 / 14 passing** |
| ESLint (`npm run lint`) | **Passing** |
| TypeScript (`npm run typecheck`) | **Passing** |

### 7.5 Root causes found and resolved during E2E debugging

The journey from "all unit tests green" to "all E2E green" surfaced three
real bugs the unit tier missed. Recording them here so they aren't relearned:

1. **Cookie context confusion.** Initial attempts used the RSC server client
   in middleware. Middleware needs the request/response cookie plumbing
   (`request.cookies.getAll` / `supabaseResponse.cookies.set`), not
   `next/headers cookies()`. Fix: distinct client per surface (§2.3). Symptom
   before fix: middleware appeared to "lose" the session on the second
   navigation and bounced authenticated users back to `/login`.

2. **`getSession()` vs `getUser()` in the layout guard.** `getSession()`
   returns whatever's in the cookie without contacting Supabase, so a tampered
   or stale cookie still passed the layout check. Fix: use
   `supabase.auth.getUser()` everywhere protection decisions are made.

3. **Jest `@/` alias not honored in `jest.mock()` args.** SWC rewrites import
   specifiers in source but does **not** rewrite the string argument to
   `jest.mock('@/…')`, so Server Action unit tests were silently mocking
   nothing and exercising the real Supabase client. Fix: explicit
   `moduleNameMapper` in `jest.config.ts`. (Captured separately in memory
   under `feedback_jest_alias.md` so future test files don't trip on it.)

---

## 8. Production Readiness Checklist

| Area | Item | Status |
|---|---|---|
| Database | Schema applied via migrations, repo is source of truth | ✅ |
| Database | All migrations committed under `supabase/migrations/` | ✅ |
| Database | Types regenerated to `infrastructure/supabase/database.types.ts` | ✅ |
| Database | RLS enabled on all user-data tables | ✅ |
| Database | RLS policies tested via auth flows (E2E reads `profiles` per user) | ✅ |
| Security | No service-role key in client/server code paths | ✅ |
| Security | `handle_new_user` is SECURITY DEFINER with locked search_path | ✅ |
| Security | `EXECUTE` on `handle_new_user` revoked from PUBLIC | ✅ |
| Security | Auth errors mapped to non-enumerating user-visible messages | ✅ |
| Security | Rate limiting | ⚠️ Supabase defaults only — app-level needed pre-launch |
| Security | Email verification flow | ⚠️ Deferred (Phase 03+) |
| Validation | Zod schemas on every form input | ✅ |
| Validation | Server-side validation independent of client | ✅ |
| Validation | DB-level invariants (checks, immutability, uniqueness) | ✅ |
| Error handling | Action results typed as `{ error?: string }`; no internals leaked | ✅ |
| Error handling | Sentry / structured logging | ⚠️ Not in scope for Phase 01 |
| Route protection | Edge middleware guard | ✅ |
| Route protection | Layout-level RSC guard | ✅ |
| Route protection | Page-level guard + RLS data backstop | ✅ |
| Testing | Unit, integration, E2E tiers green | ✅ |
| Testing | CI configuration | ⚠️ Not in scope for Phase 01 |
| Monitoring | Production telemetry | ⚠️ Not in scope for Phase 01 |
| Build | `next build` clean | ✅ |
| Build | Lint + typecheck clean | ✅ |

Phase 01 is **internally production-ready**: the auth surface itself is sound.
Operational concerns (CI, monitoring, rate limiting, email verification) are
correctly deferred — they belong to a "harden for launch" pass, not to the
auth foundation.

---

## 9. Known Technical Debt

### 9.1 Middleware → Proxy migration (Next.js 16 deprecation)

- **What:** Next.js 16 deprecates the `middleware.ts` API in favor of a new
  `proxy.ts` mechanism. The deprecation is non-blocking through the 16.x
  series.
- **Reason:** Framework upgrade path.
- **Priority:** Low.
- **Impact:** Non-blocking. We delegated all logic to
  `infrastructure/supabase/middleware.ts::updateSession`, so the migration
  is a one-file swap at the root — the infrastructure module does not need
  to change.
- **Action when picked up:** rename `middleware.ts` to `proxy.ts`, adopt the
  new signature, point it at the same `updateSession` function. Update
  matcher config to the new shape. Verify E2E redirects still pass.

### 9.2 Username changes are blocked at the DB level

- **What:** The `profiles_username_immutable` trigger prevents UPDATEs that
  alter `username`.
- **Reason:** Game identity should be stable across leaderboards / territory.
- **Priority:** Low.
- **Impact:** No user-facing rename flow exists. If product later wants one,
  it requires a dedicated migration + audit table (per-username history),
  not just relaxing the trigger.

### 9.3 No email verification gate

- See §6 "Remaining risks". Not blocking Phase 02 work.

### 9.4 No CI pipeline

- All checks are local-only today. Adding GitHub Actions (lint, typecheck,
  Jest, Playwright) is straightforward but out of scope for Phase 01.

---

## 10. Lessons Learned

### Architecture lessons

- **Build the smallest feature first so the layout proves itself.** Phase 01
  built `features/auth` exactly as Phase 02 will build `features/running`.
  No retrofitting will be needed for the running feature to fit in.
- **The infrastructure layer earns its keep early.** Three Supabase clients
  in one place (one file each) is much easier to reason about than three
  branches of one shared client.

### Testing lessons

- **Three tiers, each catching something the others can't.** Unit tests
  caught Zod regressions; integration tests caught middleware redirect
  logic; only E2E caught the cookie-context confusion described in §7.5.
  Cutting any tier would have shipped a bug.
- **Mock at the right seam.** Server Actions are easy to unit-test if you
  mock the Supabase client, *provided* your `jest.mock` paths are honored
  (see §7.5 #3). Otherwise tests silently bypass the mock.

### Supabase lessons

- **`getUser()` is the only auth check worth trusting in a server context.**
  `getSession()` returns cookie state without server validation; never use
  it for protection decisions.
- **Wrap `auth.uid()` in `(select …)` inside RLS predicates.** It moves the
  call out of the row loop and is meaningfully faster on large tables — and
  it costs nothing to do from day one.
- **Migrations: one concern per file.** It makes the migration list readable
  and rollbacks/reviews precise. The Phase 02 design (separate migrations
  for PostGIS, workouts, route_points, etc.) follows the same convention.

### Next.js lessons

- **`(group)` route groups are the right tool for `(auth)` vs `(protected)`.**
  They scope shared layouts cleanly without showing up in URLs.
- **App Router files must stay thin.** Pulling logic into `features/` and
  `infrastructure/` made the pages trivial to read; this discipline pays
  off as soon as the second feature shows up.
- **Server Actions + `useActionState` is the right shape for forms.** No
  client fetch, no manual state plumbing, full SSR cookie handling.

### E2E debugging lessons

- **When E2E disagrees with unit tests, trust E2E.** Each of the three bugs
  in §7.5 had a green unit suite next to it.
- **Cookies are subtle.** A working SSR auth setup needs middleware to
  refresh cookies and RSC to silently fail on cookie writes. Either side
  alone is broken; both together work.
- **`jest.mock` paths are not Webpack/SWC paths.** Always verify with a
  deliberate-fail mock that the mock is actually intercepting before
  trusting a green run.

---

## 11. Phase 01 Metrics

| Metric | Value |
|---|---|
| Source files created (excluding tests, configs, scaffolding) | 21 |
| Test files created | 9 |
| Migrations created and applied | 5 |
| Jest tests (unit + integration) | 37 |
| Playwright E2E tests | 14 |
| Total tests | 51 |
| Pass rate | **100 %** (51 / 51) |
| Lint status | Passing |
| Typecheck status | Passing |
| Major features delivered | Signup, Login, Logout, Profile creation trigger, Route protection (3-layer + RLS), Dashboard reading own profile |
| Architectural patterns established | Feature-first modules; infrastructure adapter layer; root-middleware delegation; route-group based protection; centralized 3-tier test tree; migration-per-concern |

---

## 12. Recommended Next Phase

Phase 02 — GPS, Running, Territory.

The full proposal is in [`docs/phase-02/phase-02-architecture.md`](./phase-02/phase-02-architecture.md).
That document is the source of truth for Phase 02; this section only
summarizes the **approved direction**, not redesigns.

Approved direction (from the proposal):

- **Domain.** Record a workout from a live GPS stream, persist its route,
  derive captured territory and XP server-side at finalize.
- **New features.** `features/running/` and `features/territory/`, following
  the Phase 01 feature pattern.
- **New infrastructure boundaries (interfaces only).**
  `infrastructure/mapbox/`, `infrastructure/health-connect/` — no
  implementations yet.
- **New API surface.** Server Actions for start/stop/discard; one Route
  Handler for the high-frequency GPS batch ingest; a `security definer` RPC
  for atomic finalize (capture + ownership + XP + profile rollup).
- **Database.** Enable PostGIS; new tables `workouts`, `route_points`,
  `territory_captures`, `cell_ownership`; per-concern migrations as in
  Phase 01.
- **Trust boundary.** Distance, capture, and XP are all server-computed at
  finalize. The client only shows live estimates.

**Open decision blocking Phase 02 implementation.** The grid system (§5 of
the Phase 02 doc) — Option A (H3) is recommended, with Options B
(geohash/square) and C (PostGIS-native polygons) considered. This decision
must be signed off at the Architecture Approval Gate before any Phase 02
migration is written.

**Order of implementation, once approved:**

1. Enable PostGIS.
2. `workouts` + `route_points`.
3. Ingest + client buffer.
4. Finalize + capture (model A: path coverage).
5. XP.
6. Territory read views.

Each slice gated by tests on the required-coverage list from CLAUDE.md.

---

## 13. Final Sign-Off

**Phase Status: COMPLETE** ✅

**Verification gates**

| Gate | Status |
|---|---|
| Database (migrations applied + repo-committed) | ✅ |
| RLS (policies present + tested) | ✅ |
| Triggers (`handle_new_user`, `updated_at`, `username_immutable`) | ✅ |
| Unit Tests (Jest, 33) | ✅ |
| Integration Tests (Jest, 4) | ✅ |
| Playwright E2E (14) | ✅ |
| Lint (ESLint) | ✅ |
| Typecheck (`tsc --noEmit`) | ✅ |

**Ready for:** Phase 02 Planning (Architecture Approval Gate — grid decision
required).

---

*End of Phase 01 Completion Report.*
