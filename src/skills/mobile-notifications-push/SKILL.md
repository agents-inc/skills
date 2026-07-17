---
name: mobile-notifications-push
description: Push notification patterns - expo-notifications (Expo) and @react-native-firebase/messaging (bare RN), permission handling, token management, foreground/background/tap listeners, local scheduling, Android channels, notification categories and actions, badge management, rich notifications
---

# Push Notification Patterns

> **Quick Guide:** Two main approaches: `expo-notifications` (Expo workflow, unified API for push + local) and `@react-native-firebase/messaging` (bare RN, FCM/APNs direct). Always request permissions before retrieving tokens. Handle three notification states: foreground (app open), background (app minimized), and quit (app killed). Set up Android notification channels before displaying any notification. Push notifications require a physical device -- they do not work on emulators or simulators.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST request notification permissions BEFORE retrieving push tokens -- calling getExpoPushTokenAsync or messaging().getToken() without permission will fail or return an unusable token)**

**(You MUST create an Android notification channel BEFORE displaying any notification on Android 8+ -- notifications without a channel are silently dropped)**

**(You MUST handle ALL three notification states: foreground (onMessage/addNotificationReceivedListener), background (setBackgroundMessageHandler/registerTaskAsync), and tap/response (addNotificationResponseReceivedListener/onNotificationOpenedApp + getInitialNotification))**

**(You MUST clean up notification listeners on unmount -- leaked listeners cause memory leaks and duplicate handlers)**

**(You MUST test push notifications on a physical device -- emulators and simulators do not support push tokens)**

</critical_requirements>

---

**Auto-detection:** expo-notifications, @react-native-firebase/messaging, push notification, push token, getExpoPushTokenAsync, getDevicePushTokenAsync, scheduleNotificationAsync, setNotificationHandler, addNotificationReceivedListener, addNotificationResponseReceivedListener, setBackgroundMessageHandler, onMessage, onNotificationOpenedApp, getInitialNotification, notification channel, setNotificationChannelAsync, notification category, notification actions, setBadgeCountAsync, FCM, APNs, remote notification, local notification, useLastNotificationResponse

**When to use:**

- Sending remote push notifications to users via FCM/APNs
- Requesting and managing notification permissions
- Retrieving and storing push tokens (Expo push token or native FCM/APNs token)
- Handling notification events in foreground, background, and quit states
- Scheduling local notifications (reminders, timers, recurring alerts)
- Creating Android notification channels with custom sound/vibration/importance
- Adding interactive notification actions (buttons, text input)
- Managing app icon badge counts
- Implementing notification tap navigation (deep linking from notifications)

**Key patterns covered:**

- Permission request flow with status checking
- Push token retrieval and refresh handling
- Foreground notification presentation (setNotificationHandler)
- Background message handling (headless JS tasks)
- Notification tap/response handling with navigation
- Local notification scheduling with trigger types
- Android notification channels and channel groups
- Notification categories with interactive actions
- Badge count management
- Rich notification content (images, sounds, data payloads)

**When NOT to use:**

- In-app messaging or toast/snackbar UI (those are UI components, not OS notifications)
- Email or SMS notifications (server-side concern)
- Web push notifications (different API entirely)

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Permission flow, token management, foreground/background/tap listeners, notification handler setup
- [examples/scheduling.md](examples/scheduling.md) - Local notification scheduling, trigger types, Android channels, categories and actions, badge management
- [reference.md](reference.md) - Decision frameworks, platform differences, checklists

---

<philosophy>

## Philosophy

Push notifications bridge the gap between your app and users when the app is not in focus. The two main approaches in React Native serve different workflows:

**expo-notifications** provides a unified API for both push and local notifications, abstracts FCM/APNs differences, and integrates with Expo's push service for simplified server-side sending. Best for Expo-managed and bare workflows that want a single library for all notification needs.

**@react-native-firebase/messaging** provides direct FCM integration, pairs naturally with Firebase's backend services, and is the standard for bare React Native projects already using Firebase. For displaying foreground notifications with Firebase, pair it with a local notification display library.

**Core principles:**

1. **Permission first** -- Always check and request permissions before any token or notification work. Requesting at a contextually appropriate moment (after user sees value) dramatically improves grant rates.
2. **Handle all three states** -- Notifications arrive when the app is in foreground, background, or quit. Each state requires a different listener. Missing one means silently lost notifications.
3. **Channels are mandatory on Android** -- Android 8+ (API 26+) requires notification channels. Without one, notifications are silently dropped. Create channels at app startup, not at send time.
4. **Tokens change** -- Push tokens can rotate. Register a token refresh listener and update your backend whenever the token changes.
5. **Physical device required** -- Push notification infrastructure (FCM/APNs) does not work on emulators or simulators. Local notifications may work on simulators but push tokens will not.

