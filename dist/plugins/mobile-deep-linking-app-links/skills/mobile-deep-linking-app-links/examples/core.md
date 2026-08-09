# Deep Linking - Core Patterns

> Core deep linking patterns: URI schemes, expo-linking API, handling incoming URLs, React Navigation linking config, Expo Router. See [SKILL.md](../SKILL.md) for decision guidance and red flags.

---

## Pattern 1: expo-linking API Essentials

### useURL Hook

Handles both cold start URLs and foreground URL changes in a single hook.

```typescript
import { useEffect } from "react";
import * as Linking from "expo-linking";

// useURL returns the initial URL on cold start AND subsequent URL changes
export function DeepLinkHandler({
  onNavigate,
}: {
  onNavigate: (path: string, params: Record<string, string>) => void;
}) {
  const url = Linking.useURL();

  useEffect(() => {
    if (!url) return;

    const { path, queryParams } = Linking.parse(url);
    if (path) {
      onNavigate(path, queryParams as Record<string, string>);
    }
  }, [url, onNavigate]);

  return null;
}
```

**Why good:** Single hook handles all app states (cold start, background resume, foreground), no need to manage `getInitialURL` + `addEventListener` separately

### createURL and parse

```typescript
import * as Linking from "expo-linking";

// Create a deep link URL for your app
const profileUrl = Linking.createURL("profile/123", {
  queryParams: { tab: "posts" },
});
// In dev: exp://127.0.0.1:8081/--/profile/123?tab=posts
// In production: myapp://profile/123?tab=posts

// Parse any URL into structured parts
const parsed = Linking.parse("myapp://profile/123?tab=posts");
// { scheme: "myapp", hostname: null, path: "profile/123", queryParams: { tab: "posts" } }

const parsedHttps = Linking.parse("https://example.com/product/456?ref=email");
// { scheme: "https", hostname: "example.com", path: "product/456", queryParams: { ref: "email" } }
```

**Why good:** `createURL` produces the correct format for dev (Expo Go `exp://`) and production (custom scheme), `parse` handles non-standard URL formats that `new URL()` would reject

### Manual Handling (Without useURL)

Use when you need more control over the lifecycle, such as integrating with a custom navigation solution.

```typescript
import { useEffect, useRef } from "react";
import * as Linking from "expo-linking";

export function useDeepLinkListener(onLink: (url: string) => void) {
  const hasHandledInitial = useRef(false);

  useEffect(() => {
    // Handle cold start URL (app was not running)
    async function handleInitialURL() {
      if (hasHandledInitial.current) return;
      hasHandledInitial.current = true;

      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        onLink(initialUrl);
      }
    }

    handleInitialURL();

    // Handle URLs received while app is running (foreground/background)
    const subscription = Linking.addEventListener("url", ({ url }) => {
      onLink(url);
    });

    return () => {
      subscription.remove();
    };
  }, [onLink]);
}
```

**Why good:** Explicit control over cold start vs foreground handling, ref prevents double-handling of initial URL on re-renders

---

## Pattern 2: React Navigation Linking Config

### Basic Setup

```typescript
import * as Linking from "expo-linking";
import type { LinkingOptions } from "@react-navigation/native";

type RootStackParamList = {
  Home: undefined;
  Profile: { id: string };
  Product: { slug: string };
  Settings: { section?: string };
  NotFound: undefined;
};

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    Linking.createURL("/"),       // Custom scheme (myapp://)
    "https://example.com",        // Universal Links / App Links
  ],
  config: {
    screens: {
      Home: "",                    // Matches root path
      Profile: "user/:id",        // Matches /user/123
      Product: {
        path: "product/:slug",
        parse: {
          slug: (slug: string) => slug.toLowerCase(),
        },
      },
      Settings: "settings/:section?", // Optional param
      NotFound: "*",               // Catch-all for unmatched URLs
    },
  },
};

// Pass to NavigationContainer
<NavigationContainer linking={linking} fallback={<ActivityIndicator />}>
  <Stack.Navigator>
    <Stack.Screen name="Home" component={HomeScreen} />
    <Stack.Screen name="Profile" component={ProfileScreen} />
    <Stack.Screen name="Product" component={ProductScreen} />
    <Stack.Screen name="Settings" component={SettingsScreen} />
    <Stack.Screen name="NotFound" component={NotFoundScreen} />
  </Stack.Navigator>
</NavigationContainer>
```

