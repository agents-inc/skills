# Expo Best Practices Research Findings (2025/2026)

> **Research Date:** January 2025
> **Technology:** Expo SDK 52+ / React Native 0.76+
> **Status:** Comprehensive findings for skill file creation

---

## Executive Summary

Expo has evolved significantly in 2024-2025 to become the recommended way to build React Native apps. Key highlights:

- **Expo SDK 52** released November 2024 with New Architecture enabled by default
- **Expo Router** provides file-based routing similar to Next.js
- **EAS Build/Submit/Update** offers comprehensive CI/CD and OTA updates
- **Expo Modules API** enables Swift/Kotlin native code with minimal boilerplate
- **Development Builds** replace Expo Go for production-ready apps
- **Continuous Native Generation (CNG)** eliminates manual native directory management

---

## 1. Core Concepts: Managed vs Bare Workflow

### Managed Workflow (Recommended)

The managed workflow uses Continuous Native Generation (CNG) where native directories are generated on-demand from `app.json` and `package.json`. This is the recommended approach for most projects.

**Key Characteristics:**
- No `android/` or `ios/` directories in version control
- Native code generated via `npx expo prebuild`
- Config plugins handle native configuration
- EAS Build generates native projects in the cloud

```bash
# Create new Expo project (managed workflow)
npx create-expo-app my-app

# Generate native directories when needed
npx expo prebuild

# Clean regeneration
npx expo prebuild --clean
```

### Bare Workflow

The bare workflow maintains native directories in version control for full native control.

**When to Use Bare:**
- Complex native code requirements
- Existing React Native project migration
- Custom native build configurations
- Need to use native tools not supported by config plugins

### The Hybrid Approach (Best of Both)

Start with managed workflow, use config plugins for customization, and prebuild to bare only when necessary.

```typescript
// app.config.js - Config plugins for native customization
export default {
  expo: {
    name: 'MyApp',
    slug: 'my-app',
    version: '1.0.0',
    plugins: [
      [
        'expo-camera',
        {
          cameraPermission: 'Allow $(PRODUCT_NAME) to access camera.',
        },
      ],
      [
        'expo-build-properties',
        {
          android: {
            compileSdkVersion: 35,
            targetSdkVersion: 35,
            minSdkVersion: 24,
          },
          ios: {
            deploymentTarget: '15.1',
          },
        },
      ],
    ],
  },
};
```

