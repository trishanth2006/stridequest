create table public.profiles (
  id uuid not null primary key references auth.users(id) on delete cascade,
  username text not null constraint profiles_username_length check (char_length(username) >= 3),
  total_xp integer not null default 0 constraint profiles_total_xp_non_negative check (total_xp >= 0),
  total_distance_m integer not null default 0 constraint profiles_total_distance_non_negative check (total_distance_m >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_username_lower_idx on public.profiles (lower(username));
create index profiles_created_at_idx on public.profiles (created_at);
