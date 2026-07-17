---
name: mobile-ui-components-react-native-paper
description: React Native Paper v5+ - Material Design 3 theming, PaperProvider, key components, dynamic color, accessibility, tree-shaking, custom fonts, navigation integration
---

# React Native Paper Patterns

> **Quick Guide:** React Native Paper v5+ provides Material Design 3 (Material You) components for React Native. Wrap your app in `PaperProvider` (MD3 is the default). Use `useTheme()` to access colors/fonts. Wrap Dialogs in `Portal`. Use the babel plugin for production bundle optimization. For BottomNavigation with React Navigation, use `BottomNavigation.Bar` as a custom `tabBar` (the old `createMaterialBottomTabNavigator` is deprecated). On Android 12+, use `expo-material3-theme` for system dynamic colors.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST wrap your app root in `PaperProvider` - all Paper components require the provider context to function)**

**(You MUST wrap Dialog, Menu, and similar overlay components in `Portal` - without it they render inline instead of above other content)**

**(You MUST use `useTheme()` to access theme colors and fonts in components - never hardcode Material Design color values)**

**(You MUST add `react-native-paper/babel` to production plugins for bundle optimization - without it the entire library is included)**

</critical_requirements>

---

**Auto-detection:** React Native Paper, react-native-paper, PaperProvider, MD3LightTheme, MD3DarkTheme, useTheme, Portal, FAB, Appbar, BottomNavigation, SegmentedButtons, configureFonts, adaptNavigationTheme, Card, Dialog, Snackbar, TextInput, Button mode, Surface, Chip, Searchbar, ActivityIndicator, Banner, Divider, ProgressBar, Switch, RadioButton, Checkbox, DataTable, Tooltip, Badge, Menu, Drawer.Item

**When to use:**

- Setting up PaperProvider with custom MD3 themes (light, dark, dynamic color)
- Using Paper components (Button, Card, TextInput, FAB, Appbar, Dialog, Snackbar, SegmentedButtons)
- Integrating Paper's BottomNavigation.Bar with React Navigation bottom tabs
- Configuring custom fonts with `configureFonts` for MD3 typography
- Implementing Android 12+ dynamic color theming
- Bridging Paper and React Navigation themes with `adaptNavigationTheme`

**Key patterns covered:**

- PaperProvider setup and MD3 theming (light, dark, custom, dynamic color)
- Component usage: Button modes, Card variants, TextInput modes, FAB sizes/variants, Dialog with Portal
- BottomNavigation.Bar integration with React Navigation v7 bottom tabs
- Custom fonts with `configureFonts` and TypeScript custom text variants
- Bundle optimization with `react-native-paper/babel` plugin
- Accessibility patterns (built-in a11y props, screen reader support)

**When NOT to use:**

- General React Native component architecture (not Paper-specific)
- Navigation patterns beyond BottomNavigation integration (not Paper-specific)
- Custom animations or gestures (not a UI component library concern)

**Detailed Resources:**

- [examples/core.md](examples/core.md) - PaperProvider setup, theming, custom fonts, babel plugin, dynamic color
- [examples/components.md](examples/components.md) - Button, Card, TextInput, FAB, Appbar, Dialog, Snackbar, SegmentedButtons
- [examples/navigation-integration.md](examples/navigation-integration.md) - BottomNavigation.Bar with React Navigation, adaptNavigationTheme, Drawer integration
- [reference.md](reference.md) - Component decision framework, theme color roles, MD3 typography scale

---

<philosophy>

## Philosophy

React Native Paper is a **Material Design 3 component library** for React Native. It provides pre-built, accessible, and themeable components that follow the Material You design system. The library is maintained by Callstack and is one of the most mature UI libraries in the React Native ecosystem.

**Core principles:**

1. **Theme-driven styling** - All components read colors, fonts, and roundness from the theme. Override the theme, not individual component styles, for consistent branding.
2. **MD3 by default** - v5+ applies Material Design 3 automatically. MD2 is still supported via `{ version: 2 }` but is legacy.
3. **Portal for overlays** - Dialog, Menu, and similar overlay components must be wrapped in `Portal` to render above other content.
4. **Accessibility built-in** - Components include proper `accessibilityRole`, `accessibilityState`, and screen reader support out of the box. Don't override these without reason.
5. **Bundle optimization required** - Add the babel plugin in production to exclude unused components from the bundle.

**Mental model:** Paper provides the Material Design visual layer. Your app's component architecture, state management, and navigation structure are separate concerns handled by their respective skills.

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: PaperProvider and Theming

Wrap your app root in `PaperProvider`. MD3 is applied by default. Extend `MD3LightTheme` or `MD3DarkTheme` for custom branding. Use `useTheme()` to access theme values in components.