### Sources
- [Expo Workflow Overview](https://docs.expo.dev/workflow/overview/)
- [Continuous Native Generation](https://docs.expo.dev/workflow/continuous-native-generation/)
- [Adopting Prebuild](https://docs.expo.dev/guides/adopting-prebuild/)

---

## 2. Expo SDK 52 Features (November 2024)

### New Architecture Default

Starting with SDK 52, the New Architecture is enabled by default for new projects. As of April 2025, approximately 75% of SDK 52+ projects use the New Architecture.

```json
// app.json - New Architecture enabled by default
{
  "expo": {
    "newArchEnabled": true
  }
}
```

**Migration Strategy:**
1. Upgrade to SDK 52 first
2. Keep old architecture initially (`newArchEnabled: false`)
3. Run `npx expo-doctor` to validate dependencies
4. Enable New Architecture after successful upgrade
5. Test thoroughly on both platforms

### Key SDK 52 Features

- **React Native 0.76** with JSI, Fabric, TurboModules
- **React Navigation v7** automatic upgrade via Expo Router
- **`expo/fetch`** - WinterCG-compliant Fetch API with streaming
- **`expo-video`** stable release with Picture-in-Picture
- **`expo-audio`** beta with modern audio API

### Platform Requirements

```json
// app.json - SDK 52 minimum requirements
{
  "expo": {
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      }
    }
  }
}
```

- **iOS minimum:** 15.1
- **Android minSdkVersion:** 24
- **Android compileSdkVersion:** 35
- **Android targetSdkVersion:** 34 (required by Play Store in 2025)

### Dependency Validation

```bash
# Validate dependencies for New Architecture compatibility
npx expo-doctor

# Upgrade to SDK 52
npx expo install expo@^52.0.0

# Fix peer dependencies
npx expo install --fix
```

### Sources
- [Expo SDK 52 Changelog](https://expo.dev/changelog/2024-11-12-sdk-52)
- [New Architecture Guide](https://docs.expo.dev/guides/new-architecture/)
- [SDK Upgrade Walkthrough](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)

---

## 3. Expo Router Patterns

### File-Based Routing Fundamentals

Expo Router uses file-system conventions to define routes. Files in the `app/` directory automatically become navigable screens.

```
app/
├── _layout.tsx          # Root layout (replaces App.jsx)
├── index.tsx            # Home route (/)
├── about.tsx            # /about
├── settings/
│   ├── _layout.tsx      # Settings layout
│   ├── index.tsx        # /settings
│   └── profile.tsx      # /settings/profile
├── users/
│   ├── _layout.tsx      # Users layout
│   └── [id].tsx         # /users/:id (dynamic route)
└── (tabs)/
    ├── _layout.tsx      # Tab navigator
    ├── home.tsx         # Tab: home
    └── search.tsx       # Tab: search
```

### Route Notation Reference

| Notation | Example | URL | Description |
|----------|---------|-----|-------------|
| Static | `about.tsx` | `/about` | Direct URL match |
| Index | `index.tsx` | `/` or parent path | Default route for directory |
| Dynamic | `[id].tsx` | `/123` | Single dynamic segment |
| Catch-all | `[...slug].tsx` | `/a/b/c` | Multiple dynamic segments |
| Group | `(tabs)/` | Not in URL | Organize without affecting URL |
| Layout | `_layout.tsx` | N/A | Wraps sibling routes |
| +not-found | `+not-found.tsx` | N/A | 404 fallback |
| +html | `+html.tsx` | N/A | Web HTML customization |

### Root Layout Pattern

```tsx
// app/_layout.tsx
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
    'Inter-Bold': require('../assets/fonts/Inter-Bold.ttf'),
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
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Home' }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
```

### Tab Navigation Pattern

```tsx
// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const TAB_ICON_SIZE = 24;

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={TAB_ICON_SIZE}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'search' : 'search-outline'}
              size={TAB_ICON_SIZE}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={TAB_ICON_SIZE}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
```

### Stack Inside Tabs (Nested Navigation)

```
app/
├── (tabs)/
│   ├── _layout.tsx           # Tab navigator
│   ├── feed/
│   │   ├── _layout.tsx       # Stack navigator
│   │   ├── index.tsx         # Feed list
│   │   └── [postId].tsx      # Post detail
│   └── settings.tsx
```

```tsx
// app/(tabs)/feed/_layout.tsx
import { Stack } from 'expo-router';

export default function FeedLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Feed' }} />
      <Stack.Screen
        name="[postId]"
        options={{ title: 'Post Details' }}
      />
    </Stack>
  );
}

// app/(tabs)/feed/[postId].tsx
import { useLocalSearchParams } from 'expo-router';
import { View, Text } from 'react-native';

export default function PostDetail() {
  const { postId } = useLocalSearchParams<{ postId: string }>();

  return (
    <View>
      <Text>Post ID: {postId}</Text>
    </View>
  );
}
```

### Shared Routes Between Tabs

```
app/(tabs)/
├── _layout.tsx
├── (feed)/
│   └── index.tsx
├── (search)/
│   └── search.tsx
└── (feed,search)/           # Shared between both tabs
    ├── _layout.tsx
    └── users/
        └── [username].tsx   # /users/:username accessible from both tabs
```

### Protected Routes (Authentication)

```tsx
// app/_layout.tsx
import { Stack } from 'expo-router';
import { useAuth } from '../hooks/use-auth';

export default function RootLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Stack>
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack.Protected>
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
```

### Modal Pattern

```tsx
// app/_layout.tsx - Modal presentation
<Stack>
  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
  <Stack.Screen
    name="modal"
    options={{
      presentation: 'modal',
      headerShown: true,
      title: 'Settings',
    }}
  />
</Stack>
```

```tsx
// Alternative: Non-route modal overlay
import { Modal } from 'react-native';

export default function RootLayout() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <Stack />
      <Modal visible={!isAuthenticated} animationType="slide">
        <LoginScreen />
      </Modal>
    </>
  );
}
```

### Navigation Hooks

```tsx
import {
  useRouter,
  useLocalSearchParams,
  useGlobalSearchParams,
  usePathname,
  useSegments,
  Link,
} from 'expo-router';

export default function NavigationExample() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const pathname = usePathname();
  const segments = useSegments();

  // Imperative navigation
  const handleNavigate = () => {
    // Push new screen
    router.push('/users/123');

    // Replace current screen
    router.replace('/home');

    // Go back
    router.back();

    // Navigate with params
    router.push({
      pathname: '/users/[id]',
      params: { id: '456' },
    });

    // Dismiss modal (Expo Router 4+)
    router.dismissTo('/home');
  };

  return (
    <View>
      {/* Declarative navigation */}
      <Link href="/about">
        <Text>About</Text>
      </Link>

      <Link href="/users/123" asChild>
        <Pressable>
          <Text>User Profile</Text>
        </Pressable>
      </Link>

      <Link
        href={{
          pathname: '/search',
          params: { query: 'expo' },
        }}
      >
        <Text>Search</Text>
      </Link>
    </View>
  );
}
```

### TypeScript Integration

```tsx
// types/navigation.ts
import type { Href } from 'expo-router';

// Typed routes (auto-generated with Expo Router)
declare module 'expo-router' {
  export namespace ExpoRouter {
    export interface __routes<T extends string = string> {
      StaticRoutes: '/' | '/about' | '/settings';
      DynamicRoutes: `/users/${string}` | `/posts/${string}`;
      DynamicRouteTemplate: '/users/[id]' | '/posts/[id]';
    }
  }
}

// Usage with type safety
const href: Href = '/users/123'; // Type-checked
```

### Sources
- [Expo Router Introduction](https://docs.expo.dev/router/introduction/)
- [Core Concepts](https://docs.expo.dev/router/basics/core-concepts/)
- [Route Notation](https://docs.expo.dev/router/basics/notation/)
- [Common Navigation Patterns](https://docs.expo.dev/router/basics/common-navigation-patterns/)
- [Stack Navigation](https://docs.expo.dev/router/advanced/stack/)
- [Tab Navigation](https://docs.expo.dev/router/advanced/tabs/)

---

## 4. EAS Workflow (Build, Submit, Update)

### EAS Build

EAS Build is Expo's cloud build service that compiles native iOS and Android apps.

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure EAS for your project
eas build:configure
```

**eas.json Configuration:**

```json
{
  "cli": {
    "version": ">= 7.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview"
    },
    "production": {
      "channel": "production"
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your@email.com",
        "ascAppId": "1234567890"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

**Build Commands:**

```bash
# Development build for testing
eas build --profile development --platform ios
eas build --profile development --platform android

# Preview build for internal testing
eas build --profile preview --platform all

# Production build
eas build --profile production --platform all
```

### EAS Submit

```bash
# Submit to App Store
eas submit --platform ios

# Submit to Google Play
eas submit --platform android

# Submit latest build automatically
eas submit --platform all --latest
```

### EAS Update (OTA Updates)

EAS Update enables over-the-air updates for JavaScript and assets without app store submission.

**How It Works:**
1. **Native Layer:** Built into app binary (requires new build to change)
2. **Update Layer:** JavaScript + assets, swappable via OTA

**Key Concepts:**
- **Runtime Version:** Describes JS-native interface compatibility
- **Channel:** Identifies builds for targeted updates (e.g., "production", "staging")
- **Branch:** Contains sequential update bundles

```bash
# Publish an update
eas update --branch production --message "Bug fix for login"

# Auto-detect branch from git
eas update --auto

# Create a preview update
eas update --branch preview --message "New feature preview"
```

**Runtime Version Configuration:**

```json
// app.json
{
  "expo": {
    "runtimeVersion": {
      "policy": "appVersion"
    },
    "updates": {
      "url": "https://u.expo.dev/your-project-id"
    }
  }
}
```

**Runtime Version Policies:**
- `appVersion`: Based on app version (1.0.0)
- `nativeVersion`: Based on version + build number (1.0.0(1))
- `sdkVersion`: Based on Expo SDK version
- Custom string: Manual control

**Channel Management:**

```bash
# Link channel to branch
eas channel:edit production --branch version-2.0

# View channels
eas channel:list
```

**Update Delivery:**

```tsx
// Check for updates programmatically
import * as Updates from 'expo-updates';

async function checkForUpdates() {
  try {
    const update = await Updates.checkForUpdateAsync();

    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch (error) {
    console.error('Update check failed:', error);
  }
}
```

### EAS Workflows (CI/CD)

```yaml
# .eas/workflows/production-deploy.yml
name: Production Deploy

on:
  push:
    branches:
      - main

jobs:
  build:
    name: Build Production
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: expo/expo-github-action@v8
        with:
          token: ${{ secrets.EXPO_TOKEN }}
          eas-version: latest
      - run: npm ci
      - run: eas build --platform all --profile production --non-interactive

  submit:
    name: Submit to Stores
    needs: build
    runs-on: ubuntu-latest
    steps:
      - run: eas submit --platform all --latest --non-interactive
```

### Best Practices

1. **Version Control eas.json:** Keep configuration in git
2. **Separate Channels:** Use `development`, `preview`, `production`
3. **Semantic Versioning:** Align with runtime versions
4. **Test OTA Updates:** Always test on real devices before production
5. **Monitor Build Status:** Use Expo dashboard for tracking
6. **Increment Build Numbers:** Before each store submission

### Sources
- [EAS Build Introduction](https://docs.expo.dev/build/introduction/)
- [How EAS Update Works](https://docs.expo.dev/eas-update/how-it-works/)
- [Runtime Versions](https://docs.expo.dev/eas-update/runtime-versions/)
- [EAS Workflows](https://docs.expo.dev/eas/workflows/get-started/)

---

## 5. Development Builds vs Expo Go

### Expo Go

**What It Is:** Pre-built app from App Store/Play Store containing Expo SDK modules.

**Pros:**
- Zero setup required
- Instant development start
- Great for prototyping and learning

**Cons:**
- Limited to bundled native modules
- Cannot use custom native code
- Cannot test push notifications, deep links
- Single SDK version per device (iOS)

### Development Builds

**What It Is:** Debug build of your app with `expo-dev-client` library.

**Pros:**
- Full native library support
- Test push notifications and deep links
- Test app icons, splash screens
- Multiple SDK versions on same device
- Access to native debugging tools

```bash
# Install dev client
npx expo install expo-dev-client

# Create development build
eas build --profile development --platform ios
eas build --profile development --platform android

# Or build locally
npx expo run:ios
npx expo run:android
```

### When to Switch from Expo Go

Switch to development builds when you need:
- Custom native libraries (e.g., `react-native-firebase`)
- Push notifications testing
- Deep linking / Universal Links
- Custom app icons / splash screens
- Native code modifications
- Libraries not in Expo SDK

### Workflow Comparison

| Feature | Expo Go | Development Build |
|---------|---------|-------------------|
| Setup Time | Instant | Minutes (build required) |
| Custom Native Code | No | Yes |
| Push Notifications | Limited | Full support |
| Deep Links | No | Yes |
| SDK Version | Fixed | Any |
| App Store Testing | No | Yes |
| Production Ready | No | Yes |

### Sources
- [Development Builds Introduction](https://docs.expo.dev/develop/development-builds/introduction/)
- [Expo Go vs Development Builds](https://expo.dev/blog/expo-go-vs-development-builds)
- [Switch from Expo Go](https://docs.expo.dev/develop/development-builds/expo-go-to-dev-build/)

---

## 6. Expo Modules API (Native Code)

### Overview

The Expo Modules API enables writing Swift and Kotlin native modules with minimal boilerplate, leveraging JSI for performance similar to TurboModules.

### Creating a Local Module

```bash
# Create local module in existing project
npx create-expo-module@latest --local

# Generate native directories
npx expo prebuild --clean
```

**Generated Structure:**

```
modules/
└── my-module/
    ├── android/
    │   └── src/main/java/expo/modules/mymodule/
    │       └── MyModule.kt
    ├── ios/
    │   └── MyModule.swift
    ├── src/
    │   └── index.ts
    ├── expo-module.config.json
    └── index.ts
```

### Swift Module Example

```swift
// modules/my-module/ios/MyModule.swift
import ExpoModulesCore

public class MyModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MyModule")

    // Synchronous function
    Function("hello") { (name: String) -> String in
      return "Hello, \(name)!"
    }

    // Asynchronous function
    AsyncFunction("fetchData") { (url: String, promise: Promise) in
      // Async work here
      promise.resolve(["success": true])
    }

    // Events
    Events("onDataReceived")

    // Constants
    Constants([
      "version": "1.0.0"
    ])
  }
}
```

### Kotlin Module Example

```kotlin
// modules/my-module/android/src/main/java/expo/modules/mymodule/MyModule.kt
package expo.modules.mymodule

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MyModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MyModule")

    // Synchronous function
    Function("hello") { name: String ->
      "Hello, $name!"
    }

    // Asynchronous function
    AsyncFunction("fetchData") { url: String ->
      // Async work here
      mapOf("success" to true)
    }

    // Events
    Events("onDataReceived")

    // Constants
    Constants(
      "version" to "1.0.0"
    )
  }
}
```

### TypeScript Interface

```typescript
// modules/my-module/src/index.ts
import { NativeModulesProxy, EventEmitter } from 'expo-modules-core';

const { MyModule } = NativeModulesProxy;
const emitter = new EventEmitter(MyModule);

export function hello(name: string): string {
  return MyModule.hello(name);
}

export async function fetchData(url: string): Promise<{ success: boolean }> {
  return await MyModule.fetchData(url);
}

export function addDataListener(
  callback: (data: unknown) => void
): { remove: () => void } {
  return emitter.addListener('onDataReceived', callback);
}

export const VERSION = MyModule.version;
```

### Usage in App

```tsx
// app/index.tsx
import { hello, fetchData, addDataListener, VERSION } from '@/modules/my-module';
import { useEffect } from 'react';

export default function HomeScreen() {
  useEffect(() => {
    const subscription = addDataListener((data) => {
      console.log('Received:', data);
    });

    return () => subscription.remove();
  }, []);

  const handlePress = async () => {
    const greeting = hello('World');
    console.log(greeting); // "Hello, World!"

    const result = await fetchData('https://api.example.com');
    console.log(result);
  };

  return (
    <View>
      <Text>Module Version: {VERSION}</Text>
      <Button title="Test Module" onPress={handlePress} />
    </View>
  );
}
```

### SharedObject (2025 Feature)

SharedObject enables object-oriented APIs with native objects shared by reference.

```swift
// iOS SharedObject example
public class MySharedObject: SharedObject {
  var data: [String: Any] = [:]

  public func set(key: String, value: Any) {
    data[key] = value
  }

  public func get(key: String) -> Any? {
    return data[key]
  }
}

public class MyModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MyModule")

    Class(MySharedObject.self) {
      Constructor { () -> MySharedObject in
        return MySharedObject()
      }

      Function("set") { (ref: MySharedObject, key: String, value: Any) in
        ref.set(key: key, value: value)
      }

      Function("get") { (ref: MySharedObject, key: String) -> Any? in
        return ref.get(key: key)
      }
    }
  }
}
```

### When to Use Expo Modules vs TurboModules

- **Expo Modules:** Most use cases, simpler API, cross-platform consistency
- **TurboModules:** C++ heavy modules, need lower-level JSI access

### Sources
- [Expo Modules API Overview](https://docs.expo.dev/modules/overview/)
- [Get Started with Expo Modules](https://docs.expo.dev/modules/get-started/)
- [Module API Reference](https://docs.expo.dev/modules/module-api/)
- [Native Module Tutorial](https://docs.expo.dev/modules/native-module-tutorial/)

---

## 7. Push Notifications

### Setup

```bash
# Install required packages
npx expo install expo-notifications expo-device expo-constants
```

**App Configuration:**

```json
// app.json
{
  "expo": {
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#ffffff",
          "sounds": ["./assets/notification.wav"]
        }
      ]
    ],
    "android": {
      "googleServicesFile": "./google-services.json"
    }
  }
}
```

### Implementation

```tsx
// hooks/use-push-notifications.ts
import { useState, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

interface PushNotificationState {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
}

export function usePushNotifications(): PushNotificationState {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => {
      setExpoPushToken(token ?? null);
    });

    // Foreground notification listener
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        setNotification(notification);
      }
    );

    // Response listener (user tapped notification)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('Notification tapped:', response);
        // Handle navigation based on notification data
        const data = response.notification.request.content.data;
        if (data.screen) {
          // Navigate to screen
        }
      }
    );

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  return { expoPushToken, notification };
}

async function registerForPushNotificationsAsync(): Promise<string | undefined> {
  let token: string | undefined;

  // Must be physical device
  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device');
    return undefined;
  }

  // Android channel setup
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  // Request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Permission not granted for push notifications');
    return undefined;
  }

  // Get push token
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      throw new Error('Project ID not found');
    }

    token = (
      await Notifications.getExpoPushTokenAsync({
        projectId,
      })
    ).data;
  } catch (error) {
    console.error('Failed to get push token:', error);
  }

  return token;
}

export { registerForPushNotificationsAsync };
```

### Background Notifications

```tsx
// tasks/background-notification.ts
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';

const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND_NOTIFICATION_TASK';

TaskManager.defineTask(
  BACKGROUND_NOTIFICATION_TASK,
  ({ data, error, executionInfo }) => {
    if (error) {
      console.error('Background task error:', error);
      return;
    }

    console.log('Received background notification:', data);
    // Handle background notification
  }
);

// Register in app initialization
Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
```

### Sending Notifications (Server)

```typescript
// server/send-notification.ts
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
}

async function sendPushNotification(message: ExpoPushMessage): Promise<void> {
  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });

  const result = await response.json();
  console.log('Push result:', result);
}

// Usage
await sendPushNotification({
  to: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
  title: 'New Message',
  body: 'You have a new message!',
  data: { screen: 'messages', messageId: '123' },
  sound: 'default',
});
```

### Platform Considerations

**Android:**
- Create notification channels before scheduling
- Request `SCHEDULE_EXACT_ALARM` for Android 12+
- Force-stopped apps won't receive notifications

**iOS:**
- Local notifications cannot trigger code when app is killed
- Use push notifications for background wake
- Register early for notification responses

### Sources
- [Push Notifications Overview](https://docs.expo.dev/push-notifications/overview/)
- [Push Notifications Setup](https://docs.expo.dev/push-notifications/push-notifications-setup/)
- [Notifications API Reference](https://docs.expo.dev/versions/latest/sdk/notifications/)

---

## 8. Asset Management

### Fonts

**Method 1: Config Plugin (Recommended)**

```json
// app.json
{
  "expo": {
    "plugins": [
      [
        "expo-font",
        {
          "fonts": [
            "./assets/fonts/Inter-Regular.ttf",
            "./assets/fonts/Inter-Bold.ttf"
          ]
        }
      ]
    ]
  }
}
```

**Method 2: Runtime Loading**

```tsx
// app/_layout.tsx
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
    'Inter-Bold': require('../assets/fonts/Inter-Bold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return <Stack />;
}
```

**Google Fonts:**

```bash
npx expo install @expo-google-fonts/inter
```

```tsx
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
```

### Images

**Static Images:**

```tsx
import { Image } from 'react-native';

// Local image
<Image source={require('./assets/logo.png')} style={{ width: 100, height: 100 }} />

// With expo-image (recommended for performance)
import { Image } from 'expo-image';

const BLUR_HASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

<Image
  source={require('./assets/logo.png')}
  placeholder={BLUR_HASH}
  contentFit="cover"
  transition={200}
  style={{ width: 100, height: 100 }}
/>
```

**Remote Images:**

```tsx
import { Image } from 'expo-image';

// Must specify dimensions for remote images
<Image
  source={{ uri: 'https://example.com/image.jpg' }}
  style={{ width: 200, height: 200 }}
  contentFit="cover"
  cachePolicy="memory-disk"
/>
```

### Asset Bundling

```json
// app.json - Bundle assets at build time
{
  "expo": {
    "assetBundlePatterns": [
      "assets/images/*",
      "assets/fonts/*"
    ],
    "plugins": [
      [
        "expo-asset",
        {
          "assets": ["./assets/data/config.json"]
        }
      ]
    ]
  }
}
```

### Image Optimization Best Practices

1. **Use WebP format** for better compression
2. **Resize images** to required dimensions before bundling
3. **Use expo-image** instead of React Native Image
4. **Implement blur hashes** for placeholders
5. **Cache remote images** with appropriate policy
6. **Lazy load** off-screen images

### Sources
- [Fonts Guide](https://docs.expo.dev/develop/user-interface/fonts/)
- [Assets Guide](https://docs.expo.dev/develop/user-interface/assets/)
- [expo-font Reference](https://docs.expo.dev/versions/latest/sdk/font/)
- [expo-asset Reference](https://docs.expo.dev/versions/latest/sdk/asset/)

---

## 9. Environment Configuration

### EXPO_PUBLIC_ Variables

Variables prefixed with `EXPO_PUBLIC_` are automatically loaded from `.env` files.

```bash
# .env
EXPO_PUBLIC_API_URL=https://api.example.com
EXPO_PUBLIC_SENTRY_DSN=https://xxxx@sentry.io/xxxx

# .env.local (gitignored, for local overrides)
EXPO_PUBLIC_API_URL=http://localhost:3000
```

**Usage:**

```typescript
// Direct access
const apiUrl = process.env.EXPO_PUBLIC_API_URL;

// IMPORTANT: These patterns DON'T work
// const { EXPO_PUBLIC_API_URL } = process.env; // BAD
// process.env['EXPO_PUBLIC_API_URL']; // BAD
```

### app.config.js for Dynamic Configuration

```typescript
// app.config.js
export default ({ config }) => {
  const isProduction = process.env.APP_ENV === 'production';

  return {
    ...config,
    name: isProduction ? 'MyApp' : 'MyApp (Dev)',
    slug: 'my-app',
    version: '1.0.0',
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL,
      environment: process.env.APP_ENV || 'development',
      eas: {
        projectId: 'your-project-id',
      },
    },
  };
};
```

**Accessing Config:**

```typescript
import Constants from 'expo-constants';

const apiUrl = Constants.expoConfig?.extra?.apiUrl;
const environment = Constants.expoConfig?.extra?.environment;
```

### Multiple App Variants

```json
// eas.json
{
  "build": {
    "development": {
      "developmentClient": true,
      "env": {
        "APP_ENV": "development",
        "EXPO_PUBLIC_API_URL": "http://localhost:3000"
      }
    },
    "preview": {
      "env": {
        "APP_ENV": "staging",
        "EXPO_PUBLIC_API_URL": "https://staging.api.example.com"
      }
    },
    "production": {
      "env": {
        "APP_ENV": "production",
        "EXPO_PUBLIC_API_URL": "https://api.example.com"
      }
    }
  }
}
```

### EAS Secrets

```bash
# Set secret (not visible in logs)
eas secret:create --name SENTRY_AUTH_TOKEN --value "your-token"

# List secrets
eas secret:list

# Use in eas.json or app.config.js
# Secrets are available as environment variables during build
```

### Security Warning

**NEVER store sensitive secrets in `EXPO_PUBLIC_` variables.** End users can access all embedded environment variables in your app.

Sensitive data should be:
- Stored on your backend
- Retrieved via authenticated API calls
- Never embedded in the app bundle

### Sources
- [Environment Variables](https://docs.expo.dev/guides/environment-variables/)
- [EAS Environment Variables](https://docs.expo.dev/eas/environment-variables/)
- [Multiple App Variants](https://docs.expo.dev/tutorial/eas/multiple-app-variants/)

---

## 10. Testing Approaches

### Unit Testing with Jest

```bash
# Install dependencies
npx expo install jest-expo jest @types/jest @testing-library/react-native --dev
```

**Configuration:**

```json
// package.json
{
  "scripts": {
    "test": "jest --watchAll"
  },
  "jest": {
    "preset": "jest-expo",
    "setupFilesAfterEnv": ["@testing-library/jest-native/extend-expect"],
    "collectCoverage": true,
    "collectCoverageFrom": [
      "**/*.{ts,tsx}",
      "!**/coverage/**",
      "!**/node_modules/**",
      "!**/.expo/**"
    ]
  }
}
```

**Component Test:**

```tsx
// components/__tests__/button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Button } from '../button';

describe('Button', () => {
  it('renders title correctly', () => {
    render(<Button title="Press Me" onPress={() => {}} />);
    expect(screen.getByText('Press Me')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    render(<Button title="Press Me" onPress={onPress} />);

    fireEvent.press(screen.getByText('Press Me'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is disabled when loading', () => {
    render(<Button title="Press Me" onPress={() => {}} loading />);
    expect(screen.getByTestId('loading-indicator')).toBeTruthy();
  });
});
```

**Hook Test:**

```tsx
// hooks/__tests__/use-counter.test.ts
import { renderHook, act } from '@testing-library/react-native';
import { useCounter } from '../use-counter';

describe('useCounter', () => {
  it('initializes with default value', () => {
    const { result } = renderHook(() => useCounter());
    expect(result.current.count).toBe(0);
  });

  it('increments counter', () => {
    const { result } = renderHook(() => useCounter());

    act(() => {
      result.current.increment();
    });

    expect(result.current.count).toBe(1);
  });

  it('accepts initial value', () => {
    const { result } = renderHook(() => useCounter(10));
    expect(result.current.count).toBe(10);
  });
});
```

### E2E Testing with Maestro (Recommended)

Maestro is Expo's recommended E2E testing framework as of 2025.

```yaml
# e2e/login.yaml
appId: com.myapp
---
- launchApp
- tapOn: "Email"
- inputText: "test@example.com"
- tapOn: "Password"
- inputText: "password123"
- tapOn: "Login"
- assertVisible: "Welcome"
```

**Running Tests:**

```bash
# Install Maestro
curl -Ls "https://get.maestro.mobile.dev" | bash

# Run tests
maestro test e2e/

# Run specific flow
maestro test e2e/login.yaml

# Cloud testing with EAS
eas build --profile preview
# Configure Maestro Cloud integration
```

### Snapshot Testing

```tsx
// components/__tests__/card.test.tsx
import { render } from '@testing-library/react-native';
import { Card } from '../card';

describe('Card', () => {
  it('matches snapshot', () => {
    const tree = render(
      <Card title="Test Card" description="Test description" />
    ).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
```

### Mocking Expo Modules

```typescript
// __mocks__/expo-constants.ts
export default {
  expoConfig: {
    extra: {
      apiUrl: 'https://test.api.example.com',
      environment: 'test',
    },
  },
};

// __mocks__/@react-native-async-storage/async-storage.ts
const storage: Record<string, string> = {};

export default {
  getItem: jest.fn((key: string) => Promise.resolve(storage[key] || null)),
  setItem: jest.fn((key: string, value: string) => {
    storage[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete storage[key];
    return Promise.resolve();
  }),
  clear: jest.fn(() => {
    Object.keys(storage).forEach((key) => delete storage[key]);
    return Promise.resolve();
  }),
};
```

### Sources
- [Unit Testing with Jest](https://docs.expo.dev/develop/unit-testing/)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Maestro E2E Testing](https://maestro.mobile.dev/)

---

## 11. Performance Optimization

### Hermes Engine

Hermes is enabled by default and provides:
- Faster startup via bytecode compilation
- Smaller bundle size
- Improved memory usage

**Hermes V1 (2025):**
- Up to 60% better performance on benchmarks
- 7-9% TTI improvements in real apps

```json
// app.json - Hermes configuration (enabled by default)
{
  "expo": {
    "jsEngine": "hermes"
  }
}
```

### Bundle Analysis with Expo Atlas

```bash
# Generate bundle analysis
npx expo export --platform ios --dump-sourcemaps
npx expo-atlas analyze

# View in browser
npx expo-atlas serve
```

### Image Optimization

```tsx
import { Image } from 'expo-image';

const BLUR_HASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';
const IMAGE_TRANSITION_MS = 200;

// Optimized image component
const OptimizedImage = ({ uri, width, height }) => (
  <Image
    source={{ uri }}
    placeholder={BLUR_HASH}
    contentFit="cover"
    transition={IMAGE_TRANSITION_MS}
    cachePolicy="memory-disk"
    style={{ width, height }}
    recyclingKey={uri}
  />
);
```

### List Performance

```tsx
import { FlashList } from '@shopify/flash-list';
import { memo, useCallback } from 'react';

const ESTIMATED_ITEM_HEIGHT = 80;

interface Item {
  id: string;
  title: string;
}

const ListItem = memo(({ item }: { item: Item }) => (
  <View style={{ height: ESTIMATED_ITEM_HEIGHT, padding: 16 }}>
    <Text>{item.title}</Text>
  </View>
));

const HighPerformanceList = ({ data }: { data: Item[] }) => {
  const renderItem = useCallback(
    ({ item }: { item: Item }) => <ListItem item={item} />,
    []
  );

  return (
    <FlashList
      data={data}
      renderItem={renderItem}
      estimatedItemSize={ESTIMATED_ITEM_HEIGHT}
      keyExtractor={(item) => item.id}
    />
  );
};
```

### Animation Performance

```tsx
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const AnimatedComponent = () => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(scale.value) }],
  }));

  const handlePress = () => {
    scale.value = scale.value === 1 ? 1.2 : 1;
  };

  return (
    <Animated.View style={[styles.box, animatedStyle]}>
      <Pressable onPress={handlePress}>
        <Text>Press Me</Text>
      </Pressable>
    </Animated.View>
  );
};
```

### General Tips

1. **Remove console.log in production:**
```javascript
// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    env: {
      production: {
        plugins: ['transform-remove-console'],
      },
    },
  };
};
```

2. **Use InteractionManager for heavy work:**
```tsx
import { InteractionManager } from 'react-native';

const handleNavigate = () => {
  navigation.navigate('Detail');

  InteractionManager.runAfterInteractions(() => {
    // Heavy computation after navigation animation
    processLargeDataSet();
  });
};
```

3. **Avoid inline styles:**
```tsx
// BAD - creates new object every render
<View style={{ padding: 16 }} />

// GOOD - cached StyleSheet
const styles = StyleSheet.create({ container: { padding: 16 } });
<View style={styles.container} />
```

### Sources
- [Using Hermes](https://docs.expo.dev/guides/using-hermes/)
- [Performance Optimization Guide](https://reactnative.dev/docs/performance)
- [Expo Atlas](https://www.callstack.com/blog/knowing-your-apps-bundle-contents-native-performance)

---

## 12. Anti-Patterns to Avoid

### Expo Go in Production

```tsx
// BAD: Assuming Expo Go features in production
if (__DEV__) {
  // Development only code
}

// GOOD: Use development builds for production testing
// Always test with development builds, not Expo Go
```

### Missing Runtime Version Updates

```tsx
// BAD: Forgetting to update runtime version after native changes
// Installing new native dependency without updating runtimeVersion
// Results in: OTA update crashes apps

// GOOD: Update runtimeVersion when native code changes
// app.json
{
  "expo": {
    "runtimeVersion": {
      "policy": "nativeVersion" // Auto-updates with version changes
    }
  }
}
```

### Storing Secrets in EXPO_PUBLIC_

```typescript
// BAD: Sensitive data in public environment variables
const apiKey = process.env.EXPO_PUBLIC_STRIPE_SECRET_KEY; // EXPOSED!

// GOOD: Fetch secrets from authenticated backend
const getStripeKey = async () => {
  const response = await authenticatedFetch('/api/config/stripe');
  return response.publishableKey; // Only public key
};
```

### Blocking Main Thread with Notifications

```typescript
// BAD: Heavy computation in notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => {
    await heavyComputation(); // Blocks UI
    return { shouldShowAlert: true };
  },
});

// GOOD: Return quickly, defer heavy work
Notifications.setNotificationHandler({
  handleNotification: async () => {
    return { shouldShowAlert: true };
  },
});

// Handle heavy work in response listener
Notifications.addNotificationResponseReceivedListener(async (response) => {
  // User already tapped, safe to do work
  await heavyComputation();
});
```

### Not Using Config Plugins

```typescript
// BAD: Manually editing android/ios directories
// Changes lost on prebuild --clean

// GOOD: Use config plugins for native changes
// app.config.js
export default {
  expo: {
    plugins: [
      ['expo-build-properties', {
        android: { compileSdkVersion: 35 }
      }],
      './plugins/my-custom-plugin',
    ],
  },
};
```

### Inline Functions in Lists

```tsx
// BAD: New function every render
<FlatList
  data={items}
  renderItem={({ item }) => <Item data={item} />}
  keyExtractor={(item, index) => index.toString()}
/>

// GOOD: Memoized functions, stable keys
const renderItem = useCallback(({ item }) => <Item data={item} />, []);
const keyExtractor = useCallback((item) => item.id, []);

<FlatList
  data={items}
  renderItem={renderItem}
  keyExtractor={keyExtractor}
/>
```

### Testing on Simulators Only

```typescript
// BAD: Only testing push notifications on simulator
// Push notifications don't work on simulators!

// GOOD: Always test on physical devices
// Use development builds on real devices
// Test OTA updates on real devices before production
```

---

## Skill File Structure Recommendation

Based on this research, the Expo skill should be structured with the following files:

```
expo (@vince)/
├── SKILL.md              # Main skill file with philosophy, critical requirements
├── metadata.yaml         # Auto-detection keywords, triggers
├── reference.md          # Decision frameworks, anti-patterns, red flags
└── examples/
    ├── core.md           # Project setup, app.config.js patterns
    ├── router.md         # Expo Router patterns, navigation
    ├── eas.md            # EAS Build, Submit, Update workflows
    ├── native-modules.md # Expo Modules API patterns
    ├── notifications.md  # Push notification setup and handling
    ├── assets.md         # Fonts, images, asset management
    ├── environment.md    # Environment configuration patterns
    ├── performance.md    # Performance optimization
    └── testing.md        # Jest, Maestro testing patterns
```

---

## Key Takeaways for Skill Creation

1. **Expo is the recommended way** to build React Native apps in 2025
2. **Development builds > Expo Go** for anything beyond prototyping
3. **Expo Router** provides Next.js-like file-based routing
4. **EAS provides full CI/CD** with build, submit, and OTA updates
5. **Config plugins** handle native customization without ejecting
6. **Continuous Native Generation** eliminates native directory management
7. **Runtime versions are critical** for safe OTA updates
8. **Maestro** is the recommended E2E testing framework
9. **Hermes V1** provides significant performance improvements
10. **NEVER store secrets** in `EXPO_PUBLIC_` environment variables

---

## Sources Summary

### Official Documentation
- [Expo Documentation](https://docs.expo.dev/)
- [Expo SDK 52 Changelog](https://expo.dev/changelog/2024-11-12-sdk-52)
- [Expo Router Introduction](https://docs.expo.dev/router/introduction/)
- [EAS Build Introduction](https://docs.expo.dev/build/introduction/)
- [Expo Modules API](https://docs.expo.dev/modules/overview/)
- [Push Notifications Setup](https://docs.expo.dev/push-notifications/push-notifications-setup/)

### Best Practices & Guides
- [Expo Go vs Development Builds](https://expo.dev/blog/expo-go-vs-development-builds)
- [Expo for React Native in 2025](https://hashrocket.com/blog/posts/expo-for-react-native-in-2025-a-perspective)
- [Mastering Expo EAS](https://procedure.tech/blogs/mastering-expo-eas-submit-ota-updates-and-workflow-automation)
- [React Native OTA Updates Best Practices](https://dev.to/nour_abdou/react-native-ota-updates-with-expo-eas-step-by-step-guide-best-practices-1idk)

### Performance & Testing
- [Using Hermes Engine](https://docs.expo.dev/guides/using-hermes/)
- [Unit Testing with Jest](https://docs.expo.dev/develop/unit-testing/)
- [Maestro E2E Testing](https://maestro.mobile.dev/)
- [Expo Atlas Bundle Analysis](https://www.callstack.com/blog/knowing-your-apps-bundle-contents-native-performance)
