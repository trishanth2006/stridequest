-- 02E-01 XP Foundation: xp_level helper + user_xp + xp_events + RLS.
--
-- Idempotent (safe to re-run). user_xp/xp_events are written ONLY by the
-- security-definer finalize_workout RPC (02E-01 v3); clients have read-own
-- access only (mirrors the territory tables' trust boundary).
--
-- Rollback: drop the two tables + the xp_level() function (and the policies).

-- MVP level thresholds (mirrors features/xp/services/xp.ts LEVEL_THRESHOLDS):
-- L1=0, L2=100, L3=250, L4=500, L5=1000.
create or replace function public.xp_level(p_xp bigint)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_xp >= 1000 then 5
    when p_xp >= 500  then 4
    when p_xp >= 250  then 3
    when p_xp >= 100  then 2
    else 1
  end;
$$;

-- Cumulative XP + derived level, one row per user.
create table if not exists public.user_xp (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  total_xp   bigint not null default 0,
  level      integer not null default 1,
  updated_at timestamptz not null default now()
);

-- Append-only audit of every XP award.
create table if not exists public.xp_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  workout_id  uuid references public.workouts(id) on delete set null,
  event_type  text not null check (event_type in ('workout','capture','steal')),
  xp_awarded  integer not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_xp_events_user_id_created_at on public.xp_events(user_id, created_at desc);
create index if not exists idx_xp_events_workout_id on public.xp_events(workout_id);

-- Defense-in-depth duplicate guard: at most one event of each type per workout.
create unique index if not exists uq_xp_events_workout_type
  on public.xp_events(workout_id, event_type) where workout_id is not null;

-- RLS: read-own only; writes happen exclusively in the finalize_workout RPC.
alter table public.user_xp enable row level security;
alter table public.xp_events enable row level security;

drop policy if exists "users_read_own_xp" on public.user_xp;
create policy "users_read_own_xp" on public.user_xp
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "users_read_own_xp_events" on public.xp_events;
create policy "users_read_own_xp_events" on public.xp_events
  for select to authenticated using ((select auth.uid()) = user_id);

-- No INSERT / UPDATE / DELETE policy by design: only the security-definer
-- finalize_workout RPC writes these tables.
