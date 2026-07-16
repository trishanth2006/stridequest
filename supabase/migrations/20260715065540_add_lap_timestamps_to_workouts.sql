-- Add lap_timestamps JSONB array to the workouts table
-- This stores the timestamp boundaries of completed laps directly on the run record,
-- avoiding a separate table and foreign key joins.
--
-- Idempotent (IF NOT EXISTS): the column was originally applied to the live
-- database out-of-band without a migration-history entry, so this migration
-- must be a safe no-op there while still creating the column (with the same
-- default the live column carries) in fresh environments.

ALTER TABLE public.workouts
ADD COLUMN IF NOT EXISTS lap_timestamps JSONB DEFAULT '[]'::jsonb;
