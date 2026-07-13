import distance from '@turf/distance';
import { point } from '@turf/helpers';
import type { GpsSample } from '@stridequest/shared/running';

export interface BestEffortResult {
  distanceLabel: string;
  targetMeters: number;
  timeMs: number;
  isPR: boolean;
}

const TARGET_DISTANCES = [
  { label: '400m', meters: 400 },
  { label: '1k', meters: 1000 },
  { label: '1mi', meters: 1609.34 },
  { label: '5k', meters: 5000 },
];

export const calculateBestEfforts = (samples: GpsSample[]): BestEffortResult[] => {
  if (samples.length < 2) return [];

  const n = samples.length;
  const cumDist = new Float64Array(n);
  const cumTime = new Float64Array(n);

  cumDist[0] = 0;
  const startTime = samples[0].recordedAt;
  cumTime[0] = 0;

  for (let i = 1; i < n; i++) {
    const p1 = point([samples[i - 1].lng, samples[i - 1].lat]);
    const p2 = point([samples[i].lng, samples[i].lat]);
    
    const d = distance(p1, p2, { units: 'meters' });
    cumDist[i] = cumDist[i - 1] + d;
    cumTime[i] = samples[i].recordedAt - startTime;
  }

  const results: BestEffortResult[] = [];

  for (const target of TARGET_DISTANCES) {
    if (cumDist[n - 1] < target.meters) continue;

    let minTimeForTarget = Infinity;
    let start = 0;

    for (let end = 1; end < n; end++) {
      while (start < end && cumDist[end] - cumDist[start + 1] >= target.meters) {
        start++;
      }

      const distWindow = cumDist[end] - cumDist[start];
      
      if (distWindow >= target.meters) {
        const excessDistance = distWindow - target.meters;
        
        const startSegmentDist = cumDist[start + 1] - cumDist[start];
        const startSegmentTime = cumTime[start + 1] - cumTime[start];
        
        let timeReduction = 0;
        if (startSegmentDist > 0) {
           const fraction = Math.min(1, excessDistance / startSegmentDist);
           timeReduction = startSegmentTime * fraction;
        }

        const exactTime = (cumTime[end] - cumTime[start]) - timeReduction;
        if (exactTime < minTimeForTarget) {
          minTimeForTarget = exactTime;
        }
      }
    }

    if (minTimeForTarget !== Infinity) {
      results.push({
        distanceLabel: target.label,
        targetMeters: target.meters,
        timeMs: minTimeForTarget,
        isPR: true, // Mocked for Pro UI showcase
      });
    }
  }

  return results;
};
