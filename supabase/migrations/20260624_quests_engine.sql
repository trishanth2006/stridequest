-- 20260624_quests_engine.sql
--
-- Quests Engine (Task 1): dictionary + per-user assignments + progress ledger,
-- plus the two security-definer RPCs that own all writes.
--
-- FEATURE
--   Players are assigned a rolling set of daily and weekly quests. Each quest
--   describes a goal (run X metres, claim X territories, hit a pace for one km).
--   Finishing a quest awards XP (and a cosmetic badge). The mobile dashboard
--   lazily tops-up the active set via ensure_active_quests; the finalize edge
--   function applies progress from a completed workout via apply_quest_progress.
--
-- TRUST BOUNDARY (mirrors finalize_workout / xp_foundation)
--   * Every table has RLS with read-own SELECT policies only — NO insert/update/
--     delete policies. All writes happen exclusively inside the two SECURITY
--     DEFINER RPCs below.
--   * Both RPCs use `set search_path = ''`, so every table and every project
--     function is schema-qualified (`public.`); only pg_catalog built-ins
--     (now(), random(), date_trunc(), current_date, gen_random_uuid(),
--     jsonb_array_elements(), coalesce(), greatest(), `= any(...)`) and the
--     `auth.uid()` helper appear without a `public.` prefix.
--   * p_user_id replaces auth.uid() for service-role callers (service-role has a
--     null auth.uid()). ensure_active_quests additionally lets an authenticated
--     caller pass only their own id; apply_quest_progress is service-role only.
--
-- IDEMPOTENCY DESIGN
--   * quest_contributions is an append-only ledger keyed by
--     (workout_id, user_quest_id). A second finalize of the same workout cannot
--     re-apply progress: the ledger insert is `on conflict do nothing` and the
--     loop skips any element whose row already existed.
--   * Aggregated quest XP is written once per workout, guarded by xp_events'
--     unique index uq_xp_events_workout_type (workout_id, event_type) plus an
--     explicit not-exists check before insert.
--   * The whole migration is re-runnable: create table/index if not exists,
--     drop policy before create policy, create or replace function, and
--     `on conflict (slug) do nothing` seeds.
--
-- TARGET_VALUE SEMANTICS depend on quests.type:
--   * distance_total  -> metres to accumulate (progress sums per workout).
--   * territory_claim -> count of new cells to claim (progress sums per workout).
--   * pace_best_km    -> a pace THRESHOLD in seconds/km; progress is binary
--                        (current_value 0 until a single km beats it, then 1).
--   The shared evaluator (Task 2) interprets these; this migration only stores
--   the dictionary rows and applies the deltas the evaluator hands back.
--
-- ASSUMPTIONS (documented, not "fixed"):
--   1. Period boundaries use current_date / date_trunc('week', now()), which are
--      UTC only when the session time zone is UTC. Supabase defaults to UTC, so
--      this is correct for our deployment; we follow the spec verbatim rather
--      than wrapping with `AT TIME ZONE 'UTC'`.
--   2. The xp_events event_type check was created inline with column `event_type`
--      and therefore carries Postgres' default constraint name
--      `xp_events_event_type_check`; the ALTER below relies on that name.

-- ─── ALTER xp_events to allow the 'quest' event type ──────────────────────────

alter table public.xp_events drop constraint if exists xp_events_event_type_check;
alter table public.xp_events add constraint xp_events_event_type_check
  check (event_type in ('workout','capture','steal','quest'));

-- ─── Tables ───────────────────────────────────────────────────────────────────

-- Dictionary of quest definitions (enum-like columns modelled as text + check).
create table if not exists public.quests (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  title              text not null,
  description        text not null,
  type               text not null check (type in ('distance_total','territory_claim','pace_best_km')),
  target_value       numeric not null check (target_value > 0),
  reward_xp          integer not null default 0 check (reward_xp >= 0),
  duration_type      text not null check (duration_type in ('daily','weekly')),
  reward_badge_icon  text,
  reward_badge_label text,
  -- "must finish before HH:00 UTC" (0-23); null = no time-of-day window.
  window_end_hour    smallint check (window_end_hour between 0 and 23),
  is_active          boolean not null default true,
  created_at         timestamptz not null default now()
);

-- One row per (user, quest, period). period_start disambiguates re-issues of the
-- same quest across days/weeks.
create table if not exists public.user_quests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  -- RESTRICT: quests are retired via is_active=false, never deleted; this
  -- protects assignment history and the idempotency ledger from orphaning.
  quest_id    uuid not null references public.quests(id) on delete restrict,
  status      text not null default 'active' check (status in ('active','completed','expired')),
  period_start date not null,
  assigned_at timestamptz not null default now(),
  expires_at  timestamptz not null,
  completed_at timestamptz,
  unique (user_id, quest_id, period_start)
);

