import { haversineMeters } from '@stridequest/shared/running';
import type { GpsSample } from '@stridequest/shared/running';

export interface LapData {
  lapNumber: number;
  timeMs: number;
  distanceMeters: number;
  averageSpeedMps: number;
  isBestLap: boolean;
}

export function analyzeLaps(samples: GpsSample[], lapTimestamps: number[]): LapData[] {
  if (!lapTimestamps || lapTimestamps.length === 0 || !samples || samples.length === 0) {
    return [];
  }

  const laps: LapData[] = [];
  let sampleIndex = 0;
  let bestLapIndex = -1;
  let bestPaceSpeedMps = -1;

  for (let i = 0; i < lapTimestamps.length; i++) {
    const lapEndTimestamp = lapTimestamps[i];
    
    const lapSamples: GpsSample[] = [];
    while (sampleIndex < samples.length && samples[sampleIndex].recordedAt <= lapEndTimestamp) {
      lapSamples.push(samples[sampleIndex]);
      sampleIndex++;
    }

    if (lapSamples.length < 2) continue;

    const startTime = lapSamples[0].recordedAt;
    const endTime = lapSamples[lapSamples.length - 1].recordedAt;
    const timeMs = endTime - startTime;

    let distanceMeters = 0;
    for (let j = 1; j < lapSamples.length; j++) {
      distanceMeters += haversineMeters(lapSamples[j - 1], lapSamples[j]);
    }

    const averageSpeedMps = timeMs > 0 ? distanceMeters / (timeMs / 1000) : 0;

    laps.push({
      lapNumber: i + 1,
      timeMs,
      distanceMeters,
      averageSpeedMps,
      isBestLap: false,
    });

    if (averageSpeedMps > bestPaceSpeedMps) {
      bestPaceSpeedMps = averageSpeedMps;
      bestLapIndex = laps.length - 1;
    }
  }

  if (bestLapIndex !== -1) {
    laps[bestLapIndex].isBestLap = true;
  }

  return laps;
}
