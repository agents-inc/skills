# Push Notifications - Core Patterns

> Permission flow, token management, foreground/background/tap listeners, complete setup. See [SKILL.md](../SKILL.md) for decision guidance and red flags.

**Related:** [scheduling.md](scheduling.md) for local notification scheduling, triggers, channels, and categories.

---

## Pattern 1: Complete Registration Function (Expo)

The standard pattern for requesting permissions, creating the default Android channel, and retrieving the Expo push token.

```typescript
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";

const DEFAULT_CHANNEL_ID = "default";
const DEFAULT_CHANNEL_NAME = "Default";

async function registerForPushNotificationsAsync(): Promise<
  string | undefined
> {
  // Android channels must be created before any notification is displayed
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
      name: DEFAULT_CHANNEL_NAME,
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  // Push tokens only work on physical devices
  if (!Device.isDevice) {
    throw new Error("Push notifications require a physical device");
  }

  // Check existing permission before prompting
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    throw new Error("Notification permission not granted");
  }

  // Retrieve Expo push token with explicit projectId
  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId;

  if (!projectId) {
    throw new Error("Missing projectId for push token registration");
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  return tokenData.data;
}
```

**Why good:** creates Android channel before anything else, validates physical device, checks existing permission before prompting, explicit projectId prevents runtime surprises, throws descriptive errors for each failure mode

```typescript
// BAD: Missing critical steps
async function registerBad() {
  // No permission check -- token retrieval may fail silently on iOS
  const token = await Notifications.getExpoPushTokenAsync();
  // No projectId -- will fail in production builds
  // No Android channel -- notifications silently dropped on Android 8+
  // No device check -- crashes on simulator
  return token.data;
}
```

**Why bad:** no permission request (iOS will deny token), no projectId (production builds fail), no Android channel (notifications dropped), no device validation (simulator crash)

---

## Pattern 2: Foreground Notification Handler

Controls whether and how notifications are presented when the app is in the foreground. Call this once at module scope (outside components) so it runs before any notification arrives.

```typescript
import * as Notifications from "expo-notifications";

// Call at module scope in your app entry file
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
```

**Why good:** called at module scope (not inside useEffect), uses current API properties, shows notification in both banner and notification center

#### Conditional Foreground Handling

Suppress the notification banner when the user is already viewing the relevant content.

```typescript
import * as Notifications from "expo-notifications";
import type { Notification } from "expo-notifications";

// Track the current screen or conversation
let activeScreenId: string | null = null;

export function setActiveScreen(screenId: string | null) {
  activeScreenId = screenId;
}

Notifications.setNotificationHandler({
  handleNotification: async (notification: Notification) => {
    const data = notification.request.content.data;
    const isCurrentScreen = data?.screenId === activeScreenId;

    return {
      shouldPlaySound: !isCurrentScreen,
      shouldSetBadge: true,
      shouldShowBanner: !isCurrentScreen,
      shouldShowList: true,
    };
  },
});
```

**Why good:** avoids duplicate alerts when user is already on the target screen, still updates badge and notification center, sound suppressed contextually

---

## Pattern 3: Notification Listeners Hook (Expo)

A custom hook that wires up foreground, tap/response, and token refresh listeners with proper cleanup.

```typescript
import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import type { Notification, NotificationResponse } from "expo-notifications";

interface UseNotificationListenersOptions {
  onNotificationReceived?: (notification: Notification) => void;
  onNotificationResponse?: (response: NotificationResponse) => void;
  onTokenRefresh?: (token: string) => void;
}

export function useNotificationListeners(
  options: UseNotificationListenersOptions,
) {
  const { onNotificationReceived, onNotificationResponse, onTokenRefresh } =
    options;

  // Use refs to avoid re-subscribing when callbacks change
  const receivedRef = useRef(onNotificationReceived);
  const responseRef = useRef(onNotificationResponse);
  const tokenRef = useRef(onTokenRefresh);

  useEffect(() => {
    receivedRef.current = onNotificationReceived;
    responseRef.current = onNotificationResponse;
    tokenRef.current = onTokenRefresh;
  });

  useEffect(() => {
    // Foreground: notification arrives while app is open
    const receivedSub = Notifications.addNotificationReceivedListener(
      (notification) => {
        receivedRef.current?.(notification);
      },
    );

    // Tap/Response: user interacts with a notification
    const responseSub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        responseRef.current?.(response);
      },
    );

    // Token refresh: push token changed (rare but important)
    const tokenSub = Notifications.addPushTokenListener(({ data }) => {
      tokenRef.current?.(data);
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
      tokenSub.remove();
    };
  }, []);

  return null;
}
```

