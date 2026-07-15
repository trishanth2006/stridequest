import * as Location from 'expo-location';

export async function requestAbsoluteLocationPermissions(): Promise<boolean> {
  // 1. First request foreground status
  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
  if (foregroundStatus !== 'granted') {
    console.warn("Foreground location permission denied.");
    return false;
  }

  // 2. ONLY after foreground is granted, request background status
  const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
  if (backgroundStatus !== 'granted') {
    console.warn("Background location permission denied. Tracking will stop when phone locks.");
    return false;
  }

  return true;
}
