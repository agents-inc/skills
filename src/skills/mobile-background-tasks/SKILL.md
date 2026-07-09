---
name: mobile-background-tasks
description: Background fetch, processing tasks, background location, headless JS, battery optimization - Expo and bare React Native
---

# React Native Background Tasks

> **Quick Guide:** Background tasks in React Native are heavily constrained by OS power management. Use `expo-background-task` (Expo) or `react-native-background-fetch` (bare RN) for periodic fetch. Use `expo-location` for background location tracking. iOS gives ~30s for refresh tasks (BGAppRefreshTask) and several minutes for processing tasks (BGProcessingTask). Android enforces 15-minute minimum intervals via WorkManager and restricts execution in Doze mode. Always call `finish()` or return a result when done -- the OS will terminate tasks that exceed their time budget.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST define tasks in the top-level scope (global) -- tasks defined inside React components or lifecycle methods will NOT be registered when the app starts from the background)**

**(You MUST call `finish(taskId)` or return a `BackgroundTaskResult` when task execution completes -- failing to signal completion causes the OS to penalize or kill your app)**

**(You MUST request background permissions explicitly on both platforms -- iOS requires Info.plist UIBackgroundModes entries, Android requires manifest permissions)**

**(You MUST handle the OS killing your task at any time -- use expiration listeners on iOS and timeout callbacks on Android to clean up gracefully)**

**(You MUST keep background work minimal -- sync only changed data, avoid heavy computation, respect the ~30s iOS refresh limit)**

</critical_requirements>

---

**Auto-detection:** expo-task-manager, expo-background-task, expo-background-fetch, expo-location background, react-native-background-fetch, BackgroundFetch, TaskManager, defineTask, registerTaskAsync, startLocationUpdatesAsync, Headless JS, registerHeadlessTask, BGTaskScheduler, WorkManager, background fetch, background processing, background location

**When to use:**

- Syncing data periodically while the app is backgrounded (new messages, feeds, email)
- Tracking location in the background (fitness, delivery, navigation)
- Running periodic cleanup or maintenance tasks (cache purge, log upload)
- Keeping local data fresh so the app opens with current content
- Processing uploads or downloads that continue after backgrounding

**When NOT to use:**

- Real-time updates that need sub-second latency (use push notifications + foreground handling)
- Continuous audio playback (use the audio background mode, not task scheduling)
- Tasks that must execute at an exact time (OS scheduling is advisory, not precise)
- Tasks requiring more than a few minutes of CPU (iOS will terminate them)

**Key patterns covered:**

- Expo background tasks: `expo-background-task` (new) and `expo-background-fetch` (legacy)
- Bare RN background fetch: `react-native-background-fetch` with configure/scheduleTask
- Background location tracking with `expo-location` and TaskManager
- Android Headless JS for post-termination task execution
- iOS BGTaskScheduler constraints (refresh ~30s vs processing ~minutes)
- Android battery optimization: Doze mode, App Standby, WorkManager guarantees
- Task registration, unregistration, and lifecycle management

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Expo background task, bare RN background fetch, background location, headless JS
- [reference.md](reference.md) - Decision frameworks, platform constraints, permission checklists

---

<philosophy>

## Philosophy

Background execution on mobile is a **privilege, not a right**. Both iOS and Android aggressively limit what apps can do in the background to preserve battery life and user experience. The OS decides when (and whether) your task runs -- you can only request execution and set minimum intervals.

**Core principles:**

1. **Minimize background work** -- Sync only deltas, not full datasets. The less you do, the more reliably the OS will schedule you.
2. **Always signal completion** -- Return a result code or call `finish()`. The OS tracks your task duration and penalizes apps that don't complete promptly.
3. **Define tasks globally** -- Background tasks must be registered at the top-level scope because the app may launch directly into background mode with no UI.
4. **Plan for termination** -- The OS can kill your task at any time. Use expiration/timeout handlers to save partial progress.
5. **Test on real devices** -- iOS simulators do not run BGTaskScheduler tasks. Android emulators may not enforce Doze mode.
6. **Respect platform differences** -- iOS kills all background tasks when the user force-quits. Android Headless JS can survive app termination with proper configuration.

**The background execution spectrum:**

```
Most reliable                                    Least reliable
|                                                         |
Push notifications > Foreground services > Background tasks > Timers
(instant delivery)   (visible to user)    (OS-scheduled)     (killed)
```

Background tasks sit in the middle -- more reliable than timers, but entirely at the OS's discretion. For critical work, combine with push notifications as a trigger.

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Expo Background Task (expo-background-task)

The modern Expo approach using BGTaskScheduler (iOS) and WorkManager (Android). Replaces the older `expo-background-fetch`.

