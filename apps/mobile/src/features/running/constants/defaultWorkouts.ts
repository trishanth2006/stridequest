import { WorkoutTarget } from '../types/workout';

export const DEFAULT_WORKOUTS: WorkoutTarget[] = [
  {
    id: 'quick-run',
    name: 'Quick Run',
    type: 'QUICK_RUN',
    description: 'Just get out and run, no pressure or targets.',
  },
  {
    id: 'recovery-jog',
    name: 'Recovery Jog',
    type: 'EASY',
    description: 'Easy 30 minute recovery jog at a relaxed pace.',
    durationTarget: 1800, // 30 minutes
    targetPace: 360, // 6:00 min/km
    paceTolerance: 30,
  },
  {
    id: 'endurance-builder',
    name: 'Endurance Builder: 10k Tempo',
    type: 'LONG',
    description: 'Steady 10km run at your tempo pace.',
    distanceTarget: 10000,
    targetPace: 300, // 5:00 min/km
    paceTolerance: 15,
  },
  {
    id: 'speed-chaser',
    name: 'Speed Chaser: 4x800m',
    type: 'INTERVAL',
    description: '4 sets of 800m fast with 90s rest in between.',
    intervals: [
      {
        repeatCount: 4,
        workDistance: 800,
        workPace: 240, // 4:00 min/km
        restDuration: 90,
      }
    ]
  },
];
