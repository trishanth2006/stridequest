-- Phase 02A-01: row level security for workouts
-- Owner-scoped access. DELETE is not exposed in Phase 02 (discard is an UPDATE to status='discarded').
alter table public.workouts enable row level security;

create policy "users_read_own_workouts"
  on public.workouts
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "users_insert_own_workouts"
  on public.workouts
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "users_update_own_workouts"
  on public.workouts
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
