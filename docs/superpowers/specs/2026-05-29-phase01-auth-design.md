# StrideQuest Phase 01 — Authentication Foundation Design

**Date:** 2026-05-29
**Status:** Approved
**Version:** 1.0

---

## Overview

StrideQuest is a gamified running platform. Phase 01 establishes the authentication and user management foundation that all future features depend on. No GPS, maps, workouts, territory capture, XP logic, or workout tracking are in scope.

At completion, users must be able to: create an account, log in, log out, access protected pages, maintain persistent sessions, and have a profile automatically created on signup.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, TypeScript (strict), Tailwind CSS, Shadcn UI |
| Backend | Supabase (Auth + PostgreSQL) |
| Auth | Supabase Auth via `@supabase/ssr` |
| Testing | Jest + React Testing Library + Playwright |
| Deployment | Vercel |

---

## Approved Decisions

### Profile Auto-Creation
**PostgreSQL trigger on `auth.users` INSERT.** Atomic with signup — no orphaned auth users. The trigger normalizes, validates, and inserts the username. A failure rolls back the entire transaction including the `auth.users` row.

### Form Handling
**Next.js 15 Server Actions.** Auth forms submit to `"use server"` functions. No API routes. Supabase server client runs server-side; secrets never reach the browser.

### Username
- Immutable in Phase 01 and enforced at both application and database level
- Normalized to `lower(trim())` before storage
- Validated with Zod in the Server Action (primary) and in the DB trigger (backstop)
- Unique constraint enforced via `lower(username)` index

---

## Database Schema

### `profiles` Table

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, FK → `auth.users(id) ON DELETE CASCADE` |
| `username` | `text` | NOT NULL, `char_length >= 3`, `char_length <= 30` |
| `total_xp` | `integer` | NOT NULL, DEFAULT 0, `>= 0` |
| `total_distance_m` | `integer` | NOT NULL, DEFAULT 0, `>= 0` |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()`, auto-maintained via trigger |

### Indexes

| Index | Definition | Purpose |
|---|---|---|
| `profiles_username_lower_idx` | `UNIQUE ON lower(username)` | Case-insensitive uniqueness |
| `profiles_created_at_idx` | `ON created_at` | Future queries by join date |

### Triggers

| Trigger | Fires | Function | Purpose |
|---|---|---|---|
| `on_auth_user_created` | AFTER INSERT ON `auth.users` | `handle_new_user()` | Create profile atomically on signup |
| `profiles_updated_at` | BEFORE UPDATE ON `profiles` | `handle_updated_at()` | Maintain `updated_at` timestamp |
| `profiles_username_immutable` | BEFORE UPDATE ON `profiles` | `handle_username_immutable()` | Reject username changes |

### RLS Policies

RLS is enabled. No DELETE policy — profiles are removed via `ON DELETE CASCADE` from `auth.users`.

| Policy | Operation | Condition |
|---|---|---|
| `users_read_own_profile` | SELECT | `(select auth.uid()) = id` |
| `users_insert_own_profile` | INSERT | `(select auth.uid()) = id` |
| `users_update_own_profile` | UPDATE | `(select auth.uid()) = id` (both USING and WITH CHECK) |

---

## Migration Files

Applied in order via MCP `apply_migration`. Each file is a single concern.

```
001_create_profiles_table.sql
002_create_table_triggers.sql
003_create_profile_creation_trigger.sql
004_enable_rls_profiles.sql
```

### `001_create_profiles_table.sql`

```sql
create table public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  username         text not null,
  total_xp         integer not null default 0,
  total_distance_m integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint profiles_username_min_length check (char_length(username) >= 3),
  constraint profiles_username_max_length check (char_length(username) <= 30),
  constraint profiles_total_xp_non_negative check (total_xp >= 0),
  constraint profiles_total_distance_non_negative check (total_distance_m >= 0)
);

create unique index profiles_username_lower_idx on public.profiles (lower(username));
create index profiles_created_at_idx on public.profiles (created_at);
```

### `002_create_table_triggers.sql`

```sql
-- updated_at maintenance
create or replace function public.handle_updated_at()
returns trigger language plpgsql security invoker
set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- username immutability enforcement
create or replace function public.handle_username_immutable()
returns trigger language plpgsql security invoker
set search_path = public as $$
begin
  if new.username <> old.username then
    raise exception 'Username cannot be changed';
  end if;
  return new;
end;
$$;

create trigger profiles_username_immutable
  before update on public.profiles
  for each row execute function public.handle_username_immutable();
```

### `003_create_profile_creation_trigger.sql`

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  v_username text;
begin
  v_username := lower(trim(new.raw_user_meta_data->>'username'));

  if v_username is null or v_username = '' then
    raise exception 'Username is required';
  end if;

  if char_length(v_username) < 3 then
    raise exception 'Username must be at least 3 characters';
  end if;

  if char_length(v_username) > 30 then
    raise exception 'Username must be at most 30 characters';
  end if;

  insert into public.profiles (id, username)
  values (new.id, v_username);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

### `004_enable_rls_profiles.sql`

```sql
alter table public.profiles enable row level security;

create policy "users_read_own_profile" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "users_insert_own_profile" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "users_update_own_profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
```

---

## Post-Migration Verification Queries

```sql
-- 1. profiles table exists
select table_name from information_schema.tables
where table_schema = 'public' and table_name = 'profiles';

-- 2. unique index on lower(username)
select indexname from pg_indexes
where tablename = 'profiles' and indexname = 'profiles_username_lower_idx';

-- 3. created_at index
select indexname from pg_indexes
where tablename = 'profiles' and indexname = 'profiles_created_at_idx';

-- 4. updated_at trigger
select trigger_name from information_schema.triggers
where event_object_table = 'profiles' and trigger_name = 'profiles_updated_at';

