-- Migration 02D-01: create_territory_tables
-- Purpose: Audit log of claims (territory_captures) and the live game board (cell_ownership).
-- RLS is deferred to a subsequent migration per the Phase 02 Database Plan.

-- territory_captures
CREATE TABLE public.territory_captures (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  cell_id text not null,
  action text not null check (action in ('claim', 'steal', 'defend')),
  captured_at timestamptz not null default now()
);

-- Indexes for territory_captures
CREATE INDEX idx_territory_captures_cell_id ON public.territory_captures(cell_id);
CREATE INDEX idx_territory_captures_user_id_captured_at ON public.territory_captures(user_id, captured_at DESC);
CREATE INDEX idx_territory_captures_workout_id ON public.territory_captures(workout_id);

-- cell_ownership
CREATE TABLE public.cell_ownership (
  cell_id text primary key,
  owner_user_id uuid not null references public.profiles(id),
  owned_since_workout_id uuid not null references public.workouts(id),
  updated_at timestamptz not null default now()
);

-- Index for cell_ownership
CREATE INDEX idx_cell_ownership_owner_user_id ON public.cell_ownership(owner_user_id);

-- Trigger for cell_ownership updated_at
CREATE TRIGGER cell_ownership_updated_at
  BEFORE UPDATE ON public.cell_ownership
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
