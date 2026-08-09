# Push Notifications - Scheduling, Channels, Categories

> Local notification scheduling, trigger types, Android channels, notification categories with interactive actions, badge management. See [SKILL.md](../SKILL.md) for decision guidance.

**Related:** [core.md](core.md) for permission flow, token management, and remote notification listeners.

---

## Pattern 1: Local Notification Triggers

expo-notifications supports multiple trigger types for scheduling local notifications. Trigger types differ between Android and iOS.

#### Immediate Notification

```typescript
import * as Notifications from "expo-notifications";

// Fire immediately (trigger: null)
await Notifications.scheduleNotificationAsync({
  content: {
    title: "Action Complete",
    body: "Your download has finished",
    data: { screen: "downloads" },
  },
  trigger: null, // Fires immediately
});
```

#### Time Interval Trigger

```typescript
const REMINDER_DELAY_SECONDS = 3600; // 1 hour

await Notifications.scheduleNotificationAsync({
  content: {
    title: "Reminder",
    body: "Come back and finish your workout!",
    sound: "default",
  },
  trigger: {
    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
    seconds: REMINDER_DELAY_SECONDS,
    repeats: false, // Set true for repeating (minimum 60 seconds interval)
  },
});
```

#### Date Trigger

```typescript
const reminderDate = new Date("2025-12-25T09:00:00");

await Notifications.scheduleNotificationAsync({
  content: {
    title: "Merry Christmas!",
    body: "Open the app for a special surprise",
  },
  trigger: {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date: reminderDate,
  },
});
```

#### Daily Recurring Trigger (Android)

```typescript
const DAILY_REMINDER_HOUR = 9;
const DAILY_REMINDER_MINUTE = 0;

// Android: DailyTrigger
await Notifications.scheduleNotificationAsync({
  content: {
    title: "Daily Check-in",
    body: "How are you feeling today?",
  },
  trigger: {
    type: Notifications.SchedulableTriggerInputTypes.DAILY,
    hour: DAILY_REMINDER_HOUR,
    minute: DAILY_REMINDER_MINUTE,
  },
});
```

#### Weekly Recurring Trigger (Android)

```typescript
const MONDAY = 2; // 1=Sunday, 2=Monday, ..., 7=Saturday
const WEEKLY_HOUR = 10;
const WEEKLY_MINUTE = 0;

// Android: WeeklyTrigger
await Notifications.scheduleNotificationAsync({
  content: {
    title: "Weekly Review",
    body: "Time to review your goals for the week",
  },
  trigger: {
    type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
    weekday: MONDAY,
    hour: WEEKLY_HOUR,
    minute: WEEKLY_MINUTE,
  },
});
```

#### Calendar Trigger (iOS)

```typescript
const DAILY_REMINDER_HOUR = 9;
const DAILY_REMINDER_MINUTE = 0;

// iOS: CalendarTrigger for daily recurrence
await Notifications.scheduleNotificationAsync({
  content: {
    title: "Daily Check-in",
    body: "How are you feeling today?",
  },
  trigger: {
    type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
    repeats: true,
    dateComponents: {
      hour: DAILY_REMINDER_HOUR,
      minute: DAILY_REMINDER_MINUTE,
    },
  },
});
```

**Why good:** explicit trigger types, named constants for all time values, repeats flag explicit

**Gotcha:** `DailyTrigger`, `WeeklyTrigger`, and `YearlyTrigger` are Android-only. Use `CalendarTrigger` with `dateComponents` on iOS for the same functionality. Wrap in `Platform.OS` check for cross-platform code.

---

## Pattern 2: Managing Scheduled Notifications

```typescript
import * as Notifications from "expo-notifications";

const EXAMPLE_DELAY_SECONDS = 60;

// List all scheduled notifications
const scheduled = await Notifications.getAllScheduledNotificationsAsync();

// Cancel a specific notification by its identifier
const notificationId = await Notifications.scheduleNotificationAsync({
  content: { title: "Reminder", body: "..." },
  trigger: {
    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
    seconds: EXAMPLE_DELAY_SECONDS,
  },
});
await Notifications.cancelScheduledNotificationAsync(notificationId);

// Cancel all scheduled notifications
await Notifications.cancelAllScheduledNotificationsAsync();
```

**Why good:** stores notification ID for targeted cancellation, lists existing before scheduling to avoid duplicates

---

## Pattern 3: Android Notification Channels and Groups

Channels group notifications by type and let users control sound, vibration, and importance per group. Channel groups organize related channels.

```typescript
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Channel definitions as constants
const CHANNEL_GROUP_SOCIAL = "social";

const CHANNELS = {
  messages: {
    id: "messages",
    name: "Direct Messages",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
    groupId: CHANNEL_GROUP_SOCIAL,
  },
  groupChat: {
    id: "group-chat",
    name: "Group Chats",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: "default",
    groupId: CHANNEL_GROUP_SOCIAL,
  },
  appUpdates: {
    id: "app-updates",
    name: "App Updates",
    importance: Notifications.AndroidImportance.LOW,
  },
  marketing: {
    id: "marketing",
    name: "Promotions & Offers",
    importance: Notifications.AndroidImportance.MIN,
    description: "Special offers and promotions",
  },
} as const;

async function setupAndroidChannels() {
  if (Platform.OS !== "android") return;

  // Create channel groups first
  await Notifications.setNotificationChannelGroupAsync(CHANNEL_GROUP_SOCIAL, {
    name: "Social",
    description: "Messages and group chats",
  });

  // Create individual channels
  for (const channel of Object.values(CHANNELS)) {
    await Notifications.setNotificationChannelAsync(channel.id, {
      name: channel.name,
      importance: channel.importance,
      sound: "sound" in channel ? channel.sound : undefined,
      vibrationPattern:
        "vibrationPattern" in channel ? channel.vibrationPattern : undefined,
      groupId: "groupId" in channel ? channel.groupId : undefined,
      description: "description" in channel ? channel.description : undefined,
    });
  }
}
```