**Why good:** refs prevent re-subscription on callback changes, all three listener types covered, cleanup prevents leaks, token refresh keeps backend in sync

```typescript
// BAD: Listeners without cleanup
useEffect(() => {
  Notifications.addNotificationReceivedListener((n) => {
    console.log(n);
  });
  // No cleanup -- listener leaks on unmount, duplicates on re-render
}, []);
```

**Why bad:** no subscription reference stored, no cleanup on unmount, listener accumulates on every mount cycle

---

## Pattern 4: Handling Notification Tap (Navigation)

When a user taps a notification, extract the data payload and navigate to the relevant screen.

#### Using useLastNotificationResponse (Expo)

The `useLastNotificationResponse` hook handles all three states (foreground tap, background tap, and cold launch from notification).

```typescript
import { useEffect } from "react";
import * as Notifications from "expo-notifications";

const DEFAULT_ACTION = Notifications.DEFAULT_ACTION_IDENTIFIER;

export function useNotificationNavigation(
  navigate: (screen: string, params?: Record<string, unknown>) => void,
) {
  const lastResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!lastResponse) return;

    const actionId = lastResponse.actionIdentifier;
    if (actionId !== DEFAULT_ACTION) return; // Handle custom actions separately

    const data = lastResponse.notification.request.content.data;
    if (data?.screen) {
      navigate(data.screen as string, data.params as Record<string, unknown>);
    }
  }, [lastResponse, navigate]);
}
```

**Why good:** useLastNotificationResponse works for foreground taps, background taps, AND cold launch (replaces three separate listeners), checks actionIdentifier to distinguish default tap from custom actions

#### Using getInitialNotification (Firebase)

For Firebase, use `getInitialNotification()` for cold launch and `onNotificationOpenedApp()` for background tap.

```typescript
import { useEffect } from "react";
import messaging from "@react-native-firebase/messaging";

export function useFirebaseNotificationNavigation(
  navigate: (screen: string, params?: Record<string, unknown>) => void,
) {
  useEffect(() => {
    // Cold launch: app was killed, user tapped notification to open it
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage?.data?.screen) {
          navigate(
            remoteMessage.data.screen as string,
            remoteMessage.data as Record<string, unknown>,
          );
        }
      });

    // Background: app was minimized, user tapped notification
    const unsubscribe = messaging().onNotificationOpenedApp((remoteMessage) => {
      if (remoteMessage?.data?.screen) {
        navigate(
          remoteMessage.data.screen as string,
          remoteMessage.data as Record<string, unknown>,
        );
      }
    });

    return unsubscribe;
  }, [navigate]);
}
```

**Why good:** handles both cold launch (getInitialNotification) and background tap (onNotificationOpenedApp), cleanup on unmount, early call prevents missing the initial notification

**Gotcha:** `getInitialNotification()` returns null if called too late in the app lifecycle. Call it as early as possible, before navigation is fully initialized.

---

## Pattern 5: Background Message Handler (Firebase)

Must be registered at the TOP LEVEL of your entry file (index.js or App.tsx), not inside a component. Runs as a headless JS task.

```typescript
// index.js or app entry file -- TOP LEVEL, not inside a component
import messaging from "@react-native-firebase/messaging";

messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  // This runs in a headless JS context -- no UI access
  // Process data, update local storage, sync with server, etc.
  const { data } = remoteMessage;

  if (data?.type === "new-message") {
    // Update local unread count, sync badge, etc.
    // Do NOT try to navigate or update React state here
  }
});
```

**Why good:** registered at top level (not in component), async handler, accesses data only (no UI operations), processes silently

```typescript
// BAD: Background handler inside a component
function App() {
  useEffect(() => {
    // This is TOO LATE -- handler must be registered before React mounts
    messaging().setBackgroundMessageHandler(async (msg) => {
      // Also BAD: trying to set React state in headless context
      setMessages((prev) => [...prev, msg]);
    });
  }, []);
}
```

