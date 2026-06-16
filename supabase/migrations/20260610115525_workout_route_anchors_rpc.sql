-- Run Detail upgrade: lightweight route-matching support.
-- Returns the start/end coordinates of each of the caller's completed workouts
-- so the historical-comparison feature can match "the same route" by endpoints
-- (start within 100 m, end within 100 m, distance within 5%) without any GIS,
-- Fréchet, or ML. SECURITY INVOKER => the caller's RLS on route_points and
-- workouts applies, so a user only ever sees their own anchors.
--
-- One row per completed workout. The (workout_id, recorded_at) index on
-- route_points serves the ordered array_agg, keeping this cheap at scale.

create or replace function public.get_workout_route_anchors()
returns table (
  workout_id uuid,
  start_lat  double precision,
  start_lng  double precision,
  end_lat    double precision,
  end_lng    double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    rp.workout_id,
    (array_agg(rp.lat order by rp.recorded_at asc,  rp.batch_seq asc,  rp.point_seq asc))[1]  as start_lat,
    (array_agg(rp.lng order by rp.recorded_at asc,  rp.batch_seq asc,  rp.point_seq asc))[1]  as start_lng,
    (array_agg(rp.lat order by rp.recorded_at desc, rp.batch_seq desc, rp.point_seq desc))[1] as end_lat,
    (array_agg(rp.lng order by rp.recorded_at desc, rp.batch_seq desc, rp.point_seq desc))[1] as end_lng
  from public.route_points rp
  join public.workouts w on w.id = rp.workout_id
  where w.status = 'completed'
  group by rp.workout_id;
$$;

-- Read-only, RLS-scoped: authenticated users only; never anon.
revoke execute on function public.get_workout_route_anchors() from public;
revoke execute on function public.get_workout_route_anchors() from anon;
grant  execute on function public.get_workout_route_anchors() to authenticated;
