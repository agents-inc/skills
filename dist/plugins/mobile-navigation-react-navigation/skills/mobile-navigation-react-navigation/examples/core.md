# React Navigation - Core Setup & Type Safety

> Static and dynamic API setup, global type declarations, typed hooks. See [SKILL.md](../SKILL.md) for decision guidance and red flags.

**Prerequisites**: React Navigation 7+ installed with `@react-navigation/native`, `@react-navigation/native-stack`, `react-native-screens`, `react-native-safe-area-context`.

---

## Pattern 1: Complete Static API Setup

```typescript
// app.tsx
import { createStaticNavigation } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { StaticParamList, StaticScreenProps } from "@react-navigation/native";
import { HomeScreen } from "./screens/home-screen";
import { ProfileScreen } from "./screens/profile-screen";
import { SettingsScreen } from "./screens/settings-screen";

const RootStack = createNativeStackNavigator({
  initialRouteName: "Home",
  screenOptions: {
    headerTintColor: "#007AFF",
    headerStyle: { backgroundColor: "#FFFFFF" },
  },
  screens: {
    Home: {
      screen: HomeScreen,
      linking: "",
    },
    Profile: {
      screen: ProfileScreen,
      linking: {
        path: "profile/:userId",
        parse: { userId: String },
      },
    },
    Settings: {
      screen: SettingsScreen,
      options: { title: "App Settings" },
      linking: "settings",
    },
  },
});

// Create the navigation component (wraps NavigationContainer)
const Navigation = createStaticNavigation(RootStack);

// Infer types from the static config
type RootStackParamList = StaticParamList<typeof RootStack>;

// CRITICAL: Global declaration makes useNavigation() type-safe everywhere
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

export function App() {
  return (
    <Navigation
      linking={{
        enabled: "auto",
        prefixes: ["myapp://", "https://myapp.com"],
      }}
    />
  );
}
```

---

## Pattern 2: StaticScreenProps for Screen Components

```typescript
// screens/profile-screen.tsx
import { View, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { StaticScreenProps } from "@react-navigation/native";

// StaticScreenProps infers route.params type from the static config
type Props = StaticScreenProps<{ userId: string }>;

export function ProfileScreen({ route }: Props) {
  const { userId } = route.params;
  const navigation = useNavigation();

  const handleGoToSettings = () => {
    // Type-safe: "Settings" validated against global RootParamList
    navigation.navigate("Settings");
  };

  return (
    <View>
      <Text>User: {userId}</Text>
    </View>
  );
}
```

---

## Pattern 3: Static API with Conditional Groups (Auth Flow)

```typescript
import { createStaticNavigation } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useContext } from "react";
import { AuthContext } from "./auth-context";

// Hook callbacks for conditional rendering
const useIsAuthenticated = () => {
  const { isAuthenticated } = useContext(AuthContext);
  return isAuthenticated;
};

const useIsGuest = () => !useIsAuthenticated();

const RootStack = createNativeStackNavigator({
  screens: {
    // Screens always visible (e.g., splash, onboarding)
  },
  groups: {
    Auth: {
      if: useIsGuest,
      screenOptions: { headerShown: false, animation: "fade" },
      screens: {
        Login: LoginScreen,
        Register: RegisterScreen,
        ForgotPassword: {
          screen: ForgotPasswordScreen,
          linking: "forgot-password",
        },
      },
    },
    Main: {
      if: useIsAuthenticated,
      screenOptions: { headerShown: true },
      screens: {
        Home: { screen: HomeScreen, linking: "" },
        Profile: {
          screen: ProfileScreen,
          linking: "profile/:userId",
        },
      },
    },
  },
});
```

---

## Pattern 4: Static API with `.with()` for Dynamic Props

```typescript
// Use .with() when the navigator needs access to hooks or providers
const RootStack = createNativeStackNavigator({
  screens: {
    Home: HomeScreen,
    Profile: ProfileScreen,
  },
}).with(({ Navigator }) => {
  const user = useCurrentUser();

  return (
    <Navigator
      screenOptions={({ route }) => {
        if (route.name === "Profile") {
          return {
            headerRight: () =>
              user.id === route.params.userId ? <EditButton /> : null,
          };
        }
        return {};
      }}
    />
  );
});
```

---

## Pattern 5: Complete Dynamic API Setup

```typescript
// navigation/types.ts
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type {
  CompositeNavigationProp,
  RouteProp,
} from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NavigatorScreenParams } from "@react-navigation/native";

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: { email?: string };
};

export type HomeStackParamList = {
  HomeScreen: undefined;
  ProductDetail: { productId: string };
};

export type MainTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  Search: { query?: string } | undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  Modal: { title: string };
};

// CRITICAL: Global declaration
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

// Composite type for screens nested in HomeTab > MainTab > RootStack
export type HomeScreenNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList, "HomeScreen">,
  CompositeNavigationProp<
    BottomTabNavigationProp<MainTabParamList>,
    NativeStackNavigationProp<RootStackParamList>
  >
>;
```

```typescript
// navigation/root-navigator.tsx
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <SplashScreen />;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={MainNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
        <Stack.Group screenOptions={{ presentation: "modal" }}>
          <Stack.Screen
            name="Modal"
            component={ModalScreen}
            options={({ route }) => ({ title: route.params.title })}
          />
        </Stack.Group>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

---

## Pattern 6: Typed Navigation Hooks (Dynamic API)

```typescript
// navigation/hooks.ts
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import type { HomeStackParamList, AuthStackParamList } from "./types";

// Per-navigator typed hooks -- useful when you need navigator-specific methods
export function useHomeNavigation() {
  return useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
}

export function useAuthNavigation() {
  return useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
}

// Generic typed route hook
export function useTypedRoute<
  ParamList extends Record<string, object | undefined>,
  RouteName extends keyof ParamList,
>() {
  return useRoute<RouteProp<ParamList, RouteName>>();
}
```

```typescript
// screens/product-detail-screen.tsx
import { useHomeNavigation, useTypedRoute } from "../navigation/hooks";
import type { HomeStackParamList } from "../navigation/types";

export function ProductDetailScreen() {
  const navigation = useHomeNavigation();
  const route = useTypedRoute<HomeStackParamList, "ProductDetail">();

  const { productId } = route.params; // typed as string

  const handleBack = () => {
    navigation.popTo("HomeScreen"); // v7: use popTo, not navigate
  };
}
```

---

## Pattern 7: Combining Static and Dynamic APIs

```typescript
// Static nested navigator
const HomeTabs = createBottomTabNavigator({
  screens: {
    Latest: LatestScreen,
    Popular: PopularScreen,
  },
});

// Extract component for use in dynamic parent
const HomeTabsComponent = HomeTabs.getComponent();

// Generate linking config from static navigator
import { createPathConfigForStaticNavigation } from "@react-navigation/native";
const homeTabsLinkingScreens = createPathConfigForStaticNavigation(HomeTabs);

// Dynamic parent navigator
const RootStack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer
      linking={{
        prefixes: ["myapp://"],
        config: {
          screens: {
            Home: {
              path: "home",
              screens: homeTabsLinkingScreens,
            },
          },
        },
      }}
    >
      <RootStack.Navigator>
        <RootStack.Screen name="Home" component={HomeTabsComponent} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
```

**When to combine:** Incremental migration from v6 dynamic API to v7 static API. Convert one navigator at a time using `getComponent()` and `createPathConfigForStaticNavigation()`.
