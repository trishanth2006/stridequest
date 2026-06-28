-- Drop the old 3-argument overload so all calls route to finalize_workout v4.
-- The v4 function (20260628_finalize_workout_v4.sql) declares
-- p_active_duration_s as DEFAULT NULL, making it compatible with callers
-- that omit the fourth argument.
DROP FUNCTION IF EXISTS public.finalize_workout(uuid, text[], uuid);
