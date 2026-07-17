# NativeWind Quick Reference

> Decision frameworks, API cheat sheet, and migration notes. See [SKILL.md](SKILL.md) for red flags and anti-patterns.

---

## Decision Framework

### When to Use NativeWind

```
Need Tailwind CSS utility classes in React Native?
├─ YES → NativeWind
└─ NO → StyleSheet.create (zero overhead)

Need zero runtime overhead?
├─ YES → StyleSheet.create (0ms)
├─ Acceptable ~2ms → NativeWind (compiled)
└─ Runtime parsing OK → twrnc (~8-15ms, pure runtime)

Need web + native from same codebase?
├─ YES → NativeWind (CSS on web, StyleSheet on native)
└─ NO → Either NativeWind or StyleSheet.create
```

### Styling Third-Party Components

```
Does the component accept a className prop already?
├─ YES → Use it directly (no setup needed)
└─ NO → Does it have multiple style props (style, contentContainerStyle)?
    ├─ YES → remapProps (lightweight, maps className to style props)
    └─ NO → Does a style attribute need to become a prop?
        ├─ YES → cssInterop (extracts style attributes to props)
        │   Example: TextInput placeholderTextColor from className
        └─ NO → remapProps with simple mapping
```

### Dark Mode Strategy

```
Follow system preference?
├─ YES → Use dark: prefix classes (automatic)
│   └─ Expo: Ensure userInterfaceStyle: "automatic" in app.json
└─ Need manual toggle?
    ├─ Import useColorScheme from "nativewind"
    ├─ Call toggleColorScheme() or setColorScheme("dark"|"light"|"system")
    └─ Persist choice to AsyncStorage
```

### Theming Strategy

```
Static theme (compile-time)?
├─ YES → Customize tailwind.config.js theme.extend
└─ NO → Need runtime theme switching?
    ├─ YES → vars() with CSS variables
    │   ├─ Define theme objects: vars({ "--color-primary": "#3b82f6" })
    │   ├─ Apply to ancestor: <View style={brandTheme}>
    │   ├─ Reference in children: className="text-[--color-primary]"
    │   └─ Read in JS: useUnstableNativeVariable("--color-primary")
    └─ Need multiple brand themes?
        └─ Combine vars() + useColorScheme for brand + light/dark matrix
```

---

## API Cheat Sheet

### Core APIs

| API                           | Import             | Purpose                                                |
| ----------------------------- | ------------------ | ------------------------------------------------------ |
| `useColorScheme()`            | `nativewind`       | Read/set color scheme (light/dark/system)              |
| `vars()`                      | `nativewind`       | Set CSS variables as style object                      |
| `useUnstableNativeVariable()` | `nativewind`       | Read resolved CSS variable value in JS                 |
| `cssInterop()`                | `nativewind`       | Tag third-party component for full style interop       |
| `remapProps()`                | `nativewind`       | Map className props to style props (lightweight)       |
| `colorScheme`                 | `nativewind`       | Module-level color scheme control (outside components) |
| `withNativeWind()`            | `nativewind/metro` | Metro config wrapper                                   |

### useColorScheme Return Values

```typescript
const {
  colorScheme, // "light" | "dark"
  setColorScheme, // (scheme: "light" | "dark" | "system") => void
  toggleColorScheme, // () => void -- switches between light and dark
} = useColorScheme();
```

### Platform Prefixes

| Prefix     | Target                   |
| ---------- | ------------------------ |
| `ios:`     | iOS only                 |
| `android:` | Android only             |
| `web:`     | Web only                 |
| `windows:` | Windows only             |
| `osx:`     | macOS only               |
| `native:`  | All platforms except web |

### State Prefixes

| Prefix    | Behavior                                |
| --------- | --------------------------------------- |
| `dark:`   | Dark color scheme active                |
| `active:` | Component being pressed                 |
| `hover:`  | Pointer hovering (web, pointer devices) |
| `focus:`  | Component focused                       |

---

## Configuration Reference

### tailwind.config.js

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.tsx",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./screens/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // Custom values here
    },
  },
  plugins: [],
};
```

### Peer Dependencies (v4)

```
nativewind
tailwindcss ^3.4.17
react-native-reanimated
react-native-safe-area-context
```

### TypeScript Declaration

```typescript
// nativewind-env.d.ts (do NOT name it nativewind.d.ts)
/// <reference types="nativewind/types" />
```

---

## Migration Notes

### From v2 to v4

Key breaking changes:

| v2                                         | v4                                       |
| ------------------------------------------ | ---------------------------------------- |
| `styled()` wrapper                         | Removed -- className works directly      |
| Babel plugin approach                      | JSX import source transform              |
| `NativeWindStyleSheet`                     | Renamed to `StyleSheet`                  |
| `gap-` polyfill                            | Compiles to native `columnGap`/`rowGap`  |
| rem = 16 everywhere                        | rem = 14 on native, 16 on web            |
| `divide-` / `space-`                       | Temporarily unavailable                  |
| className not accessible inside components | className accessible (enables clsx, cva) |

### From v4 to v5 (Preview)

When NativeWind v5 stabilizes:

| v4                              | v5                                        |
| ------------------------------- | ----------------------------------------- |
| `cssInterop()` / `remapProps()` | Unified `styled()` API                    |
| `vars()` for theming            | `VariableContextProvider` component       |
| Custom JSX transform            | Import rewrite system                     |
| Tailwind CSS v3.4 config        | Tailwind CSS v4.1+ with new import syntax |
| Requires RN 0.73+               | Requires RN 0.81+                         |
| `platformSelect()` JS function  | CSS media queries                         |

### From StyleSheet.create to NativeWind

```tsx
// Before: StyleSheet.create
const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  title: { fontSize: 18, fontWeight: "bold", color: "#111" },
});

<View style={styles.container}>
  <Text style={styles.title}>Hello</Text>
</View>

// After: NativeWind className
<View className="flex-1 bg-white p-4">
  <Text className="text-lg font-bold text-gray-900">Hello</Text>
</View>
```
