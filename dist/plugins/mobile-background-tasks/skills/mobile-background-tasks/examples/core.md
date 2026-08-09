# Background Tasks - Core Patterns

> Complete implementations for background fetch, location tracking, and headless tasks. See [SKILL.md](../SKILL.md) for decision guidance and red flags.

**Prerequisites:** Familiarity with React Native, Expo SDK, and async JavaScript.

---

## Pattern 1: Expo Background Task (Full Lifecycle)

Complete setup with registration, status checking, and unregistration.

```typescript
// background-sync.ts -- top-level task definition
import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";

const SYNC_TASK_NAME = "BACKGROUND_SYNC_TASK";
const MIN_INTERVAL_MINUTES = 60; // 1 hour minimum

// CRITICAL: Must be top-level, not inside any component
TaskManager.defineTask(SYNC_TASK_NAME, async () => {
  try {
    const lastSyncTimestamp = await getLastSyncTimestamp();
    const updates = await fetchChangesSince(lastSyncTimestamp);

    if (updates.length === 0) {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }

    await applyUpdates(updates);
    await setLastSyncTimestamp(Date.now());
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

// Registration helper -- call from your app's initialization
async function registerBackgroundSync(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(SYNC_TASK_NAME);
  if (isRegistered) return;

  const status = await BackgroundTask.getStatusAsync();
  if (status === BackgroundTask.BackgroundTaskStatus.Restricted) {
    // Background tasks not available -- user disabled or system restricted
    return;
  }

  await BackgroundTask.registerTaskAsync(SYNC_TASK_NAME, {
    minimumInterval: MIN_INTERVAL_MINUTES,
  });
}

// Unregistration helper -- call when user disables sync
async function unregisterBackgroundSync(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(SYNC_TASK_NAME);
  if (!isRegistered) return;

  await BackgroundTask.unregisterTaskAsync(SYNC_TASK_NAME);
}

export { registerBackgroundSync, unregisterBackgroundSync };
```

**Why good:** Task defined at module scope (survives headless launch), checks registration status before registering (idempotent), checks availability before attempting registration, syncs only changes since last timestamp (minimal work), returns explicit result codes, named constants for intervals

```typescript
// BAD: Multiple anti-patterns in one example
import { useEffect } from "react";

function App() {
  useEffect(() => {
    // BAD: Task defined inside component lifecycle
    TaskManager.defineTask("sync", async () => {
      // BAD: Fetching everything instead of deltas
      const allData = await fetchAllData();
      await saveAllData(allData);
      // BAD: No return value -- OS doesn't know if task succeeded
    });

    // BAD: No registration check -- may double-register
    BackgroundTask.registerTaskAsync("sync", {
      minimumInterval: 5, // BAD: Below 15-minute minimum, will be ignored
    });
  }, []);
}
```

**Why bad:** Task defined in useEffect will not execute when app starts headlessly in background, fetching all data wastes limited execution time, no result returned means OS cannot optimize scheduling, no registration guard causes duplicate registrations, interval below 15 minutes is silently ignored by the OS

---

## Pattern 2: Bare RN Background Fetch (Full Setup)

Complete configuration with periodic tasks, one-shot tasks, and headless support.

```typescript
// background-fetch-setup.ts
import BackgroundFetch from "react-native-background-fetch";

const MIN_FETCH_INTERVAL_MINUTES = 15;
const CACHE_CLEANUP_DELAY_MS = 5000;
const CACHE_CLEANUP_TASK_ID = "com.myapp.cache-cleanup";

async function initBackgroundFetch(): Promise<number> {
  const status = await BackgroundFetch.configure(
    {
      minimumFetchInterval: MIN_FETCH_INTERVAL_MINUTES,
      stopOnTerminate: false,
      startOnBoot: true,
      enableHeadless: true,
      requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY,
      requiresBatteryNotLow: false,
      requiresCharging: false,
    },
    async (taskId) => {
      // Default fetch event -- runs periodically
      console.log("[BackgroundFetch] Task started:", taskId);

      switch (taskId) {
        case CACHE_CLEANUP_TASK_ID:
          await cleanupExpiredCache();
          break;
        default:
          // Default periodic sync
          await syncLatestData();
          break;
      }

      // CRITICAL: Must call finish when done
      BackgroundFetch.finish(taskId);
    },
    async (taskId) => {
      // Timeout callback -- OS is about to kill this task
      console.warn("[BackgroundFetch] Task timed out:", taskId);
      // Save partial progress, then finish immediately
      BackgroundFetch.finish(taskId);
    },
  );

  return status;
}

// Schedule a one-shot task
async function scheduleCacheCleanup(): Promise<void> {
  await BackgroundFetch.scheduleTask({
    taskId: CACHE_CLEANUP_TASK_ID,
    delay: CACHE_CLEANUP_DELAY_MS,
    periodic: false,
    forceAlarmManager: false,
    requiresNetworkConnectivity: false,
  });
}

export { initBackgroundFetch, scheduleCacheCleanup };
```

**Why good:** Separate handlers per taskId via switch, timeout callback saves partial progress, one-shot task scheduled separately, all Android options configured explicitly, named constants throughout

---

## Pattern 3: Android Headless JS Setup

Enables background task execution after app termination on Android. Requires both JavaScript and native configuration.

```javascript
// index.js -- app entry point
import { AppRegistry } from "react-native";
import { App } from "./App";

const APP_NAME = "MyApp";
const HEADLESS_TASK_NAME = "com.transistorsoft.fetch"; // Default ID from react-native-background-fetch

// Register the React app
AppRegistry.registerComponent(APP_NAME, () => App);

// Register headless task for Android background execution
// This runs when the app is terminated but a background fetch fires
AppRegistry.registerHeadlessTask(HEADLESS_TASK_NAME, () => async (event) => {
  const { taskId } = event;
  console.log("[HeadlessJS] Task:", taskId);

  try {
    await performLightweightSync();
  } catch (error) {
    console.error("[HeadlessJS] Failed:", error);
  }

  // Task completes when the async function resolves
  // No need to call finish() -- the promise resolution signals completion
});
```