```typescript
import {
  MD3LightTheme,
  MD3DarkTheme,
  PaperProvider,
  useTheme,
} from "react-native-paper";
import { useColorScheme } from "react-native";

const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: "#6750A4",
    secondary: "#625B71",
  },
};

const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: "#D0BCFF",
    secondary: "#CCC2DC",
  },
};

// In your root component:
const colorScheme = useColorScheme();
const theme = colorScheme === "dark" ? darkTheme : lightTheme;
// <PaperProvider theme={theme}>...</PaperProvider>
```

**Why good:** Extends default themes (preserves all MD3 color roles), dynamically switches on system preference, all Paper components pick up the overrides

For typed custom themes, dynamic color with `expo-material3-theme`, and `configureFonts`, see [examples/core.md](examples/core.md).

---

### Pattern 2: Portal for Overlay Components

Dialog, Menu, and overlay components must be wrapped in `Portal` to render above all other content. `Portal` teleports children to the nearest `Portal.Host` (which `PaperProvider` includes by default).

```typescript
import { Portal, Dialog, Button, Text } from "react-native-paper";

// Inside a component:
<Portal>
  <Dialog visible={visible} onDismiss={hideDialog}>
    <Dialog.Title>Confirm</Dialog.Title>
    <Dialog.Content>
      <Text variant="bodyMedium">Are you sure?</Text>
    </Dialog.Content>
    <Dialog.Actions>
      <Button onPress={hideDialog}>Cancel</Button>
      <Button onPress={handleConfirm}>OK</Button>
    </Dialog.Actions>
  </Dialog>
</Portal>
```

**Why good:** Portal ensures the dialog renders above all screen content including headers and tabs. Without Portal, the dialog renders inline in the component tree and may be clipped or hidden behind other elements.

---

### Pattern 3: Button Modes

Paper's Button supports five modes with increasing visual emphasis: `text`, `outlined`, `contained`, `elevated`, and `contained-tonal`.

```typescript
import { Button } from "react-native-paper";

<Button mode="text" onPress={onCancel}>Cancel</Button>
<Button mode="outlined" onPress={onEdit}>Edit</Button>
<Button mode="contained-tonal" onPress={onSave}>Save Draft</Button>
<Button mode="contained" onPress={onSubmit}>Submit</Button>
<Button mode="elevated" onPress={onAction}>Elevated</Button>

// With icon and loading state:
<Button mode="contained" icon="camera" loading={isUploading} onPress={onUpload}>
  Upload Photo
</Button>
```

**Why good:** Modes map directly to MD3 emphasis levels (low to high: text < outlined < contained-tonal < contained). Use the right mode for the action's importance.

See [examples/components.md](examples/components.md) for all component patterns.

---

### Pattern 4: TextInput with Validation

TextInput supports `flat` and `outlined` modes, error state, and adornments (icons/affixes) via `TextInput.Icon` and `TextInput.Affix`.

```typescript
import { TextInput } from "react-native-paper";

<TextInput
  mode="outlined"
  label="Email"
  value={email}
  onChangeText={setEmail}
  error={!!emailError}
  keyboardType="email-address"
  autoCapitalize="none"
  left={<TextInput.Icon icon="email" />}
/>
```

**Why good:** `error` prop automatically applies MD3 error color to outline and label. Adornments via `TextInput.Icon` and `TextInput.Affix` are positioned correctly by the component.

---

### Pattern 5: BottomNavigation.Bar with React Navigation

The old `createMaterialBottomTabNavigator` is deprecated since v5.14. Use `@react-navigation/bottom-tabs` with `BottomNavigation.Bar` as a custom `tabBar` renderer instead.

```typescript
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { BottomNavigation } from "react-native-paper";

const Tab = createBottomTabNavigator();

// Pass BottomNavigation.Bar as the tabBar prop:
<Tab.Navigator
  tabBar={({ navigation, state, descriptors, insets }) => (
    <BottomNavigation.Bar
      navigationState={state}
      safeAreaInsets={insets}
      onTabPress={({ route, preventDefault }) => { /* emit tabPress, navigate */ }}
      renderIcon={({ route, focused, color }) => { /* render tabBarIcon */ }}
      getLabelText={({ route }) => { /* return label */ }}
    />
  )}
>
```

**Why good:** Uses React Navigation's latest bottom-tabs API with Paper's MD3-styled bar. Handles tab press events correctly (with `canPreventDefault` for listeners). Deprecated `createMaterialBottomTabNavigator` is no longer maintained.

See [examples/navigation-integration.md](examples/navigation-integration.md) for full implementation including `adaptNavigationTheme` and drawer integration.

---

### Pattern 6: Bundle Optimization with Babel Plugin

Add `react-native-paper/babel` to `env.production.plugins` in `babel.config.js`. Without it, importing `{ Button }` from `react-native-paper` includes the entire library. The plugin rewrites imports to per-component paths, reducing bundle size significantly.

**Important:** Only works with ES2015 `import` syntax, not `require()`.

See [examples/core.md](examples/core.md) for the babel config snippet.

</patterns>