**Why good:** Type-safe linking config matches `RootStackParamList`, `parse` transforms params before they reach the screen, catch-all `*` prevents unhandled URLs

### Nested Navigator Config

The config structure must mirror the navigator nesting.

```typescript
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [Linking.createURL("/"), "https://example.com"],
  config: {
    screens: {
      HomeTabs: {
        screens: {
          Feed: "feed",
          Explore: "explore",
        },
      },
      Profile: {
        path: "user/:id",
        screens: {
          Posts: "posts", // Matches /user/123/posts
          Followers: "followers", // Matches /user/123/followers
        },
      },
      Auth: {
        screens: {
          Login: "login",
          Register: "register",
        },
        // initialRouteName ensures back button from deep link
        // goes to Login instead of nowhere
        initialRouteName: "Login",
      },
    },
  },
};
```

**Why good:** Mirrors navigator hierarchy, `initialRouteName` ensures sensible back navigation from deep-linked nested screens

### Static API Configuration (React Navigation 7+)

With the static API, linking is configured per-screen instead of in a separate config object.

```typescript
import { createStaticNavigation } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

const RootStack = createNativeStackNavigator({
  screens: {
    Home: {
      screen: HomeScreen,
      linking: { path: "" },
    },
    Profile: {
      screen: ProfileScreen,
      linking: {
        path: "user/:id",
        parse: { id: (id: string) => id },
      },
    },
    Product: {
      screen: ProductScreen,
      linking: {
        path: "product/:slug",
        parse: { slug: (slug: string) => slug.toLowerCase() },
      },
    },
  },
});

const Navigation = createStaticNavigation(RootStack);

// In your app root:
export function App() {
  return (
    <Navigation
      linking={{
        enabled: "auto", // Auto-generates kebab-case paths from screen names
        prefixes: [Linking.createURL("/"), "https://example.com"],
      }}
    />
  );
}
```

**Why good:** Co-locates linking config with screen definition, `enabled: "auto"` generates paths from PascalCase screen names (Profile -> /profile)

---

## Pattern 3: Expo Router Automatic Deep Linking

Expo Router requires zero deep linking configuration. File paths are deep link paths.

```
app/
  _layout.tsx              ->  Layout wrapper (not a route)
  index.tsx                ->  /
  profile/[id].tsx         ->  /profile/123
  product/[slug].tsx       ->  /product/blue-shirt
  settings/index.tsx       ->  /settings
  settings/[section].tsx   ->  /settings/notifications
  [...missing].tsx         ->  Catch-all for unmatched routes
```

### Handling Parameters in Expo Router

```typescript
// app/profile/[id].tsx
import { useLocalSearchParams } from "expo-router";

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // id is extracted from the URL path: /profile/123 -> id = "123"
  return <ProfileView userId={id} />;
}
```

### Handling Query Parameters

```typescript
// app/product/[slug].tsx
import { useLocalSearchParams } from "expo-router";

export default function ProductScreen() {
  const { slug, ref } = useLocalSearchParams<{ slug: string; ref?: string }>();
  // /product/blue-shirt?ref=email -> slug = "blue-shirt", ref = "email"
  return <ProductView slug={slug} referrer={ref} />;
}
```

**Why good:** No linking config to maintain, adding a file automatically creates a deep link, TypeScript params from `useLocalSearchParams`

---

## Pattern 4: URL Validation and Sanitization

Never trust incoming URLs. Validate paths and parameters before navigating.