create index if not exists idx_user_quests_user_status on public.user_quests(user_id, status);

-- Current progress per assignment (keyed by user_quest_id, not bare quest_id).
create table if not exists public.quest_progress (
  user_quest_id uuid primary key references public.user_quests(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  current_value numeric not null default 0 check (current_value >= 0),
  updated_at    timestamptz not null default now()
);

-- Idempotency ledger: at most one contribution per (workout, assignment).
create table if not exists public.quest_contributions (
  workout_id    uuid not null references public.workouts(id) on delete cascade,
  user_quest_id uuid not null references public.user_quests(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  value_added   numeric not null,
  created_at    timestamptz not null default now(),
  primary key (workout_id, user_quest_id)
);

-- ─── RLS (read-own; writes only via the SECURITY DEFINER RPCs) ────────────────

alter table public.quests enable row level security;
alter table public.user_quests enable row level security;
alter table public.quest_progress enable row level security;
alter table public.quest_contributions enable row level security;

-- Dictionary: any authenticated user may read active quests.
drop policy if exists "quests_read_active" on public.quests;
create policy "quests_read_active" on public.quests
  for select to authenticated using (is_active);

-- Per-user tables: read-own only (uses the project's (select auth.uid()) form).
drop policy if exists "users_read_own_user_quests" on public.user_quests;
create policy "users_read_own_user_quests" on public.user_quests
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "users_read_own_quest_progress" on public.quest_progress;
create policy "users_read_own_quest_progress" on public.quest_progress
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "users_read_own_quest_contributions" on public.quest_contributions;
create policy "users_read_own_quest_contributions" on public.quest_contributions
  for select to authenticated using ((select auth.uid()) = user_id);

-- No INSERT / UPDATE / DELETE policies by design.

-- ─── RPC 1: ensure_active_quests ──────────────────────────────────────────────
-- Lazily expires stale assignments, tops-up the active daily+weekly sets for the
-- current period, then returns the active set joined with quest defs + progress.
-- Callable by the mobile dashboard (authenticated, self) and the finalize edge
-- function (service-role).

create or replace function public.ensure_active_quests(p_user_id uuid)
returns table (
  user_quest_id      uuid,
  quest_id           uuid,
  slug               text,
  title              text,
  description        text,
  type               text,
  target_value       numeric,
  reward_xp          integer,
  duration_type      text,
  reward_badge_icon  text,
  reward_badge_label text,
  window_end_hour    smallint,
  status             text,
  current_value      numeric,
  expires_at         timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_daily_start   date;
  v_daily_expires timestamptz;
  v_week_start    date;
  v_week_expires  timestamptz;
  v_daily_needed  integer;
  v_week_needed   integer;
begin
  -- Authorization: authenticated callers may only request their own quests;
  -- service-role callers have a null auth.uid() and are allowed.
  if p_user_id is null then
    raise exception 'ensure_active_quests: p_user_id is required' using errcode = '42501';
  end if;
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'ensure_active_quests: not authorized' using errcode = '42501';
  end if;

  -- Serialize concurrent calls for this user so the top-up can't over-assign.
  perform pg_advisory_xact_lock(hashtext('ensure_active_quests:' || p_user_id::text));

  -- Expire stale assignments first so the top-up counts below are accurate.
  update public.user_quests
  set status = 'expired'
  where user_id = p_user_id and status = 'active' and expires_at <= now();

  -- Period boundaries (UTC; see header assumption 1).
  v_daily_start   := current_date;
  v_daily_expires := (current_date + 1)::timestamptz;
  v_week_start    := (date_trunc('week', now()))::date;
  v_week_expires  := (date_trunc('week', now()) + interval '7 days');

  -- How many daily quests are still needed to reach a target of 3?
  select greatest(0, 3 - count(*))
  into v_daily_needed
  from public.user_quests uq
  join public.quests q on q.id = uq.quest_id
  where uq.user_id = p_user_id and uq.status = 'active' and q.duration_type = 'daily';

  -- Top-up daily: pick random active daily quests not yet assigned this period.
  with picked as (
    select q.id as quest_id
    from public.quests q
    where q.is_active and q.duration_type = 'daily'
      and not exists (
        select 1 from public.user_quests uq
        where uq.user_id = p_user_id and uq.quest_id = q.id and uq.period_start = v_daily_start
      )
    order by random()
    limit v_daily_needed
  ), ins as (
    insert into public.user_quests (user_id, quest_id, status, period_start, expires_at)
    select p_user_id, p.quest_id, 'active', v_daily_start, v_daily_expires from picked p
    on conflict (user_id, quest_id, period_start) do nothing
    returning id
  )
  insert into public.quest_progress (user_quest_id, user_id, current_value)
  select i.id, p_user_id, 0 from ins i
  on conflict (user_quest_id) do nothing;

  -- How many weekly quests are still needed to reach a target of 3?
  select greatest(0, 3 - count(*))
  into v_week_needed
  from public.user_quests uq
  join public.quests q on q.id = uq.quest_id
  where uq.user_id = p_user_id and uq.status = 'active' and q.duration_type = 'weekly';

  -- Top-up weekly.
  with picked as (
    select q.id as quest_id
    from public.quests q
    where q.is_active and q.duration_type = 'weekly'
      and not exists (
        select 1 from public.user_quests uq
        where uq.user_id = p_user_id and uq.quest_id = q.id and uq.period_start = v_week_start
      )
    order by random()
    limit v_week_needed
  ), ins as (
    insert into public.user_quests (user_id, quest_id, status, period_start, expires_at)
    select p_user_id, p.quest_id, 'active', v_week_start, v_week_expires from picked p
    on conflict (user_id, quest_id, period_start) do nothing
    returning id
  )
  insert into public.quest_progress (user_quest_id, user_id, current_value)
  select i.id, p_user_id, 0 from ins i
  on conflict (user_quest_id) do nothing;

  -- Return the active set (column order/types match the RETURNS TABLE signature).
  return query
  select uq.id, q.id, q.slug, q.title, q.description, q.type, q.target_value, q.reward_xp,
         q.duration_type, q.reward_badge_icon, q.reward_badge_label, q.window_end_hour,
         uq.status, coalesce(qp.current_value, 0), uq.expires_at
  from public.user_quests uq
  join public.quests q on q.id = uq.quest_id
  left join public.quest_progress qp on qp.user_quest_id = uq.id
  where uq.user_id = p_user_id and uq.status = 'active'
  order by q.duration_type, q.reward_xp desc;
end;
$$;

revoke execute on function public.ensure_active_quests(uuid) from public;
revoke execute on function public.ensure_active_quests(uuid) from anon;
grant  execute on function public.ensure_active_quests(uuid) to authenticated;
grant  execute on function public.ensure_active_quests(uuid) to service_role;

-- ─── RPC 2: apply_quest_progress ──────────────────────────────────────────────
-- Atomically + idempotently apply quest progress from one finalized workout,
-- flip newly-completed quests, and award aggregated quest XP. Service-role only
-- (called by the finalize edge function).
--
-- p_updates is a JSON array of objects, each:
--   { "userQuestId": uuid, "valueAdded": number, "completed": boolean }
-- The awarded XP is NOT taken from the caller; it is read authoritatively from
-- public.quests.reward_xp for each quest this call actually completes.
-- Returns the newly-completed quests (the edge function sums reward_xp itself).

create or replace function public.apply_quest_progress(
  p_user_id    uuid,
  p_workout_id uuid,
  p_updates    jsonb
)
returns table (
  user_quest_id uuid,
  quest_id      uuid,
  reward_xp     integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total_quest_xp integer := 0;
  v_elem           jsonb;
  v_uq             uuid;
  v_added          numeric;
  v_completed      boolean;
  v_reward         integer;
  v_owner          uuid;
  v_n              integer;
begin
  if p_user_id is null then
    raise exception 'apply_quest_progress: p_user_id is required' using errcode = '42501';
  end if;

  -- IDEMPOTENCY: if this workout already contributed, re-return the completed
  -- quests it touched and exit without re-writing anything.
  if exists (select 1 from public.quest_contributions where workout_id = p_workout_id) then
    return query
    select uq.id, uq.quest_id, q.reward_xp
    from public.quest_contributions c
    join public.user_quests uq on uq.id = c.user_quest_id
    join public.quests q on q.id = uq.quest_id
    where c.workout_id = p_workout_id and uq.status = 'completed';
    return;
  end if;

  -- Apply each update. Ledger insert is the idempotency unit per assignment.
  for v_elem in select * from jsonb_array_elements(p_updates) loop
    v_uq        := (v_elem->>'userQuestId')::uuid;
    v_added     := (v_elem->>'valueAdded')::numeric;
    v_completed := coalesce((v_elem->>'completed')::boolean, false);

    if v_uq is null or v_added is null or v_added < 0 then
      continue;
    end if;

    -- Defense in depth: only apply progress to the caller's own assignments.
    select user_id into v_owner from public.user_quests where id = v_uq;
    if v_owner is distinct from p_user_id then
      continue;
    end if;

    -- Ledger: skip if this (workout, assignment) was already recorded.
    insert into public.quest_contributions (workout_id, user_quest_id, user_id, value_added)
    values (p_workout_id, v_uq, p_user_id, v_added)
    on conflict (workout_id, user_quest_id) do nothing;
    get diagnostics v_n = row_count;
    if v_n = 0 then
      continue;
    end if;

    -- Apply progress additively (upsert so a missing row can't drop progress).
    insert into public.quest_progress (user_quest_id, user_id, current_value, updated_at)
    values (v_uq, p_user_id, v_added, now())
    on conflict (user_quest_id) do update
      set current_value = public.quest_progress.current_value + excluded.current_value,
          updated_at = excluded.updated_at;

    -- Flip to completed once; only count its reward if we actually flipped it.
    -- Reward is read authoritatively from the dictionary, not the caller.
    if v_completed then
      update public.user_quests
      set status = 'completed', completed_at = now()
      where id = v_uq and status <> 'completed';
      if found then
        select q.reward_xp into v_reward
        from public.user_quests uq
        join public.quests q on q.id = uq.quest_id
        where uq.id = v_uq;
        v_total_quest_xp := v_total_quest_xp + coalesce(v_reward, 0);
      end if;
    end if;
  end loop;

  -- Award aggregated quest XP once per workout. The audit row and the cumulative
  -- bump are co-guarded by the same not-exists check so they happen together
  -- exactly once, even if this RPC is somehow re-entered for the same workout.
  if v_total_quest_xp > 0 then
    if not exists (
      select 1 from public.xp_events
      where workout_id = p_workout_id and event_type = 'quest'
    ) then
      insert into public.xp_events (user_id, workout_id, event_type, xp_awarded)
      values (p_user_id, p_workout_id, 'quest', v_total_quest_xp);

      insert into public.user_xp (user_id, total_xp, level, updated_at)
      values (p_user_id, v_total_quest_xp, public.xp_level(v_total_quest_xp), now())
      on conflict (user_id) do update
        set total_xp = public.user_xp.total_xp + excluded.total_xp,
            level = public.xp_level(public.user_xp.total_xp + excluded.total_xp),
            updated_at = excluded.updated_at;
    end if;
  end if;

  -- Return the newly-completed quests (column order/types match RETURNS TABLE).
  return query
  select uq.id, uq.quest_id, q.reward_xp
  from public.user_quests uq
  join public.quests q on q.id = uq.quest_id
  where uq.id = any (
          select (e->>'userQuestId')::uuid
          from jsonb_array_elements(p_updates) e
          where coalesce((e->>'completed')::boolean, false)
        )
    and uq.user_id = p_user_id and uq.status = 'completed';
end;
$$;

revoke execute on function public.apply_quest_progress(uuid, uuid, jsonb) from public;
revoke execute on function public.apply_quest_progress(uuid, uuid, jsonb) from anon;
revoke execute on function public.apply_quest_progress(uuid, uuid, jsonb) from authenticated;
grant  execute on function public.apply_quest_progress(uuid, uuid, jsonb) to service_role;

-- ─── Seed quest dictionary (idempotent) ───────────────────────────────────────

insert into public.quests
  (slug, title, description, type, target_value, reward_xp, duration_type, reward_badge_icon, reward_badge_label, window_end_hour)
values
  -- Daily
  ('daily-run-3k',     'Daily 3K',        'Run 3 km today.',                          'distance_total',  3000,  50, 'daily', '🏃', 'Mover',      null),
  ('daily-early-5k',   'Early Bird 5K',   'Finish a 5 km run before 8 AM.',           'distance_total',  5000, 100, 'daily', '🌅', 'Early Bird',    8),
  ('daily-claim-3',    'Land Grab',       'Claim 3 new territories today.',           'territory_claim',    3,  60, 'daily', '🚩', 'Conqueror',  null),
  ('daily-best-km-6',  'Speed Demon',     'Hit a 6:00/km pace for one kilometre.',    'pace_best_km',     360,  80, 'daily', '⚡', 'Sprinter',   null),
  -- Weekly
  ('weekly-run-20k',     'Distance Crusher', 'Run 20 km this week.',                     'distance_total', 20000, 250, 'weekly', '🏅', 'Crusher',  null),
  ('weekly-claim-15',    'Territory Lord',   'Claim 15 territories this week.',          'territory_claim',   15, 300, 'weekly', '👑', 'Overlord', null),
  ('weekly-best-km-530', 'Pace Master',      'Hit a 5:30/km pace for one kilometre.',    'pace_best_km',     330, 350, 'weekly', '🔥', 'Pacer',    null)
on conflict (slug) do nothing;
