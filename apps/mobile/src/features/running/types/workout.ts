export type WorkoutType = 'QUICK_RUN' | 'EASY' | 'LONG' | 'INTERVAL';

export interface IntervalBlock {
  repeatCount: number;
  workDistance: number; // in meters
  workPace: number; // in seconds per kilometer
  restDistance?: number; // in meters
  restDuration?: number; // in seconds
}

export interface WorkoutTarget {
  id: string;
  name: string;
  type: WorkoutType;
  description?: string;
  distanceTarget?: number; // in meters
  durationTarget?: number; // in seconds
  targetPace?: number; // in seconds per kilometer
  paceTolerance?: number; // in seconds (+/-)
  intervals?: IntervalBlock[];
}
