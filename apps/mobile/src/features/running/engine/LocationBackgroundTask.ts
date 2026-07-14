import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';

export const BACKGROUND_TRACKING_TASK = 'STRIDEQUEST_BACKGROUND_TRACKING';

TaskManager.defineTask(BACKGROUND_TRACKING_TASK, async ({ data, error }) => {
  if (error) {
    console.error("Background Location Engine Error:", error);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    // Process locations, update local Room database, or stream to storage engine
    console.log("Background coordinates captured:", locations[0].coords.latitude);
  }
});

export async function startTrackingService() {
  await Location.startLocationUpdatesAsync(BACKGROUND_TRACKING_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 1000, // 1Hz tracking resolution
    distanceInterval: 1, // Capture update every 1 meter delta
    foregroundService: {
      notificationTitle: "StrideQuest Run Live",
      notificationBody: "Tracking your active pace and route data...",
      notificationColor: "#000000",
    },
  });
}

export async function stopTrackingService() {
  // pause() and stop() both call this; a second stop (or a stop after a
  // permission-denied start) throws TaskNotFoundException without the guard.
  const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TRACKING_TASK);
  if (!isRunning) return;
  await Location.stopLocationUpdatesAsync(BACKGROUND_TRACKING_TASK);
}