**Why bad:** registered inside component (too late for background delivery), tries to set React state in headless JS context (crashes), registration depends on component mount

---

## Pattern 6: Firebase Foreground Message Handling

Firebase does NOT display notifications when the app is in the foreground by default. You must handle display yourself using a local notification library or custom UI.

```typescript
import { useEffect } from "react";
import messaging from "@react-native-firebase/messaging";
import type { FirebaseMessagingTypes } from "@react-native-firebase/messaging";

export function useFirebaseForegroundMessages(
  onMessage: (message: FirebaseMessagingTypes.RemoteMessage) => void,
) {
  useEffect(() => {
    const unsubscribe = messaging().onMessage(async (remoteMessage) => {
      // Firebase does NOT display foreground notifications automatically
      // Option 1: Show via local notification library
      // Option 2: Show custom in-app UI (toast, banner)
      // Option 3: Update app state silently
      onMessage(remoteMessage);
    });

    return unsubscribe;
  }, [onMessage]);
}
```

**Why good:** cleanup via unsubscribe return, clear comment that Firebase requires manual foreground display, callback pattern for flexibility

---

## Pattern 7: Token Management with Backend Sync

Push tokens must be sent to your backend and kept up to date. Tokens can change when the app is reinstalled, restored from backup, or (rarely) rotated by FCM/APNs.

```typescript
import { useEffect, useCallback } from "react";
import * as Notifications from "expo-notifications";

async function syncTokenWithBackend(
  token: string,
  userId: string,
): Promise<void> {
  await fetch("https://your-api.example.com/push-tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, userId, platform: Platform.OS }),
  });
}

export function usePushTokenSync(userId: string) {
  const handleToken = useCallback(
    async (token: string) => {
      await syncTokenWithBackend(token, userId);
    },
    [userId],
  );

  useEffect(() => {
    // Send initial token
    registerForPushNotificationsAsync()
      .then((token) => {
        if (token) handleToken(token);
      })
      .catch((error) => {
        // Handle registration failure
      });

    // Listen for token refresh
    const subscription = Notifications.addPushTokenListener(({ data }) => {
      handleToken(data);
    });

    return () => subscription.remove();
  }, [handleToken]);
}
```

**Why good:** syncs token on initial registration AND on refresh, includes platform identifier for backend, cleanup on unmount, userId association for targeted notifications

---

## Pattern 8: Rich Notification Content

Push notifications support titles, bodies, images, sounds, badges, and custom data payloads.

#### Expo Push Service Payload

```typescript
// Server-side: sending via Expo Push Service
const message = {
  to: expoPushToken,
  title: "New Photo",
  body: "Sarah shared a photo with you",
  sound: "default",
  badge: 1,
  data: {
    screen: "photo-detail",
    photoId: "abc123",
    senderId: "user456",
  },
  // iOS-specific
  _contentAvailable: true, // Enables background processing
  // Android-specific
  channelId: "messages", // Must match a created channel
  priority: "high",
};
```

#### Firebase FCM Payload

```typescript
// Server-side: sending via FCM
const message = {
  token: fcmToken,
  notification: {
    title: "New Photo",
    body: "Sarah shared a photo with you",
    imageUrl: "https://example.com/photo-thumb.jpg", // Rich image
  },
  data: {
    screen: "photo-detail",
    photoId: "abc123",
  },
  android: {
    notification: {
      channelId: "messages",
      sound: "default",
      priority: "high",
      imageUrl: "https://example.com/photo-thumb.jpg",
    },
  },
  apns: {
    payload: {
      aps: {
        badge: 1,
        sound: "default",
        "content-available": 1,
        "mutable-content": 1, // Required for notification service extension (rich media on iOS)
      },
    },
    fcmOptions: {
      imageUrl: "https://example.com/photo-thumb.jpg",
    },
  },
};
```

**Why good:** data payload for navigation, channelId for Android, content-available for background delivery, mutable-content for iOS rich media, imageUrl for both platforms

**Gotcha for data-only messages (Firebase):** Messages without a `notification` key (data-only) require `priority: "high"` on Android and `content-available: 1` on iOS to trigger the background handler. Without these, the message may be silently dropped.
