/**
 * A grid cell identifier. Phase 02 stores this as the H3 res-9 index in its
 * string form (`cell_id text`). Kept as a named alias — not a branded type — to
 * match the project's plain-string id convention; it documents intent and gives
 * a single rename point if branding ever earns its keep.
 */
export type CellId = string

/** The three capture outcomes (FR-TC-4 / the DB CHECK on territory_captures.action). */
export type TerritoryAction = 'claim' | 'steal' | 'defend'
