# React Navigation - Navigation Patterns

> Auth flows, deep linking, modals, and tab+stack composition. See [core.md](core.md) for API setup and type safety.

---

## Pattern 1: Authentication Flow (Dynamic API)

```typescript
// navigation/root-navigator.tsx
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../hooks/use-auth";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show splash while checking auth state (token validation, etc.)
  if (isLoading) return <SplashScreen />;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="Main" component={MainNavigator} />
            <Stack.Group screenOptions={{ presentation: "modal" }}>
              <Stack.Screen name="Modal" component={ModalScreen} />
            </Stack.Group>
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

**Why this pattern:** React Navigation detects the screen list change and automatically animates the transition. No manual navigation calls needed -- just toggle the auth state and the UI follows.

**Anti-pattern:** Don't conditionally render individual screens in the same navigator based on auth state. Separate auth and main into distinct navigator branches.

---

## Pattern 2: Tab Navigator with Nested Stacks

```typescript
// navigation/main-navigator.tsx
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { MainTabParamList, HomeStackParamList } from "./types";

// Stack nested inside a tab
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
        options={{ title: "Product Details" }}
      />
    </HomeStack.Navigator>
  );
}

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ACTIVE_COLOR = "#007AFF";
const TAB_INACTIVE_COLOR = "#8E8E93";

export function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: TAB_ACTIVE_COLOR,
        tabBarInactiveTintColor: TAB_INACTIVE_COLOR,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ color, size }) => (
            <HomeIcon color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          tabBarLabel: "Search",
          tabBarIcon: ({ color, size }) => (
            <SearchIcon color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: "Profile",
          tabBarIcon: ({ color, size }) => (
            <ProfileIcon color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
```

---

## Pattern 3: Modal Navigation

```typescript
// Modals are stack screens with presentation: "modal" or "formSheet"
const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator>
      {/* Regular screens */}
      <Stack.Group screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainNavigator} />
      </Stack.Group>

      {/* Modal screens -- accessible from anywhere in the app */}
      <Stack.Group screenOptions={{ presentation: "modal", headerShown: true }}>
        <Stack.Screen
          name="CreatePost"
          component={CreatePostScreen}
          options={{ title: "New Post" }}
        />
      </Stack.Group>

      {/* Form sheet -- iOS bottom sheet, Android modal */}
      <Stack.Group screenOptions={{ presentation: "formSheet" }}>
        <Stack.Screen
          name="Filter"
          component={FilterScreen}
          options={{
            sheetAllowedDetents: [0.5, 1.0],
            sheetGrabberVisible: true,
            sheetCornerRadius: 16,
          }}
        />
      </Stack.Group>
    </Stack.Navigator>
  );
}

// Opening modal from any screen
function SomeScreen() {
  const navigation = useNavigation();

  return (
    <Pressable onPress={() => navigation.navigate("CreatePost")}>
      <Text>New Post</Text>
    </Pressable>
  );
}
```

**Note:** Screens pushed on top of a modal in v7 automatically use modal presentation. Set `presentation: "card"` explicitly to override this.

---

## Pattern 4: Drawer Navigator

```typescript
import { createDrawerNavigator } from "@react-navigation/drawer";

type DrawerParamList = {
  Home: undefined;
  Settings: undefined;
  About: undefined;
};

const Drawer = createDrawerNavigator<DrawerParamList>();

export function DrawerNavigator() {
  return (
    <Drawer.Navigator
      screenOptions={{
        drawerActiveTintColor: "#007AFF",
        headerShown: true,
      }}
    >
      <Drawer.Screen
        name="Home"
        component={HomeScreen}
        options={{
          drawerLabel: "Home",
          drawerIcon: ({ color, size }) => (
            <HomeIcon color={color} size={size} />
          ),
        }}
      />
      <Drawer.Screen name="Settings" component={SettingsScreen} />
      <Drawer.Screen name="About" component={AboutScreen} />
    </Drawer.Navigator>
  );
}
```

**Note:** Drawer navigator in v7 requires Reanimated 2 or 3 on native platforms.

---

## Pattern 5: Deep Linking (Dynamic API)

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
          HomeTab: {
            screens: {
              HomeScreen: "",
              ProductDetail: "product/:productId",
            },
          },
          Search: "search",
          Profile: "profile",
        },
      },
      Modal: "modal/:title",
    },
  },
};

// app.tsx
import { linking } from "./navigation/linking";

export function App() {
  return (
    <NavigationContainer linking={linking} fallback={<SplashScreen />}>
      <RootNavigator />
    </NavigationContainer>
  );
}
```

---

## Pattern 6: Deep Linking with Custom URL Handlers

Override the default URL handling for push notifications or other custom URL sources.

```typescript
import { Linking } from "react-native";
import type { LinkingOptions } from "@react-navigation/native";

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ["myapp://", "https://myapp.com"],

  // Handle initial URL (app opened via deep link)
  async getInitialURL() {
    // Check for standard deep link first
    const url = await Linking.getInitialURL();
    if (url != null) return url;

    // Check push notification data as fallback
    const notification = await getLastNotificationResponse();
    return notification?.data?.url ?? null;
  },

  // Subscribe to incoming URLs while app is running
  subscribe(listener) {
    // Standard deep link listener
    const linkingSub = Linking.addEventListener("url", ({ url }) => {
      listener(url);
    });

    // Push notification URL listener
    const notifSub = addNotificationResponseListener((response) => {
      const url = response.notification.request.content.data.url;
      if (url) listener(url);
    });

    return () => {
      linkingSub.remove();
      notifSub.remove();
    };
  },

  config: {
    screens: {
      // ... screen config
    },
  },
};
```

---

## Pattern 7: Navigate to Nested Screens (v7 Change)

```typescript
// v7: Must target the parent screen, then specify the nested screen
function goToProductDetail(productId: string) {
  // Correct: explicit parent targeting
  navigation.navigate("Main", {
    screen: "HomeTab",
    params: {
      screen: "ProductDetail",
      params: { productId },
    },
  });
}

// Anti-pattern in v7: implicit nested navigation removed
// navigation.navigate("ProductDetail", { productId }); // WILL NOT WORK
```

**Temporary escape hatch:** Add `navigationInChildEnabled` to `NavigationContainer` during migration. Remove once all call sites are updated.

```typescript
<NavigationContainer navigationInChildEnabled>
  {/* ... */}
</NavigationContainer>
```
