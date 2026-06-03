import {
  TERRITORY_ACTIONS,
  isTerritoryAction,
  toTerritoryCapture,
  toTerritoryOwnership,
  toCaptureSummary,
} from '@/features/territory/mappers'
import type {
  CaptureSummary,
  TerritoryCapture,
  TerritoryCaptureRow,
  TerritoryOwnership,
  CellOwnershipRow,
} from '@/features/territory/types'

// Realistic fixtures: cell_id is an H3 res-9 index string; ids are uuids; the
// timestamp columns are ISO strings (Supabase returns timestamptz as text).
const captureRow: TerritoryCaptureRow = {
  id: '6f9619ff-8b86-d011-b42d-00cf4fc964ff',
  workout_id: '110ec58a-a0f2-4ac4-8393-c866d813b8d1',
  user_id: '3f333df6-90a4-4fda-8dd3-9485d27cee36',
  cell_id: '8928308280fffff',
  action: 'claim',
  captured_at: '2026-06-03T10:00:00+00:00',
}

const ownershipRow: CellOwnershipRow = {
  cell_id: '8928308280fffff',
  owner_user_id: '3f333df6-90a4-4fda-8dd3-9485d27cee36',
  owned_since_workout_id: '110ec58a-a0f2-4ac4-8393-c866d813b8d1',
  updated_at: '2026-06-03T10:00:00+00:00',
}

describe('isTerritoryAction (action classification)', () => {
  it.each(['claim', 'steal', 'defend'])('accepts the valid action %s', (action) => {
    expect(isTerritoryAction(action)).toBe(true)
  })

  it.each(['', 'CLAIM', 'capture', 'stolen'])('rejects the invalid string %p', (value) => {
    expect(isTerritoryAction(value)).toBe(false)
  })

  it.each([null, undefined, 123, {}, ['claim']])('rejects the non-string %p', (value) => {
    expect(isTerritoryAction(value)).toBe(false)
  })

  it('TERRITORY_ACTIONS is exactly the three actions', () => {
    expect(TERRITORY_ACTIONS).toEqual(['claim', 'steal', 'defend'])
  })
})

describe('toTerritoryCapture (deserialize row -> domain)', () => {
  it('maps a snake_case row to the camelCase domain shape (type contract)', () => {
    const capture: TerritoryCapture = toTerritoryCapture(captureRow)
    expect(capture).toEqual({
      id: '6f9619ff-8b86-d011-b42d-00cf4fc964ff',
      workoutId: '110ec58a-a0f2-4ac4-8393-c866d813b8d1',
      userId: '3f333df6-90a4-4fda-8dd3-9485d27cee36',
      cellId: '8928308280fffff',
      action: 'claim',
      capturedAt: '2026-06-03T10:00:00+00:00',
    })
  })

  it('narrows action to the TerritoryAction union', () => {
    expect(toTerritoryCapture({ ...captureRow, action: 'steal' }).action).toBe('steal')
  })

  it('throws on an action outside the union (DB CHECK would prevent this)', () => {
    expect(() => toTerritoryCapture({ ...captureRow, action: 'bogus' })).toThrow(
      /territory action/i,
    )
  })
})

describe('toTerritoryOwnership (deserialize row -> domain)', () => {
  it('maps a snake_case row to the camelCase domain shape (type contract)', () => {
    const ownership: TerritoryOwnership = toTerritoryOwnership(ownershipRow)
    expect(ownership).toEqual({
      cellId: '8928308280fffff',
      ownerUserId: '3f333df6-90a4-4fda-8dd3-9485d27cee36',
      ownedSinceWorkoutId: '110ec58a-a0f2-4ac4-8393-c866d813b8d1',
      updatedAt: '2026-06-03T10:00:00+00:00',
    })
  })
})

describe('toCaptureSummary (normalize nullable finalize fields)', () => {
  it('coalesces null cell counts to zero', () => {
    const summary: CaptureSummary = toCaptureSummary({
      cellsClaimed: null,
      cellsStolen: null,
      cellsDefended: null,
    })
    expect(summary).toEqual({ cellsClaimed: 0, cellsStolen: 0, cellsDefended: 0 })
  })

  it('passes through present cell counts', () => {
    expect(
      toCaptureSummary({ cellsClaimed: 5, cellsStolen: 2, cellsDefended: 3 }),
    ).toEqual({ cellsClaimed: 5, cellsStolen: 2, cellsDefended: 3 })
  })
})
