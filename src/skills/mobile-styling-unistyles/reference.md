# Unistyles Quick Reference

## API Cheat Sheet

### Imports

```typescript
import {
  StyleSheet, // StyleSheet.create, StyleSheet.configure
  UnistylesRuntime, // Imperative read/write access
  ScopedTheme, // Force theme on subtree
  Display, // Show children at breakpoint/mq
  Hide, // Hide children at breakpoint/mq
  mq, // Media query utility
  withUnistyles, // HOC for third-party components
  useUnistyles, // Hook (avoid -- causes re-renders)
} from "react-native-unistyles";

import type {
  UnistylesVariants, // Derive variant props from stylesheet
  UnistylesThemes, // Module augmentation target
  UnistylesBreakpoints, // Module augmentation target
} from "react-native-unistyles";
```

### StyleSheet Methods

| Method                                                    | Purpose                                              |
| --------------------------------------------------------- | ---------------------------------------------------- |
| `StyleSheet.create(styles)`                               | Static styles (no theme)                             |
| `StyleSheet.create((theme) => styles)`                    | Theme-dependent styles                               |
| `StyleSheet.create((theme, rt) => styles)`                | Theme + runtime-dependent styles                     |
| `StyleSheet.configure({ themes, breakpoints, settings })` | One-time setup                                       |
| `StyleSheet.hairlineWidth`                                | Thinnest drawable line                               |
| `StyleSheet.absoluteFillObject`                           | `{ position: 'absolute', left/top/right/bottom: 0 }` |
| `StyleSheet.compose(a, b)`                                | Compose two styles                                   |
| `StyleSheet.flatten(styles)`                              | Flatten nested styles                                |
| `StyleSheet.addChangeListener(cb)`                        | Subscribe to dependency changes (v3.1.0+)            |

### UnistylesRuntime Properties

| Property                     | Type                                   | Reactive? |
| ---------------------------- | -------------------------------------- | --------- |
| `themeName`                  | `string?`                              | No\*      |
| `breakpoint`                 | `string?`                              | No\*      |
| `screen`                     | `{ width, height }`                    | No\*      |
| `isPortrait` / `isLandscape` | boolean                                | No\*      |
| `colorScheme`                | `"light"` / `"dark"` / `"unspecified"` | No\*      |
| `insets`                     | `{ top, bottom, left, right, ime }`    | No\*      |
| `statusBar`                  | `{ width, height }`                    | No\*      |
| `navigationBar`              | `{ width, height }`                    | No\*      |
| `pixelRatio`                 | number                                 | No\*      |
| `fontScale`                  | number                                 | No\*      |
| `rtl`                        | boolean                                | No\*      |
| `hasAdaptiveThemes`          | boolean                                | No\*      |
| `contentSizeCategory`        | string                                 | No\*      |
| `breakpoints`                | object                                 | No\*      |
| `getTheme(name?)`            | Theme object                           | No\*      |

\*Non-reactive outside StyleSheet callbacks. Use `useUnistyles()` or `withUnistyles` for reactive access in components.

### UnistylesRuntime Methods

| Method                              | Purpose                 |
| ----------------------------------- | ----------------------- |
| `setTheme(name)`                    | Switch active theme     |
| `setAdaptiveThemes(bool)`           | Toggle adaptive theming |
| `updateTheme(name, updater)`        | Modify theme at runtime |
| `statusBar.setHidden(bool)`         | Show/hide status bar    |
| `navigationBar.setHidden(bool)`     | Show/hide nav bar       |
| `setImmersiveMode(bool)`            | Hide both bars          |
| `setRootViewBackgroundColor(color)` | Set root background     |

---

## Decision Framework

### When to Use Which API

```
Do you need theme colors in styles?
|-- NO -> StyleSheet.create({ ... }) -- static, no callback
+-- YES -> StyleSheet.create((theme) => ...)
    |
    Do you also need device values (insets, screen, fontScale)?
    +-- YES -> StyleSheet.create((theme, rt) => ...)

Do styles depend on component props/state?
|-- YES -> Dynamic function: style: (arg) => ({ ... })
+-- NO -> Static or theme-only style is enough

Need different visual modes (size, color, state)?
|-- YES -> Use variants: { ... } inside the style
+-- NO -> Regular style properties

Need to conditionally show/hide entire components by screen size?
|-- YES -> <Display mq={...}> / <Hide mq={...}>
+-- NO -> Use breakpoint objects on style properties
```