```typescript
const VALID_DEEP_LINK_PATHS = new Set([
  "profile",
  "product",
  "settings",
  "order",
]);
const MAX_PARAM_LENGTH = 256;

interface DeepLinkResult {
  screen: string;
  params: Record<string, string>;
}

export function validateDeepLink(url: string): DeepLinkResult | null {
  const { path, queryParams } = Linking.parse(url);
  if (!path) return null;

  const segments = path.split("/").filter(Boolean);
  const rootPath = segments[0];

  if (!rootPath || !VALID_DEEP_LINK_PATHS.has(rootPath)) {
    return null; // Unknown path -- navigate to home or show error
  }

  // Sanitize parameters
  const sanitizedParams: Record<string, string> = {};
  for (const [key, value] of Object.entries(queryParams ?? {})) {
    if (typeof value === "string" && value.length <= MAX_PARAM_LENGTH) {
      sanitizedParams[key] = value.replace(/[<>]/g, ""); // Strip basic injection chars
    }
  }

  return {
    screen: rootPath,
    params: { ...sanitizedParams, id: segments[1] ?? "" },
  };
}
```

**Why good:** Allowlist of valid paths prevents navigation to unexpected screens, parameter sanitization prevents injection, length limit prevents abuse

---

## Pattern 5: Custom getInitialURL and subscribe (Push Notifications)

When deep links come from multiple sources (URL links + push notifications), customize `getInitialURL` and `subscribe`.

```typescript
import * as Linking from "expo-linking";
import type { LinkingOptions } from "@react-navigation/native";

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [Linking.createURL("/"), "https://example.com"],

  async getInitialURL() {
    // Check if app was opened from a push notification
    const notificationUrl = await getNotificationDeepLink();
    if (notificationUrl) return notificationUrl;

    // Fall back to standard deep link handling
    const url = await Linking.getInitialURL();
    return url;
  },

  subscribe(listener) {
    // Listen for standard deep links
    const linkingSubscription = Linking.addEventListener("url", ({ url }) => {
      listener(url);
    });

    // Listen for push notification deep links
    const notificationSubscription = subscribeToNotificationLinks((url) => {
      listener(url);
    });

    return () => {
      linkingSubscription.remove();
      notificationSubscription.remove();
    };
  },

  config: {
    screens: {
      Home: "",
      Profile: "user/:id",
      Order: "order/:orderId",
    },
  },
};
```

**Why good:** Handles multiple link sources (URL + push) in a unified way, cleanup functions prevent memory leaks, prioritizes notification links over standard deep links

---

## Pattern 6: Deferred Deep Link Handling

Deferred deep links persist the intended destination through the app store install flow. After install, check for a pending deep link on first open.

```typescript
import { useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DEFERRED_LINK_KEY = "deferred_deep_link";
const DEFERRED_LINK_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

interface DeferredLink {
  url: string;
  timestamp: number;
}

// Call on first app launch after install
export function useDeferredDeepLink(onLink: (url: string) => void) {
  const hasChecked = useRef(false);

  useEffect(() => {
    if (hasChecked.current) return;
    hasChecked.current = true;

    async function checkDeferredLink() {
      try {
        const stored = await AsyncStorage.getItem(DEFERRED_LINK_KEY);
        if (!stored) return;

        const parsed: DeferredLink = JSON.parse(stored);
        const age = Date.now() - parsed.timestamp;

        // Only honor links less than 24 hours old
        if (age < DEFERRED_LINK_MAX_AGE_MS) {
          onLink(parsed.url);
        }

        // Clean up regardless of age
        await AsyncStorage.removeItem(DEFERRED_LINK_KEY);
      } catch {
        // Silently fail -- deferred link is best-effort
      }
    }

    checkDeferredLink();
  }, [onLink]);
}
```

**Why good:** Expiry prevents stale navigation, single-use (deleted after read), error handling prevents crashes from corrupt storage

**Note:** For production deferred deep linking with install attribution, use a dedicated attribution SDK. The pattern above shows the client-side concept -- the server-side link persistence and device matching are handled by the attribution service.
