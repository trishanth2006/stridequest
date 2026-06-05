import type { Tables } from '@/infrastructure/supabase/database.types';
import type { Achievement, AchievementCategory, PersonalRecord } from '../types';

// Future achievements:
// streaks
// distance milestones
// territory domination
// seasonal events
// leaderboard placement

export function getAchievements(
  workouts: Tables<'workouts'>[],
  territoryCaptures: Tables<'territory_captures'>[] = [],
  totalXp: number = 0,
  level: number = 1,
  xpEvents: Tables<'xp_events'>[] = []
): Achievement[] {
  const completedWorkouts = workouts
    .filter(w => w.status === 'completed')
    .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
  
  const sortedCaptures = [...territoryCaptures]
    .sort((a, b) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime());

  const workoutCount = completedWorkouts.length;
  const cumulativeDistance = completedWorkouts.reduce((sum, w) => sum + (w.distance_m || 0), 0);
  const captureCount = territoryCaptures.length;
  
  const achievementsList: Omit<Achievement, 'unlocked' | 'unlockedAt'>[] = [
    {
      id: 'first-run',
      title: 'First Run',
      description: 'Complete your first workout',
      icon: '🏃',
      progress: workoutCount,
      target: 1,
      category: 'running'
    },
    {
      id: 'runner',
      title: 'Runner',
      description: 'Complete 10 workouts',
      icon: '🔥',
      progress: workoutCount,
      target: 10,
      category: 'running'
    },
    {
      id: 'marathoner',
      title: 'Marathoner',
      description: 'Run 42 km cumulative distance',
      icon: '🏅',
      progress: cumulativeDistance,
      target: 42000,
      category: 'running'
    },
    {
      id: 'distance-beast',
      title: 'Distance Beast',
      description: 'Run 100 km cumulative distance',
      icon: '💯',
      progress: cumulativeDistance,
      target: 100000,
      category: 'running'
    },
    {
      id: 'first-territory',
      title: 'First Territory',
      description: 'Capture your first territory cell',
      icon: '🌍',
      progress: captureCount,
      target: 1,
      category: 'territory'
    },
    {
      id: 'explorer',
      title: 'Explorer',
      description: 'Capture 50 territory cells',
      icon: '🗺️',
      progress: captureCount,
      target: 50,
      category: 'territory'
    },
    {
      id: 'xp-hunter',
      title: 'XP Hunter',
      description: 'Earn 100 XP cumulative',
      icon: '⭐',
      progress: totalXp,
      target: 100,
      category: 'xp'
    },
    {
      id: 'xp-master',
      title: 'XP Master',
      description: 'Earn 500 XP cumulative',
      icon: '⚡',
      progress: totalXp,
      target: 500,
      category: 'xp'
    },
    {
      id: 'rising-star',
      title: 'Rising Star',
      description: 'Reach Level 3',
      icon: '🚀',
      progress: level,
      target: 3,
      category: 'xp'
    },
    {
      id: 'elite-runner',
      title: 'Elite Runner',
      description: 'Reach Level 5',
      icon: '👑',
      progress: level,
      target: 5,
      category: 'xp'
    }
  ];

  return achievementsList.map(item => {
    const unlocked = item.progress >= item.target;
    let unlockedAt: string | undefined = undefined;

    if (unlocked) {
      if (item.id === 'first-run' && completedWorkouts[0]) {
        unlockedAt = completedWorkouts[0].started_at;
      } else if (item.id === 'runner' && completedWorkouts[9]) {
        unlockedAt = completedWorkouts[9].started_at;
      } else if (item.id === 'marathoner') {
        unlockedAt = getDistanceMilestoneDate(completedWorkouts, 42000);
      } else if (item.id === 'distance-beast') {
        unlockedAt = getDistanceMilestoneDate(completedWorkouts, 100000);
      } else if (item.id === 'first-territory' && sortedCaptures[0]) {
        unlockedAt = sortedCaptures[0].captured_at;
      } else if (item.id === 'explorer' && sortedCaptures[49]) {
        unlockedAt = sortedCaptures[49].captured_at;
      } else if (item.id === 'xp-hunter') {
        unlockedAt = getXpMilestoneDate(xpEvents, completedWorkouts, 100);
      } else if (item.id === 'xp-master') {
        unlockedAt = getXpMilestoneDate(xpEvents, completedWorkouts, 500);
      } else if (item.id === 'rising-star') {
        unlockedAt = getXpMilestoneDate(xpEvents, completedWorkouts, 250);
      } else if (item.id === 'elite-runner') {
        unlockedAt = getXpMilestoneDate(xpEvents, completedWorkouts, 1000);
      }
    }

    return {
      ...item,
      unlocked,
      unlockedAt
    };
  });
}

