---
name: mobile-navigation-react-navigation
description: React Navigation 7+ patterns - static and dynamic APIs, type-safe navigation, stack/tab/drawer navigators, deep linking, authentication flows, screen preloading, header customization
---

# React Navigation Patterns

> **Quick Guide:** Use the static API for simpler TypeScript inference and automatic deep linking config. Use the dynamic API when you need runtime-dynamic screen lists. Always declare a global `RootParamList` for type-safe `useNavigation` everywhere. Use `createNativeStackNavigator` (not the JS stack) for production performance. Auth flows use conditional screen rendering via the `if` callback (static) or conditional JSX (dynamic). Deep linking config lives per-screen in the static API -- no separate config object needed.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST declare a global `ReactNavigation.RootParamList` interface so `useNavigation` is type-safe without manual annotation)**

**(You MUST use `createNativeStackNavigator` for production apps -- the JS stack (`@react-navigation/stack`) is significantly slower and only needed for highly custom transitions)**

**(You MUST use `popTo()` to navigate back to a previous screen in the stack -- `navigate()` in v7 no longer pops back to existing screens)**

**(You MUST wrap `useFocusEffect` callbacks in `useCallback` -- without it, the effect runs on every render, not just focus changes)**

**(You MUST NOT use `navigation.navigate('NestedScreen')` to reach screens in child navigators -- v7 removed implicit nested navigation; use explicit parent targeting)**

</critical_requirements>

---

**Auto-detection:** React Navigation, @react-navigation, createNativeStackNavigator, createBottomTabNavigator, createDrawerNavigator, createStaticNavigation, NavigationContainer, useNavigation, useRoute, useFocusEffect, usePreventRemove, StaticParamList, StaticScreenProps, NativeStackNavigationProp, CompositeNavigationProp, NavigatorScreenParams, deep linking, linking config, headerSearchBarOptions, headerLargeTitle, popTo, preload

**When to use:**

- Setting up navigation structure (stack, tab, drawer) in a React Native app
- Choosing between static API and dynamic API for navigator configuration
- Adding type-safe navigation with TypeScript (param lists, typed hooks)
- Configuring deep linking (URL prefixes, path params, universal links)
- Implementing authentication flows with conditional screen rendering
- Customizing headers (large titles, search bars, custom buttons)
- Preloading screens for perceived performance
- Preventing back navigation for unsaved changes

**When NOT to use:**

- File-based routing with a managed workflow (uses its own router built on React Navigation)
- Web-only React apps (use a web router)
- Simple single-screen apps with no navigation

**Key patterns covered:**

- Static API vs dynamic API: when to use each
- Global `RootParamList` declaration for type-safe hooks everywhere
- Native stack vs JS stack performance trade-offs
- Auth flow with conditional screens (static `if` callback or dynamic JSX)
- Deep linking configuration (per-screen in static, `linking` prop in dynamic)
- Screen preloading with `navigation.preload()`
- `useFocusEffect` for screen lifecycle management
- `usePreventRemove` for unsaved changes guards
- Header customization: large titles, search bars, form sheets

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Static API setup, dynamic API setup, type-safe navigation, global RootParamList
- [examples/patterns.md](examples/patterns.md) - Auth flows, deep linking, modals, tab navigator with nested stacks
- [examples/advanced.md](examples/advanced.md) - Screen preloading, state persistence, usePreventRemove, useFocusEffect, header customization
- [reference.md](reference.md) - Decision frameworks, screen options cheat sheet, v6-to-v7 migration

---

<philosophy>

## Philosophy

React Navigation provides routing and navigation for React Native apps. The key decision in v7 is **static vs dynamic API**:

- **Static API** -- object-based configuration. Simpler TypeScript (types inferred from config), automatic deep linking path generation, less boilerplate. Use for most apps.
- **Dynamic API** -- component-based configuration (`<Stack.Navigator>`/`<Stack.Screen>`). Required when screen lists change at runtime or you need full programmatic control over navigator props. More verbose but more flexible.

Both APIs produce the same navigation behavior -- the difference is configuration ergonomics.

**Core principles:**

