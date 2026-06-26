-- 20260624_quests_engine_fix_ambiguous_status.sql
--
-- Forward fix for 20260624_quests_engine.sql.
--
-- BUG: ensure_active_quests() declares RETURNS TABLE(... status text, expires_at
-- timestamptz ...). Those OUT columns become PL/pgSQL variables in scope, so the
-- "expire stale" UPDATE's WHERE clause referenced them ambiguously:
--   update public.user_quests set status='expired'
--   where user_id = p_user_id and status = 'active' and expires_at <= now();
-- → ERROR 42702: column reference "status" is ambiguous (variable vs column).
-- Every other statement in the function already alias-qualifies its columns; only
-- this UPDATE did not. Fix = alias the target (uq) and qualify the WHERE columns.
--
-- CREATE OR REPLACE preserves the existing grants; they are re-stated here for a
-- self-contained, re-runnable migration.

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
  if p_user_id is null then
    raise exception 'ensure_active_quests: p_user_id is required' using errcode = '42501';
  end if;
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'ensure_active_quests: not authorized' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext('ensure_active_quests:' || p_user_id::text));

  -- Expire stale assignments first. Alias + qualify so `status`/`expires_at`
  -- resolve to the TABLE columns, not the RETURNS TABLE OUT variables.
  update public.user_quests uq
  set status = 'expired'
  where uq.user_id = p_user_id and uq.status = 'active' and uq.expires_at <= now();

  v_daily_start   := current_date;
  v_daily_expires := (current_date + 1)::timestamptz;
  v_week_start    := (date_trunc('week', now()))::date;
  v_week_expires  := (date_trunc('week', now()) + interval '7 days');

  select greatest(0, 3 - count(*))
  into v_daily_needed
  from public.user_quests uq
  join public.quests q on q.id = uq.quest_id
  where uq.user_id = p_user_id and uq.status = 'active' and q.duration_type = 'daily';

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

  select greatest(0, 3 - count(*))
  into v_week_needed
  from public.user_quests uq
  join public.quests q on q.id = uq.quest_id
  where uq.user_id = p_user_id and uq.status = 'active' and q.duration_type = 'weekly';

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
