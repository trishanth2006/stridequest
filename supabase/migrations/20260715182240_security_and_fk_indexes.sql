-- Sprint 1 · Security & FK-index batch (audit items C6 + Q10).
--
-- 1. push_tokens RLS: cache auth.uid() via initplan (the per-row re-evaluation
--    was flagged by the performance advisor) and scope the policy to
--    authenticated instead of public.
-- 2. rls_auto_enable() is an internal event-trigger helper; Postgres grants
--    EXECUTE to PUBLIC on new functions by default, which exposed it through
--    the Data API. PUBLIC must be revoked too — anon/authenticated inherit
--    execute from it. The event trigger itself is unaffected (it runs as the
--    function owner, not via an EXECUTE grant).
-- 3. Covering indexes for the five foreign keys the advisor reported as
--    unindexed (finalize write path + quest joins).

DROP POLICY IF EXISTS "users manage own push token" ON public.push_tokens;
CREATE POLICY "users manage own push token" ON public.push_tokens
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_cell_ownership_owned_since_workout ON public.cell_ownership (owned_since_workout_id);
CREATE INDEX IF NOT EXISTS idx_quest_contributions_user ON public.quest_contributions (user_id);
CREATE INDEX IF NOT EXISTS idx_quest_contributions_user_quest ON public.quest_contributions (user_quest_id);
CREATE INDEX IF NOT EXISTS idx_quest_progress_user ON public.quest_progress (user_id);
CREATE INDEX IF NOT EXISTS idx_user_quests_quest ON public.user_quests (quest_id);
