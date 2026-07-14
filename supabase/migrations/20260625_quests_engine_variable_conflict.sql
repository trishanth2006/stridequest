-- Add #variable_conflict use_column to avoid ambiguity between OUT parameters and column names

create or replace function public.ensure_active_quests(p_user_id uuid)
returns table(
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
#variable_conflict use_column
declare
  v_daily_start   timestamptz;
  v_daily_expires timestamptz;
  v_daily_count   integer;
  v_daily_needed  integer;

  v_week_start    timestamptz;
  v_week_expires  timestamptz;
  v_week_count    integer;
  v_week_needed   integer;
begin
  if p_user_id is null then
    raise exception 'ensure_active_quests: p_user_id is required' using errcode = '42501';
  end if;
  if auth.uid() is not null and auth.uid() is distinct from p_user_id then
    raise exception 'ensure_active_quests: not authorized' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext('ensure_active_quests:' || p_user_id::text));

  v_daily_start   := date_trunc('day', now() at time zone 'UTC');
  v_daily_expires := v_daily_start + interval '1 day';
  v_week_start    := date_trunc('week', now() at time zone 'UTC');
  v_week_expires  := v_week_start + interval '1 week';

  select count(*) into v_daily_count
  from public.user_quests uq
  join public.quests q on q.id = uq.quest_id
  where uq.user_id = p_user_id and uq.status = 'active' and q.duration_type = 'daily';

  v_daily_needed := greatest(0, 3 - v_daily_count);

  if v_daily_needed > 0 then
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
  end if;

  select count(*) into v_week_count
  from public.user_quests uq
  join public.quests q on q.id = uq.quest_id
  where uq.user_id = p_user_id and uq.status = 'active' and q.duration_type = 'weekly';

  v_week_needed := greatest(0, 3 - v_week_count);

  if v_week_needed > 0 then
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
  end if;

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
#variable_conflict use_column
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

  if exists (select 1 from public.quest_contributions where workout_id = p_workout_id) then
    return query
    select uq.id, uq.quest_id, q.reward_xp
    from public.quest_contributions c
    join public.user_quests uq on uq.id = c.user_quest_id
    join public.quests q on q.id = uq.quest_id
    where c.workout_id = p_workout_id and uq.status = 'completed';
    return;
  end if;

  for v_elem in select * from jsonb_array_elements(p_updates) loop
    v_uq        := (v_elem->>'userQuestId')::uuid;
    v_added     := (v_elem->>'valueAdded')::numeric;
    v_completed := coalesce((v_elem->>'completed')::boolean, false);

    if v_uq is null or v_added is null or v_added < 0 then
      continue;
    end if;

    select user_id into v_owner from public.user_quests where id = v_uq;
    if v_owner is distinct from p_user_id then
      continue;
    end if;

    insert into public.quest_contributions (workout_id, user_quest_id, user_id, value_added)
    values (p_workout_id, v_uq, p_user_id, v_added)
    on conflict (workout_id, user_quest_id) do nothing;
    get diagnostics v_n = row_count;
    if v_n = 0 then
      continue;
    end if;

    insert into public.quest_progress (user_quest_id, user_id, current_value, updated_at)
    values (v_uq, p_user_id, v_added, now())
    on conflict (user_quest_id) do update
      set current_value = public.quest_progress.current_value + excluded.current_value,
          updated_at = excluded.updated_at;

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
