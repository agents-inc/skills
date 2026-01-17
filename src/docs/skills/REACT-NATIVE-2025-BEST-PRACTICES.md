# React Native 2025 Best Practices Research Findings

> **Research Date:** January 2025
> **Technology:** React Native 0.76+ / 0.77+
> **Status:** Comprehensive findings for skill file creation

---

## Executive Summary

React Native has undergone significant evolution in 2024-2025 with the New Architecture becoming the default in 0.76. Key changes include:

- **New Architecture is now default** (Fabric, TurboModules, JSI)
- **React Navigation 7** with static configuration API
- **FlashList v2** for high-performance lists
- **Expo recommended** by React Native team for new projects
- **TypeScript as standard** for type safety
- **Zustand + TanStack Query** as dominant state management pattern
- **NativeWind v5** for utility-first styling

---

## 1. New Architecture (Fabric, TurboModules, JSI)

### Overview

The New Architecture removes the asynchronous bridge between JavaScript and native, replacing it with JavaScript Interface (JSI). Starting with React Native 0.76, the New Architecture is enabled by default.

**Four Core Components:**
1. **JSI (JavaScript Interface)**: Allows JavaScript to hold references to C++ objects and vice-versa
2. **Fabric**: New rendering system with synchronous layout
3. **TurboModules**: Lazy-loaded native modules with synchronous access
4. **Codegen**: Generates native code from TypeScript/Flow specs

### Performance Improvements

- App launch times improved ~10% on Android, ~3% on iOS
- Concurrent rendering support (React 18+)
- Automatic batching to reduce re-renders
- Measure-before-paint for smoother screen loads

### Migration Best Practices (Shopify Experience)

```typescript
// Migration checklist:
// 1. Audit dependencies early for compatibility
// 2. Upgrade to latest RN version BEFORE migration
// 3. Release upgrade before starting migration (smaller blast radius)
// 4. Enable Fabric in development first
// 5. Use feature flags to fork implementations
// 6. Maintain compatibility with old architecture during transition
```

### Library Compatibility

- ~75% of Expo SDK 52+ projects use New Architecture (as of April 2025)
- All expo-* packages in SDK 53 support New Architecture
- Interop Layers allow many legacy libraries to work without changes
- **Warning:** Legacy architecture may be removed in late 2025

