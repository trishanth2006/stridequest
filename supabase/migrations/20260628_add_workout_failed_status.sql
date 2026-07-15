-- Allow finalize-workout edge function to mark a workout as 'failed' when
-- GPS data is corrupt and captureCells throws before the RPC can run.
ALTER TABLE public.workouts
  DROP CONSTRAINT workouts_status_check,
  ADD CONSTRAINT workouts_status_check
    CHECK (status IN ('recording', 'completed', 'discarded', 'failed'));
