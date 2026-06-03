# Claude Session Bootstrap — Phase 02

**Audience.** Every new Claude Code session opened against StrideQuest during Phase 02.
**Purpose.** The first file to read. Tells you what to load, in what order, and what rules you operate under before touching any code.

> Read this file end-to-end, then follow §1. Do not skip to implementation.

---

## 1. Required Reading Order

Open these files in this order. Stop and re-read if anything contradicts a higher-tier document — higher tiers win.

1. [`../../CLAUDE.md`](../../CLAUDE.md) — behavioral guidelines and StrideQuest engineering rules.
2. [`../../requirements.md`](../../requirements.md) — Phase 01 product requirements (historical context; does **not** govern Phase 02 scope).
3. [`./phase-02-master-spec.md`](./phase-02-master-spec.md) — Phase 02 entry point. Follow its documentation index and source-of-truth hierarchy.

Everything else in `docs/phase-02/` is reachable from the master spec. Let it route you — do not pre-load the full directory.

---

## 2. Operating Rules

These are non-negotiable for every Phase 02 session:

1. Read CLAUDE.md before acting.
2. Read `requirements.md` for Phase 01 context only.
3. Read `phase-02-master-spec.md` and follow its links from there.
4. Resolve conflicts using the source-of-truth hierarchy in the master spec (§2). Higher tiers always win.
5. Do not redesign the architecture. The Tier-1 architecture doc is the design.
6. Use TDD: failing test first, smallest implementation that passes, refactor with green tests.
7. Use MCP for all migrations. No manual schema edits, no out-of-band SQL.
8. Regenerate `infrastructure/supabase/database.types.ts` after every schema change.
9. Keep every file under 300 lines. Split components, hooks, services, or utilities before they cross the line.
10. Stop at milestone boundaries. Execute only the currently approved milestone — wait for explicit approval before crossing into the next one.

---

## 3. Scope Discipline

Phase 02 is delivered milestone-by-milestone (02A → 02E). The current entry point for implementation is the first unstarted milestone listed in [`phase-02-implementation-order.md`](./phase-02-implementation-order.md).

Do not:

- start a later milestone before the current one verifies.
- expand a milestone with features that belong to a later one.
- add planning artifacts unless the master spec instructs you to.

If you believe scope must change, stop and surface the tradeoff. Do not silently widen the work.

---

## 4. Verification Before Completion

A task is not complete until:

- Lint passes.
- Typecheck passes.
- The tests written for the task pass.
- Any migrations introduced are verified per the database plan (tables, indexes, constraints, RLS).
- `database.types.ts` is regenerated if the schema changed.

Report what was built, files created/modified, tests added, test results, migration status, remaining risks, and the recommended next step — as required by CLAUDE.md.

Before every new Claude session:

1. Read docs/phase-02/claude-session-bootstrap.md
2. Read docs/phase-02/phase-02-master-spec.md
3. Report current milestone status
4. Do not implement until milestone is confirmed