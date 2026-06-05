export type AchievementCategory = 'running' | 'territory' | 'xp';

export type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress: number;
  target: number;
  category: AchievementCategory;
  unlockedAt?: string;
};

export type PersonalRecord = {
  id: string;
  title: string;
  value: number;
  workoutId: string;
  achievedAt?: string;
  workoutDistanceM?: number;
  workoutXp?: number;
};
