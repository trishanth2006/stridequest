-- Phase 02B-07: enable multi-sample batches in route_points.
-- 02B-01 created UNIQUE(workout_id, batch_seq), but route_points stores one row
-- PER SAMPLE (arch 3.2/6) and batches coalesce many samples under one batch_seq
-- (NFR-B-3). That constraint rejected every batch with >1 sample (23505). This
-- forward-fix adds an intra-batch index column (point_seq) and moves idempotency
-- to the (workout_id, batch_seq, point_seq) grain: re-sending an identical batch
-- conflicts on every row and is a no-op (FR-RR-2 / NFR-R-1), while many samples
-- per batch_seq are now permitted. Per master-spec 2, Tier-1 (one-row-per-sample)
-- governs over the Tier-3/4 unique constraint.
--
-- Rollback (pre-data): drop the composite unique -> drop point_seq -> restore the
-- old (workout_id, batch_seq) unique.

-- Add point_seq via a temporary default so the NOT NULL holds even if rows exist,
-- then drop the default so future inserts must supply the value explicitly.
alter table public.route_points
  add column point_seq integer not null default 0
    constraint route_points_point_seq_non_negative check (point_seq >= 0);

alter table public.route_points
  alter column point_seq drop default;

-- Replace the per-batch unique (incompatible with one-row-per-sample) with the
-- per-sample grain. The composite B-tree's (workout_id, batch_seq) prefix still
-- serves ordered replay and dedupe lookups (NFR-S-1).
alter table public.route_points
  drop constraint route_points_workout_batch_seq_unique;

alter table public.route_points
  add constraint route_points_workout_batch_point_unique
    unique (workout_id, batch_seq, point_seq);
