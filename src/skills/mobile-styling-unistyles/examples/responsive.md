# Unistyles Responsive Patterns

> Related: [core.md](core.md) for StyleSheet basics, [theming.md](theming.md) for theme setup

---

## Pattern 1: Breakpoint Object Syntax

Convert any style property to a breakpoint object. Values cascade upward -- `xs` applies until a larger breakpoint overrides it.

```typescript
import { StyleSheet } from "react-native-unistyles";

const styles = StyleSheet.create((theme) => ({
  container: {
    padding: {
      xs: theme.spacing.sm, // 0px and up
      md: theme.spacing.md, // 768px and up
      xl: theme.spacing.xl, // 1200px and up
    },
    flexDirection: {
      xs: "column" as const,
      md: "row" as const,
    },
  },
  sidebar: {
    width: {
      xs: "100%" as const,
      md: 280,
      lg: 320,
    },
  },
}));
```

**Why good:** values cascade like CSS media queries -- `xs` stays active until `md` overrides it. No need to repeat values at every breakpoint.

### Breakpoints with Nested Objects

Breakpoint objects work with complex style properties like `transform` and `shadowOffset`:

```typescript
const styles = StyleSheet.create(() => ({
  card: {
    transform: {
      xs: [{ scale: 0.9 }],
      md: [{ scale: 1.0 }],
    },
    shadowOffset: {
      xs: { width: 0, height: 1 },
      md: { width: 0, height: 4 },
    },
  },
}));
```

---

## Pattern 2: Media Queries (mq)

For precise pixel ranges that don't align with named breakpoints, use the `mq` utility. Media queries always have higher priority than breakpoints.

```typescript
import { StyleSheet, mq } from "react-native-unistyles";

const styles = StyleSheet.create((theme) => ({
  sidebar: {
    display: {
      // Hidden on small screens, visible on 768px+
      [mq.only.width(0, 768)]: "none" as const,
      [mq.only.width(768)]: "flex" as const,
    },
  },
  grid: {
    flexDirection: {
      // Column layout below 500px width, row above
      [mq.only.width(0, 500)]: "column" as const,
      [mq.only.width(500)]: "row" as const,
    },
  },
}));
```

### mq Syntax Reference

```typescript
// Width-only ranges
mq.only.width(0, 500); // 0px to 499px
mq.only.width(500); // 500px and up
mq.only.width(null, 800); // 0px to 799px
mq.only.width("sm", "md"); // sm breakpoint to md breakpoint

// Height-only ranges
mq.only.height(300, 600); // 300px to 599px height
mq.only.height(600); // 600px height and up

// Combined width AND height
mq.width(240, 380).and.height(300); // width 240-379 AND height 300+
mq.height(500).and.width("sm"); // height 500+ AND width from sm breakpoint
```

**Gotcha:** Invalid ranges like `mq.only.width(500, 200)` or `mq.only.width("xl", "sm")` are silently ignored.

---

## Pattern 3: Display and Hide Components

Conditionally render entire components based on breakpoints or media queries. These are simple if/else wrappers -- no extra view layers added.

```typescript
import { Display, Hide, mq } from "react-native-unistyles";

function ResponsiveLayout() {
  return (
    <View style={styles.container}>
      {/* Show sidebar only on md and up */}
      <Display mq={mq.only.width("md")}>
        <Sidebar />
      </Display>

      {/* Hide desktop header on small screens */}
      <Hide mq={mq.only.width(0, 768)}>
        <DesktopHeader />
      </Hide>

      {/* Show mobile nav only on small screens */}
      <Display mq={mq.only.width(0, 768)}>
        <MobileNav />
      </Display>

      <MainContent />
    </View>
  );
}
```

**Why good:** no conditional logic in component code, no wasted renders -- Display/Hide evaluate at the C++ level

---

## Pattern 4: Built-in Orientation Breakpoints

Even without custom breakpoints, Unistyles provides `portrait` and `landscape` breakpoints that resolve to the device's width in each orientation.

```typescript
const styles = StyleSheet.create((theme) => ({
  header: {
    height: {
      portrait: 120,
      landscape: 64,
    },
    flexDirection: {
      portrait: "column" as const,
      landscape: "row" as const,
    },
  },
}));
```

---

## Pattern 5: Runtime Values for Responsive Layouts

Use the miniRuntime (`rt`) for device-specific values that update automatically.

### Safe Area Insets

```typescript
const styles = StyleSheet.create((theme, rt) => ({
  screen: {
    flex: 1,
    paddingTop: rt.insets.top,
    paddingBottom: rt.insets.bottom,
    paddingLeft: rt.insets.left,
    paddingRight: rt.insets.right,
  },
}));
```

### Keyboard-Aware Padding

```typescript
const styles = StyleSheet.create((theme, rt) => ({
  input: {
    // rt.insets.ime = keyboard height (input method editor)
    // rt.insets.bottom = static safe area bottom
    paddingBottom: rt.insets.ime > 0 ? rt.insets.ime : rt.insets.bottom,
  },
}));
```

**Gotcha:** `rt.insets.bottom` is the static safe area inset (home indicator). It does NOT change when the keyboard appears. Use `rt.insets.ime` for keyboard-responsive padding.

### Font Scale Aware Styles

```typescript
const BASE_FONT_SIZE = 16;
const MAX_FONT_SIZE = 24;

const styles = StyleSheet.create((_theme, rt) => ({
  body: {
    fontSize: Math.min(rt.fontScale * BASE_FONT_SIZE, MAX_FONT_SIZE),
  },
}));
```

### Screen Dimension Dependent Styles

```typescript
const IMAGE_ASPECT_RATIO = 0.5625; // 16:9 inverted
const COLUMN_COUNT = 2;
const COLUMN_GAP = 16;

const styles = StyleSheet.create((_theme, rt) => ({
  heroImage: {
    width: rt.screen.width,
    height: rt.screen.width * IMAGE_ASPECT_RATIO,
  },
  gridItem: {
    width: (rt.screen.width - COLUMN_GAP * (COLUMN_COUNT + 1)) / COLUMN_COUNT,
  },
}));
```

---

## Pattern 6: Mixing Breakpoints and Media Queries

Breakpoints and mq can coexist on the same style. Media queries always take priority when both match.

```typescript
const styles = StyleSheet.create((theme) => ({
  container: {
    padding: {
      xs: 8,
      md: 16,
      // mq overrides breakpoint when its range matches
      [mq.only.width(0, 320)]: 4,
    },
  },
}));
```

### Native vs Web Breakpoint Behavior

- **Native (iOS/Android):** Breakpoints are calculated based on screen pixels (default) or points (`nativeBreakpointsMode: "points"`)
- **Web:** Breakpoints automatically generate CSS `@media` queries -- no JavaScript recalculation on resize

```typescript
// To use screen points instead of pixels on native:
StyleSheet.configure({
  breakpoints,
  settings: {
    nativeBreakpointsMode: "points",
  },
});
```
