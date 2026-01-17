# React Navigation Patterns

Type-safe navigation, authentication flows, and common navigation patterns.

---

## Type-Safe Navigation Setup

```typescript
// navigation/types.ts
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { CompositeNavigationProp, RouteProp } from "@react-navigation/native";

// Define param lists for each navigator
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Modal: { title: string };
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: { email?: string };
};

export type MainTabParamList = {
  Home: undefined;
  Search: { query?: string };
  Profile: undefined;
};

export type HomeStackParamList = {
  HomeScreen: undefined;
  ProductDetail: { productId: string };
  CategoryList: { categoryId: string; categoryName: string };
};

// Composite navigation types for nested navigators
export type HomeScreenNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList, "HomeScreen">,
  CompositeNavigationProp<
    BottomTabNavigationProp<MainTabParamList>,
    NativeStackNavigationProp<RootStackParamList>
  >
>;

// Route types
export type ProductDetailRouteProp = RouteProp<HomeStackParamList, "ProductDetail">;
```

---

## Type-Safe Navigation Hooks

```typescript
// navigation/hooks.ts
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import type {
  RootStackParamList,
  AuthStackParamList,
  HomeStackParamList,
} from "./types";

// Typed navigation hooks
export function useRootNavigation() {
  return useNavigation<NativeStackNavigationProp<RootStackParamList>>();
}

export function useAuthNavigation() {
  return useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
}

export function useHomeNavigation() {
  return useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
}

// Typed route hook
export function useTypedRoute<
  ParamList extends Record<string, object | undefined>,
  RouteName extends keyof ParamList
>() {
  return useRoute<RouteProp<ParamList, RouteName>>();
}

// Usage in component
function ProductDetailScreen() {
  const navigation = useHomeNavigation();
  const route = useTypedRoute<HomeStackParamList, "ProductDetail">();

  const { productId } = route.params;

  const handleGoBack = () => {
    navigation.goBack();
  };

  const handleNavigateToCategory = (categoryId: string, categoryName: string) => {
    navigation.navigate("CategoryList", { categoryId, categoryName });
  };

  return (
    <View>
      <Text>Product: {productId}</Text>
    </View>
  );
}
```

---

## Authentication Flow Pattern

```typescript
// navigation/root-navigator.tsx
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../hooks/use-auth";
import { AuthNavigator } from "./auth-navigator";
import { MainNavigator } from "./main-navigator";
import { SplashScreen } from "../screens/splash-screen";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show splash while checking auth state
  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <Stack.Screen name="Main" component={MainNavigator} />
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
}

// navigation/auth-navigator.tsx
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LoginScreen } from "../screens/auth/login-screen";
import { RegisterScreen } from "../screens/auth/register-screen";
import { ForgotPasswordScreen } from "../screens/auth/forgot-password-screen";
import type { AuthStackParamList } from "./types";

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{ title: "Create Account" }}
      />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{ title: "Reset Password" }}
      />
    </Stack.Navigator>
  );
}
```

---

## Tab Navigator with Nested Stacks

```typescript
// navigation/main-navigator.tsx
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { HomeScreen } from "../screens/home/home-screen";
import { ProductDetailScreen } from "../screens/home/product-detail-screen";
import { SearchScreen } from "../screens/search/search-screen";
import { ProfileScreen } from "../screens/profile/profile-screen";
import type { MainTabParamList, HomeStackParamList } from "./types";

// Home Stack (nested in tab)
const HomeStack = createNativeStackNavigator<HomeStackParamList>();

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator>
      <HomeStack.Screen
        name="HomeScreen"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <HomeStack.Screen
        name="ProductDetail"
        component={ProductDetailScreen}
        options={({ route }) => ({
          title: "Product Details",
        })}
      />
    </HomeStack.Navigator>
  );
}

// Tab Navigator
const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#007AFF",
        tabBarInactiveTintColor: "#8E8E93",
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeStackNavigator}
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="home" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          tabBarLabel: "Search",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="search" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: "Profile",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="person" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
```

---

## Modal Navigation Pattern

```typescript
// navigation/root-navigator.tsx - with modals
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ModalScreen } from "../screens/modal-screen";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { isAuthenticated } = useAuth();

  return (
    <Stack.Navigator>
      <Stack.Group screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={MainNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Group>

      {/* Modal screens accessible from anywhere */}
      <Stack.Group
        screenOptions={{
          presentation: "modal",
          headerShown: true,
        }}
      >
        <Stack.Screen
          name="Modal"
          component={ModalScreen}
          options={({ route }) => ({
            title: route.params.title,
          })}
        />
      </Stack.Group>
    </Stack.Navigator>
  );
}

// Opening modal from anywhere
function SomeScreen() {
  const navigation = useRootNavigation();

  const openModal = () => {
    navigation.navigate("Modal", { title: "My Modal" });
  };

  return (
    <Button onPress={openModal}>Open Modal</Button>
  );
}
```