---

## v2 to v3 Migration Checklist

### Configuration

| v2                                   | v3                                           |
| ------------------------------------ | -------------------------------------------- |
| `UnistylesRegistry.addConfig()`      | `StyleSheet.configure()`                     |
| `UnistylesRegistry.addThemes()`      | `StyleSheet.configure({ themes: ... })`      |
| `UnistylesRegistry.addBreakpoints()` | `StyleSheet.configure({ breakpoints: ... })` |
| `useInitialTheme(...)`               | `settings: { initialTheme: "..." }`          |
| `UnistylesProvider`                  | Remove -- not needed in v3                   |

### StyleSheet

| v2                                        | v3                                     |
| ----------------------------------------- | -------------------------------------- |
| `createStyleSheet(...)`                   | `StyleSheet.create(...)`               |
| `useStyles(stylesheet)`                   | Use styles directly -- no hook needed  |
| `useStyles(stylesheet, { variant: "x" })` | `styles.useVariants({ variant: "x" })` |
| `UnistylesRuntime.hairlineWidth`          | `StyleSheet.hairlineWidth`             |

### Hooks and Components

| v2                                          | v3                                                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `useStyles()` for theme access              | `StyleSheet.create((theme) => ...)` in styles, or `withUnistyles` / `useUnistyles` in components |
| Breakpoint conditionals in JS               | `<Display mq={...}>` / `<Hide mq={...}>`                                                         |
| `UnistylesRuntime.statusBar.setColor()`     | Removed (Android 15 deprecation)                                                                 |
| `UnistylesRuntime.navigationBar.setColor()` | Removed (Android 15 deprecation)                                                                 |
| `addPlugin()` / `removePlugin()`            | Removed (plugins eliminated)                                                                     |

### Style Syntax

| v2                                 | v3                                          |
| ---------------------------------- | ------------------------------------------- |
| `{ ...styles.a, ...styles.b }`     | `[styles.a, styles.b]` (array syntax)       |
| Color methods with alpha parameter | Color methods accept single color parameter |

### Removed Settings

- `plugins` -- eliminated entirely
- `experimentalCSSMediaQueries` -- now always enabled
- `windowResizeDebounceTimeMs` -- no debouncing
- `disableAnimatedInsets` -- insets no longer re-render

### Insets

| v2                               | v3                                                                  |
| -------------------------------- | ------------------------------------------------------------------- |
| `insets.bottom` (keyboard-aware) | `insets.ime` for keyboard, `insets.bottom` is static safe area only |

---

## Requirements

| Requirement     | Minimum                                      |
| --------------- | -------------------------------------------- |
| React Native    | 0.78.0+                                      |
| Architecture    | New Architecture (Fabric) required           |
| Expo SDK        | 53+ (if using Expo)                          |
| Xcode           | 16+ recommended                              |
| Peer dependency | `react-native-nitro-modules` (fixed version) |

### Babel Plugin

```javascript
// babel.config.js
plugins: [["react-native-unistyles/plugin", { root: "src" }]];
```

| Option               | Purpose                                                |
| -------------------- | ------------------------------------------------------ |
| `root` (required)    | Folder containing components to process                |
| `autoProcessImports` | Process files with specific imports (monorepo support) |
| `autoRemapImports`   | Remap uncommon imports to Unistyles components         |
| `autoProcessPaths`   | Extend processing to node_modules packages             |
| `debug`              | Log detected dependencies to console                   |

### TypeScript Module Augmentation

```typescript
type AppThemes = { light: typeof lightTheme; dark: typeof darkTheme };
type AppBreakpoints = typeof breakpoints;

declare module "react-native-unistyles" {
  export interface UnistylesThemes extends AppThemes {}
  export interface UnistylesBreakpoints extends AppBreakpoints {}
}
```