function getDistanceMilestoneDate(workouts: Tables<'workouts'>[], threshold: number): string | undefined {
  let cumulative = 0;
  for (const w of workouts) {
    cumulative += w.distance_m || 0;
    if (cumulative >= threshold) {
      return w.started_at;
    }
  }
  return undefined;
}

function getXpMilestoneDate(xpEvents: Tables<'xp_events'>[], workouts: Tables<'workouts'>[], threshold: number): string | undefined {
  if (xpEvents && xpEvents.length > 0) {
    const sortedEvents = [...xpEvents].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    let cumulative = 0;
    for (const event of sortedEvents) {
      cumulative += event.xp_awarded || 0;
      if (cumulative >= threshold) {
        return event.created_at;
      }
    }
  }
  
  let cumulative = 0;
  for (const w of workouts) {
    cumulative += w.xp_awarded || 0;
    if (cumulative >= threshold) {
      return w.started_at;
    }
  }
  return undefined;
}

export function sortAchievements(achievements: Achievement[]): Achievement[] {
  return [...achievements].sort((a, b) => {
    if (a.unlocked && !b.unlocked) return -1;
    if (!a.unlocked && b.unlocked) return 1;
    
    // Sort by completion percentage (highest first)
    const pctA = a.target > 0 ? (a.progress / a.target) : 0;
    const pctB = b.target > 0 ? (b.progress / b.target) : 0;
    if (pctB !== pctA) {
      return pctB - pctA;
    }
    
    // Fallback deterministic order
    return a.id.localeCompare(b.id);
  });
}

export function groupAchievementsByCategory(achievements: Achievement[]): Record<AchievementCategory, Achievement[]> {
  const result: Record<AchievementCategory, Achievement[]> = {
    running: [],
    territory: [],
    xp: []
  };
  for (const ach of achievements) {
    result[ach.category].push(ach);
  }
  return result;
}

export function getCategorySummaries(achievements: Achievement[]): Record<AchievementCategory, { unlocked: number; total: number }> {
  const result: Record<AchievementCategory, { unlocked: number; total: number }> = {
    running: { unlocked: 0, total: 0 },
    territory: { unlocked: 0, total: 0 },
    xp: { unlocked: 0, total: 0 }
  };
  for (const ach of achievements) {
    result[ach.category].total += 1;
    if (ach.unlocked) {
      result[ach.category].unlocked += 1;
    }
  }
  return result;
}

export function getClosestAchievement(achievements: Achievement[]): { achievement: Achievement; remaining: number } | undefined {
  const locked = achievements.filter(a => !a.unlocked);
  if (locked.length === 0) return undefined;
  
  let best: Achievement = locked[0];
  let bestPct = locked[0].target > 0 ? (locked[0].progress / locked[0].target) : 0;
  
  for (let i = 1; i < locked.length; i++) {
    const pct = locked[i].target > 0 ? (locked[i].progress / locked[i].target) : 0;
    if (pct > bestPct) {
      best = locked[i];
      bestPct = pct;
    } else if (pct === bestPct) {
      const remCurrent = locked[i].target - locked[i].progress;
      const remBest = best.target - best.progress;
      if (remCurrent < remBest) {
        best = locked[i];
        bestPct = pct;
      } else if (remCurrent === remBest) {
        if (locked[i].id.localeCompare(best.id) < 0) {
          best = locked[i];
        }
      }
    }
  }
  
  return {
    achievement: best,
    remaining: Math.max(0, best.target - best.progress)
  };
}

export function getAchievementSummary(achievements: Achievement[]): {
  unlocked: number;
  total: number;
  percentage: number;
  closestAchievement?: Achievement & { remaining: number };
} {
  const total = achievements.length;
  const unlocked = achievements.filter(a => a.unlocked).length;
  const percentage = total > 0 ? Math.round((unlocked / total) * 100) : 0;
  
  const closest = getClosestAchievement(achievements);
  
  return {
    unlocked,
    total,
    percentage,
    closestAchievement: closest ? { ...closest.achievement, remaining: closest.remaining } : undefined
  };
}