1. **Native stack by default** -- `createNativeStackNavigator` uses platform navigation primitives (UINavigationController/Fragment) for smoother transitions and lower memory. The JS stack (`@react-navigation/stack`) only when you need custom transition animations not available natively.
2. **Type safety from the root** -- Declare `ReactNavigation.RootParamList` globally so every `useNavigation()` call is type-checked without manual generics.
3. **Deep linking as first-class** -- Configure linking per-screen (static API) or in a centralized config (dynamic API). Prefixes handle custom schemes and universal links.
4. **Screen lifecycle via focus** -- Screens in a stack remain mounted when covered. Use `useFocusEffect` (not `useEffect`) for work that should pause when the screen loses focus.

**v7 behavioral changes from v6:**

- `navigate()` no longer pops back to existing screens -- use `popTo()` instead
- Implicit nested navigator navigation removed -- must target parent screen explicitly
- `headerBackTitleVisible` replaced with `headerBackButtonDisplayMode`
- Navigation state is frozen in dev mode (mutations throw)
- Theme objects now require a `fonts` property

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Static API Setup

The static API uses object configuration for simpler TypeScript and automatic deep linking.

```typescript
import { createStaticNavigation } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { StaticParamList } from "@react-navigation/native";

const RootStack = createNativeStackNavigator({
  initialRouteName: "Home",
  screenOptions: { headerShown: true },
  screens: {
    Home: HomeScreen,
    Profile: {
      screen: ProfileScreen,
      linking: "profile/:userId",
    },
  },
});

const Navigation = createStaticNavigation(RootStack);

// Declare global types -- makes useNavigation() type-safe everywhere
type RootStackParamList = StaticParamList<typeof RootStack>;
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

export function App() {
  return <Navigation />;
}
```

**Why good:** types inferred from config (no manual `ParamList`), deep linking paths defined per-screen, less boilerplate than dynamic API

See [examples/core.md](examples/core.md) for complete static API setup with groups and conditional screens.

---

### Pattern 2: Dynamic API Setup

The dynamic API uses JSX components. Use when screen lists are runtime-dynamic.

```typescript
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

type RootStackParamList = {
  Home: undefined;
  Profile: { userId: string };
};

// Must declare globally for type-safe useNavigation()
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

const Stack = createNativeStackNavigator<RootStackParamList>();

export function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

**Why good:** familiar JSX pattern, supports runtime-dynamic screen lists, manual param list gives explicit control

See [examples/core.md](examples/core.md) for dynamic API with typed hooks and nested navigators.

---

### Pattern 3: Type-Safe Navigation Hooks

Declare `RootParamList` globally once, then `useNavigation()` and `useRoute()` are type-safe everywhere without manual generics.

```typescript
// In any screen component -- no generic needed
function HomeScreen() {
  const navigation = useNavigation();

  // Type-checked: "Profile" must exist, params must match
  navigation.navigate("Profile", { userId: "123" });

  // Type error: "Nonexistent" is not in RootParamList
  navigation.navigate("Nonexistent"); // compile error
}
```

For nested navigators, use `CompositeScreenProps` or `NavigatorScreenParams` to propagate types. With the static API, use `StaticScreenProps` for screen component props.

See [examples/core.md](examples/core.md) for composite types and `StaticScreenProps`.

---

### Pattern 4: Authentication Flow

Conditionally render auth or main screens. React Navigation animates the transition automatically.

```typescript
// Static API: use the `if` callback on groups
const useIsAuthenticated = () => {
  const { isAuthenticated } = useContext(AuthContext);
  return isAuthenticated;
};

const useIsGuest = () => !useIsAuthenticated();

const RootStack = createNativeStackNavigator({
  screens: {},
  groups: {
    Auth: {
      if: useIsGuest,
      screenOptions: { headerShown: false },
      screens: { Login: LoginScreen, Register: RegisterScreen },
    },
    Main: {
      if: useIsAuthenticated,
      screens: { Home: HomeScreen, Profile: ProfileScreen },
    },
  },
});
```

**Why good:** `if` callbacks cleanly separate auth/main screens, React Navigation handles transition animation, no manual state-based conditional rendering needed

See [examples/patterns.md](examples/patterns.md) for both static and dynamic auth flow implementations.

---

### Pattern 5: Deep Linking

Static API: define `linking` per-screen. Dynamic API: pass a `linking` config to `NavigationContainer`.

```typescript
// Static API -- linking defined inline per screen
const RootStack = createNativeStackNavigator({
  screens: {
    Home: { screen: HomeScreen, linking: "" },
    Profile: {
      screen: ProfileScreen,
      linking: {
        path: "user/:userId",
        parse: { userId: (id: string) => id.replace(/^@/, "") },
        stringify: { userId: (id: string) => `@${id}` },
      },
    },
  },
});