-- 5. username immutability trigger
select trigger_name from information_schema.triggers
where event_object_table = 'profiles' and trigger_name = 'profiles_username_immutable';

-- 6. profile creation trigger on auth.users
select trigger_name from information_schema.triggers
where event_object_schema = 'auth' and trigger_name = 'on_auth_user_created';

-- 7. RLS enabled
select relrowsecurity from pg_class
where relname = 'profiles' and relrowsecurity = true;

-- 8. All three RLS policies
select policyname from pg_policies
where tablename = 'profiles' order by policyname;
```

Expected: `users_insert_own_profile`, `users_read_own_profile`, `users_update_own_profile`

---

## Auth Architecture

```
Browser
  └── /login, /signup  (Server Components)
        └── LoginForm / SignupForm  (Client Components — "use client")
              └── loginAction / signupAction  ("use server" Server Actions)
                    └── Zod validation
                          └── Supabase server client
                                └── redirect("/dashboard") on success
```

### Supabase Client Split

| File | Usage |
|---|---|
| `lib/supabase/server.ts` | Server Components, Server Actions, Middleware — reads/writes cookies |
| `lib/supabase/client.ts` | Browser-only client — not used for auth in Phase 01 |

### Session Handling

`middleware.ts` calls `supabase.auth.getUser()` on every request to refresh the session token. This is the only correct pattern for Next.js 15 App Router with `@supabase/ssr`.

### Zod Validation

Schemas in `lib/validations/auth.ts`, reused by Server Actions and tests.

- `signupSchema`: email (valid format), password (min 8), username (3–30 chars, trimmed, lowercased)
- `loginSchema`: email (valid format), password (required)

---

## Folder Structure

```
app/
  (auth)/
    login/page.tsx
    signup/page.tsx
    layout.tsx               ← unauthenticated shell
  (protected)/
    dashboard/page.tsx
    layout.tsx               ← server-side auth guard + Navbar
  layout.tsx
  page.tsx                   ← redirects based on session

features/
  auth/
    actions.ts               ← signupAction, loginAction, logoutAction
    components/
      LoginForm.tsx
      SignupForm.tsx
      LogoutButton.tsx
    types.ts
    __tests__/
      actions.test.ts
      LoginForm.test.tsx
      SignupForm.test.tsx

lib/
  supabase/
    client.ts
    server.ts
  validations/
    auth.ts
    __tests__/
      auth.test.ts

components/
  ui/                        ← Shadcn primitives
  Navbar.tsx

middleware.ts
```

---

## Route Protection

### Middleware (primary)
- Unauthenticated → `/dashboard` redirects to `/login`
- Authenticated → `/login` or `/signup` redirects to `/dashboard`

### `(protected)/layout.tsx` (secondary guard)
Server Component that calls `getUser()` and throws a redirect if no session. Defense in depth.

---

## Error Handling

| Scenario | User Message |
|---|---|
| Email already exists | "An account with this email already exists" |
| Username taken | "This username is already taken" |
| Weak password | "Password must be at least 8 characters" |
| Invalid credentials | "Invalid email or password" |
| Session expired | Redirect to /login silently |

Raw database errors and Supabase error codes are never surfaced to users.

---

## Testing Strategy

| Layer | Tool | Coverage |
|---|---|---|
| Zod validation | Jest | All valid/invalid input combinations |
| Server Actions | Jest + mock Supabase | signup, login, logout; error paths |
| Form components | RTL | Render, submit, error display, loading state |
| Route protection | Jest | Middleware redirect logic |
| E2E — signup | Playwright | Full flow: fill form → submit → land on dashboard |
| E2E — login | Playwright | Valid credentials → dashboard; invalid → error |
| E2E — logout | Playwright | Click logout → land on /login; /dashboard redirects |
| E2E — protection | Playwright | Unauthenticated /dashboard → /login |

Coverage target: 80% overall, 100% on auth critical paths.

---

## Security Checklist

- [x] `service_role` key never in frontend code
- [x] All `NEXT_PUBLIC_` vars are publishable keys only
- [x] RLS enabled on `profiles` with ownership predicates
- [x] UPDATE policy has both USING and WITH CHECK
- [x] No `auth.role()` — uses `TO authenticated` + `auth.uid()` predicate
- [x] `SECURITY DEFINER` functions have explicit `set search_path = public`
- [x] No views exposing profiles (none in Phase 01)
- [x] Username immutability enforced at DB level
- [x] Raw DB errors sanitized before reaching users

---

## Username Immutability

Username is immutable in Phase 01 and enforced at three layers:
1. **Database trigger** — `profiles_username_immutable` rejects UPDATE that changes `username`
2. **RLS** — UPDATE policy exists but no username-change API is exposed
3. **Application layer** — No username edit UI, no Server Action for username changes

Future profile settings can support username changes through a dedicated flow in a later phase.

---

## Out of Scope (Phase 01)

GPS, Maps, Workouts, Territory Capture, XP System, Leaderboards, Social Features, AI Coaching, Health Integrations, Username editing.

---

## Definition of Done

- [ ] All 4 migrations applied and verified via MCP
- [ ] RLS policies verified via MCP
- [ ] Supabase packages installed (`@supabase/ssr`, `@supabase/supabase-js`)
- [ ] Testing packages installed (Jest, Playwright)
- [ ] Shadcn components initialized
- [ ] Middleware implemented and tested
- [ ] Login page implemented and tested
- [ ] Signup page implemented and tested
- [ ] Dashboard implemented and tested
- [ ] Navbar implemented
- [ ] All Jest tests passing
- [ ] All Playwright tests passing
- [ ] `npm run lint` clean
- [ ] `npm run typecheck` clean