---

## useFocusEffect for Resource Management

```typescript
import { useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";

// WebSocket connection management
function ChatScreen({ roomId }: { roomId: string }) {
  useFocusEffect(
    useCallback(() => {
      // Setup: Connect when screen is focused
      const ws = new WebSocket(`wss://chat.example.com/rooms/${roomId}`);

      ws.onopen = () => {
        console.log("Connected to chat");
      };

      ws.onmessage = (event) => {
        // Handle incoming messages
      };

      // Cleanup: Disconnect when screen loses focus
      return () => {
        ws.close();
      };
    }, [roomId])
  );

  return <ChatUI />;
}

// Analytics tracking
function ProductScreen({ productId }: { productId: string }) {
  useFocusEffect(
    useCallback(() => {
      // Track screen view when focused
      analytics.trackScreenView("ProductScreen", { productId });

      const startTime = Date.now();

      // Track time spent when leaving
      return () => {
        const timeSpent = Date.now() - startTime;
        analytics.trackTimeSpent("ProductScreen", { productId, timeSpent });
      };
    }, [productId])
  );

  return <ProductDetails productId={productId} />;
}

// Polling data while focused
function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);

  useFocusEffect(
    useCallback(() => {
      // Start polling when focused
      const fetchNotifications = async () => {
        const data = await api.getNotifications();
        setNotifications(data);
      };

      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);

      // Stop polling when unfocused
      return () => {
        clearInterval(interval);
      };
    }, [])
  );

  return <NotificationList notifications={notifications} />;
}
```

---

## Screen Preloading Pattern

```typescript
import { useNavigation } from "@react-navigation/native";
import { useCallback } from "react";

function ProductList({ products }: { products: Product[] }) {
  const navigation = useNavigation();

  // Preload product detail screen when user hovers/long-presses
  const handlePreload = useCallback(
    (productId: string) => {
      // React Navigation 7+ supports preloading
      if ("preload" in navigation) {
        (navigation as any).preload("ProductDetail", { productId });
      }
    },
    [navigation]
  );

  const renderItem = useCallback(
    ({ item }: { item: Product }) => (
      <ProductCard
        product={item}
        onPress={() =>
          navigation.navigate("ProductDetail", { productId: item.id })
        }
        onLongPress={() => handlePreload(item.id)}
      />
    ),
    [navigation, handlePreload]
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

---

## Deep Linking Configuration

```typescript
// navigation/linking.ts
import type { LinkingOptions } from "@react-navigation/native";
import type { RootStackParamList } from "./types";

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ["myapp://", "https://myapp.com"],

  config: {
    screens: {
      Auth: {
        screens: {
          Login: "login",
          Register: "register",
          ForgotPassword: "forgot-password",
        },
      },
      Main: {
        screens: {
          Home: {
            screens: {
              HomeScreen: "",
              ProductDetail: "product/:productId",
              CategoryList: "category/:categoryId",
            },
          },
          Search: "search",
          Profile: "profile",
        },
      },
      Modal: "modal/:title",
    },
  },

  // Custom URL parsing
  getStateFromPath: (path, config) => {
    // Handle custom URL formats
    if (path.startsWith("/p/")) {
      const productId = path.replace("/p/", "");
      return {
        routes: [
          {
            name: "Main",
            state: {
              routes: [
                {
                  name: "Home",
                  state: {
                    routes: [
                      { name: "HomeScreen" },
                      { name: "ProductDetail", params: { productId } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      };
    }

    // Default behavior
    return undefined;
  },
};

// App.tsx
import { NavigationContainer } from "@react-navigation/native";
import { linking } from "./navigation/linking";

function App() {
  return (
    <NavigationContainer linking={linking}>
      <RootNavigator />
    </NavigationContainer>
  );
}
```

---

## Navigation State Persistence

```typescript
// Persist navigation state across app restarts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer, type NavigationState } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";

const NAVIGATION_STATE_KEY = "NAVIGATION_STATE";

function App() {
  const [isReady, setIsReady] = useState(false);
  const [initialState, setInitialState] = useState<NavigationState | undefined>();

  useEffect(() => {
    const restoreState = async () => {
      try {
        const savedStateString = await AsyncStorage.getItem(NAVIGATION_STATE_KEY);
        const state = savedStateString ? JSON.parse(savedStateString) : undefined;
        setInitialState(state);
      } finally {
        setIsReady(true);
      }
    };

    if (!isReady) {
      restoreState();
    }
  }, [isReady]);

  const onStateChange = useCallback((state: NavigationState | undefined) => {
    if (state) {
      AsyncStorage.setItem(NAVIGATION_STATE_KEY, JSON.stringify(state));
    }
  }, []);

  if (!isReady) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer
      initialState={initialState}
      onStateChange={onStateChange}
    >
      <RootNavigator />
    </NavigationContainer>
  );
}
```