**Mental model:**

```
Server sends push -> FCM/APNs delivers to device -> OS displays notification
   |                                                      |
   |  (or Expo Push Service abstracts FCM/APNs)          |
   |                                                      v
   |                                              User taps notification
   |                                                      |
   v                                                      v
App in foreground:                               App opens with payload:
  -> onMessage / notificationReceived              -> response listener
  -> YOU decide whether to show it                 -> navigate to content
```

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Permission Request Flow

Always check existing permission status before prompting. On iOS, the permission dialog can only be shown ONCE natively -- if denied, you must direct users to Settings.

```typescript
// expo-notifications approach
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";

const { status: existingStatus } = await Notifications.getPermissionsAsync();
let finalStatus = existingStatus;

if (existingStatus !== "granted") {
  const { status } = await Notifications.requestPermissionsAsync();
  finalStatus = status;
}

if (finalStatus !== "granted") {
  // Handle denial -- direct to Settings or degrade gracefully
  return;
}
```

**Why good:** checks existing status first to avoid redundant prompts, handles denial gracefully, works on both platforms

See [examples/core.md](examples/core.md) for the complete registration function with Android channel setup and error handling.

---

### Pattern 2: Push Token Retrieval

Expo push tokens work with Expo's push service. Native device tokens (FCM/APNs) work with your own backend or third-party services.

```typescript
// Expo push token -- for use with Expo Push Service
const expoPushToken = await Notifications.getExpoPushTokenAsync({
  projectId:
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId,
});
// Returns: "ExponentPushToken[xxxxxx]"

// Native device token -- for direct FCM/APNs integration
const deviceToken = await Notifications.getDevicePushTokenAsync();
// Returns: { type: "ios" | "android", data: "native-token-string" }
```

**Why good:** projectId is explicit (not inferred), both token types available depending on backend choice

See [examples/core.md](examples/core.md) for token refresh handling and Firebase token retrieval patterns.

---

### Pattern 3: Foreground Notification Handler

By default, notifications received while the app is in the foreground are NOT displayed. You must explicitly opt in via `setNotificationHandler`.

```typescript
// Call once at app startup (outside of any component)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true, // replaces deprecated shouldShowAlert
    shouldShowList: true, // show in notification center
  }),
});
```

**Why good:** explicit opt-in to foreground display, uses current API (shouldShowBanner/shouldShowList, not deprecated shouldShowAlert), called at module scope so it runs before any notification arrives

**Gotcha:** `shouldShowAlert` is deprecated in recent expo-notifications versions -- use `shouldShowBanner` and `shouldShowList` instead.

See [examples/core.md](examples/core.md) for conditional foreground handling (e.g., suppressing notification when user is already on that screen).

---

### Pattern 4: Notification Listeners (Foreground, Background, Tap)

Three distinct handlers cover the full notification lifecycle.

```typescript
// Foreground: notification arrives while app is open
const receivedSub = Notifications.addNotificationReceivedListener(
  (notification) => {
    const data = notification.request.content.data;
    // Update UI, show in-app indicator, etc.
  },
);

// Tap/Response: user taps a notification (from any state)
const responseSub = Notifications.addNotificationResponseReceivedListener(
  (response) => {
    const data = response.notification.request.content.data;
    // Navigate to relevant screen
  },
);

// Cleanup on unmount
return () => {
  receivedSub.remove();
  responseSub.remove();
};
```

**Why good:** separate listeners for receiving vs tapping, cleanup prevents leaks, data extraction from correct nested path

See [examples/core.md](examples/core.md) for the complete useNotificationListeners hook, background handler registration, and Firebase equivalents.

---

### Pattern 5: Android Notification Channels

Required on Android 8+ (API 26+). Create channels at app startup. Users can customize channel settings (sound, vibration) in system settings -- your code cannot override user preferences after creation.

```typescript
const CHANNELS = {
  messages: {
    id: "messages",
    name: "Messages",
    importance: Notifications.AndroidImportance.HIGH,
  },
  updates: {
    id: "updates",
    name: "App Updates",
    importance: Notifications.AndroidImportance.DEFAULT,
  },
  marketing: {
    id: "marketing",
    name: "Promotions",
    importance: Notifications.AndroidImportance.LOW,
  },
} as const;

// Create at app startup
if (Platform.OS === "android") {
  await Notifications.setNotificationChannelAsync(CHANNELS.messages.id, {
    name: CHANNELS.messages.name,
    importance: CHANNELS.messages.importance,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#FF231F7C",
    sound: "default",
  });
}
```

**Why good:** channels defined as constants, importance levels match notification priority, created at startup before any notification arrives

See [examples/scheduling.md](examples/scheduling.md) for channel groups and channel management patterns.

---

### Pattern 6: Local Notification Scheduling

