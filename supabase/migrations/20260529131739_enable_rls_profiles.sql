alter table public.profiles enable row level security;

create policy "users_read_own_profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "users_insert_own_profile"
  on public.profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "users_update_own_profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
