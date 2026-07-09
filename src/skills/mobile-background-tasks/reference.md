# Background Tasks Quick Reference

> Decision frameworks, platform constraints, and permission checklists. See [SKILL.md](SKILL.md) for patterns and red flags.

---

## Platform Constraint Summary

### iOS BGTaskScheduler

| Task Type                           | Time Limit      | Requirements                     | Use Case                             |
| ----------------------------------- | --------------- | -------------------------------- | ------------------------------------ |
| BGAppRefreshTask                    | ~30 seconds     | None                             | Light data sync, feed refresh        |
| BGProcessingTask                    | Several minutes | Charger + network (configurable) | ML models, database maintenance      |
| BGContinuedProcessingTask (iOS 26+) | Until complete  | User-initiated action            | Export, upload started in foreground |

**iOS scheduling behavior:**

- System uses ML to predict optimal execution time based on user habits
- Newly installed apps may take days for scheduling to stabilize
- Force-quitting the app stops ALL background tasks until user reopens
- Simulator does NOT run BGTaskScheduler -- test on physical devices only
- `BGTaskSchedulerPermittedIdentifiers` must list all task IDs in Info.plist

### Android WorkManager / Doze

| State       | Network | CPU        | AlarmManager | WorkManager                            |
| ----------- | ------- | ---------- | ------------ | -------------------------------------- |
| Active      | Full    | Full       | Full         | Full                                   |
| Doze (idle) | Blocked | Restricted | Deferred     | Deferred (runs in maintenance windows) |
| App Standby | Blocked | Restricted | Deferred     | Deferred                               |
| Deep Doze   | Blocked | Blocked    | Deferred     | Deferred                               |

**Android-specific constraints:**

