-- Phase 02A-01 remediation: relocate PostGIS out of the public schema.
-- PostGIS in `public` exposes spatial_ref_sys (and helper functions) to PostgREST,
-- tripping the rls_disabled_in_public ERROR advisor. PostGIS is not relocatable via
-- ALTER EXTENSION ... SET SCHEMA (extrelocatable = false), so it is dropped and
-- recreated in the dedicated `extensions` schema. Safe: workouts has no data.

-- Drop the only object outside the extension that depends on a PostGIS type.
-- (Dropping the column also drops its GiST index.)
alter table public.workouts drop column path;

drop extension postgis;

create extension postgis with schema extensions;

-- Re-add the canonical path using the relocated geography type, then restore the index.
alter table public.workouts add column path extensions.geography(LineString, 4326);

create index workouts_path_gist on public.workouts using gist (path);
