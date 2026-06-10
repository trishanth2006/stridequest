import type { WorkoutRoutePoint } from '../types/workout-detail'

export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // meters
  const rLat1 = lat1 * Math.PI / 180;
  const rLat2 = lat2 * Math.PI / 180;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(rLat1) * Math.cos(rLat2) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export type Split = {
  splitIndex: number;
  label: string;
  distanceMeters: number;
  durationSeconds: number;
  paceSecondsPerKm: number;
}

export function calculateSplits(routePoints: WorkoutRoutePoint[]): Split[] {
  if (!routePoints || routePoints.length < 2) return []

  const splits: Split[] = []
  let currentSplitIndex = 1
  let currentSplitDistance = 0
  let currentSplitStartTime = new Date(routePoints[0].timestamp).getTime()
  
  let totalDistance = 0

  for (let i = 1; i < routePoints.length; i++) {
    const prev = routePoints[i - 1]
    const curr = routePoints[i]

    const distMeters = haversineDistance(prev.lat, prev.lng, curr.lat, curr.lng)
    currentSplitDistance += distMeters
    totalDistance += distMeters

    // Have we completed a kilometer?
    if (currentSplitDistance >= 1000) {
      // Find exact interpolation for exactly 1000m (simplification: just take current time)
      const currTime = new Date(curr.timestamp).getTime()
      const durationSeconds = (currTime - currentSplitStartTime) / 1000
      
      // If we overshot 1000m slightly, we calculate pace for exactly 1000m
      // and carry over the remainder to the next split.
      // For simplicity in this UI, we'll just treat the segment duration as the pace for this ~1000m
      const exactDurationFor1km = durationSeconds * (1000 / currentSplitDistance)

      splits.push({
        splitIndex: currentSplitIndex,
        label: currentSplitIndex.toString(),
        distanceMeters: 1000,
        durationSeconds: exactDurationFor1km,
        paceSecondsPerKm: exactDurationFor1km
      })

      // Carry over
      const remainderDist = currentSplitDistance - 1000
      const remainderTime = durationSeconds - exactDurationFor1km

      currentSplitIndex++
      currentSplitDistance = remainderDist
      // Reset start time conceptually
      currentSplitStartTime = currTime - (remainderTime * 1000)
    }
  }

  // Handle final partial split
  if (currentSplitDistance > 0) {
    const currTime = new Date(routePoints[routePoints.length - 1].timestamp).getTime()
    const durationSeconds = (currTime - currentSplitStartTime) / 1000
    
    // Convert currentSplitDistance to a fraction (e.g. 0.45)
    const fractionLabel = (currentSplitDistance / 1000).toFixed(2).replace(/^0+/, '')
    
    let pace = 0
    if (currentSplitDistance > 0) {
      pace = durationSeconds * (1000 / currentSplitDistance)
    }

    splits.push({
      splitIndex: currentSplitIndex,
      label: fractionLabel,
      distanceMeters: currentSplitDistance,
      durationSeconds: durationSeconds,
      paceSecondsPerKm: pace
    })
  }

  return splits
}
