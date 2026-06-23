# TECH-DEBT-MAP-001: Heatmap Full-Scan Performance

**Status:** Open  
**Severity:** Medium (correctness over performance; no data loss)  
**Source file:** `apps/mobile/src/features/maps/services/heatmap.ts`

## Issue

`getUserHeatmap()` fetches all `territory_captures` rows for the current user with no time or row-count limit, then aggregates them in-memory. As capture history grows (long-term users, high-frequency captures), this query will degrade.

The heatmap service on web (`features/territory/services/heatmap.ts`) has the same scan pattern.

## Impact

- Query latency grows linearly with total lifetime captures per user.
- No data is lost or truncated — correctness is maintained at the cost of speed.
- Current MVP user base: negligible impact. Risk horizon: >10,000 captures per user.

## Acceptance Criteria for Resolution

- Create a `user_heatmap` Postgres view or materialized view that pre-aggregates `count(*)` per `(user_id, cell_id)`.
- Alternatively, expose a `get_user_heatmap(user_id)` RPC that returns the aggregated rows directly.
- Both mobile (`getUserHeatmap`) and web heatmap services should be updated to use the new endpoint.
- No arbitrary row limits should be introduced — the fix must preserve complete data.

## Target Sprint

Sprint 5 (post-stabilization, once RPC/view infrastructure for territory is established).

## Related

- `TECH-DEBT-ACH-001` (inline comment in `apps/mobile/src/features/achievements/services/achievements.ts`) — same scan pattern for achievement aggregation.
