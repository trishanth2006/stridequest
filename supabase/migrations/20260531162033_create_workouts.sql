-- Phase 02A-01: workouts table
-- One row per running session. Geometry and derived metrics are null until finalize.
create table public.workouts (
  id uuid not null primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'recording'
    constraint workouts_status_check check (status in ('recording', 'completed', 'discarded')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  path geography(LineString, 4326),
  distance_m integer constraint workouts_distance_m_non_negative check (distance_m >= 0),
  duration_s integer constraint workouts_duration_s_non_negative check (duration_s >= 0),
  avg_pace_s_per_km integer,
  elevation_gain_m integer,
  xp_awarded integer constraint workouts_xp_awarded_non_negative check (xp_awarded >= 0),
  source text not null default 'web',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- History queries: most recent workouts per user (NFR-S-2).
create index workouts_user_started_idx on public.workouts (user_id, started_at desc);

-- Spatial queries over the canonical path (NFR-S-3).
create index workouts_path_gist on public.workouts using gist (path);

-- At most one active workout per user (FR-WL-2).
create unique index workouts_one_active_per_user
  on public.workouts (user_id)
  where status = 'recording';

-- Maintain updated_at (reuses the Phase 01 trigger function).
create trigger workouts_updated_at
  before update on public.workouts
  for each row
  execute function public.handle_updated_at();
