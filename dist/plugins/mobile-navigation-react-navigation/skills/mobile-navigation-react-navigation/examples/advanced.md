# React Navigation - Advanced Patterns

> Screen preloading, state persistence, navigation guards, header customization. See [patterns.md](patterns.md) for auth flows and deep linking.

---

## Pattern 1: useFocusEffect for Resource Management

Screens in a stack stay mounted when covered by another screen. Use `useFocusEffect` to start/stop work based on screen visibility.

```typescript
import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

const POLL_INTERVAL_MS = 30_000;

// WebSocket connection: connect on focus, disconnect on blur
function ChatScreen({ roomId }: { roomId: string }) {
  useFocusEffect(
    useCallback(() => {
      const ws = new WebSocket(`wss://chat.example.com/rooms/${roomId}`);

      ws.onopen = () => {
        // Connected
      };

      // Cleanup: disconnect when screen loses focus
      return () => {
        ws.close();
      };
    }, [roomId])
  );

  return <ChatUI />;
}

// Polling: start on focus, stop on blur
function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);

  useFocusEffect(
    useCallback(() => {
      const fetch = async () => {
        const data = await api.getNotifications();
        setNotifications(data);
      };

      fetch();
      const interval = setInterval(fetch, POLL_INTERVAL_MS);

      return () => clearInterval(interval);
    }, [])
  );

  return <NotificationList data={notifications} />;
}
```

**Critical:** The callback passed to `useFocusEffect` MUST be wrapped in `useCallback`. Without it, the effect registers a new callback on every render, causing setup/teardown on every render cycle instead of only on focus/blur.

---

## Pattern 2: usePreventRemove for Unsaved Changes

Prevent the user from navigating away when there are unsaved changes.

```typescript
import { usePreventRemove } from "@react-navigation/native";
import { Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";

function EditProfileScreen() {
  const navigation = useNavigation();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  usePreventRemove(hasUnsavedChanges, ({ data }) => {
    Alert.alert(
      "Discard changes?",
      "You have unsaved changes. Are you sure you want to leave?",
      [
        { text: "Stay", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            // Dispatch the blocked action to proceed
            navigation.dispatch(data.action);
          },
        },
      ]
    );
  });

  return (
    <TextInput
      onChangeText={() => setHasUnsavedChanges(true)}
      // ...
    />
  );
}
```

**Limitations:**

- Only fires for removal actions (back, pop, reset) -- NOT for screen being covered (push, tab switch)
- Better alternative for data preservation: auto-save to persistent storage and offer restore on return

---

## Pattern 3: Screen Preloading

Preload heavy screens in the background before the user navigates. The screen renders off-screen with all hooks running.

```typescript
import { useNavigation } from "@react-navigation/native";
import { useCallback } from "react";

function ProductList({ products }: { products: Product[] }) {
  const navigation = useNavigation();

  // Preload on long press -- data fetching starts before user taps
  const handleLongPress = useCallback(
    (productId: string) => {
      navigation.preload("ProductDetail", { productId });
    },
    [navigation]
  );

  const handlePress = useCallback(
    (productId: string) => {
      navigation.navigate("ProductDetail", { productId });
    },
    [navigation]
  );

  const renderItem = useCallback(
    ({ item }: { item: Product }) => (
      <ProductCard
        product={item}
        onPress={() => handlePress(item.id)}
        onLongPress={() => handleLongPress(item.id)}
      />
    ),
    [handlePress, handleLongPress]
  );

  return (
    <FlatList
      data={products}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
    />
  );
}
```

**Preloaded screen limitations:**

- Cannot dispatch navigation actions
- Cannot call `navigation.setOptions()`
- Cannot listen to navigator events
- These restrictions lift once the user actually navigates to the screen

---

## Pattern 4: Navigation State Persistence

Restore the navigation state across app restarts (useful for development and optional for production).

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  NavigationContainer,
  type NavigationState,
} from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";

const NAV_STATE_KEY = "NAVIGATION_STATE_V7";

export function App() {
  const [isReady, setIsReady] = useState(false);
  const [initialState, setInitialState] = useState<NavigationState | undefined>();

  useEffect(() => {
    const restore = async () => {
      try {
        const saved = await AsyncStorage.getItem(NAV_STATE_KEY);
        if (saved) {
          setInitialState(JSON.parse(saved));
        }
      } catch {
        // Ignore restore errors -- start fresh
      } finally {
        setIsReady(true);
      }
    };

    restore();
  }, []);

  const handleStateChange = useCallback((state: NavigationState | undefined) => {
    if (state) {
      AsyncStorage.setItem(NAV_STATE_KEY, JSON.stringify(state));
    }
  }, []);

  if (!isReady) return <SplashScreen />;

  return (
    <NavigationContainer
      initialState={initialState}
      onStateChange={handleStateChange}
    >
      <RootNavigator />
    </NavigationContainer>
  );
}
```

