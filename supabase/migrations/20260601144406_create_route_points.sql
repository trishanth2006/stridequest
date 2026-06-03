-- Phase 02B-01: route_points table + constraints + indexes + RLS
-- Raw, append-only stream of accepted GPS samples per workout.
-- FK cascades from workouts; RLS is enabled here per database plan §Migration 3.
--
-- Rollback (pre-data): drop policies → drop index → drop table.
-- After data exists, forward-fix is preferred over rollback.

create table public.route_points (
  id          bigint         generated always as identity primary key,
  workout_id  uuid           not null
                               references public.workouts(id) on delete cascade,
  lat         double precision not null
                               constraint route_points_lat_range
                               check (lat between -90 and 90),
  lng         double precision not null
                               constraint route_points_lng_range
                               check (lng between -180 and 180),
  accuracy_m  real           not null
                               constraint route_points_accuracy_non_negative
                               check (accuracy_m >= 0),
  altitude_m  real,
  speed_mps   real
                               constraint route_points_speed_non_negative
                               check (speed_mps >= 0),
  heading_deg real,
  recorded_at timestamptz    not null,
  received_at timestamptz    not null default now(),
  batch_seq   integer        not null
                               constraint route_points_batch_seq_non_negative
                               check (batch_seq >= 0),

  -- Idempotent ingest: duplicate (workout_id, batch_seq) pairs are rejected.
  -- This unique constraint also implicitly creates the B-tree index used for
  -- ordered replay and deduplication (NFR-S-1 / FR-RR-2 / NFR-R-1).
  constraint route_points_workout_batch_seq_unique
    unique (workout_id, batch_seq)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- Route reconstruction, workout details, route finalization, and map rendering
-- frequently read a workout's points ordered by client clock. This composite
-- B-tree serves those (workout_id, recorded_at)-ordered scans directly.
create index route_points_workout_recorded_at_idx
  on public.route_points (workout_id, recorded_at);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.route_points enable row level security;

-- SELECT: owner-scoped via join through workouts.user_id.
-- No user_id column on route_points; ownership is established through the FK.
create policy "users_read_own_route_points"
  on public.route_points
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.workouts w
      where w.id = route_points.workout_id
        and w.user_id = (select auth.uid())
    )
  );

-- INSERT: client must own the target workout (FR-RR-5).
create policy "users_insert_own_route_points"
  on public.route_points
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.workouts w
      where w.id = route_points.workout_id
        and w.user_id = (select auth.uid())
    )
  );

-- No UPDATE policy. No DELETE policy.
-- route_points is append-only at the application layer (arch §3.2).
