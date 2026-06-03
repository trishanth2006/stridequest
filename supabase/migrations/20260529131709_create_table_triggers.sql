create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_username_immutable()
returns trigger
language plpgsql
as $$
begin
  if new.username <> old.username then
    raise exception 'Username cannot be changed';
  end if;
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.handle_updated_at();

create trigger profiles_username_immutable
  before update on public.profiles
  for each row
  execute function public.handle_username_immutable();