const Navigation = createStaticNavigation(RootStack);

export function App() {
  return (
    <Navigation
      linking={{ prefixes: ["myapp://", "https://myapp.com"] }}
    />
  );
}
```

**Why good:** linking config co-located with screen definition, parse/stringify handle URL encoding, prefixes handle both custom scheme and universal links

See [examples/patterns.md](examples/patterns.md) for dynamic API linking, custom URL handlers, and platform-specific setup.

---

### Pattern 6: Native Stack vs JS Stack

```
Which stack navigator?
|-- Need custom JS-driven transition animations? --> @react-navigation/stack (JS)
|-- Everything else --> @react-navigation/native-stack (NATIVE)
```

| Feature            | Native Stack                       | JS Stack                   |
| ------------------ | ---------------------------------- | -------------------------- |
| Performance        | Native animations, lower memory    | JS-driven, higher overhead |
| Transitions        | Platform defaults + limited custom | Fully customizable         |
| Large titles (iOS) | Supported natively                 | Not available              |
| Search bar (iOS)   | headerSearchBarOptions             | Must build custom          |
| Form sheets        | presentation: "formSheet"          | Not available              |
| Gesture handling   | Native, smooth                     | JS-driven                  |

**Default to native stack.** Only use JS stack when you need transition animations that native stack cannot provide.

---

### Pattern 7: useFocusEffect for Screen Lifecycle

Screens in a stack remain mounted when a new screen is pushed. Use `useFocusEffect` to run effects only when the screen is focused.

```typescript
import { useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";

function ChatScreen({ roomId }: { roomId: string }) {
  useFocusEffect(
    useCallback(() => {
      const ws = new WebSocket(`wss://chat.example.com/rooms/${roomId}`);
      // Cleanup runs when screen loses focus
      return () => ws.close();
    }, [roomId]),
  );
}
```

**Gotcha:** The callback MUST be wrapped in `useCallback`. Without it, the effect re-runs on every render, not just focus changes.

See [examples/advanced.md](examples/advanced.md) for polling, analytics tracking, and resource cleanup patterns.

---

### Pattern 8: Screen Preloading

Preload heavy screens before the user navigates to them. The screen is rendered off-screen with all hooks running.

```typescript
function ProductList() {
  const navigation = useNavigation();

  const handleLongPress = (productId: string) => {
    navigation.preload("ProductDetail", { productId });
  };
  // Later: navigation.navigate("ProductDetail", { productId }) is instant
}
```

**Limitations:** Preloaded screens cannot dispatch navigation actions, update options, or listen to events until actually navigated to.

---

### Pattern 9: Header Customization

Native stack supports platform-native header features: large titles, search bars, and form sheets.

```typescript
<Stack.Screen
  name="Settings"
  component={SettingsScreen}
  options={{
    headerLargeTitleEnabled: true,
    headerLargeStyle: { backgroundColor: "#f5f5f5" },
    headerSearchBarOptions: {
      placeholder: "Search settings...",
      onChangeText: (e) => handleSearch(e.nativeEvent.text),
      hideWhenScrolling: true,
    },
  }}
/>
```

**Gotcha:** Custom `header` functions disable ALL native header features (large title, search bar, blur effects). Use `headerLeft`/`headerRight` to add custom elements while keeping native behavior.

See [examples/advanced.md](examples/advanced.md) for form sheets, custom header items, and search bar integration.

</patterns>

---

<decision_framework>

## Decision Framework

### Static vs Dynamic API

```
Starting a new navigation setup?
|-- Can all screens be defined at build time?
|   |-- YES --> Static API (simpler TS, auto deep linking)
|   +-- NO  --> Dynamic API (runtime screen lists)
|
|-- Migrating incrementally from v6?
|   +-- YES --> Dynamic API at root, static for new navigators
|       (use getComponent() and createPathConfigForStaticNavigation)
|
|-- Need to wrap navigator with providers (e.g. context)?
|   +-- Use static API with .with() method
```

### Navigator Type

```
What navigation pattern?
|-- Linear flow (onboarding, checkout) --> Stack Navigator
|-- Main app sections with persistent bar --> Bottom Tab Navigator
|-- Side menu / settings panel --> Drawer Navigator
|-- Modal overlays --> Stack with presentation: "modal"
|-- Bottom sheets --> Stack with presentation: "formSheet"
|-- Combination --> Nest navigators (tabs inside stack, stacks inside tabs)
```

### Navigation Method

```
How to move between screens?
|-- Push new screen forward --> navigation.navigate("Screen", params)
|-- Go back to specific screen --> navigation.popTo("Screen", params)
|-- Go back one screen --> navigation.goBack()
|-- Replace current screen --> navigation.replace("Screen", params)
|-- Reset entire stack --> navigation.reset({ routes: [...] })
|-- Navigate to nested screen --> navigation.navigate("Parent", { screen: "Child" })
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Using `navigate()` to go back to a previous screen -- v7 changed behavior; `navigate()` stays on current screen if target exists. Use `popTo()` instead.
- Using `navigation.navigate("NestedScreen")` to reach child navigator screens -- removed in v7. Must use `navigate("ParentScreen", { screen: "NestedScreen" })`.
- Using JS stack (`@react-navigation/stack`) for production without a specific need for custom transitions -- native stack is significantly more performant.
- Missing global `RootParamList` declaration -- every `useNavigation()` call is untyped, losing the primary benefit of TypeScript with React Navigation.
- Using a custom `header` function and expecting native features (large title, search bar, blur) -- custom headers disable all native header functionality.

**Medium Priority Issues:**

- Inline component functions in `<Stack.Screen component={() => <MyScreen />} />` -- creates a new component on every render, causing unmount/remount. Always pass a reference.
- Not using `useFocusEffect` for screen-specific side effects -- `useEffect` runs even when the screen is covered by another screen in the stack.
- Mutating navigation state directly (caught in dev mode in v7, silent corruption in prod).
- Missing `fonts` property in custom theme -- required in v7, crashes without it.

**Gotchas & Edge Cases:**

- `useFocusEffect` callback must be wrapped in `useCallback` -- without it, the effect fires on every render, not just focus changes
- `usePreventRemove` only fires for navigation state removal (back, pop, reset) -- it does NOT fire when the screen is merely unfocused (push, tab switch)
- Preloaded screens cannot dispatch navigation actions or call `navigation.setOptions()` until actually navigated to
- Screen `options` can be an object or a function receiving `{ route, navigation }` -- use the function form when options depend on route params
- `headerSearchBarOptions` requires `contentInsetAdjustmentBehavior="automatic"` on your ScrollView/FlatList for proper layout
- `headerBackButtonDisplayMode` replaced `headerBackTitleVisible` in v7 -- values are "default", "generic", or "minimal"
- `unmountOnBlur` removed from tabs/drawer in v7 -- use `popToTopOnBlur: true` or the `useIsFocused` pattern instead
- Navigation state frozen in dev mode -- if you were mutating state directly, you'll get runtime errors in v7 dev builds
- Android requires `RNScreensFragmentFactory` setup in `MainActivity` -- without it, View state is lost during Activity restarts
- The `Link` component changed from path-based to screen-based: `<Link screen="Profile" params={{ userId }}>` not `<Link to="/profile/123">`

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST declare a global `ReactNavigation.RootParamList` interface so `useNavigation` is type-safe without manual annotation)**

**(You MUST use `createNativeStackNavigator` for production apps -- the JS stack (`@react-navigation/stack`) is significantly slower and only needed for highly custom transitions)**

**(You MUST use `popTo()` to navigate back to a previous screen in the stack -- `navigate()` in v7 no longer pops back to existing screens)**

**(You MUST wrap `useFocusEffect` callbacks in `useCallback` -- without it, the effect runs on every render, not just focus changes)**

**(You MUST NOT use `navigation.navigate('NestedScreen')` to reach screens in child navigators -- v7 removed implicit nested navigation; use explicit parent targeting)**

**Failure to follow these rules will cause untyped navigation, performance issues, broken back navigation, and runtime errors.**

</critical_reminders>
