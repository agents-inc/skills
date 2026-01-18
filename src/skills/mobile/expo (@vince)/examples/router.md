# Expo Router Patterns

File-based routing for React Native applications.

---

## Route Notation Reference

| Notation | Example | URL | Description |
|----------|---------|-----|-------------|
| Static | `about.tsx` | `/about` | Direct URL match |
| Index | `index.tsx` | `/` or parent path | Default route for directory |
| Dynamic | `[id].tsx` | `/123` | Single dynamic segment |
| Catch-all | `[...slug].tsx` | `/a/b/c` | Multiple dynamic segments |
| Group | `(tabs)/` | Not in URL | Organize without affecting URL |
| Layout | `_layout.tsx` | N/A | Wraps sibling routes |
| Not Found | `+not-found.tsx` | N/A | 404 fallback |

---

## Directory Structure

```
app/
├── _layout.tsx              # Root layout
├── index.tsx                # Home route (/)
├── about.tsx                # /about
├── +not-found.tsx           # 404 fallback
├── settings/
│   ├── _layout.tsx          # Settings stack layout
│   ├── index.tsx            # /settings
│   └── profile.tsx          # /settings/profile
├── users/
│   ├── _layout.tsx          # Users layout
│   ├── index.tsx            # /users
│   └── [id].tsx             # /users/:id (dynamic)
├── posts/
│   └── [...slug].tsx        # /posts/a/b/c (catch-all)
└── (tabs)/                  # Tab navigator (group)
    ├── _layout.tsx          # Tab layout
    ├── home.tsx             # Tab: home
    ├── search.tsx           # Tab: search
    └── profile.tsx          # Tab: profile
```

---

## Root Layout

```typescript
// app/_layout.tsx
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "Inter-Regular": require("../assets/fonts/Inter-Regular.ttf"),
    "Inter-Bold": require("../assets/fonts/Inter-Bold.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="index" options={{ title: "Home" }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="modal"
          options={{
            presentation: "modal",
            headerShown: true,
          }}
        />
        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  );
}
```

---

## Tab Navigation

```typescript
// app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const TAB_ICON_SIZE = 24;

type TabIconName = keyof typeof Ionicons.glyphMap;

interface TabIconProps {
  name: TabIconName;
  focusedName: TabIconName;
  color: string;
  focused: boolean;
}

function TabIcon({ name, focusedName, color, focused }: TabIconProps) {
  return (
    <Ionicons
      name={focused ? focusedName : name}
      size={TAB_ICON_SIZE}
      color={color}
    />
  );
}

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
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="home-outline"
              focusedName="home"
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="search-outline"
              focusedName="search"
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="person-outline"
              focusedName="person"
              color={color}
              focused={focused}
            />
          ),
        }}
      />
    </Tabs>
  );
}
```

---

## Stack Inside Tabs (Nested Navigation)

```
app/
├── (tabs)/
│   ├── _layout.tsx           # Tab navigator
│   ├── feed/
│   │   ├── _layout.tsx       # Stack navigator for feed
│   │   ├── index.tsx         # Feed list
│   │   └── [postId].tsx      # Post detail
│   └── settings.tsx
```

```typescript
// app/(tabs)/feed/_layout.tsx
import { Stack } from "expo-router";

export default function FeedLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{ title: "Feed" }}
      />
      <Stack.Screen
        name="[postId]"
        options={{
          title: "Post",
          headerBackTitle: "Feed",
        }}
      />
    </Stack>
  );
}

// app/(tabs)/feed/index.tsx
import { FlatList, Pressable, Text, View } from "react-native";
import { Link } from "expo-router";

interface Post {
  id: string;
  title: string;
}

const POSTS: Post[] = [
  { id: "1", title: "First Post" },
  { id: "2", title: "Second Post" },
];

export default function FeedScreen() {
  return (
    <FlatList
      data={POSTS}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <Link href={`/feed/${item.id}`} asChild>
          <Pressable style={{ padding: 16 }}>
            <Text>{item.title}</Text>
          </Pressable>
        </Link>
      )}
    />
  );
}

// app/(tabs)/feed/[postId].tsx
import { useLocalSearchParams } from "expo-router";
import { View, Text, StyleSheet } from "react-native";

export default function PostDetailScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Post ID: {postId}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
  },
});
```

---

## Dynamic Routes

```typescript
// app/users/[id].tsx
import { useLocalSearchParams, Stack } from "expo-router";
import { View, Text, StyleSheet } from "react-native";

export default function UserScreen() {
  // Type-safe params
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <>
      <Stack.Screen options={{ title: `User ${id}` }} />
      <View style={styles.container}>
        <Text style={styles.heading}>User Profile</Text>
        <Text style={styles.id}>ID: {id}</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  heading: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  id: {
    fontSize: 16,
    color: "#666",
  },
});
```

