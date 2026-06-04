# ADR 02D-05 — Territory Finalize Trust Boundary

**Status:** Accepted (records a decision already implemented and live).
**Date:** 2026-06-04
**Context tasks:** 02D-04 architecture review (Finding 1), 02D-05 implementation.
**Supersedes:** the R-07 "TypeScript-side generation" note that did not account for the RPC's trust boundary.

> This ADR documents the decision that was already implemented and verified live. It is not a redesign. See the recovery audit (`phase-02D-05-recovery-audit.md`) for the verification that this gate had shipped without its record.

---

## 1. Context

Territory capture converts a workout's GPS path into a set of H3 cells, then records
claim/steal/defend ownership. H3 projection runs in **TypeScript** (`features/territory/capture.ts`,
decision R-07 path (b)) because there is no H3 implementation in our Postgres. The finalize step is a
single `SECURITY DEFINER` RPC, `public.finalize_workout`, which writes `workouts`, `territory_captures`,
and `cell_ownership` in one transaction.

Because cells are computed in TS, the RPC must accept a **caller-supplied cell array**
(`p_cell_ids text[]`). That is the crux of the problem below.

## 2. Threat model / attack path

In v1, the RPC was granted `EXECUTE` to `authenticated` and was reachable through PostgREST at
`/rest/v1/rpc/finalize_workout`. The internal check `workouts.user_id = auth.uid()` proves the caller
**owns the workout** — it does **not** prove they **ran through the supplied cells**.

The moment the RPC accepts a caller-supplied cell array while remaining `authenticated`-executable:

> **Any authenticated user can `POST /rest/v1/rpc/finalize_workout` with an arbitrary `p_cell_ids`
> array and claim/steal the entire board, bypassing the GPS path entirely.**

The RPC cannot re-validate cells against the path: there is no H3 in SQL (that is precisely why
projection moved to TS). Computing cells "server-side in the action" does not help either — PostgREST
exposes the RPC independently of any server action. The vulnerability is the **executable surface**,
not where cells are computed. (Risk register: R-05 × R-07 × R-08 intersection.)

## 3. Decision — Option A: lock the entry point

**Revoke `EXECUTE` on `finalize_workout` from `public`, `anon`, and `authenticated`; grant it only to
`service_role`.** The cell-accepting endpoint is therefore **not reachable by any browser/PostgREST
client**. It can be invoked only by a holder of the service-role key — i.e. the Next.js server action,
which runs server-side and whose key never ships in the browser bundle.

Identity is still established **before** privilege escalation and passed explicitly:

1. The server action (`features/running/actions/stop.ts`) calls `getUser()` on the **user-scoped**
   client — validating the JWT server-side, not trusting a client claim.
2. A preflight `SELECT` on the user-scoped client confirms the workout is visible under RLS (owner-scoped).
3. The action switches to the **service-role** client (`infrastructure/supabase/service-role.ts`) solely
   to (a) read `route_points`, (b) call the RPC.
4. The verified uid is passed as `p_user_id`. The RPC uses `p_user_id` instead of `auth.uid()`
   because `auth.uid()` is null for a service-role call, and re-checks `workouts.user_id = p_user_id`
   as defence in depth.

So ownership is enforced at three layers: RLS preflight, server-side `getUser()`, and the RPC's
`p_user_id` check — and the dangerous endpoint is simply not exposed to clients.

## 4. Options rejected

- **Option B — compute cells inside the RPC (install `h3-pg`).** Restores a clean trust boundary by
  deriving cells from the stored path in SQL, so no cell array crosses the wire. **Rejected:** reverses
  the approved R-07 TS-side decision, adds a Postgres extension dependency and an H3-in-SQL surface to
  maintain, and duplicates the TS projection logic (two H3 implementations to keep in parity). Larger
  change than the security goal requires (MVP refactoring rule).
- **Option C — in-RPC plausibility check** of supplied cells against the path. **Rejected:** unreliable
  without H3 in SQL, and is exactly the anti-cheat scope-creep R-08 warns against. It mitigates nothing
  that Option A doesn't fully close.

## 5. Consequences

- **Trust boundary:** `finalize_workout` is a privileged, server-only operation. The browser can never
  call it. The board can only change through a server action that has already verified identity.
- **`service_role` key is now load-bearing** for territory writes. It must remain a server-only secret
  (`SUPABASE_SERVICE_ROLE_KEY`, no `NEXT_PUBLIC_` prefix). `service-role.ts` must never be imported by
  any client component or any module reachable from the browser bundle.
- **No new RLS write policies** on `territory_captures` / `cell_ownership` — they stay write-closed to
  clients; the RPC (which bypasses RLS as `SECURITY DEFINER`) is the only writer (NFR-Sec-2).
- **Contract change:** the RPC signature gains `p_cell_ids text[]` and `p_user_id uuid` (v2). The v1
  `(uuid)` overload is dropped so the old `authenticated` grant cannot be exploited.

## 6. Implementation & verification references

| Concern | Location |
|---|---|
| Grant change + v2 signature + v1 drop | `supabase/migrations/20260604121656_finalize_rpc_v2.sql` |
| Service-role client (server-only) | `infrastructure/supabase/service-role.ts` |
| Identity → service-role → RPC flow | `features/running/actions/stop.ts` |
| RPC wrapper (cells + userId) | `features/running/services/finalize.ts` |
| Automated boundary proof | `tests/integration/security/rls.test.ts` → "RPC trust boundary: finalize_workout EXECUTE" |

**Live verification (2026-06-04):** owner `postgres`, `SECURITY DEFINER`, `search_path=''`;
`has_function_privilege` → `service_role` = true, `authenticated` = false, `anon` = false; `proacl`
contains no `PUBLIC` entry. Option A is enforced on the live database.
