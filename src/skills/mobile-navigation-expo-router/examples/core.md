# Expo Router Core Patterns

> Layouts, tabs, navigation hooks, dynamic routes, modals, typed routes. See [SKILL.md](../SKILL.md) for decisions and philosophy.

---

## Directory Structure

```
app/
├── _layout.tsx              # Root layout (Stack navigator)
├── index.tsx                # Home route (/)
├── about.tsx                # /about
├── +not-found.tsx           # 404 fallback
├── modal.tsx                # /modal (configured as modal in root layout)
├── settings/
│   ├── _layout.tsx          # Settings stack layout
│   ├── index.tsx            # /settings
│   └── profile.tsx          # /settings/profile
├── users/
│   ├── _layout.tsx          # Users layout
│   ├── index.tsx            # /users
│   └── [id].tsx             # /users/:id (dynamic)
├── docs/
│   └── [...slug].tsx        # /docs/a/b/c (catch-all)
├── (tabs)/                  # Tab navigator (group -- not in URL)
│   ├── _layout.tsx          # Tab layout
│   ├── home.tsx             # Tab: home
│   ├── search.tsx           # Tab: search
│   └── profile.tsx          # Tab: profile
└── api/
    └── users+api.ts         # API route: /api/users
```

---

## Root Layout with Stack

```typescript
// app/_layout.tsx
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Home" }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
      <Stack.Screen
        name="modal"
        options={{
          presentation: "modal",
          headerShown: true,
          title: "Modal",
        }}
      />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
```

---

## Tab Navigation

```typescript
// app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";

const TAB_ICON_SIZE = 24;

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#007AFF",
        tabBarInactiveTintColor: "#8E8E93",
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <IconComponent name="home" size={TAB_ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color }) => <IconComponent name="search" size={TAB_ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <IconComponent name="person" size={TAB_ICON_SIZE} color={color} />,
        }}
      />
    </Tabs>
  );
}
```

---

## Nested Stack Inside Tabs

```
app/
├── (tabs)/
│   ├── _layout.tsx           # Tab navigator
│   ├── feed/
│   │   ├── _layout.tsx       # Stack navigator for feed tab
│   │   ├── index.tsx         # Feed list (/feed)
│   │   └── [postId].tsx      # Post detail (/feed/:postId)
│   └── settings.tsx          # Settings tab
```

```typescript
// app/(tabs)/feed/_layout.tsx
import { Stack } from "expo-router";

export default function FeedLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Feed" }} />
      <Stack.Screen
        name="[postId]"
        options={{ title: "Post", headerBackTitle: "Feed" }}
      />
    </Stack>
  );
}

// app/(tabs)/feed/[postId].tsx
import { useLocalSearchParams, Stack } from "expo-router";
import { View, Text, StyleSheet } from "react-native";

export default function PostDetailScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();

  return (
    <>
      {/* Dynamic screen options -- overrides layout config */}
      <Stack.Screen options={{ title: `Post ${postId}` }} />
      <View style={styles.container}>
        <Text style={styles.title}>Post {postId}</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: "bold" },
});
```

---

## Navigation Hooks Usage

```typescript
// components/navigation-example.tsx
import {
  useRouter,
  useLocalSearchParams,
  usePathname,
  useSegments,
  Link,
} from "expo-router";
import { View, Text, Pressable, StyleSheet } from "react-native";

export function NavigationExample() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const pathname = usePathname();
  const segments = useSegments();

  const handlePush = () => {
    router.push("/users/123");
  };

  const handlePushWithParams = () => {
    // Object form for typed routes
    router.push({
      pathname: "/users/[id]",
      params: { id: "456" },
    });
  };

  const handleReplace = () => {
    // Replace -- no back button to return
    router.replace("/home");
  };

  const handleDismiss = () => {
    // Dismiss modal or pop stack screen
    if (router.canDismiss()) {
      router.dismissTo("/home");
    }
  };

  return (
    <View style={styles.container}>
      {/* Declarative navigation -- preferred for static links */}
      <Link href="/about" style={styles.link}>
        <Text>About</Text>
      </Link>

      {/* Link with asChild -- passes navigation behavior to child */}
      <Link href="/users/123" asChild>
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>User Profile</Text>
        </Pressable>
      </Link>

      {/* Link with params object */}
      <Link
        href={{ pathname: "/search", params: { query: "expo" } }}
        style={styles.link}
      >
        <Text>Search for Expo</Text>
      </Link>

      {/* Imperative navigation */}
      <Pressable style={styles.button} onPress={handlePush}>
        <Text style={styles.buttonText}>Push Screen</Text>
      </Pressable>

      <Text style={styles.info}>Path: {pathname}</Text>
      <Text style={styles.info}>Segments: {segments.join("/")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  link: { padding: 12, backgroundColor: "#f0f0f0", borderRadius: 8 },
  button: { padding: 12, backgroundColor: "#007AFF", borderRadius: 8, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600" },
  info: { fontSize: 12, color: "#666" },
});
```

---

## Dynamic Route

```typescript
// app/users/[id].tsx
import { useLocalSearchParams, Stack } from "expo-router";
import { View, Text } from "react-native";

export default function UserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <>
      <Stack.Screen options={{ title: `User ${id}` }} />
      <View style={{ flex: 1, padding: 16 }}>
        <Text>User ID: {id}</Text>
      </View>
    </>
  );
}
```