```typescript
import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";

const SYNC_TASK_NAME = "BACKGROUND_SYNC_TASK";
const TWELVE_HOURS_IN_MINUTES = 720;

// MUST be top-level -- not inside a component
TaskManager.defineTask(SYNC_TASK_NAME, async () => {
  try {
    const hasNewData = await fetchLatestUpdates();
    return hasNewData
      ? BackgroundTask.BackgroundTaskResult.Success
      : BackgroundTask.BackgroundTaskResult.Failed;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});
```

**Why good:** Task defined at top-level scope (runs even when app launches in background), returns explicit result code, handles errors

```typescript
// BAD: Defining task inside a component
function App() {
  useEffect(() => {
    // This will NOT work when app starts from background
    TaskManager.defineTask(SYNC_TASK_NAME, async () => {
      /* ... */
    });
  }, []);
}
```

**Why bad:** Task definition inside component lifecycle will not execute when the OS launches the app headlessly in the background

See [examples/core.md](examples/core.md) for complete registration/unregistration lifecycle.

---

### Pattern 2: Bare RN Background Fetch (react-native-background-fetch)

For bare React Native projects (non-Expo). Wraps BGAppRefreshTask (iOS) and WorkManager (Android).

```typescript
import BackgroundFetch from "react-native-background-fetch";

const MIN_FETCH_INTERVAL_MINUTES = 15;

// Configure in app initialization (e.g., App component mount)
const status = await BackgroundFetch.configure(
  {
    minimumFetchInterval: MIN_FETCH_INTERVAL_MINUTES,
    stopOnTerminate: false, // Android: continue after app killed
    startOnBoot: true, // Android: restart after device reboot
    enableHeadless: true, // Android: enable Headless JS
    requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY,
  },
  async (taskId) => {
    // Task triggered -- do your work
    await syncData();
    BackgroundFetch.finish(taskId); // MUST call when done
  },
  async (taskId) => {
    // Timeout -- OS is about to kill the task, clean up immediately
    BackgroundFetch.finish(taskId);
  },
);
```

**Why good:** Explicit timeout handler for graceful cleanup, `finish(taskId)` signals OS completion, Android-specific options for post-termination behavior

See [examples/core.md](examples/core.md) for scheduleTask one-shot/periodic tasks and Headless JS setup.

---

### Pattern 3: Background Location Tracking

Continuous location updates while backgrounded. Uses `expo-location` with `expo-task-manager`. Requires explicit background permission grants ("Always Allow" on iOS).

```typescript
import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";

const LOCATION_TASK_NAME = "BACKGROUND_LOCATION_TASK";

// Top-level task definition
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error("Location task error:", error.message);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    await saveLocationsToServer(locations);
  }
});
```

**Why good:** Top-level definition, explicit error handling, typed location data extraction

See [examples/core.md](examples/core.md) for permission flow, start/stop, and accuracy configuration.

---

### Pattern 4: Android Headless JS

Android-only mechanism for running JavaScript after app termination. Requires native setup and registration in `index.js`.

```javascript
// index.js -- register headless task alongside app
import { AppRegistry } from "react-native";
import { App } from "./App";

const APP_NAME = "MyApp";
const HEADLESS_TASK_NAME = "com.transistorsoft.fetch"; // Default ID from react-native-background-fetch

AppRegistry.registerComponent(APP_NAME, () => App);

// Headless task runs when app is terminated but task fires
AppRegistry.registerHeadlessTask(HEADLESS_TASK_NAME, () => async (taskData) => {
  await performSync(taskData);
  // Task completes when promise resolves
});
```

**Why good:** Registered at app entry point, async function allows proper cleanup, runs even after app termination on Android

**Gotcha:** Headless JS is Android-only. iOS has no equivalent -- once the user force-quits the app, no background tasks run until the user reopens it.

See [examples/core.md](examples/core.md) for complete headless setup with `enableHeadless` configuration.

---

### Pattern 5: Task Registration and Unregistration Lifecycle

Always check registration status before registering, and unregister when tasks are no longer needed.

```typescript
async function ensureBackgroundSyncRegistered(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(SYNC_TASK_NAME);
  if (isRegistered) return;

  await BackgroundTask.registerTaskAsync(SYNC_TASK_NAME, {
    minimumInterval: TWELVE_HOURS_IN_MINUTES,
  });
}

async function disableBackgroundSync(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(SYNC_TASK_NAME);
  if (!isRegistered) return;

  await BackgroundTask.unregisterTaskAsync(SYNC_TASK_NAME);
}
```

**Why good:** Guards against double-registration, idempotent enable/disable, named constants for intervals

See [examples/core.md](examples/core.md) for status checking and debugging patterns.

</patterns>

---

<decision_framework>

## Decision Framework

### Choosing a Background Task Approach