### Sources
- [About the New Architecture - React Native](https://reactnative.dev/architecture/landing-page)
- [Expo New Architecture Guide](https://docs.expo.dev/guides/new-architecture/)
- [Shopify Migration Experience](https://shopify.engineering/react-native-new-architecture)

---

## 2. React Native 0.76 / 0.77 Features

### React Native 0.76 (October 2024)

- **New Architecture enabled by default**
- **Consolidated native libraries**: `libreactnative.so` reduces APK size by ~3.8MB
- **Startup time improved by 15ms** on Android
- **Hermes engine default**: Faster startup, smaller bundles, improved memory

### React Native 0.77 (January 2025)

**New CSS Features (New Architecture only):**
```typescript
// New styling properties available in 0.77:
const styles = StyleSheet.create({
  container: {
    display: 'contents',     // New: contents layout
    boxSizing: 'border-box', // New: box model control
    mixBlendMode: 'multiply', // New: blend modes
    outlineWidth: 2,         // New: outline properties
    outlineColor: 'blue',
    outlineStyle: 'solid',
  },
});
```

**Other Changes:**
- **Android 16KB page support** for future device compatibility
- **Swift template for iOS** (default for new projects)
- **Metro log forwarding removed** - use React Native DevTools
- **`react-native init` deprecated** - use `npx create-expo-app`

### React Native 0.78 (Upcoming)

- React 19 support

### Sources
- [React Native 0.77 Release Notes](https://reactnative.dev/blog/2025/01/21/version-0.77)
- [Expo SDK 52 Changelog](https://expo.dev/changelog/2025-01-21-react-native-0.77)
- [Microsoft RN 0.76/0.77 New Architecture](https://devblogs.microsoft.com/react-native/2025-01-29-new-architecture-on-0-76-0-77/)

---

## 3. Component Patterns (Functional Components, Hooks)

### Functional Components as Standard

Function components are the de facto standard, replacing class components for nearly all use cases.

```typescript
// Modern functional component with TypeScript
import type { FC } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface UserCardProps {
  name: string;
  email: string;
  onPress?: () => void;
}

const UserCard: FC<UserCardProps> = ({ name, email, onPress }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.email}>{email}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
  },
  email: {
    fontSize: 14,
    color: '#666',
  },
});

export { UserCard };
```

### TypeScript Best Practices

```typescript
// Discriminated unions for state management
type DataState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

// Utility types for prop derivation
type ButtonProps = React.ComponentProps<typeof Pressable> & {
  variant: 'primary' | 'secondary';
  size: 'sm' | 'md' | 'lg';
};

// Avoid any, use unknown for dynamic values
const parseApiResponse = (data: unknown): User => {
  // Type guard and validation
  if (isUser(data)) {
    return data;
  }
  throw new Error('Invalid user data');
};
```

### Custom Hooks Pattern

```typescript
// Custom hook for data fetching with cleanup
const useUser = (userId: string) => {
  const [state, setState] = useState<DataState<User>>({ status: 'idle' });

  useEffect(() => {
    const abortController = new AbortController();

    const fetchUser = async () => {
      setState({ status: 'loading' });
      try {
        const response = await api.getUser(userId, {
          signal: abortController.signal,
        });
        setState({ status: 'success', data: response });
      } catch (error) {
        if (!abortController.signal.aborted) {
          setState({ status: 'error', error: error as Error });
        }
      }
    };

    fetchUser();

    return () => abortController.abort();
  }, [userId]);

  return state;
};
```

### Sources
- [Using TypeScript - React Native](https://reactnative.dev/docs/typescript)
- [TypeScript Patterns for React 2025](https://dev.to/muhammad_zulqarnainakram/typescript-patterns-every-react-developer-should-know-in-2025-2264)

---

## 4. Navigation Patterns (React Navigation 7)

### Static Configuration API (New in v7)

React Navigation 7 introduces a static configuration API that provides:
- Simpler TypeScript integration
- Automatic deep linking path generation
- Cleaner navigation structure

```typescript
// Static API configuration
import { createStaticNavigation, StaticParamList } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const RootStack = createNativeStackNavigator({
  screens: {
    Home: {
      screen: HomeScreen,
      linking: {
        path: 'home',
      },
    },
    Profile: {
      screen: ProfileScreen,
      linking: {
        path: 'user/:id',
        parse: {
          id: (id) => id,
        },
      },
    },
  },
});

// Type-safe navigation
type RootStackParamList = StaticParamList<typeof RootStack>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

const Navigation = createStaticNavigation(RootStack);

export default function App() {
  return <Navigation />;
}
```

### Dynamic API (Still Supported)

```typescript
// Dynamic API for complex use cases
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

type RootStackParamList = {
  Home: undefined;
  Profile: { userId: string };
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function RootNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}
```

### Authentication Pattern

```typescript
// Separate navigators for auth states
function AppNavigator() {
  const { isAuthenticated } = useAuth();

  return (
    <NavigationContainer>
      {isAuthenticated ? (
        <MainNavigator />
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}
```

### Deep Linking Configuration

```typescript
// Deep linking setup
const linking = {
  prefixes: ['https://myapp.com', 'myapp://'],
  config: {
    screens: {
      Home: 'home',
      Profile: 'user/:id',
      Settings: {
        path: 'settings',
        screens: {
          Notifications: 'notifications',
          Privacy: 'privacy',
        },
      },
      NotFound: '*',
    },
  },
};

function App() {
  return (
    <NavigationContainer linking={linking} fallback={<LoadingScreen />}>
      <RootNavigator />
    </NavigationContainer>
  );
}
```

### Performance Tips

- Memoize navigator components to prevent unnecessary re-renders
- Use `native-stack` over `stack` for better native performance
- Keep navigation state minimal

### Sources
- [React Navigation 7 Docs](https://reactnavigation.org/docs/upgrading-from-6.x/)
- [Deep Linking - React Navigation](https://reactnavigation.org/docs/deep-linking/)
- [React Navigation Best Practices 2025](https://viewlytics.ai/blog/react-navigation-best-practices-guide)

---

## 5. State Management Patterns

### The Modern Approach: Zustand + TanStack Query

The dominant pattern in 2025 is combining:
- **TanStack Query**: Server state (fetched data, caching, re-validation)
- **Zustand**: Client state (UI state, preferences)

```typescript
// Server state with TanStack Query
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const STALE_TIME_MS = 5 * 60 * 1000; // 5 minutes

const useUsers = () => {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => api.getUsers(),
    staleTime: STALE_TIME_MS,
  });
};

const useCreateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateUserDto) => api.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};
```

```typescript
// Client state with Zustand
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AppState {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  notifications: boolean;
  toggleNotifications: () => void;
}

const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'light',
      setTheme: (theme) => set({ theme }),
      notifications: true,
      toggleNotifications: () =>
        set((state) => ({ notifications: !state.notifications })),
    }),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export { useAppStore };
```

### Decision Framework

```
Is it server data (from API)?
├─ YES → TanStack Query
└─ NO → Is it needed across multiple components?
    ├─ YES → Zustand
    └─ NO → Is it form data?
        ├─ YES → React Hook Form / useState
        └─ NO → useState in component
```

### When Redux Still Makes Sense

- Large organizations requiring strict consistency
- Complex state with many reducers
- Need for middleware (logging, persistence)
- Existing Redux codebase

### Sources
- [React State Management 2025](https://www.developerway.com/posts/react-state-management-2025)
- [Zustand vs RTK Query vs TanStack Query](https://medium.com/@imranrafeek/zustand-vs-rtk-query-vs-tanstack-query-unpacking-the-react-state-management-toolbox-d47893479742)
- [TanStack Query Docs](https://tanstack.com/query/v4/docs/react/guides/does-this-replace-client-state)

---

## 6. Styling Patterns

### StyleSheet API (Default)

```typescript
import { StyleSheet, View, Text } from 'react-native';

const SPACING_SM = 8;
const SPACING_MD = 16;
const BORDER_RADIUS = 8;
const FONT_SIZE_TITLE = 18;
const FONT_SIZE_BODY = 14;

const Card = ({ title, children }) => (
  <View style={styles.container}>
    <Text style={styles.title}>{title}</Text>
    <View style={styles.content}>{children}</View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    padding: SPACING_MD,
    borderRadius: BORDER_RADIUS,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: FONT_SIZE_TITLE,
    fontWeight: '600',
    marginBottom: SPACING_SM,
  },
  content: {
    fontSize: FONT_SIZE_BODY,
  },
});

export { Card };
```

### NativeWind (Tailwind for React Native)

NativeWind v5 compiles Tailwind classes to native StyleSheet objects at build time.

```typescript
// NativeWind v5 setup
import { View, Text, Pressable } from 'react-native';
import { styled } from 'nativewind';

const StyledPressable = styled(Pressable);
const StyledView = styled(View);
const StyledText = styled(Text);

const Button = ({ title, onPress, variant = 'primary' }) => (
  <StyledPressable
    className={`
      px-4 py-2 rounded-lg
      ${variant === 'primary' ? 'bg-blue-500' : 'bg-gray-200'}
      active:opacity-80
    `}
    onPress={onPress}
  >
    <StyledText
      className={`
        text-center font-semibold
        ${variant === 'primary' ? 'text-white' : 'text-gray-800'}
      `}
    >
      {title}
    </StyledText>
  </StyledPressable>
);

// Platform-specific styling
const PlatformCard = () => (
  <StyledView className="p-4 ios:shadow-lg android:elevation-4">
    <StyledText className="ios:font-medium android:font-normal">
      Platform-specific styles
    </StyledText>
  </StyledView>
);
```

### Responsive Design with NativeWind

```typescript
// Custom breakpoints for mobile
// xs: 0-359px (small phones)
// sm: 360-479px (standard phones)
// md: 480-767px (large phones/small tablets)
// lg: 768-1023px (tablets)
// xl: 1024px+ (large tablets)

const ResponsiveGrid = () => (
  <View className="flex-row flex-wrap">
    <View className="w-full sm:w-1/2 md:w-1/3 p-2">
      <Card />
    </View>
  </View>
);
```

### Platform-Specific Styling

```typescript
import { Platform, StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  shadow: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    android: {
      elevation: 4,
    },
  }),
  // Font weight handling
  bold: {
    fontWeight: Platform.OS === 'ios' ? '600' : 'bold',
  },
});
```

### Sources
- [NativeWind Documentation](https://www.nativewind.dev/v5)
- [Modern Approaches to Styling RN Apps](https://blog.codeminer42.com/modern-approaches-to-styling-react-native-apps/)
- [Best Practices for Styling Mobile Apps](https://medium.com/@tusharkumar27864/best-practices-for-styling-mobile-apps-in-react-native-1fcf8eac649e)

---

## 7. Performance Optimization

### FlatList Optimization

```typescript
import { FlatList, View, Text } from 'react-native';
import { memo, useCallback } from 'react';

const ITEM_HEIGHT = 80;
const INITIAL_NUM_TO_RENDER = 10;
const MAX_TO_RENDER_PER_BATCH = 5;
const WINDOW_SIZE = 11; // 5 above, 5 below, 1 visible

interface ListItem {
  id: string;
  title: string;
}

// Memoized list item
const ListItemComponent = memo(({ item }: { item: ListItem }) => (
  <View style={{ height: ITEM_HEIGHT, padding: 16 }}>
    <Text>{item.title}</Text>
  </View>
));

// Optimized FlatList
const OptimizedList = ({ data }: { data: ListItem[] }) => {
  // Memoize renderItem
  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => <ListItemComponent item={item} />,
    []
  );

  // Stable keyExtractor
  const keyExtractor = useCallback((item: ListItem) => item.id, []);

  // getItemLayout for fixed-height items
  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    []
  );

  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      getItemLayout={getItemLayout}
      initialNumToRender={INITIAL_NUM_TO_RENDER}
      maxToRenderPerBatch={MAX_TO_RENDER_PER_BATCH}
      windowSize={WINDOW_SIZE}
      removeClippedSubviews={true}
    />
  );
};
```

### FlashList (High Performance Alternative)

FlashList v2 (2025) offers significant performance improvements:
- 54% FPS improvement (36.9 -> 56.9 FPS)
- 82% CPU reduction
- Built for New Architecture
- Automatic item sizing

```typescript
import { FlashList } from '@shopify/flash-list';

const HighPerformanceList = ({ data }) => {
  const renderItem = useCallback(
    ({ item }) => <ListItemComponent item={item} />,
    []
  );

  return (
    <FlashList
      data={data}
      renderItem={renderItem}
      estimatedItemSize={ITEM_HEIGHT}
      // FlashList v2 handles sizing automatically
    />
  );
};
```

### useMemo and useCallback

```typescript
// With React Compiler (2025), most memoization is automatic
// But still needed for:
// 1. Expensive calculations
// 2. Props passed to memoized children
// 3. Third-party libraries that compare by reference

const ExpensiveComponent = ({ items }) => {
  // Expensive calculation - use useMemo
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => a.score - b.score);
  }, [items]);

  // Callback passed to child - use useCallback
  const handlePress = useCallback((id: string) => {
    // handle press
  }, []);

  return (
    <MemoizedList
      data={sortedItems}
      onItemPress={handlePress}
    />
  );
};

// Rule of thumb: If operation < 1ms, skip memoization
```

### Image Optimization

```typescript
// For Expo projects: use expo-image
import { Image } from 'expo-image';

const BLUR_HASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

const OptimizedImage = ({ uri }) => (
  <Image
    source={{ uri }}
    placeholder={BLUR_HASH}
    contentFit="cover"
    transition={200}
    style={{ width: 200, height: 200 }}
  />
);

// For bare RN: use react-native-fast-image
import FastImage from 'react-native-fast-image';

const FastCachedImage = ({ uri }) => (
  <FastImage
    style={{ width: 200, height: 200 }}
    source={{
      uri,
      priority: FastImage.priority.normal,
    }}
    resizeMode={FastImage.resizeMode.cover}
  />
);
```

### Animation Performance

```typescript
import { Animated, Easing } from 'react-native';

// Use native driver for smooth animations
const fadeAnim = new Animated.Value(0);

Animated.timing(fadeAnim, {
  toValue: 1,
  duration: 300,
  easing: Easing.ease,
  useNativeDriver: true, // CRITICAL for performance
}).start();

// For complex animations, use Reanimated 3
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

const AnimatedComponent = () => {
  const offset = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(offset.value) }],
  }));

  return <Animated.View style={animatedStyle} />;
};
```

### General Performance Tips

```typescript
// 1. Remove console.log in production
// babel.config.js
module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  env: {
    production: {
      plugins: ['transform-remove-console'],
    },
  },
};

// 2. Use InteractionManager for heavy work
import { InteractionManager } from 'react-native';

const handlePress = () => {
  InteractionManager.runAfterInteractions(() => {
    // Heavy computation here
    processLargeDataSet();
  });
};

// 3. requestAnimationFrame for UI responsiveness
const handleExpensiveAction = () => {
  requestAnimationFrame(() => {
    doExpensiveWork();
  });
};
```

### Sources
- [React Native Performance Docs](https://reactnative.dev/docs/performance)
- [Optimizing FlatList Configuration](https://reactnative.dev/docs/optimizing-flatlist-configuration)
- [FlashList vs FlatList 2025](https://javascript.plainenglish.io/flashlist-vs-flatlist-2025-complete-performance-comparison-guide-for-react-native-developers-f89989547c29)
- [FlashList Official](https://shopify.github.io/flash-list/)

---

## 8. Platform-Specific Code Patterns

### Platform Module

```typescript
import { Platform, StyleSheet } from 'react-native';

// Platform.OS
const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';

// Platform.select for values
const fontFamily = Platform.select({
  ios: 'San Francisco',
  android: 'Roboto',
  default: 'System',
});

// Platform.select for styles
const styles = StyleSheet.create({
  container: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
});

// Platform.Version for version checks
if (Platform.OS === 'android' && Platform.Version >= 33) {
  // Android 13+ specific code
}
```

### File-Based Platform Splitting

```
components/
  button.tsx         # Shared code
  button.ios.tsx     # iOS-specific
  button.android.tsx # Android-specific
  button.native.tsx  # iOS + Android (not web)
  button.web.tsx     # Web-specific
```

```typescript
// Import automatically resolves to correct platform file
import { Button } from './components/button';
```

### Safe Area Handling

```typescript
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

// Wrapper component
const ScreenWrapper = ({ children }) => (
  <SafeAreaView style={{ flex: 1 }}>
    {children}
  </SafeAreaView>
);

// Hook for granular control
const HeaderWithInsets = () => {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ paddingTop: insets.top }}>
      <Text>Header</Text>
    </View>
  );
};
```

### Keyboard Handling

```typescript
import { KeyboardAvoidingView, Platform } from 'react-native';

const KEYBOARD_OFFSET = 64;

const FormScreen = () => (
  <KeyboardAvoidingView
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    keyboardVerticalOffset={KEYBOARD_OFFSET}
    style={{ flex: 1 }}
  >
    <TextInput placeholder="Enter text" />
  </KeyboardAvoidingView>
);
```

### Sources
- [Platform-Specific Code - React Native](https://reactnative.dev/docs/platform-specific-code)
- [Handling Platform Differences](https://medium.com/@tusharkumar27864/navigating-the-two-worlds-handling-platform-specific-differences-in-react-native-f2805d9f7fce)

---

## 9. Error Handling and Crash Recovery

### Error Boundary Pattern

```typescript
import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to error reporting service
    this.props.onError?.(error, errorInfo);
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <TouchableOpacity style={styles.button} onPress={this.handleRetry}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 10 },
  message: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 20 },
  button: { backgroundColor: '#007AFF', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  buttonText: { color: '#fff', fontWeight: '600' },
});

export { ErrorBoundary };
```

### Global Error Handler

```typescript
import { ErrorUtils } from 'react-native';

// Global uncaught error handler
const defaultHandler = ErrorUtils.getGlobalHandler();

ErrorUtils.setGlobalHandler((error, isFatal) => {
  // Log to crash reporting service (e.g., Sentry)
  if (isFatal) {
    // Show fatal error UI
    showFatalErrorScreen(error);
  }

  // Call default handler
  defaultHandler(error, isFatal);
});
```

### Async Error Handling

```typescript
// Use try/catch with AbortController for async operations
const fetchData = async (signal?: AbortSignal) => {
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) {
      throw new ApiError(response.status, await response.text());
    }
    return response.json();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      // Request was cancelled, not an error
      return;
    }
    // Handle other errors
    throw error;
  }
};

// Custom error class for API errors
class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}
```

### Sources
- [Error Boundaries - React Native University](https://www.reactnative.university/blog/react-native-error-boundaries)
- [react-native-error-boundary](https://github.com/carloscuesta/react-native-error-boundary)
- [Production Error Handling Guide](https://dzone.com/articles/react-native-error-handling-guide)

---

## 10. Testing Patterns

### Testing Pyramid

- **70% Unit tests**: Fast, isolated, component logic
- **20% Integration tests**: Component interactions
- **10% E2E tests**: Full user workflows

### Jest + React Native Testing Library

```typescript
// user-card.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { UserCard } from './user-card';

describe('UserCard', () => {
  const mockUser = {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
  };

  it('renders user information correctly', () => {
    render(<UserCard user={mockUser} />);

    expect(screen.getByText('John Doe')).toBeTruthy();
    expect(screen.getByText('john@example.com')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    render(<UserCard user={mockUser} onPress={onPress} />);

    fireEvent.press(screen.getByTestId('user-card'));

    expect(onPress).toHaveBeenCalledWith(mockUser.id);
  });

  it('shows loading state', () => {
    render(<UserCard user={mockUser} isLoading />);

    expect(screen.getByTestId('loading-indicator')).toBeTruthy();
  });
});
```

### Testing Hooks

```typescript
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useCounter } from './use-counter';

describe('useCounter', () => {
  it('increments counter', () => {
    const { result } = renderHook(() => useCounter());

    act(() => {
      result.current.increment();
    });

    expect(result.current.count).toBe(1);
  });

  it('handles async operations', async () => {
    const { result } = renderHook(() => useUser('1'));

    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });

    expect(result.current.data?.name).toBe('John Doe');
  });
});
```

### Detox E2E Testing

```typescript
// e2e/login.test.ts
describe('Login Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should login successfully with valid credentials', async () => {
    await element(by.id('email-input')).typeText('test@example.com');
    await element(by.id('password-input')).typeText('password123');
    await element(by.id('login-button')).tap();

    await expect(element(by.id('home-screen'))).toBeVisible();
  });

  it('should show error with invalid credentials', async () => {
    await element(by.id('email-input')).typeText('wrong@example.com');
    await element(by.id('password-input')).typeText('wrongpassword');
    await element(by.id('login-button')).tap();

    await expect(element(by.text('Invalid credentials'))).toBeVisible();
  });
});
```

### Mocking Patterns

```typescript
// __mocks__/react-native-async-storage.ts
const mockStorage: Record<string, string> = {};

export default {
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] || null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete mockStorage[key];
    return Promise.resolve();
  }),
  clear: jest.fn(() => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    return Promise.resolve();
  }),
};
```

### Sources
- [Testing Overview - React Native](https://reactnative.dev/docs/testing-overview)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Detox Documentation](https://github.com/wix/detox/)

---

## 11. Anti-Patterns to Avoid

### State Management Anti-Patterns

```typescript
// BAD: Declaring state as variable
function BadComponent() {
  let count = 0; // Will reset on every render!
  return <Text onPress={() => count++}>{count}</Text>;
}

// GOOD: Use useState
function GoodComponent() {
  const [count, setCount] = useState(0);
  return <Text onPress={() => setCount(c => c + 1)}>{count}</Text>;
}
```

### useEffect Anti-Patterns

```typescript
// BAD: Missing cleanup
useEffect(() => {
  const subscription = api.subscribe(handleUpdate);
  // Missing unsubscribe!
}, []);

// GOOD: Proper cleanup
useEffect(() => {
  const subscription = api.subscribe(handleUpdate);
  return () => subscription.unsubscribe();
}, []);

// BAD: Object in dependency array (new object every render)
useEffect(() => {
  // This runs on every render!
}, [{ userId }]);

// GOOD: Use primitive values
useEffect(() => {
  // Only runs when userId changes
}, [userId]);

// BAD: Infinite loop
useEffect(() => {
  setItems([...items, newItem]); // Triggers re-render -> triggers effect
}, [items]);

// GOOD: Use functional update
useEffect(() => {
  setItems(prev => [...prev, newItem]);
}, [newItem]);
```

### FlatList Anti-Patterns

```typescript
// BAD: Index as key
<FlatList
  data={items}
  keyExtractor={(item, index) => index.toString()} // Causes issues on reorder
  renderItem={renderItem}
/>

// GOOD: Unique identifier as key
<FlatList
  data={items}
  keyExtractor={(item) => item.id}
  renderItem={renderItem}
/>

// BAD: Inline renderItem
<FlatList
  data={items}
  renderItem={({ item }) => <Item {...item} />} // New function every render
/>

// GOOD: Memoized renderItem
const renderItem = useCallback(
  ({ item }) => <Item {...item} />,
  []
);

<FlatList
  data={items}
  renderItem={renderItem}
/>
```

### Custom Hooks Anti-Patterns

```typescript
// BAD: use* prefix without using hooks
function useFormatDate(date: Date) {
  // This doesn't use any hooks!
  return date.toLocaleDateString();
}

// GOOD: Regular function for non-hook utilities
function formatDate(date: Date) {
  return date.toLocaleDateString();
}

// BAD: Over-abstracting simple operations
const useDoubled = (value: number) => useMemo(() => value * 2, [value]);

// GOOD: Just inline it
const doubled = value * 2;
```

### Props Drilling Anti-Pattern

```typescript
// BAD: Passing props through many layers
<App>
  <Layout user={user}>
    <Sidebar user={user}>
      <UserInfo user={user} /> {/* user passed through 3 levels */}
    </Sidebar>
  </Layout>
</App>

// GOOD: Use Context or Zustand
const UserContext = createContext<User | null>(null);

<UserContext.Provider value={user}>
  <App>
    <Layout>
      <Sidebar>
        <UserInfo /> {/* Gets user from context */}
      </Sidebar>
    </Layout>
  </App>
</UserContext.Provider>
```

### Performance Anti-Patterns

```typescript
// BAD: Inline styles (new object every render)
<View style={{ padding: 16, margin: 8 }}>
  <Text>Content</Text>
</View>

// GOOD: StyleSheet.create (cached)
const styles = StyleSheet.create({
  container: { padding: 16, margin: 8 },
});

<View style={styles.container}>
  <Text>Content</Text>
</View>

// BAD: console.log in production
console.log('Debug info'); // Blocks JS thread

// GOOD: Use __DEV__ flag or babel plugin
if (__DEV__) {
  console.log('Debug info');
}
```

### Sources
- [React Anti-Patterns 2025](https://jsdev.space/react-anti-patterns-2025/)
- [React Native Advanced Mistakes to Avoid](https://medium.com/@Amanda10/react-native-advanced-mistakes-to-avoid-in-2025-a-developers-guide-to-building-robust-apps-94048e49930e)
- [React Hooks Anti-Patterns](https://techinsights.manisuec.com/reactjs/react-hooks-antipatterns/)

---

## 12. Expo vs Bare Workflow (2025 Recommendation)

### When to Use Expo (Managed Workflow)

- **Prototypes and MVPs**: Quick setup, built-in tools, OTA updates
- **Standard functionality**: Camera, push notifications, etc.
- **Small teams**: No need for iOS/Android specialists
- **Most small-to-medium apps**

```bash
# Create new Expo project (recommended way)
npx create-expo-app my-app
```

### When to Use Bare Workflow

- **Custom native code** requirements
- **Deep integration** with device APIs
- **Complex native libraries** without Expo support
- **Maximum control** over build process

### The Hybrid Approach (Recommended)

1. **Start with Expo** managed workflow
2. **Use config plugins** for native customization
3. **Prebuild** to bare workflow if needed: `npx expo prebuild`

```typescript
// app.config.js - using config plugins
export default {
  expo: {
    plugins: [
      [
        'expo-camera',
        {
          cameraPermission: 'Allow $(PRODUCT_NAME) to access camera.',
        },
      ],
      [
        'expo-notifications',
        {
          sounds: ['./assets/notification.wav'],
        },
      ],
    ],
  },
};
```

### 2025 Consensus

> "You should always use Expo if the app is suitable for building with React Native. Even the React Native team recommends that."

### Sources
- [Expo vs Bare React Native 2025](https://www.godeltech.com/blog/expo-vs-bare-react-native-in-2025/)
- [Expo Documentation](https://docs.expo.dev/bare/overview/)
- [Should You Use Expo 2025](https://scriptide.tech/blog/should-you-use-expo-for-react-native)

---

## Skill File Structure Recommendation

Based on this research, the React Native skill should be structured with the following files:

```
react-native (@vince)/
├── SKILL.md              # Main skill file with philosophy, critical requirements
├── metadata.yaml         # Auto-detection keywords, triggers
├── reference.md          # Decision frameworks, anti-patterns, red flags
└── examples/
    ├── core.md           # Functional components, TypeScript patterns
    ├── navigation.md     # React Navigation 7 patterns
    ├── state.md          # Zustand + TanStack Query patterns
    ├── lists.md          # FlatList/FlashList optimization
    ├── styling.md        # StyleSheet, NativeWind patterns
    ├── platform.md       # Platform-specific code patterns
    ├── performance.md    # Performance optimization techniques
    ├── error-handling.md # Error boundaries, crash recovery
    └── testing.md        # Jest, RTL, Detox patterns
```

---

## Key Takeaways for Skill Creation

1. **New Architecture is the default** - All patterns should assume 0.76+ with JSI/Fabric
2. **Expo is recommended** for new projects by the React Native team
3. **Zustand + TanStack Query** is the dominant state management pattern
4. **FlashList v2** should be recommended over FlatList for performance
5. **TypeScript is mandatory** - All examples should be typed
6. **React Navigation 7** static API should be the primary pattern
7. **NativeWind v5** for utility-first styling (alternative to StyleSheet)
8. **Performance patterns** are critical - FlatList optimization, useMemo/useCallback, image optimization
9. **Platform-specific patterns** essential for cross-platform development
10. **Error boundaries** and proper error handling are production requirements
