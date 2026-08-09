# React Navigation Quick Reference

> Decision frameworks, screen options cheat sheet, v6-to-v7 migration. See [SKILL.md](SKILL.md) for red flags and philosophy.

---

## Decision Framework

### Static vs Dynamic API

```
Starting fresh?
|-- YES --> Static API (simpler types, auto deep linking)
|
Migrating from v6?
|-- Incrementally --> Dynamic root + static nested (one at a time)
|-- Full rewrite --> Static API
|
Need runtime-dynamic screen lists?
|-- YES --> Dynamic API
|-- NO  --> Static API
```

### Navigator Type

```
What navigation pattern?
|-- Linear forward/back flow        --> Stack Navigator
|-- Persistent bottom bar            --> Bottom Tab Navigator
|-- Side menu / drawer               --> Drawer Navigator
|-- Full-screen overlay              --> Stack + presentation: "modal"
|-- Bottom sheet / partial overlay   --> Stack + presentation: "formSheet"
|-- Combination                      --> Nest navigators
```

### Navigation Method (v7)

| Method                       | When to Use                                                   |
| ---------------------------- | ------------------------------------------------------------- |
| `navigate("Screen", params)` | Go forward to a screen. Stays put if already focused.         |
| `popTo("Screen", params)`    | Go BACK to a specific screen in the stack. NEW in v7.         |
| `goBack()`                   | Go back one screen.                                           |
| `push("Screen", params)`     | Always push a new instance (even if screen already in stack). |
| `replace("Screen", params)`  | Replace current screen (no back navigation to it).            |
| `pop(n)`                     | Go back n screens.                                            |
| `popToTop()`                 | Go back to first screen in stack.                             |
| `reset({ routes: [...] })`   | Reset entire navigation state.                                |
| `preload("Screen", params)`  | Render screen off-screen in background. NEW in v7.            |

---

## Screen Options Cheat Sheet (Native Stack)

### Header

| Option                | Type               | Notes                                        |
| --------------------- | ------------------ | -------------------------------------------- |
| `headerShown`         | boolean            | Show/hide entire header                      |
| `title`               | string             | Fallback for headerTitle                     |
| `headerTitle`         | string or function | Title content                                |
| `headerTintColor`     | string             | Back button and title color                  |
| `headerStyle`         | object             | `{ backgroundColor }`                        |
| `headerTransparent`   | boolean            | Transparent header background                |
| `headerBlurEffect`    | string             | iOS blur material ("regular", "light", etc.) |
| `headerShadowVisible` | boolean            | Show header bottom shadow                    |
| `headerLeft`          | function           | Custom left element                          |
| `headerRight`         | function           | Custom right element                         |

### Large Title (iOS)

| Option                          | Type    | Notes                                         |
| ------------------------------- | ------- | --------------------------------------------- |
| `headerLargeTitleEnabled`       | boolean | Enable collapsible large title                |
| `headerLargeStyle`              | object  | `{ backgroundColor }` for large title area    |
| `headerLargeTitleStyle`         | object  | `{ fontFamily, fontSize, fontWeight, color }` |
| `headerLargeTitleShadowVisible` | boolean | Shadow below large title                      |

### Back Button (iOS)

| Option                        | Type    | Notes                                                                           |
| ----------------------------- | ------- | ------------------------------------------------------------------------------- |
| `headerBackVisible`           | boolean | Show/hide back button                                                           |
| `headerBackTitle`             | string  | Custom back button label                                                        |
| `headerBackButtonDisplayMode` | string  | `"default"`, `"generic"`, or `"minimal"` (replaces v6 `headerBackTitleVisible`) |
| `headerBackButtonMenuEnabled` | boolean | Long-press shows stack history (default: true)                                  |

### Search Bar

| Option                                     | Type     | Notes                        |
| ------------------------------------------ | -------- | ---------------------------- |
| `headerSearchBarOptions.placeholder`       | string   | Search placeholder text      |
| `headerSearchBarOptions.onChangeText`      | function | Text change handler          |
| `headerSearchBarOptions.hideWhenScrolling` | boolean  | iOS: collapse on scroll      |
| `headerSearchBarOptions.autoFocus`         | boolean  | Android: auto-focus on mount |

### Animation