---

## Catch-All Routes

```typescript
// app/docs/[...slug].tsx
import { useLocalSearchParams } from "expo-router";
import { View, Text, StyleSheet } from "react-native";

export default function DocsScreen() {
  // slug is an array: /docs/api/auth/login -> ["api", "auth", "login"]
  const { slug } = useLocalSearchParams<{ slug: string[] }>();

  const path = Array.isArray(slug) ? slug.join("/") : slug;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Documentation</Text>
      <Text style={styles.path}>Path: {path}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  heading: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  path: {
    fontSize: 16,
    color: "#666",
  },
});
```

---

## Navigation Hooks

```typescript
// components/navigation-example.tsx
import {
  useRouter,
  useLocalSearchParams,
  useGlobalSearchParams,
  usePathname,
  useSegments,
  Link,
} from "expo-router";
import { View, Text, Pressable, StyleSheet } from "react-native";

export function NavigationExample() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const globalParams = useGlobalSearchParams();
  const pathname = usePathname();
  const segments = useSegments();

  const handlePush = () => {
    // Push new screen onto stack
    router.push("/users/123");
  };

  const handleReplace = () => {
    // Replace current screen
    router.replace("/home");
  };

  const handleBack = () => {
    // Go back
    router.back();
  };

  const handleNavigateWithParams = () => {
    // Navigate with typed params
    router.push({
      pathname: "/users/[id]",
      params: { id: "456" },
    });
  };

  const handleDismissModal = () => {
    // Dismiss to specific route (Expo Router 4+)
    router.dismissTo("/home");
  };

  return (
    <View style={styles.container}>
      {/* Declarative navigation with Link */}
      <Link href="/about" style={styles.link}>
        <Text>Go to About</Text>
      </Link>

      {/* Link with asChild - pass navigation to child */}
      <Link href="/users/123" asChild>
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>User Profile</Text>
        </Pressable>
      </Link>

      {/* Link with params object */}
      <Link
        href={{
          pathname: "/search",
          params: { query: "expo" },
        }}
        style={styles.link}
      >
        <Text>Search for Expo</Text>
      </Link>

      {/* Imperative navigation */}
      <Pressable style={styles.button} onPress={handlePush}>
        <Text style={styles.buttonText}>Push Screen</Text>
      </Pressable>

      <Text style={styles.info}>Current path: {pathname}</Text>
      <Text style={styles.info}>Segments: {segments.join("/")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  link: {
    padding: 12,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
  },
  button: {
    padding: 12,
    backgroundColor: "#007AFF",
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
  info: {
    fontSize: 12,
    color: "#666",
  },
});
```

---

## Authentication Flow

```typescript
// app/_layout.tsx
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { useAuth } from "../hooks/use-auth";

function useProtectedRoute(isAuthenticated: boolean) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const inAuthGroup = segments[0] === "(auth)";

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace("/login");
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to home if authenticated
      router.replace("/");
    }
  }, [isAuthenticated, segments]);
}

export default function RootLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  useProtectedRoute(isAuthenticated);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Stack>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
```

```
app/
├── _layout.tsx              # Root layout with auth check
├── (auth)/                  # Auth screens (unprotected)
│   ├── _layout.tsx
│   ├── login.tsx
│   └── register.tsx
└── (tabs)/                  # Main app (protected)
    ├── _layout.tsx
    ├── index.tsx
    └── profile.tsx
```

---

## Modal Routes

```typescript
// app/_layout.tsx
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="modal"
        options={{
          presentation: "modal",
          headerShown: true,
          title: "Settings",
        }}
      />
      <Stack.Screen
        name="sheet"
        options={{
          presentation: "formSheet",
          sheetGrabberVisible: true,
          sheetCornerRadius: 16,
        }}
      />
    </Stack>
  );
}

// app/modal.tsx
import { useRouter } from "expo-router";
import { View, Text, Pressable, StyleSheet } from "react-native";

export default function ModalScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Modal Content</Text>
      <Pressable
        style={styles.closeButton}
        onPress={() => router.back()}
      >
        <Text style={styles.closeText}>Close</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
  },
  closeButton: {
    padding: 12,
    backgroundColor: "#007AFF",
    borderRadius: 8,
  },
  closeText: {
    color: "#fff",
    fontWeight: "600",
  },
});
```

---

## Not Found Screen