export function getPersonalRecords(
  workouts: Tables<'workouts'>[],
  territoryCaptures: Tables<'territory_captures'>[] = []
): PersonalRecord[] {
  const validWorkouts = workouts.filter(w => 
    w.status === 'completed' && 
    w.distance_m != null && 
    w.avg_pace_s_per_km != null
  );
  
  if (validWorkouts.length === 0) return [];
  
  const capturesByWorkout: Record<string, number> = {};
  for (const cap of territoryCaptures) {
    if (cap.action === 'claim' || cap.action === 'steal') {
      capturesByWorkout[cap.workout_id] = (capturesByWorkout[cap.workout_id] || 0) + 1;
    }
  }

  let best1k: { value: number; workout: Tables<'workouts'> } | null = null;
  let best5k: { value: number; workout: Tables<'workouts'> } | null = null;
  let best10k: { value: number; workout: Tables<'workouts'> } | null = null;
  let longest: { value: number; workout: Tables<'workouts'> } | null = null;
  let mostXp: { value: number; workout: Tables<'workouts'> } | null = null;
  let mostTerritory: { value: number; workout: Tables<'workouts'> } | null = null;
  let mostEfficient: { value: number; workout: Tables<'workouts'> } | null = null;
  let territoryEff: { value: number; workout: Tables<'workouts'> } | null = null;

  const isEarlier = (a: Tables<'workouts'>, b: Tables<'workouts'>) => {
    return new Date(a.started_at).getTime() < new Date(b.started_at).getTime();
  };

  for (const w of validWorkouts) {
    const dist = w.distance_m!;
    const pace = w.avg_pace_s_per_km!;
    const xp = w.xp_awarded || 0;
    const captures = capturesByWorkout[w.id] || 0;
    const distKm = dist / 1000;

    // Fastest 1K (distance >= 1000m)
    if (dist >= 1000) {
      const time1k = pace * 1;
      if (!best1k || time1k < best1k.value || (time1k === best1k.value && isEarlier(w, best1k.workout))) {
        best1k = { value: time1k, workout: w };
      }
    }

    // Fastest 5K (distance >= 5000m)
    if (dist >= 5000) {
      const time5k = pace * 5;
      if (!best5k || time5k < best5k.value || (time5k === best5k.value && isEarlier(w, best5k.workout))) {
        best5k = { value: time5k, workout: w };
      }
    }

    // Fastest 10K (distance >= 10000m)
    if (dist >= 10000) {
      const time10k = pace * 10;
      if (!best10k || time10k < best10k.value || (time10k === best10k.value && isEarlier(w, best10k.workout))) {
        best10k = { value: time10k, workout: w };
      }
    }

    // Longest Run
    if (!longest || dist > longest.value || (dist === longest.value && isEarlier(w, longest.workout))) {
      longest = { value: dist, workout: w };
    }

    // Most XP Workout
    if (!mostXp || xp > mostXp.value || (xp === mostXp.value && isEarlier(w, mostXp.workout))) {
      mostXp = { value: xp, workout: w };
    }

    // Most Territory Workout
    if (!mostTerritory || captures > mostTerritory.value || (captures === mostTerritory.value && isEarlier(w, mostTerritory.workout))) {
      mostTerritory = { value: captures, workout: w };
    }

    // Most Efficient Run (distance > 0)
    if (dist > 0) {
      const eff = xp / distKm;
      if (!mostEfficient || eff > mostEfficient.value || (eff === mostEfficient.value && isEarlier(w, mostEfficient.workout))) {
        mostEfficient = { value: eff, workout: w };
      }
    }

    // Territory Efficiency (distance > 0)
    if (dist > 0) {
      const effT = captures / distKm;
      if (!territoryEff || effT > territoryEff.value || (effT === territoryEff.value && isEarlier(w, territoryEff.workout))) {
        territoryEff = { value: effT, workout: w };
      }
    }
  }

  const records: PersonalRecord[] = [];

  const addRecord = (id: string, title: string, best: { value: number; workout: Tables<'workouts'> } | null) => {
    if (best) {
      records.push({
        id,
        title,
        value: best.value,
        workoutId: best.workout.id,
        achievedAt: best.workout.started_at,
        workoutDistanceM: best.workout.distance_m || undefined,
        workoutXp: best.workout.xp_awarded || undefined
      });
    }
  };

  addRecord('fastest-1k', 'Fastest 1K', best1k);
  addRecord('fastest-5k', 'Fastest 5K', best5k);
  addRecord('fastest-10k', 'Fastest 10K', best10k);
  addRecord('longest-run', 'Longest Run', longest);
  addRecord('most-xp-workout', 'Most XP Workout', mostXp);
  addRecord('most-territory-workout', 'Most Territory Workout', mostTerritory);
  addRecord('most-efficient-run', 'Most Efficient Run', mostEfficient);
  addRecord('territory-efficiency', 'Territory Efficiency', territoryEff);

  return records;
}

export function getBestRecord(records: PersonalRecord[]): PersonalRecord | undefined {
  const priority = [
    'fastest-10k',
    'fastest-5k',
    'fastest-1k',
    'longest-run',
    'most-xp-workout',
    'most-territory-workout',
    'most-efficient-run',
    'territory-efficiency'
  ];
  for (const id of priority) {
    const rec = records.find(r => r.id === id);
    if (rec) return rec;
  }
  return undefined;
}