**Why good:** channels defined as constants with groups, group created before channels that reference it, Platform.OS guard, importance levels match notification priority

**Gotcha:** Once a user changes a channel's settings in Android system settings, your code CANNOT override those preferences. You can only set defaults on channel creation. To change settings after creation, you must create a NEW channel with a new ID.

---

## Pattern 4: Notification Categories with Interactive Actions

Categories define action buttons and text input fields that appear on notifications. Register at app startup.

```typescript
import * as Notifications from "expo-notifications";

async function setupNotificationCategories() {
  // Message category: reply + mark read
  await Notifications.setNotificationCategoryAsync("message", [
    {
      identifier: "reply",
      buttonTitle: "Reply",
      textInput: {
        submitButtonTitle: "Send",
        placeholder: "Type a reply...",
      },
      options: {
        opensAppToForeground: true, // Open app when replying
      },
    },
    {
      identifier: "mark-read",
      buttonTitle: "Mark as Read",
      options: {
        opensAppToForeground: false, // Handle silently in background
      },
    },
  ]);

  // Social category: like + view
  await Notifications.setNotificationCategoryAsync("social", [
    {
      identifier: "like",
      buttonTitle: "Like",
      options: {
        opensAppToForeground: false,
      },
    },
    {
      identifier: "view",
      buttonTitle: "View",
      options: {
        opensAppToForeground: true,
      },
    },
  ]);
}
```

#### Handling Action Responses

```typescript
import * as Notifications from "expo-notifications";

function handleNotificationAction(
  response: Notifications.NotificationResponse,
) {
  const actionId = response.actionIdentifier;
  const data = response.notification.request.content.data;

  switch (actionId) {
    case Notifications.DEFAULT_ACTION_IDENTIFIER:
      // User tapped the notification body (not an action button)
      navigateToScreen(data);
      break;

    case "reply": {
      // Extract text input from the response
      const userInput = response.userText;
      if (userInput && data?.conversationId) {
        sendReply(data.conversationId as string, userInput);
      }
      break;
    }

    case "mark-read":
      if (data?.conversationId) {
        markAsRead(data.conversationId as string);
      }
      break;

    case "like":
      if (data?.postId) {
        likePost(data.postId as string);
      }
      break;
  }
}
```

**Why good:** DEFAULT_ACTION_IDENTIFIER distinguishes body tap from button tap, userText extracted for text input actions, opensAppToForeground controls whether actions launch the app

**Gotcha:** To trigger categories on push notifications, include `categoryIdentifier` in the notification content (Expo) or `category` in the APNs payload.

---

## Pattern 5: Badge Count Management

```typescript
import * as Notifications from "expo-notifications";

const BADGE_CLEAR = 0;

// Get current badge count
const currentBadge = await Notifications.getBadgeCountAsync();

// Set badge count (e.g., unread message count)
await Notifications.setBadgeCountAsync(unreadCount);

// Clear badge when user opens app
await Notifications.setBadgeCountAsync(BADGE_CLEAR);
```

**Why good:** named constant for clear operation, straightforward API

**Gotcha on Android:** Badge count behavior varies by Android launcher. Not all Android launchers support badge counts. Some require specific launcher APIs or notification channels to display badges correctly.

---

## Pattern 6: Dismissing Notifications from the Tray

```typescript
import * as Notifications from "expo-notifications";

// Get all presented notifications currently in the notification tray
const presented = await Notifications.getPresentedNotificationsAsync();

// Dismiss a specific notification
await Notifications.dismissNotificationAsync(notificationId);

// Dismiss all notifications (e.g., when user opens the conversation list)
await Notifications.dismissAllNotificationsAsync();
```

**Why good:** can inspect presented notifications before dismissing, targeted dismissal for specific conversations, bulk dismiss for app-wide clear

---

## Pattern 7: Topic Subscriptions

Subscribe devices to topics for broadcast-style notifications (e.g., "breaking-news", "sports-scores").

#### Expo

```typescript
import * as Notifications from "expo-notifications";

// Subscribe to a topic (Android only for expo-notifications)
await Notifications.subscribeToTopicAsync("breaking-news");

// Unsubscribe
await Notifications.unsubscribeFromTopicAsync("breaking-news");
```

#### Firebase

```typescript
import messaging from "@react-native-firebase/messaging";

// Subscribe to topic
await messaging().subscribeToTopic("breaking-news");

// Unsubscribe
await messaging().unsubscribeFromTopic("breaking-news");
```

**Why good:** server sends one message to topic, all subscribers receive it, no need to track individual tokens for broadcast messages