```
What kind of background work do you need?
|
+-> Periodic data sync (every 15min - 12hrs)?
|   +-> Expo project? --> expo-background-task
|   +-> Bare RN? --> react-native-background-fetch
|
+-> Continuous location tracking?
|   +-> Expo? --> expo-location + startLocationUpdatesAsync
|   +-> Bare RN? --> react-native-background-geolocation
|
+-> Complete a task started in foreground (iOS 26+)?
|   +-> BGContinuedProcessingTask (new in iOS 26)
|
+-> Long-running processing (ML, export)?
|   +-> Foreground service with notification (Android)
|   +-> BGProcessingTask (iOS, requires charger + network)
|
+-> Must survive app termination (Android)?
|   +-> Headless JS + enableHeadless: true + stopOnTerminate: false
|
+-> Must execute at exact time?
    +-> Not possible with background tasks
    +-> Use push notifications + server-side scheduling
```

### expo-background-task vs expo-background-fetch

| Feature          | expo-background-task     | expo-background-fetch   |
| ---------------- | ------------------------ | ----------------------- |
| Status           | **Active** (recommended) | **Deprecated**          |
| iOS API          | BGTaskScheduler          | Legacy Background Fetch |
| Android API      | WorkManager              | JobScheduler            |
| Min interval     | 15 minutes               | ~10 minutes (advisory)  |
| Network required | Yes (by default)         | No                      |
| Reliability      | Higher                   | Lower                   |

### Platform Execution Limits

| Constraint           | iOS                                           | Android                            |
| -------------------- | --------------------------------------------- | ---------------------------------- |
| Refresh task time    | ~30 seconds                                   | ~10 minutes                        |
| Processing task time | Several minutes (charger required)            | ~10 minutes                        |
| Minimum interval     | 15 minutes (system-managed)                   | 15 minutes (WorkManager-enforced)  |
| After force-quit     | No tasks run                                  | Headless JS can run (with config)  |
| After reboot         | Tasks resume automatically                    | Requires `startOnBoot: true`       |
| Simulator support    | No (physical device only for BGTaskScheduler) | Partial (Doze may not be enforced) |

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Defining tasks inside React components or useEffect -- tasks MUST be at the top-level scope or they won't run when the app starts from background
- Not calling `finish(taskId)` or returning a result -- the OS will penalize your app, reducing future scheduling frequency or killing the task
- Expecting exact timing -- background task intervals are minimums, the OS may delay execution by hours or even days on iOS
- Using `setTimeout`/`setInterval` for background work -- these are killed immediately when the app is backgrounded
- Not requesting background permissions -- iOS requires Info.plist UIBackgroundModes, Android requires ACCESS_BACKGROUND_LOCATION and RECEIVE_BOOT_COMPLETED

**Medium Priority Issues:**

- Doing heavy computation in a background refresh task -- iOS gives ~30 seconds, not minutes
- Not handling the timeout/expiration callback -- if the OS decides to stop your task early, you must save progress and exit
- Assuming background location works with "When In Use" permission -- it requires "Always Allow" on iOS
- Testing only on simulators -- iOS simulators do not execute BGTaskScheduler tasks
- Not checking `getStatusAsync()` before registering -- background tasks may be restricted by user settings or device state

**Gotchas & Edge Cases:**

- iOS force-quit kills ALL background tasks until user reopens the app -- there is no workaround
- Android vendor battery optimizations (Samsung, Xiaomi, Huawei) may kill background tasks beyond stock Android Doze restrictions -- see dontkillmyapp.com
- `expo-background-task` requires network connectivity by default -- tasks won't run offline
- iOS BGTaskScheduler uses machine learning to predict when to run your task -- it may take days to "settle in" for newly installed apps
- WorkManager enforces a hard 15-minute minimum interval -- you cannot schedule more frequently
- Headless JS is Android-only -- iOS has no equivalent post-termination execution
- `expo-background-fetch` is deprecated in favor of `expo-background-task` -- migrate to the new API
- Background tasks registered with expo-task-manager persist across app restarts -- always check `isTaskRegisteredAsync` before re-registering
- Android 15/16 edge-to-edge changes do not affect background tasks, but foreground service notification requirements have tightened
- iOS 26 introduces BGContinuedProcessingTask for completing user-initiated work in the background -- a new option for tasks started in foreground

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST define tasks in the top-level scope (global) -- tasks defined inside React components or lifecycle methods will NOT be registered when the app starts from the background)**

**(You MUST call `finish(taskId)` or return a `BackgroundTaskResult` when task execution completes -- failing to signal completion causes the OS to penalize or kill your app)**

**(You MUST request background permissions explicitly on both platforms -- iOS requires Info.plist UIBackgroundModes entries, Android requires manifest permissions)**

**(You MUST handle the OS killing your task at any time -- use expiration listeners on iOS and timeout callbacks on Android to clean up gracefully)**

**(You MUST keep background work minimal -- sync only changed data, avoid heavy computation, respect the ~30s iOS refresh limit)**

**Failure to follow these rules will result in tasks that never execute, apps penalized by the OS scheduler, or apps rejected from the App Store for excessive background resource usage.**

</critical_reminders>