| Option                     | Type    | Notes                                                                                                                                              |
| -------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `animation`                | string  | `"default"`, `"fade"`, `"slide_from_right"`, `"slide_from_left"`, `"slide_from_bottom"`, `"fade_from_bottom"`, `"flip"`, `"simple_push"`, `"none"` |
| `animationDuration`        | number  | iOS only, in ms (default: 350)                                                                                                                     |
| `gestureEnabled`           | boolean | iOS: swipe back gesture                                                                                                                            |
| `fullScreenGestureEnabled` | boolean | iOS: swipe from anywhere                                                                                                                           |

### Presentation

| Option                | Type    | Notes                                                                                                                            |
| --------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `presentation`        | string  | `"card"`, `"modal"`, `"transparentModal"`, `"containedModal"`, `"fullScreenModal"`, `"formSheet"`, `"containedTransparentModal"` |
| `sheetAllowedDetents` | array   | Form sheet stop points: `[0.25, 0.5, 1.0]` or `"fitToContents"`                                                                  |
| `sheetGrabberVisible` | boolean | iOS: show drag indicator                                                                                                         |
| `sheetCornerRadius`   | number  | Corner radius in points                                                                                                          |

### Performance

| Option         | Type    | Notes                                        |
| -------------- | ------- | -------------------------------------------- |
| `freezeOnBlur` | boolean | Prevents re-renders when screen inactive     |
| `lazy`         | boolean | Tab/Drawer: don't render until first visited |

---

## v6 to v7 Migration Checklist

### Breaking Changes

- [ ] `navigate()` no longer pops back -- replace with `popTo()` for back navigation
- [ ] Implicit nested navigation removed -- use `navigate("Parent", { screen: "Child" })`
- [ ] `headerBackTitleVisible` removed -- use `headerBackButtonDisplayMode: "minimal"`
- [ ] `animationEnabled: false` removed -- use `animation: "none"`
- [ ] `unmountOnBlur` removed from tabs/drawer -- use `popToTopOnBlur: true`
- [ ] Custom theme requires `fonts` property -- spread `DefaultTheme`
- [ ] `<Link to="/path">` changed to `<Link screen="Name" params={...}>`
- [ ] `independent` prop removed -- wrap in `<NavigationIndependentTree>`
- [ ] `sceneContainerStyle` removed -- use `sceneStyle` in `screenOptions`
- [ ] Material Bottom Tabs moved to `react-native-paper/react-navigation`
- [ ] Flipper plugin removed -- use `useLogger` hook or DevTools extension
- [ ] `react-native-screens` v4 required for native stack
- [ ] Drawer requires Reanimated 2 or 3

### New Features Available

- [ ] Static API for simpler TypeScript and auto deep linking
- [ ] `preload()` for background screen rendering
- [ ] `usePreventRemove()` for unsaved changes guards
- [ ] `layout` prop on navigators, screens, and groups
- [ ] `headerSearchBarOptions` on all header-supporting navigators
- [ ] Bottom Tab `tabBarPosition: "left"` or `"right"` for sidebar layout
- [ ] Bottom Tab `animation` for tab transition animations
- [ ] `popTo()` for explicit back navigation
- [ ] Form sheet presentation with detents

### Temporary Migration Helpers

- `navigateDeprecated()` -- maintains v6 navigate() behavior
- `navigationInChildEnabled` prop -- maintains implicit nested navigation
- Remove these once migration is complete

---

## Essential Imports

```typescript
// Core
import {
  NavigationContainer,
  createStaticNavigation,
  useNavigation,
  useRoute,
  useFocusEffect,
  usePreventRemove,
  useIsFocused,
  NavigationIndependentTree,
} from "@react-navigation/native";

import type {
  StaticParamList,
  StaticScreenProps,
  NavigatorScreenParams,
  CompositeScreenProps,
  CompositeNavigationProp,
  LinkingOptions,
  NavigationState,
  Theme,
} from "@react-navigation/native";

// Native Stack
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";

// Bottom Tabs
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type {
  BottomTabNavigationProp,
  BottomTabScreenProps,
} from "@react-navigation/bottom-tabs";

// Drawer
import { createDrawerNavigator } from "@react-navigation/drawer";
import type {
  DrawerNavigationProp,
  DrawerScreenProps,
} from "@react-navigation/drawer";
```
