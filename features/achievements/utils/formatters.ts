export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatDistance(meters: number): string {
  if (isNaN(meters) || meters < 0) return '0 km';
  const km = meters / 1000;
  // Format to 1 decimal place, stripping trailing .0
  return `${km.toFixed(1).replace(/\.0$/, '')} km`;
}

export function formatPercentage(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatRecordValue(recordId: string, value: number): string {
  switch (recordId) {
    case 'fastest-1k':
    case 'fastest-5k':
    case 'fastest-10k':
      return formatDuration(value);
    case 'longest-run':
      return formatDistance(value);
    case 'most-xp-workout':
      return `${Math.round(value)} XP`;
    case 'most-territory-workout':
      return `${Math.round(value)} ${Math.round(value) === 1 ? 'Territory' : 'Territories'}`;
    case 'most-efficient-run':
      return `${value.toFixed(1).replace(/\.0$/, '')} XP/km`;
    case 'territory-efficiency':
      return `${value.toFixed(1).replace(/\.0$/, '')} captures/km`;
    default:
      return value.toString();
  }
}

export function getAchievementProgress(
  progress: number,
  target: number
): { progress: number; target: number; percentage: number } {
  const safeProgress = Math.max(0, progress);
  const safeTarget = Math.max(1, target); // Prevent division by zero
  const clampedProgress = Math.min(safeProgress, safeTarget);
  const percentage = Math.min(100, Math.round((clampedProgress / safeTarget) * 100));
  
  return {
    progress: clampedProgress,
    target: safeTarget,
    percentage
  };
}
