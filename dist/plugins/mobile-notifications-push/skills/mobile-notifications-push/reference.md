# Push Notifications Reference

> Decision frameworks, platform differences, and quick-reference checklists. See [SKILL.md](SKILL.md) for red flags and anti-patterns.

---

## Decision Framework

### Library Choice

```
Are you using Expo (managed or bare)?
|-- YES -> expo-notifications (unified push + local API)
|   |-- Want Expo Push Service? -> getExpoPushTokenAsync()
|   +-- Want direct FCM/APNs?  -> getDevicePushTokenAsync()
+-- NO (bare React Native)
    |-- Firebase in your stack? -> @react-native-firebase/messaging
    |   +-- For foreground display -> pair with local notification library
    +-- Want Expo API anyway?   -> expo-notifications (install expo modules)
```

### Notification State Handling

```
What state is the app in when the notification arrives?
|
|-- FOREGROUND (app is open)
|   |-- Expo:    setNotificationHandler + addNotificationReceivedListener
|   +-- Firebase: messaging().onMessage()
|       +-- Must display manually (Firebase does not auto-show in foreground)
|
|-- BACKGROUND (app minimized)
|   |-- Expo:    registerTaskAsync (headless JS task)
|   +-- Firebase: setBackgroundMessageHandler (top-level, index.js)
|
+-- QUIT (app was killed)
    |-- Expo:    useLastNotificationResponse (covers all tap states)
    +-- Firebase: getInitialNotification() (cold launch only)
        +-- onNotificationOpenedApp() (background -> tap)
```

### Trigger Type by Platform

```
When should the local notification fire?
|
|-- Immediately          -> trigger: null (both platforms)
|-- After N seconds      -> TimeIntervalTrigger (both platforms)
|-- At specific date     -> DateTrigger (both platforms)
|-- Daily at HH:MM       -> DailyTrigger (Android) / CalendarTrigger (iOS)
|-- Weekly on day at HH  -> WeeklyTrigger (Android) / CalendarTrigger (iOS)
+-- Yearly on date       -> YearlyTrigger (Android) / CalendarTrigger (iOS)
```

---

## Platform Differences

| Feature                 | iOS                                                        | Android                                                         |
| ----------------------- | ---------------------------------------------------------- | --------------------------------------------------------------- |
| Permission dialog       | Shown once natively; subsequent calls return cached status | Auto-granted on install (Android 13+ requires explicit request) |
| Notification channels   | Not applicable                                             | Required on Android 8+ (API 26+)                                |
| Badge count             | System-wide, reliable                                      | Depends on launcher; not universally supported                  |
| Rich images             | Via Notification Service Extension + mutable-content       | Via BigPicture style or imageUrl in FCM                         |
| Sound                   | Included in app bundle (.caf, .aiff, .wav)                 | Included in res/raw or channel default                          |
| Daily/Weekly triggers   | CalendarTrigger with dateComponents                        | DailyTrigger / WeeklyTrigger                                    |
| Notification grouping   | Automatic by threadIdentifier                              | Requires notification channel groups                            |
| Foreground presentation | Controlled by shouldShowBanner/shouldShowList              | Always shown (controlled by channel importance)                 |
| Category actions        | Long-press or 3D Touch to reveal                           | Swipe or expand notification                                    |
| Topic subscriptions     | Via APNs or Firebase                                       | Native FCM support                                              |

---

## Notification Lifecycle Checklist

### Initial Setup (App Startup)

- [ ] `setNotificationHandler` called at module scope (foreground presentation)
- [ ] Android notification channels created (before any notification)
- [ ] Notification categories registered (if using interactive actions)
- [ ] Background handler registered at top level of entry file

### Permission & Token Flow

- [ ] Check existing permission status before prompting
- [ ] Request permission at contextually appropriate moment
- [ ] Retrieve push token after permission granted
- [ ] Send token to backend with userId and platform
- [ ] Register token refresh listener
- [ ] Handle permission denial gracefully (degrade features, show Settings prompt)

### Listener Setup

- [ ] Foreground received listener with cleanup
- [ ] Tap/response listener with navigation logic
- [ ] Token refresh listener with backend sync
- [ ] All listeners cleaned up on unmount

### Testing

- [ ] Tested on physical iOS device
- [ ] Tested on physical Android device
- [ ] Tested foreground notification display
- [ ] Tested background notification delivery
- [ ] Tested notification tap from killed state
- [ ] Tested notification tap from background state
- [ ] Tested interactive actions (if using categories)
- [ ] Tested with expired/invalid token (error handling)

---

## Quick Reference: Key Imports

### expo-notifications

```typescript
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";

// Key functions
Notifications.getPermissionsAsync();
Notifications.requestPermissionsAsync();
Notifications.getExpoPushTokenAsync({ projectId });
Notifications.getDevicePushTokenAsync();
Notifications.setNotificationHandler({ handleNotification });
Notifications.addNotificationReceivedListener(callback);
Notifications.addNotificationResponseReceivedListener(callback);
Notifications.addPushTokenListener(callback);
Notifications.scheduleNotificationAsync({ content, trigger });
Notifications.setNotificationChannelAsync(channelId, config);
Notifications.setNotificationCategoryAsync(categoryId, actions);
Notifications.getBadgeCountAsync();
Notifications.setBadgeCountAsync(count);
Notifications.useLastNotificationResponse(); // React hook
```

### @react-native-firebase/messaging

```typescript
import messaging from "@react-native-firebase/messaging";

// Key functions
messaging().requestPermission();
messaging().getToken();
messaging().onMessage(callback);
messaging().setBackgroundMessageHandler(callback); // Top-level only
messaging().onNotificationOpenedApp(callback);
messaging().getInitialNotification();
messaging().subscribeToTopic(topic);
messaging().unsubscribeFromTopic(topic);
messaging().onTokenRefresh(callback);
```

---

## Notification Payload Quick Reference

### Expo Push Service

```typescript
{
  to: "ExponentPushToken[xxx]",
  title: "Title",
  body: "Body text",
  sound: "default",
  badge: 1,
  data: { key: "value" },       // Custom data for navigation
  categoryId: "message",         // Links to registered category
  channelId: "messages",         // Android channel (must exist)
  priority: "high",              // Android delivery priority
  _contentAvailable: true,       // iOS background processing
}
```

### FCM (Server-Side)

```typescript
{
  token: "fcm-device-token",
  notification: {
    title: "Title",
    body: "Body text",
    imageUrl: "https://...",     // Rich image
  },
  data: { key: "value" },       // Custom data payload
  android: {
    notification: {
      channelId: "messages",
      sound: "default",
      priority: "high",
    },
  },
  apns: {
    payload: {
      aps: {
        badge: 1,
        sound: "default",
        "content-available": 1,  // Background delivery
        "mutable-content": 1,    // Rich media on iOS
        category: "message",     // iOS category identifier
      },
    },
  },
}
```

---

## Android Channel Importance Reference

| Level   | Enum                        | Sound | Vibration | Heads-up | Use Case                       |
| ------- | --------------------------- | ----- | --------- | -------- | ------------------------------ |
| Max     | `AndroidImportance.MAX`     | Yes   | Yes       | Yes      | Incoming calls, urgent alerts  |
| High    | `AndroidImportance.HIGH`    | Yes   | Yes       | Yes      | Messages, direct communication |
| Default | `AndroidImportance.DEFAULT` | Yes   | Yes       | No       | General notifications          |
| Low     | `AndroidImportance.LOW`     | No    | No        | No       | Recommendations, updates       |
| Min     | `AndroidImportance.MIN`     | No    | No        | No       | Silent, informational          |