- WorkManager minimum interval: 15 minutes (hard limit)
- Doze maintenance windows occur at increasing intervals (first after 1 hour, then 2, 4, etc.)
- `forceAlarmManager: true` bypasses JobScheduler but increases battery usage
- Vendor skins (Samsung, Xiaomi, Huawei, OPPO) add additional restrictions beyond stock Android
- Reference: [dontkillmyapp.com](https://dontkillmyapp.com) for vendor-specific workarounds

---

## Permission Checklist

### iOS Permissions (Info.plist / app.json)

```
Background fetch / processing:
  [ ] UIBackgroundModes includes "processing"
  [ ] BGTaskSchedulerPermittedIdentifiers lists task IDs
  [ ] (expo-background-task auto-configures via CNG prebuild)

Background location:
  [ ] UIBackgroundModes includes "location"
  [ ] NSLocationAlwaysAndWhenInUseUsageDescription set
  [ ] NSLocationWhenInUseUsageDescription set
  [ ] User granted "Always Allow" (not just "When In Use")
```

### Android Permissions (AndroidManifest.xml)

```
Background fetch:
  [ ] RECEIVE_BOOT_COMPLETED (if startOnBoot: true)
  [ ] WAKE_LOCK (for keeping device awake during task)

Background location:
  [ ] ACCESS_FINE_LOCATION
  [ ] ACCESS_COARSE_LOCATION
  [ ] ACCESS_BACKGROUND_LOCATION (Android 10+, separate prompt)
  [ ] FOREGROUND_SERVICE (for foreground service notification)
  [ ] FOREGROUND_SERVICE_LOCATION (Android 14+)
```

---

## API Quick Reference

### expo-background-task

| Method                                              | Purpose                                 |
| --------------------------------------------------- | --------------------------------------- |
| `TaskManager.defineTask(name, executor)`            | Register task logic (top-level)         |
| `BackgroundTask.registerTaskAsync(name, options?)`  | Schedule task with OS                   |
| `BackgroundTask.unregisterTaskAsync(name)`          | Remove scheduled task                   |
| `BackgroundTask.getStatusAsync()`                   | Check if background tasks are available |
| `BackgroundTask.triggerTaskWorkerForTestingAsync()` | Debug-only: trigger task manually       |
| `TaskManager.isTaskRegisteredAsync(name)`           | Check if task is registered             |
| `BackgroundTask.addExpirationListener(fn)`          | iOS: called when OS stops task early    |

**BackgroundTaskOptions:**

- `minimumInterval?: number` -- Minutes between executions (min: 15, default: 720)

**Return values:**

- `BackgroundTaskResult.Success` (1) -- Task completed successfully
- `BackgroundTaskResult.Failed` (2) -- Task failed

### react-native-background-fetch

| Method                                                  | Purpose                            |
| ------------------------------------------------------- | ---------------------------------- |
| `BackgroundFetch.configure(config, onEvent, onTimeout)` | Initialize with handlers           |
| `BackgroundFetch.scheduleTask(config)`                  | Schedule one-shot or periodic task |
| `BackgroundFetch.finish(taskId)`                        | Signal OS that task is done        |
| `BackgroundFetch.start()`                               | Resume background fetch            |
| `BackgroundFetch.stop(taskId?)`                         | Pause background fetch             |
| `BackgroundFetch.status()`                              | Check authorization status         |

**Key configure options:**

- `minimumFetchInterval: number` -- Minutes (min: 15)
- `stopOnTerminate: boolean` -- Android: stop when app killed (default: true)
- `startOnBoot: boolean` -- Android: restart after reboot (default: false)
- `enableHeadless: boolean` -- Android: enable Headless JS (default: false)
- `forceAlarmManager: boolean` -- Android: use AlarmManager (default: false)
- `requiredNetworkType: number` -- Network requirement (NONE, ANY, CELLULAR, WIFI)
- `requiresBatteryNotLow: boolean` -- Skip when battery low
- `requiresCharging: boolean` -- Only run when charging
- `requiresDeviceIdle: boolean` -- Only run when device idle

### expo-location (background)

| Method                                                  | Purpose                           |
| ------------------------------------------------------- | --------------------------------- |
| `Location.requestForegroundPermissionsAsync()`          | Request foreground location       |
| `Location.requestBackgroundPermissionsAsync()`          | Request "Always Allow" permission |
| `Location.startLocationUpdatesAsync(taskName, options)` | Start background tracking         |
| `Location.stopLocationUpdatesAsync(taskName)`           | Stop background tracking          |
| `Location.hasStartedLocationUpdatesAsync(taskName)`     | Check if tracking active          |

**Location update options:**

- `accuracy: Location.Accuracy.*` -- Lowest, Low, Balanced, High, Highest, BestForNavigation
- `distanceInterval: number` -- Meters between updates
- `timeInterval: number` -- Milliseconds between updates (Android only)
- `deferredUpdatesInterval: number` -- Milliseconds to batch updates
- `foregroundService: { notificationTitle, notificationBody }` -- Android foreground notification
- `activityType: Location.ActivityType.*` -- iOS: Fitness, OtherNavigation, AutomotiveNavigation, Other

---

## Debugging Checklist

```
Task not executing?
|
+-> Is the task defined at the top-level scope?
|   +-> NO --> Move defineTask outside any component or lifecycle method
|
+-> Is the task registered? (check isTaskRegisteredAsync)
|   +-> NO --> Call registerTaskAsync
|
+-> Is background execution available? (check getStatusAsync)
|   +-> Restricted --> User or system disabled background refresh
|
+-> Are you testing on a real device?
|   +-> iOS simulator --> BGTaskScheduler does not run on simulators
|
+-> Did the user force-quit the app?
|   +-> iOS --> No tasks run until user reopens the app
|   +-> Android --> Check stopOnTerminate and enableHeadless settings
|
+-> Is the device in Doze mode? (Android)
|   +-> Check with: adb shell dumpsys deviceidle
|   +-> WorkManager tasks run in maintenance windows
|
+-> Is a vendor battery optimizer blocking it? (Android)
    +-> Check dontkillmyapp.com for device-specific settings
    +-> Guide user to disable battery optimization for your app
```
