-- Phase 02D-02: row level security for the territory tables.
--
-- Both tables hold game-board state written ONLY by the security-definer
-- finalize_workout RPC (02D-05). That RPC runs as a BYPASSRLS role, so it writes
-- regardless of policies; every client is denied because no write policy exists.
-- This file therefore adds SELECT policies only and deliberately NO write policies.
-- Trust boundary (arch 3.3 / 8.5, FR-TC-6, NFR-Sec-2): only the RPC may write.
--
-- RLS is already enabled by the project's ensure_rls event trigger, but we assert
-- it here so the migration is self-contained when applied to a fresh database.
--
-- Rollback (pre-RPC-dependency): drop the two policies. Tables and RLS remain.

-- ---------------------------------------------------------------------------
-- territory_captures: owner-scoped read; append-only audit log.
-- ---------------------------------------------------------------------------

alter table public.territory_captures enable row level security;

-- SELECT: a user reads only their own capture history (mirrors workouts/route_points).
create policy "users_read_own_territory_captures"
  on public.territory_captures
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- No INSERT / UPDATE / DELETE policy by design.
-- Capture rows are written only by the security-definer finalize_workout RPC
-- (02D-05); they are an append-only audit log. Do not add a client write policy.

-- ---------------------------------------------------------------------------
-- cell_ownership: world-readable board; written only by the finalize RPC.
-- ---------------------------------------------------------------------------

alter table public.cell_ownership enable row level security;

-- SELECT: the live board is world-readable to any authenticated user (FR-OW-1).
-- The absence of an ownership predicate is INTENTIONAL — the board is public by
-- design, not a missing owner check.
create policy "authenticated_read_cell_ownership"
  on public.cell_ownership
  for select
  to authenticated
  using (true);

-- No INSERT / UPDATE / DELETE policy by design.
-- Ownership is maintained exclusively by the security-definer finalize_workout RPC
-- (02D-05) under row locks (last-writer-wins, FR-TC-5). Direct client writes are
-- forbidden (NFR-Sec-2). Do not add a client write policy.
