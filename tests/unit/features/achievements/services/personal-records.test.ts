import type { Tables } from '@/infrastructure/supabase/database.types';
import { getPersonalRecords, getBestRecord } from '@/features/achievements/services/achievements'

describe('personal records service', () => {
  it('ignores incomplete or invalid workouts', () => {
    const workouts = [
      { id: 'w1', status: 'recording', distance_m: 5000, avg_pace_s_per_km: 300, started_at: '2026-06-01T08:00:00Z', created_at: '', updated_at: '', user_id: '', duration_s: 0, elevation_gain_m: null, ended_at: null, path: null, source: '', xp_awarded: null },
      { id: 'w2', status: 'completed', distance_m: null, avg_pace_s_per_km: 300, started_at: '2026-06-02T08:00:00Z', created_at: '', updated_at: '', user_id: '', duration_s: 0, elevation_gain_m: null, ended_at: null, path: null, source: '', xp_awarded: null },
      { id: 'w3', status: 'completed', distance_m: 5000, avg_pace_s_per_km: null, started_at: '2026-06-03T08:00:00Z', created_at: '', updated_at: '', user_id: '', duration_s: 0, elevation_gain_m: null, ended_at: null, path: null, source: '', xp_awarded: null }
    ] as Tables<'workouts'>[]
    const records = getPersonalRecords(workouts, [])
    expect(records).toHaveLength(0)
  })

  it('allows a single workout to own multiple records', () => {
    const workouts = [
      { id: 'w1', status: 'completed', distance_m: 12000, avg_pace_s_per_km: 240, xp_awarded: 100, started_at: '2026-06-01T08:00:00Z', created_at: '', updated_at: '', user_id: '', duration_s: 0, elevation_gain_m: null, ended_at: null, path: null, source: '' }
    ] as Tables<'workouts'>[]
    const captures = [
      { id: 'c1', workout_id: 'w1', cell_id: 'cell1', action: 'claim', captured_at: '', user_id: '' },
      { id: 'c2', workout_id: 'w1', cell_id: 'cell2', action: 'steal', captured_at: '', user_id: '' }
    ] as Tables<'territory_captures'>[]

    const records = getPersonalRecords(workouts, captures)
    
    expect(records).toHaveLength(8)
    
    const recordIds = records.map(r => r.id)
    expect(recordIds).toContain('fastest-1k')
    expect(recordIds).toContain('fastest-5k')
    expect(recordIds).toContain('fastest-10k')
    expect(recordIds).toContain('longest-run')
    expect(recordIds).toContain('most-xp-workout')
    expect(recordIds).toContain('most-territory-workout')
    expect(recordIds).toContain('most-efficient-run')
    expect(recordIds).toContain('territory-efficiency')

    records.forEach(r => {
      expect(r.workoutId).toBe('w1')
    })
  })

  it('uses earliest workout when personal record values are tied', () => {
    const workouts = [
      { id: 'w1', status: 'completed', distance_m: 5000, avg_pace_s_per_km: 300, started_at: '2026-06-01T08:00:00Z', created_at: '', updated_at: '', user_id: '', duration_s: 0, elevation_gain_m: null, ended_at: null, path: null, source: '', xp_awarded: null },
      { id: 'w2', status: 'completed', distance_m: 5000, avg_pace_s_per_km: 300, started_at: '2026-06-02T08:00:00Z', created_at: '', updated_at: '', user_id: '', duration_s: 0, elevation_gain_m: null, ended_at: null, path: null, source: '', xp_awarded: null }
    ] as Tables<'workouts'>[]

    const records = getPersonalRecords(workouts, [])
    const f5k = records.find(r => r.id === 'fastest-5k')!
    expect(f5k.workoutId).toBe('w1')
  })

  it('uses earliest workout on tied fastest records', () => {
    const workouts = [
      { id: 'w1', status: 'completed', distance_m: 1000, avg_pace_s_per_km: 240, started_at: '2026-06-01T08:00:00Z', created_at: '', updated_at: '', user_id: '', duration_s: 0, elevation_gain_m: null, ended_at: null, path: null, source: '', xp_awarded: null },
      { id: 'w2', status: 'completed', distance_m: 1000, avg_pace_s_per_km: 240, started_at: '2026-06-02T08:00:00Z', created_at: '', updated_at: '', user_id: '', duration_s: 0, elevation_gain_m: null, ended_at: null, path: null, source: '', xp_awarded: null }
    ] as Tables<'workouts'>[]
    const records = getPersonalRecords(workouts)
    const f1k = records.find(r => r.id === 'fastest-1k')!
    expect(f1k.workoutId).toBe('w1')
  })

  it('uses earliest workout on tied efficient runs', () => {
    const workouts = [
      { id: 'w1', status: 'completed', distance_m: 1000, avg_pace_s_per_km: 240, xp_awarded: 50, started_at: '2026-06-01T08:00:00Z', created_at: '', updated_at: '', user_id: '', duration_s: 0, elevation_gain_m: null, ended_at: null, path: null, source: '' },
      { id: 'w2', status: 'completed', distance_m: 1000, avg_pace_s_per_km: 240, xp_awarded: 50, started_at: '2026-06-02T08:00:00Z', created_at: '', updated_at: '', user_id: '', duration_s: 0, elevation_gain_m: null, ended_at: null, path: null, source: '' }
    ] as Tables<'workouts'>[]
    const records = getPersonalRecords(workouts)
    const fEff = records.find(r => r.id === 'most-efficient-run')!
    expect(fEff.workoutId).toBe('w1')
  })

  it('calculates most efficient run correctly', () => {
    const workouts = [
      { id: 'w1', status: 'completed', distance_m: 2000, avg_pace_s_per_km: 300, xp_awarded: 100, started_at: '2026-06-01T08:00:00Z', created_at: '', updated_at: '', user_id: '', duration_s: 0, elevation_gain_m: null, ended_at: null, path: null, source: '' },
      { id: 'w2', status: 'completed', distance_m: 3000, avg_pace_s_per_km: 300, xp_awarded: 120, started_at: '2026-06-02T08:00:00Z', created_at: '', updated_at: '', user_id: '', duration_s: 0, elevation_gain_m: null, ended_at: null, path: null, source: '' }
    ] as Tables<'workouts'>[]

    const records = getPersonalRecords(workouts, [])
    const eff = records.find(r => r.id === 'most-efficient-run')!
    expect(eff.value).toBe(50)
    expect(eff.workoutId).toBe('w1')
  })

  it('calculates territory efficiency correctly', () => {
    const workouts = [
      { id: 'w1', status: 'completed', distance_m: 2000, avg_pace_s_per_km: 300, started_at: '2026-06-01T08:00:00Z', created_at: '', updated_at: '', user_id: '', duration_s: 0, elevation_gain_m: null, ended_at: null, path: null, source: '', xp_awarded: null },
      { id: 'w2', status: 'completed', distance_m: 1000, avg_pace_s_per_km: 300, started_at: '2026-06-02T08:00:00Z', created_at: '', updated_at: '', user_id: '', duration_s: 0, elevation_gain_m: null, ended_at: null, path: null, source: '', xp_awarded: null }
    ] as Tables<'workouts'>[]
    const captures = [
      { id: 'c1', workout_id: 'w1', cell_id: 'cell1', action: 'claim', captured_at: '', user_id: '' },
      { id: 'c2', workout_id: 'w1', cell_id: 'cell2', action: 'claim', captured_at: '', user_id: '' },
      { id: 'c3', workout_id: 'w1', cell_id: 'cell3', action: 'steal', captured_at: '', user_id: '' },
      { id: 'c4', workout_id: 'w1', cell_id: 'cell4', action: 'defend', captured_at: '', user_id: '' },
      { id: 'c5', workout_id: 'w2', cell_id: 'cell5', action: 'claim', captured_at: '', user_id: '' }
    ] as Tables<'territory_captures'>[]

    const records = getPersonalRecords(workouts, captures)
    const eff = records.find(r => r.id === 'territory-efficiency')!
    expect(eff.value).toBe(1.5)
    expect(eff.workoutId).toBe('w1')
  })

  it('uses claimed + stolen for territory record calculations and ignores defend', () => {
    const workouts = [
      { id: 'w1', status: 'completed', distance_m: 2000, avg_pace_s_per_km: 300, started_at: '2026-06-01T08:00:00Z', created_at: '', updated_at: '', user_id: '', duration_s: 0, elevation_gain_m: null, ended_at: null, path: null, source: '', xp_awarded: null }
    ] as Tables<'workouts'>[]
    const captures = [
      { id: 'c1', workout_id: 'w1', cell_id: 'cell1', action: 'claim', captured_at: '', user_id: '' },
      { id: 'c2', workout_id: 'w1', cell_id: 'cell2', action: 'steal', captured_at: '', user_id: '' },
      { id: 'c3', workout_id: 'w1', cell_id: 'cell3', action: 'defend', captured_at: '', user_id: '' }
    ] as Tables<'territory_captures'>[]

    const records = getPersonalRecords(workouts, captures)
    const terr = records.find(r => r.id === 'most-territory-workout')!
    expect(terr.value).toBe(2)
  })

  describe('getBestRecord', () => {
    it('shows current best record based on priority list', () => {
      const records = [
        { id: 'fastest-1k', title: 'Fastest 1K', value: 240, workoutId: 'w1' },
        { id: 'fastest-5k', title: 'Fastest 5K', value: 1200, workoutId: 'w1' },
        { id: 'longest-run', title: 'Longest Run', value: 6000, workoutId: 'w1' }
      ]

      const best = getBestRecord(records)!
      expect(best.id).toBe('fastest-5k')
    })
  })
})