```typescript
// app/+not-found.tsx
import { Link, Stack } from "expo-router";
import { View, Text, StyleSheet } from "react-native";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Page Not Found" }} />
      <View style={styles.container}>
        <Text style={styles.title}>404</Text>
        <Text style={styles.message}>This page does not exist.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go to Home</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#666",
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    color: "#888",
    marginBottom: 24,
  },
  link: {
    padding: 12,
    backgroundColor: "#007AFF",
    borderRadius: 8,
  },
  linkText: {
    color: "#fff",
    fontWeight: "600",
  },
});
```

---

## TypeScript Route Types

```typescript
// types/navigation.ts
import type { Href } from "expo-router";

// Enable typed routes in app.json:
// { "experiments": { "typedRoutes": true } }

// After enabling, routes are auto-generated in:
// .expo/types/router.d.ts

// Usage with type safety
const homeRoute: Href = "/";
const userRoute: Href = "/users/123";
const searchRoute: Href = { pathname: "/search", params: { query: "test" } };

// TypeScript will error on invalid routes
// const invalidRoute: Href = "/nonexistent"; // Error!
```

---

## Shared Routes Between Tabs

```
app/(tabs)/
├── _layout.tsx
├── (feed)/
│   └── index.tsx            # Feed tab content
├── (search)/
│   └── search.tsx           # Search tab content
└── (feed,search)/           # Shared between both tabs
    ├── _layout.tsx
    └── users/
        └── [username].tsx   # Accessible from both feed and search tabs
```

```typescript
// app/(tabs)/(feed,search)/users/[username].tsx
import { useLocalSearchParams } from "expo-router";
import { View, Text, StyleSheet } from "react-native";

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();

  // This screen is accessible from both tabs
  // URL: /users/:username

  return (
    <View style={styles.container}>
      <Text style={styles.title}>@{username}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
  },
});
```

---

## Headless Tabs (Custom Tab Layouts)

SDK 52+ provides headless tab components via `expo-router/ui` for fully custom tab layouts. This feature is experimentally available in SDK 52 and later.

### Basic Headless Tabs

```typescript
// app/(tabs)/_layout.tsx
import { Tabs, TabList, TabTrigger, TabSlot } from "expo-router/ui";
import { View, Text, Pressable, StyleSheet } from "react-native";

const TAB_BAR_HEIGHT = 60;

export default function CustomTabLayout() {
  return (
    <Tabs>
      {/* Content area */}
      <TabSlot />

      {/* Custom tab bar */}
      <TabList style={styles.tabBar}>
        <TabTrigger name="home" href="/" asChild>
          <Pressable style={styles.tab}>
            {({ isFocused }) => (
              <Text style={[styles.tabText, isFocused && styles.tabTextFocused]}>
                Home
              </Text>
            )}
          </Pressable>
        </TabTrigger>

        <TabTrigger name="search" href="/search" asChild>
          <Pressable style={styles.tab}>
            {({ isFocused }) => (
              <Text style={[styles.tabText, isFocused && styles.tabTextFocused]}>
                Search
              </Text>
            )}
          </Pressable>
        </TabTrigger>

        <TabTrigger name="profile" href="/profile" asChild>
          <Pressable style={styles.tab}>
            {({ isFocused }) => (
              <Text style={[styles.tabText, isFocused && styles.tabTextFocused]}>
                Profile
              </Text>
            )}
          </Pressable>
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
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: {
    fontSize: 14,
    color: "#8E8E93",
  },
  tabTextFocused: {
    color: "#007AFF",
    fontWeight: "600",
  },
});
```

### TabTrigger Props

| Prop | Type | Description |
|------|------|-------------|
| `name` | string | Required identifier for the tab |
| `href` | string | Required route destination (in TabList) |
| `reset` | "always" \| "onLongPress" \| "never" | Navigation state reset behavior |
| `asChild` | boolean | Pass navigation to child component |
| `isFocused` | boolean | Forwarded prop indicating active state |

### Native Tabs (SDK 54+ Alpha)

SDK 54 introduces true native tabs with iOS 26 Liquid Glass support. **Note: This API is in alpha and subject to change.**

```typescript
// app/(tabs)/_layout.tsx
// IMPORTANT: Import from unstable-native-tabs, not expo-router
import { NativeTabs, Icon, Label, Badge } from "expo-router/unstable-native-tabs";

const TAB_BAR_TINT_COLOR = "#007AFF";

export default function TabLayout() {
  return (
    <NativeTabs
      tintColor={TAB_BAR_TINT_COLOR}
      minimizeBehavior="onScrollDown" // iOS 26+
    >
      <NativeTabs.Trigger name="index">
        <Icon sf="house.fill" />
        <Label>Home</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="search">
        <Icon sf="magnifyingglass" />
        <Label>Search</Label>
        <Badge>3</Badge>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <Icon sf="person.fill" />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

// NOTE: Android has a limit of 5 tabs (Material Design constraint)
```