---

<decision_framework>

## Decision Framework

### Component Selection

```
What type of action does the user perform?
├─ Primary action on screen → FAB (icon="plus" or extended with label)
├─ High-emphasis button → Button mode="contained"
├─ Medium-emphasis button → Button mode="outlined" or "contained-tonal"
├─ Low-emphasis button → Button mode="text"
└─ Segmented choice → SegmentedButtons

What type of content container?
├─ Tappable entry point → Card mode="elevated" with onPress
├─ Informational group → Card mode="outlined" (non-interactive)
├─ Elevated surface → Surface elevation={2}
└─ Dismissable message → Snackbar (with optional action)

What type of text input?
├─ Dense form (many fields) → TextInput mode="flat"
├─ Prominent input (few fields) → TextInput mode="outlined"
└─ Search → Searchbar component

What type of navigation bar?
├─ Top of screen → Appbar.Header with Appbar.Content + Appbar.Action
├─ Bottom tabs (with React Navigation) → BottomNavigation.Bar as tabBar
└─ Screen header with back → Appbar.Header with Appbar.BackAction
```

### Theming Decision

```
Do you need custom brand colors?
├─ YES → Extend MD3LightTheme/MD3DarkTheme with your colors
└─ NO → Use default PaperProvider (MD3 applied automatically)

Do you need Android 12+ system colors?
├─ YES → Use expo-material3-theme's useMaterial3Theme hook
└─ NO → Use your static custom theme

Do you need custom fonts?
├─ YES → Use configureFonts({ config: fontConfig })
│   └─ Need custom text variants? → Use customText<'myVariant'>()
└─ NO → Default MD3 typography (Roboto/System/sans-serif) is applied

Do you need to bridge Paper + React Navigation themes?
├─ YES → Use adaptNavigationTheme() to unify color schemes
└─ NO → Configure each provider's theme independently
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- **Missing `PaperProvider` at app root** - All Paper components silently fall back to unstyled defaults without the provider. Symptoms: wrong colors, missing ripples, broken Dialogs.
- **Dialog without `Portal` wrapper** - Dialog renders inline in the component tree and gets clipped by parent containers or hidden behind navigation headers.
- **Hardcoding MD3 color values** - Use `theme.colors.primary`, `theme.colors.surface`, etc. via `useTheme()`. Hardcoded hex values break when the theme changes (dark mode, dynamic color, brand update).
- **Missing babel plugin in production** - Without `react-native-paper/babel`, the entire library is bundled regardless of which components you import.
- **Using deprecated `createMaterialBottomTabNavigator`** - Deprecated since v5.14. Use `@react-navigation/bottom-tabs` with `BottomNavigation.Bar` as custom `tabBar` instead.

**Medium Priority Issues:**

- Using `require()` instead of ES2015 `import` for Paper components - the babel plugin only optimizes `import` statements
- Not providing `onDismiss` callback on Dialog - users cannot close the dialog with back button or outside tap
- Overriding component `accessibilityRole` without reason - Paper components have correct roles by default
- Using `mode="contained"` for all buttons - use appropriate emphasis levels (text, outlined, contained-tonal, contained)
- Not switching theme based on system color scheme - leads to always-light or always-dark UI regardless of user preference

**Gotchas & Edge Cases:**

- `useTheme()` returns the default theme if called outside `PaperProvider` - no error thrown, just wrong colors
- TextInput label floats over outline in some edge cases (known issue) - apply `outlineStyle` padding workaround
- `Snackbar` renders at bottom of its parent by default - wrap in `Portal` to display as a true overlay above tab bars
- `Dialog` does not support scrollable content by default - use `Dialog.ScrollArea` for long content instead of wrapping in ScrollView
- `Card.Cover` images have no default aspect ratio - set explicit height or use `resizeMode`
- Android `StatusBar` does not automatically adapt to Paper theme - manually set `StatusBar` `backgroundColor` / `barStyle`
- Variable fonts may not render correctly on all platforms - install each weight as a separate `.ttf` file
- `FAB.Group` visibility: set `visible={true}` explicitly - it defaults to `true` but can silently become `false` if parent re-renders with stale props
- MD2 mode (`version: 2`) and MD3 cannot coexist in the same provider - choose one per `PaperProvider`
- `react-native-safe-area-context` is a required peer dependency since v5 - install it even if not using SafeAreaView directly

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST wrap your app root in `PaperProvider` - all Paper components require the provider context to function)**

**(You MUST wrap Dialog, Menu, and similar overlay components in `Portal` - without it they render inline instead of above other content)**

**(You MUST use `useTheme()` to access theme colors and fonts in components - never hardcode Material Design color values)**

**(You MUST add `react-native-paper/babel` to production plugins for bundle optimization - without it the entire library is included)**

**Failure to follow these rules will cause unstyled components, invisible dialogs, broken dark mode, and bloated bundles.**

</critical_reminders>
