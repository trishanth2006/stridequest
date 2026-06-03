# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.
# StrideQuest Engineering Rules

## Core Engineering Standards

* Never create files larger than 300 lines
* Use strict TypeScript
* No any types
* No dead code
* No duplicate logic
* Prefer composition over duplication
* Reuse components whenever possible
* Follow Next.js 15 App Router best practices
* Follow Supabase SSR best practices
* Keep functions small and focused
* Prefer server components by default
* Use client components only when required

---

## Test Driven Development

* Follow TDD whenever practical
* Write tests before implementing features
* Create failing tests first
* Implement the smallest solution that passes
* Refactor after tests pass
* Maintain high coverage for business-critical flows

Required test coverage:

* Authentication
* Route protection
* Database access layers
* User onboarding
* Territory capture logic
* XP calculations

---

## Database Rules

* Use migrations only
* Never manually modify production schemas
* Use MCP for migration creation
* Use MCP for migration execution
* Verify migrations after execution
* Verify tables exist
* Verify indexes exist
* Verify constraints exist
* Verify RLS policies exist

Always provide migration verification reports.

---

## Code Quality

Before completing any task:

* Run lint
* Run typecheck
* Run tests
* Fix all failures
* Fix all warnings where practical

Task is not complete until:

* Lint passes
* Typecheck passes
* Tests pass

---

## Architecture Rules

### MVP Refactoring Rule

When proposing architecture changes, prefer the smallest refactor that achieves the architectural goal.

---

### Source Structure

Use feature-first architecture.

Required structure (root-level — no `src/` wrapper):

```
app/
features/
infrastructure/
components/
tests/
lib/
types/
```

Do not create business logic directly under `app/`.

App Router files should remain thin and delegate logic to features.

---

### Feature Ownership

Business logic belongs inside features.

Example:

```
features/auth
features/profile
features/running
features/territory
```

Each feature may contain:

```
components/
actions/
hooks/
types/
services/
```

Do not place feature-specific code in shared folders.

---

### Infrastructure Layer

All external services belong under infrastructure.

Required:

```
infrastructure/supabase
```

Files:

* `client.ts`
* `server.ts`
* `middleware.ts`
* `database.types.ts`

Future:

```
infrastructure/mapbox
infrastructure/health-connect
infrastructure/analytics
```

Do not place infrastructure code inside `lib/`.

---

### Components Rules

`components/` contains only reusable UI.

Allowed:

```
components/ui
components/layout
components/shared
```

Not allowed:

```
components/LoginForm
components/SignupForm
components/AuthCard
```

Those belong inside `features/auth/components`.

---

### Testing Structure

Use centralized test directories:

```
tests/unit/
tests/integration/
tests/e2e/
```

Do not create `__tests__` folders anywhere in the repo.

---

### Supabase Rules

Repository is the source of truth.

All MCP-applied migrations must exist locally.

Required:

```
supabase/
└── migrations/
```

Example:

```
001_create_profiles_table.sql
002_create_table_triggers.sql
003_create_profile_creation_trigger.sql
004_enable_rls_profiles.sql
```

Never leave schema changes only inside the remote database.

Every migration must be committed.

---

### Database Types

Never hand-write database types.

Always generate from live schema.

Store at: `infrastructure/supabase/database.types.ts`

Regenerate after every schema change.

---

### Middleware Rules

Root `middleware.ts` exists only because Next.js requires it.

Business logic must not live there.

Root `middleware.ts` should delegate to `infrastructure/supabase/middleware.ts`.

Example flow:

```
middleware.ts → updateSession() → route guards
```

Keep root middleware minimal.

---

### Folder Review Requirement

Before implementing a new feature:

1. Generate the resulting folder tree.
2. Verify: no architecture violations, no misplaced files, no duplicate responsibilities.

If violations exist: stop implementation, propose refactor, wait for approval.

---

### Refactoring Authority

Claude is authorized and expected to move files, reorganize folders, and split modules when architecture drift is detected.

Never continue building on top of a bad structure. Fix architecture first.

---

### Architecture Approval Gate

Before implementing any major feature:

1. Show folder tree.
2. Explain file ownership.
3. Explain why locations were chosen.
4. Wait for approval.

Do not proceed until approved.

---

### Long-Term StrideQuest Structure

Future target (aspirational — not current):

```
app/
features/
│   ├── auth/
│   ├── profile/
│   ├── running/
│   ├── territory/
│   ├── social/
│   └── analytics/
infrastructure/
│   ├── supabase/
│   ├── mapbox/
│   ├── health-connect/
│   └── monitoring/
components/
│   ├── ui/
│   ├── layout/
│   └── shared/
tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
lib/
types/
```

This is the build-toward target. Current mandatory structure is the root-level layout defined in the Source Structure section above.

---

### General Architecture Standards

* Avoid deeply nested components
* Avoid God components
* Avoid God services

If a file exceeds 300 lines:

* Split components
* Split hooks
* Split services
* Split utilities

---

## Decision Making

When information is missing:

* Make reasonable assumptions
* Clearly state assumptions
* Continue implementation

Ask questions only if the answer would materially affect:

* Database schema
* Security
* Authentication
* Authorization
* API contracts
* Core business logic
* User experience

Do not stop progress for minor implementation details.

---

## Verification Requirements

For every completed task provide:

1. What was built
2. Files created
3. Files modified
4. Tests added
5. Test results
6. Migration status
7. Remaining risks
8. Recommended next step

---

## StrideQuest MVP Scope

Current phase:

Authentication Foundation

Allowed:

* Login
* Signup
* Logout
* Profiles
* Dashboard
* Route protection

Not allowed yet:

* GPS
* Maps
* Workouts
* Territory capture
* XP system
* Leaderboards
* Social features
* AI coaching
* Health integrations

Build only what belongs to the current phase.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes. 