**Caveats:**

- All params must be serializable (no functions, class instances, or circular references)
- Consider clearing persisted state on app version updates or if the screen structure changes
- If the app crashes on a specific screen, persisted state could cause a crash loop -- add error boundaries that clear state

---

## Pattern 5: Header Customization with Native Features

Native stack supports platform-native header features. These only work when NOT using a custom `header` function.

```typescript
// Large title (iOS) -- collapses on scroll
<Stack.Screen
  name="Settings"
  component={SettingsScreen}
  options={{
    title: "Settings",
    headerLargeTitleEnabled: true,
    headerLargeStyle: { backgroundColor: "#F5F5F5" },
    headerLargeTitleStyle: { fontWeight: "bold" },
    headerLargeTitleShadowVisible: false,
  }}
/>
```

```typescript
// Search bar in header (iOS + Android)
function SettingsScreen() {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState("");

  // Must use useLayoutEffect to set options before first paint
  useLayoutEffect(() => {
    navigation.setOptions({
      headerSearchBarOptions: {
        placeholder: "Search settings...",
        onChangeText: (event: { nativeEvent: { text: string } }) => {
          setSearchQuery(event.nativeEvent.text);
        },
        hideWhenScrolling: true,
      },
    });
  }, [navigation]);

  return (
    // contentInsetAdjustmentBehavior required for proper search bar layout
    <ScrollView contentInsetAdjustmentBehavior="automatic">
      <SettingsContent filter={searchQuery} />
    </ScrollView>
  );
}
```

```typescript
// Custom header buttons (preserves native header features)
<Stack.Screen
  name="Profile"
  component={ProfileScreen}
  options={{
    headerRight: () => (
      <Pressable onPress={handleEdit}>
        <Text>Edit</Text>
      </Pressable>
    ),
  }}
/>
```

**Critical:** If you provide a custom `header` function (not `headerLeft`/`headerRight`), ALL native features are disabled: large titles, search bars, blur effects, native back button.

---

## Pattern 6: Form Sheet Presentation (iOS/Android)

```typescript
<Stack.Screen
  name="Filter"
  component={FilterScreen}
  options={{
    presentation: "formSheet",
    sheetAllowedDetents: [0.25, 0.5, 1.0],
    sheetInitialDetentIndex: 1,
    sheetGrabberVisible: true,
    sheetCornerRadius: 16,
    sheetExpandsWhenScrolledToEdge: true,
  }}
/>
```

**Detent values:** Fractions of screen height (0.25 = quarter screen) or `"fitToContents"` for auto-sizing.

---

## Pattern 7: Theme Configuration (v7 Requirement)

v7 themes require a `fonts` property. Always spread `DefaultTheme` to include it.

```typescript
import { DefaultTheme, type Theme } from "@react-navigation/native";

const APP_THEME: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: "#007AFF",
    background: "#FFFFFF",
    card: "#F5F5F5",
    text: "#1C1C1E",
    border: "#E5E5EA",
    notification: "#FF3B30",
  },
  // fonts is inherited from DefaultTheme spread -- DON'T omit it
};

// Static API
<Navigation theme={APP_THEME} />

// Dynamic API
<NavigationContainer theme={APP_THEME}>
```