---

## Catch-All Route

```typescript
// app/docs/[...slug].tsx
import { useLocalSearchParams } from "expo-router";
import { View, Text } from "react-native";

export default function DocsScreen() {
  const { slug } = useLocalSearchParams<{ slug: string[] }>();

  // IMPORTANT: Normalize -- single segment returns string, multiple returns array
  const segments = Array.isArray(slug) ? slug : [slug];
  const path = segments.join("/");

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text>Docs path: {path}</Text>
      <Text>Depth: {segments.length} levels</Text>
    </View>
  );
}
```

---

## Modal Route

```typescript
// app/modal.tsx -- the file itself is a regular route
import { useRouter } from "expo-router";
import { View, Text, Pressable, StyleSheet } from "react-native";

export default function ModalScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Modal Content</Text>
      <Pressable style={styles.closeButton} onPress={() => router.back()}>
        <Text style={styles.closeText}>Close</Text>
      </Pressable>
    </View>
  );
}

// The modal PRESENTATION is configured in the PARENT layout:
// app/_layout.tsx -> <Stack.Screen name="modal" options={{ presentation: "modal" }} />

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 16 },
  closeButton: { padding: 12, backgroundColor: "#007AFF", borderRadius: 8 },
  closeText: { color: "#fff", fontWeight: "600" },
});
```

---

## Form Sheet (iOS)

```typescript
// Configure in parent layout
<Stack.Screen
  name="sheet"
  options={{
    presentation: "formSheet",
    sheetGrabberVisible: true,
    sheetCornerRadius: 16,
    // Optional: control sheet height
    // sheetInitialDetentIndex: 0,
    // sheetAllowedDetents: [0.5, 1.0],
  }}
/>
```

---

## Shared Routes Between Tab Groups

When multiple tabs need to show the same screen (e.g., a user profile accessible from both feed and search):

```
app/(tabs)/
├── _layout.tsx
├── (feed)/
│   └── index.tsx            # Feed tab content
├── (search)/
│   └── search.tsx           # Search tab content
└── (feed,search)/           # Shared between both groups
    ├── _layout.tsx
    └── users/
        └── [username].tsx   # Accessible from both feed and search
```

```typescript
// app/(tabs)/(feed,search)/users/[username].tsx
import { useLocalSearchParams } from "expo-router";
import { View, Text, StyleSheet } from "react-native";

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>@{username}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: "bold" },
});
```

---

## Headless Tabs (Custom Tab Bar UI)

When the default tab bar doesn't fit your design, use headless tab components from `expo-router/ui` for full control over rendering:

```typescript
// app/(tabs)/_layout.tsx
import { Tabs, TabList, TabTrigger, TabSlot } from "expo-router/ui";
import { Text, StyleSheet } from "react-native";

const TAB_BAR_HEIGHT = 60;

export default function CustomTabLayout() {
  return (
    <Tabs>
      {/* Content area -- renders the active tab's content */}
      <TabSlot />

      {/* Fully custom tab bar */}
      <TabList style={styles.tabBar}>
        <TabTrigger name="home" href="/" style={styles.tab}>
          <Text>Home</Text>
        </TabTrigger>
        <TabTrigger name="search" href="/search" style={styles.tab}>
          <Text>Search</Text>
        </TabTrigger>
        <TabTrigger name="profile" href="/profile" style={styles.tab}>
          <Text>Profile</Text>
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    height: TAB_BAR_HEIGHT,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center" },
});
```

---

## Typed Routes Setup

```json
// app.json
{
  "expo": {
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

```typescript
// After enabling and starting dev server, routes are auto-typed:
import { useRouter, useLocalSearchParams, Link } from "expo-router";

export function TypedNavigationExample() {
  const router = useRouter();

  // TypeScript validates route exists
  router.push("/about");

  // TypeScript requires correct params for dynamic routes
  router.push({ pathname: "/users/[id]", params: { id: "123" } });

  // TypeScript errors on invalid routes
  // router.push("/nonexistent"); // Error!

  // Typed params from route
  const { id } = useLocalSearchParams<"/users/[id]">();
  // id is typed as string

  // Typed Link
  return <Link href={{ pathname: "/users/[id]", params: { id: "456" } }}>User</Link>;
}
```

---

## 404 Not Found Route

```typescript
// app/+not-found.tsx
import { Link, Stack } from "expo-router";
import { View, Text, StyleSheet } from "react-native";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not Found" }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen does not exist.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go to home screen</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  title: { fontSize: 20, fontWeight: "bold" },
  link: { marginTop: 16, paddingVertical: 16 },
  linkText: { fontSize: 14, color: "#2e78b7" },
});
```

---

## useFocusEffect for Data Fetching

```typescript
// Fetch data when screen comes into focus (e.g., returning from edit screen)
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

export default function UserListScreen() {
  const [users, setUsers] = useState([]);

  useFocusEffect(
    useCallback(() => {
      // Runs on focus, cleanup on blur
      let isActive = true;

      async function fetchUsers() {
        const data = await getUsers();
        if (isActive) setUsers(data);
      }

      fetchUsers();

      return () => {
        isActive = false; // Prevent state update after blur
      };
    }, []),
  );

  // Render users...
}
```