**Key requirements for headless JS:**

1. `enableHeadless: true` in BackgroundFetch.configure()
2. `stopOnTerminate: false` to allow post-termination execution
3. `AppRegistry.registerHeadlessTask()` in index.js
4. Android native: extend `HeadlessJsTaskService` (auto-configured by react-native-background-fetch)

**Platform limitation:** Headless JS is Android-only. On iOS, force-quitting the app stops all background execution with no workaround.

---

## Pattern 4: Background Location Tracking (Expo)

Continuous location updates while the app is backgrounded. Requires "Always Allow" permission.

```typescript
// location-tracking.ts
import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";

const LOCATION_TASK_NAME = "BACKGROUND_LOCATION_TRACKING";
const DISTANCE_INTERVAL_METERS = 100;
const DEFERRED_UPDATE_INTERVAL_MS = 60000; // Batch updates every 60s

// Top-level task definition
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error("Background location error:", error.message);
    return;
  }
  if (!data) return;

  const { locations } = data as { locations: Location.LocationObject[] };

  // Process location updates (batch upload, local storage, etc.)
  await uploadLocationBatch(locations);
});

// Permission flow -- must request foreground THEN background separately
async function requestLocationPermissions(): Promise<boolean> {
  const { status: foreground } =
    await Location.requestForegroundPermissionsAsync();
  if (foreground !== "granted") return false;

  const { status: background } =
    await Location.requestBackgroundPermissionsAsync();
  if (background !== "granted") {
    // User denied "Always Allow" -- background tracking won't work
    return false;
  }

  return true;
}

async function startTracking(): Promise<void> {
  const hasPermission = await requestLocationPermissions();
  if (!hasPermission) return;

  const isTracking =
    await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (isTracking) return; // Already tracking

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: DISTANCE_INTERVAL_METERS,
    deferredUpdatesInterval: DEFERRED_UPDATE_INTERVAL_MS,
    showsBackgroundLocationIndicator: true, // iOS: blue bar indicator
    foregroundService: {
      // Android: required foreground notification
      notificationTitle: "Location Tracking",
      notificationBody: "Tracking your route in the background",
    },
  });
}

async function stopTracking(): Promise<void> {
  const isTracking =
    await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (!isTracking) return;

  await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
}

export { startTracking, stopTracking, requestLocationPermissions };
```

**Why good:** Separate foreground and background permission requests (Android requires this flow), checks if already tracking before starting, uses balanced accuracy (battery-efficient), batches updates with deferredUpdatesInterval, includes foreground service notification for Android, iOS background indicator shown

```typescript
// BAD: Common location tracking mistakes
async function startBadTracking() {
  // BAD: Only requesting foreground permission
  const { status } = await Location.requestForegroundPermissionsAsync();

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.BestForNavigation, // BAD: highest accuracy drains battery
    timeInterval: 1000, // BAD: every second is excessive for most use cases
    // BAD: No foregroundService -- Android will kill the task
    // BAD: No distanceInterval -- receives updates even when stationary
  });
}
```

**Why bad:** Missing background permission means tracking stops immediately on background, highest accuracy drains battery for little benefit over Balanced, 1-second interval is excessive, no foreground service on Android means the OS will terminate the task, no distance filter means unnecessary updates while stationary

---

## Pattern 5: iOS Expiration Listener

Handle iOS system stopping your task early. The expiration listener fires when BGTaskScheduler decides to reclaim resources.

```typescript
import * as BackgroundTask from "expo-background-task";
import type { Subscription } from "expo-modules-core";

let expirationSubscription: Subscription | null = null;

function setupExpirationHandler(): void {
  // Clean up previous listener if any
  expirationSubscription?.remove();

  expirationSubscription = BackgroundTask.addExpirationListener(() => {
    // iOS is about to stop our task -- save progress immediately
    savePartialProgress();
    // Do NOT start new work here -- you have milliseconds, not seconds
  });
}

function cleanupExpirationHandler(): void {
  expirationSubscription?.remove();
  expirationSubscription = null;
}

export { setupExpirationHandler, cleanupExpirationHandler };
```

**Why good:** Saves partial progress when iOS reclaims resources, cleans up subscription to prevent leaks, uses typed Subscription for cleanup

**Note:** This is iOS-only. On Android, the timeout callback in `BackgroundFetch.configure()` serves the same purpose.

---

## Pattern 6: Checking Background Task Status

Always verify background task availability before attempting registration.

```typescript
import * as BackgroundTask from "expo-background-task";

type BackgroundAvailability =
  | { available: true }
  | { available: false; reason: string };

async function checkBackgroundAvailability(): Promise<BackgroundAvailability> {
  const status = await BackgroundTask.getStatusAsync();

  switch (status) {
    case BackgroundTask.BackgroundTaskStatus.Available:
      return { available: true };
    case BackgroundTask.BackgroundTaskStatus.Restricted:
      return {
        available: false,
        reason:
          "Background tasks are restricted. Check device settings to enable background app refresh.",
      };
    default: {
      const _exhaustive: never = status;
      return { available: false, reason: `Unknown status: ${_exhaustive}` };
    }
  }
}

export { checkBackgroundAvailability, type BackgroundAvailability };
```

**Why good:** Exhaustive switch handles all enum values, returns structured result for UI consumption, provides actionable user guidance