Schedule notifications for future delivery without a server. Supports one-time, repeating, and calendar-based triggers.

```typescript
const REMINDER_DELAY_SECONDS = 60;

await Notifications.scheduleNotificationAsync({
  content: {
    title: "Reminder",
    body: "Don't forget to complete your task!",
    data: { screen: "tasks", taskId: "abc123" },
    sound: "default",
  },
  trigger: {
    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
    seconds: REMINDER_DELAY_SECONDS,
  },
});
```

**Why good:** data payload enables navigation on tap, trigger type is explicit, named constant for delay

See [examples/scheduling.md](examples/scheduling.md) for daily/weekly recurring triggers, calendar triggers, and platform-specific trigger differences.

---

### Pattern 7: Notification Categories and Actions

Categories define interactive buttons and text input fields on notifications. Register categories at app startup.

```typescript
await Notifications.setNotificationCategoryAsync("message", [
  {
    identifier: "reply",
    buttonTitle: "Reply",
    textInput: { submitButtonTitle: "Send", placeholder: "Type a reply..." },
  },
  {
    identifier: "mark-read",
    buttonTitle: "Mark as Read",
    options: { opensAppToForeground: false },
  },
]);
```

**Why good:** text input action for quick replies, opensAppToForeground: false for silent actions, registered at startup before notifications arrive

See [examples/scheduling.md](examples/scheduling.md) for handling action responses and iOS-specific category options.

</patterns>

---

<decision_framework>

## Decision Framework

Key decisions: which library (expo-notifications vs @react-native-firebase/messaging), which push token type (Expo vs native), which trigger type for local notifications, and which Android channel importance level.

See [reference.md](reference.md) for complete decision trees, platform differences table, and channel importance reference.

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Requesting push token before checking/requesting permissions -- fails silently or returns unusable token on iOS
- Missing Android notification channel creation -- notifications silently dropped on Android 8+ (API 26+)
- Not handling the "quit" state -- `getInitialNotification()` (Firebase) or `useLastNotificationResponse()` (Expo) is the only way to get the notification that launched the app
- Using `shouldShowAlert` instead of `shouldShowBanner`/`shouldShowList` -- deprecated API, will break in future expo-notifications versions
- Not cleaning up listeners on unmount -- causes memory leaks and duplicate notification handlers
- Testing only on simulator/emulator -- push tokens and remote notifications require a physical device

**Medium Priority Issues:**

- Hardcoding push token on the server without refresh handling -- tokens rotate and become invalid
- Creating notification channels at notification send time instead of app startup -- causes race condition where first notification is dropped
- Using `console.log` in background handlers -- headless JS tasks may not have console access; use your logging solution
- Not sending `channelId` in Android notification payloads -- notification uses default channel, ignoring your custom channel settings
- Requesting permission immediately on app launch -- users deny at higher rates without context; request after demonstrating value

**Gotchas & Edge Cases:**

- iOS permission dialog shows only ONCE natively -- if denied, subsequent `requestPermissionsAsync()` calls return "denied" without showing a dialog; direct users to Settings
- Expo SDK 53+ dropped push notification support from Expo Go on Android -- you need a development build to test
- `setBackgroundMessageHandler` (Firebase) and `registerTaskAsync` (Expo) must be called at the TOP LEVEL of your entry file (index.js), not inside a component
- Firebase data-only messages require `priority: "high"` (Android) and `content-available: 1` (iOS) to trigger background handlers
- Android notification icons must be white with transparent background -- colored icons render as solid white squares
- `DailyTrigger` and `WeeklyTrigger` are Android-only in expo-notifications -- use `CalendarTrigger` for iOS
- Notification categories/actions may not show in background/killed state on some Android devices (known limitation)
- Both `expo-notifications` and `@react-native-firebase/messaging` register for the same Android FCM intents -- using both requires manual conflict resolution
- `getInitialNotification()` returns null if called too late -- call it early in app initialization, not after navigation is ready

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST request notification permissions BEFORE retrieving push tokens -- calling getExpoPushTokenAsync or messaging().getToken() without permission will fail or return an unusable token)**

**(You MUST create an Android notification channel BEFORE displaying any notification on Android 8+ -- notifications without a channel are silently dropped)**

**(You MUST handle ALL three notification states: foreground (onMessage/addNotificationReceivedListener), background (setBackgroundMessageHandler/registerTaskAsync), and tap/response (addNotificationResponseReceivedListener/onNotificationOpenedApp + getInitialNotification))**

**(You MUST clean up notification listeners on unmount -- leaked listeners cause memory leaks and duplicate handlers)**

**(You MUST test push notifications on a physical device -- emulators and simulators do not support push tokens)**

**Failure to follow these rules will result in silently dropped notifications, missed user interactions, and platform-specific failures that are difficult to debug.**

</critical_reminders>
