---
name: mobile-animation-reanimated
description: React Native Reanimated 4 - shared values, animated styles, spring/timing/decay, layout animations, gesture integration, scroll-driven animations, interpolation, worklets, CSS animations
---

# React Native Reanimated Patterns

> **Quick Guide:** Reanimated 4 is New Architecture only (requires `react-native-worklets` as a separate dependency). Use `useSharedValue` + `useAnimatedStyle` for all animations. Animations run on the UI thread via worklets -- never block the JS thread. Use `withSpring` (physics-based) or `withTiming` (duration-based) for transitions, layout animations (`entering`/`exiting`) for mount/unmount, and `useScrollOffset` (renamed from `useScrollViewOffset`) for scroll-driven animations. Reanimated 4 also introduces CSS animations/transitions as a declarative alternative to the worklet API.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use Animated components (`Animated.View`, `Animated.Text`, etc.) for any animated styles -- passing animated styles to regular components causes errors)**

**(You MUST keep static styles in `StyleSheet.create` and only animate dynamic properties in `useAnimatedStyle` -- animating static values wastes UI thread resources)**

**(You MUST NOT mutate shared values inside `useAnimatedStyle` callbacks -- read only, or you cause infinite loops)**

**(You MUST use `react-native-worklets` as a separate dependency in Reanimated 4 -- the worklet Babel plugin moved from `react-native-reanimated/plugin` to `react-native-worklets/plugin`)**

</critical_requirements>

---

**Auto-detection:** Reanimated, react-native-reanimated, useSharedValue, useAnimatedStyle, withSpring, withTiming, withDecay, Animated.View, Animated.Text, Animated.ScrollView, entering, exiting, FadeIn, FadeOut, SlideIn, interpolate, interpolateColor, useScrollOffset, GestureDetector, Gesture.Pan, worklet, layout animation, shared value, energyThreshold, CSS animation, react-native-worklets

**When to use:**

- Animating view properties (opacity, transforms, colors) on the UI thread
- Adding entering/exiting animations when components mount/unmount
- Building gesture-driven animations (drag, swipe, pinch)
- Creating scroll-driven header collapse, parallax, or sticky effects
- Interpolating values across ranges (position to opacity, scroll to scale)
- Implementing spring physics or timing-based transitions

**When NOT to use:**

- Simple boolean show/hide without animation (conditional rendering suffices)
- Static layouts that never change at runtime
- Animated.Value from React Native core (use Reanimated's shared values instead)

**Key patterns covered:**

- Shared values (`useSharedValue`) + animated styles (`useAnimatedStyle`)
- Animation functions: `withTiming`, `withSpring`, `withDecay`
- Layout animations: `entering`/`exiting` with predefined builders
- Gesture integration: `Gesture.Pan` + shared values + `withDecay`
- Scroll-driven animations with `useScrollOffset`
- Interpolation: `interpolate` and `interpolateColor`
- Worklet functions and the `'worklet'` directive
- CSS animations and transitions (Reanimated 4 declarative API)

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Shared values, animated styles, withTiming, withSpring, interpolation
- [examples/layout-animations.md](examples/layout-animations.md) - Entering/exiting animations, predefined builders, custom layout animations
- [examples/gestures.md](examples/gestures.md) - Pan gesture with shared values, swipe-to-dismiss, withDecay
- [examples/scroll-animations.md](examples/scroll-animations.md) - Collapsing header, parallax, scroll-driven opacity
- [reference.md](reference.md) - Decision frameworks, migration from 3.x, API quick reference

---

<philosophy>

## Philosophy

Reanimated runs animations on the **UI thread** via worklets, keeping the JS thread free for business logic. The core model: **shared values** are reactive state that bridges JS and UI threads, **animated styles** derive visual properties from shared values, and **animation functions** (`withSpring`, `withTiming`, `withDecay`) drive transitions between values.

**Reanimated 4 key changes from 3.x:**

- **New Architecture only** -- drops Legacy Architecture (bridge) support entirely
- **`react-native-worklets`** as a separate package -- Babel plugin moved from `react-native-reanimated/plugin` to `react-native-worklets/plugin`
- **CSS animations/transitions** -- declarative API for state-driven animations (use CSS for simple state transitions, worklets for gesture/scroll-driven)
- **`energyThreshold`** replaces `restDisplacementThreshold`/`restSpeedThreshold` in `withSpring`
- **`useScrollOffset`** replaces `useScrollViewOffset` (deprecated alias remains)
- **Threading functions moved** to `react-native-worklets`: `runOnJS` -> `scheduleOnRN`, `runOnUI` -> `scheduleOnUI`

**When to use CSS animations vs worklets:**

- **CSS animations/transitions** -- state-driven, declarative, less code, better optimizable by Reanimated
- **Worklets** -- gesture-driven, scroll-driven, complex orchestration, frame-by-frame control

**Backward compatibility:** All v2/v3 shared value and animation APIs work unchanged in v4. CSS animations and worklet-based animations work simultaneously and interchangeably.

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Shared Values and Animated Styles

The fundamental building blocks. `useSharedValue` creates reactive state on the UI thread. `useAnimatedStyle` derives styles that update when shared values change.

```typescript
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

const EXPANDED_HEIGHT = 200;
const COLLAPSED_HEIGHT = 60;
const ANIMATION_DURATION = 300;

function CollapsibleCard() {
  const height = useSharedValue(COLLAPSED_HEIGHT);

  const animatedStyle = useAnimatedStyle(() => ({
    height: height.value,
  }));

  const toggle = () => {
    height.value = withTiming(
      height.value === COLLAPSED_HEIGHT ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT,
      { duration: ANIMATION_DURATION }
    );
  };

  return (
    <Pressable onPress={toggle}>
      <Animated.View style={[styles.card, animatedStyle]}>
        <Text>Content</Text>
      </Animated.View>
    </Pressable>
  );
}
```

**Why good:** static styles stay in StyleSheet, only dynamic height in useAnimatedStyle, named constants for dimensions and durations, Animated.View receives the animated style

**Key rules:**

- Only animate dynamic properties in `useAnimatedStyle` -- static styles belong in `StyleSheet.create`
- Never mutate shared values inside `useAnimatedStyle` -- it is read-only
- Always apply animated styles to `Animated.*` components, not regular `View`/`Text`

See [examples/core.md](examples/core.md) for complete examples including React Compiler compatibility (`get()`/`set()`).

---

### Pattern 2: withSpring and withTiming

`withTiming` is duration-based (predictable timing). `withSpring` is physics-based (natural feel). Choose based on UX intent.

```typescript
// Physics-based spring (natural, bouncy)
sv.value = withSpring(TARGET, { damping: 100, stiffness: 800 });

// Duration-based spring (controlled timing with spring feel)
sv.value = withSpring(TARGET, { duration: 500, dampingRatio: 0.8 });

// Timing with easing
sv.value = withTiming(TARGET, {
  duration: ANIMATION_DURATION,
  easing: Easing.bezierFn(0.25, 0.1, 0.25, 1),
});
```

**Reanimated 4 spring change:** `restDisplacementThreshold` and `restSpeedThreshold` are removed. Replaced by `energyThreshold` (relative to animation, default `6e-9`). In most cases, removing the old thresholds is sufficient -- no need to set `energyThreshold` manually.

**Duration gotcha:** In v4, actual spring completion time = perceptual `duration` x 1.5. Divide existing duration values by 1.5 for equivalent behavior when migrating from v3.

See [examples/core.md](examples/core.md) for spring config comparison and withDecay.

---

### Pattern 3: Layout Animations (Entering/Exiting)

Predefined animations for component mount/unmount. Apply to `Animated.*` components via `entering` and `exiting` props.

```typescript
import Animated, { FadeIn, FadeOutLeft } from "react-native-reanimated";

const ANIMATION_DURATION = 400;
const ANIMATION_DELAY = 100;

function NotificationBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(ANIMATION_DURATION).delay(ANIMATION_DELAY)}
      exiting={FadeOutLeft.duration(ANIMATION_DURATION)}
      style={styles.banner}
    >
      <Text>New notification</Text>
    </Animated.View>
  );
}
```

**Available builders:** `FadeIn`, `SlideInRight`, `ZoomIn`, `BounceIn`, `FlipInEasyX`, `LightSpeedInRight`, `RotateIn`, `PinwheelIn`, and all directional variants (Up/Down/Left/Right) plus corresponding `Out` variants.

**Modifiers:** `.duration(ms)`, `.delay(ms)`, `.springify()` (with `.damping()`, `.stiffness()`, `.mass()`), `.withInitialValues()`, `.withCallback()`, `.reduceMotion()`.

**Performance tip:** Define animation builders outside components or in `useMemo` -- creating them inline in render causes unnecessary object allocation.

See [examples/layout-animations.md](examples/layout-animations.md) for custom builders, staggered lists, and `EntryExitTransition`.

---

### Pattern 4: Gesture Integration

Reanimated integrates with `react-native-gesture-handler`. Gesture callbacks are **automatically workletized** -- you can access shared values directly without the `'worklet'` directive.

```typescript
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDecay,
} from "react-native-reanimated";

function DraggableCard() {
  const offsetX = useSharedValue(0);

  const pan = Gesture.Pan()
    .onChange((e) => {
      offsetX.value += e.changeX;
    })
    .onFinalize((e) => {
      offsetX.value = withDecay({ velocity: e.velocityX, rubberBandEffect: true });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offsetX.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.card, animatedStyle]} />
    </GestureDetector>
  );
}
```

**Why good:** `onChange` gives delta values (not absolute), `onFinalize` adds momentum with `withDecay`, gesture callbacks access shared values directly on UI thread

**Key points:**

- Use `onChange` for incremental updates (delta), `onUpdate` for absolute position
- `GestureHandlerRootView` must wrap your app near the root
- This skill covers the Reanimated side of gesture animations -- for gesture configuration details (tap, pinch, fling, simultaneous gestures), see the gesture handler skill

See [examples/gestures.md](examples/gestures.md) for swipe-to-dismiss, bottom sheet, and combined gestures.

---

### Pattern 5: Scroll-Driven Animations

Use `useScrollOffset` to track scroll position as a shared value. Combine with `interpolate` for parallax, collapsing headers, and fade effects.

```typescript
import Animated, {
  useAnimatedRef,
  useScrollOffset,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";

const HEADER_MAX = 200;
const HEADER_MIN = 60;

function CollapsibleHeader() {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollOffset(scrollRef);

  const headerStyle = useAnimatedStyle(() => ({
    height: interpolate(
      scrollOffset.value,
      [0, HEADER_MAX - HEADER_MIN],
      [HEADER_MAX, HEADER_MIN],
      Extrapolation.CLAMP
    ),
  }));

  return (
    <>
      <Animated.View style={[styles.header, headerStyle]} />
      <Animated.ScrollView ref={scrollRef}>
        {/* content */}
      </Animated.ScrollView>
    </>
  );
}
```

**Why good:** `useScrollOffset` auto-detects horizontal/vertical, no manual scroll event handler needed, `Extrapolation.CLAMP` prevents values outside the range

**Reanimated 4 rename:** `useScrollViewOffset` -> `useScrollOffset` (deprecated alias remains temporarily).

See [examples/scroll-animations.md](examples/scroll-animations.md) for parallax, sticky elements, and scroll-to-hide tab bar.

---

### Pattern 6: Interpolation

Map one value range to another. `interpolate` for numbers, `interpolateColor` for color transitions.

```typescript
import {
  interpolate,
  interpolateColor,
  Extrapolation,
} from "react-native-reanimated";

// Number interpolation: scroll position -> opacity
const opacity = interpolate(
  scrollY.value,
  [0, 100], // input range
  [1, 0], // output range
  Extrapolation.CLAMP,
);

// Color interpolation: progress -> background
const backgroundColor = interpolateColor(
  progress.value,
  [0, 0.5, 1], // input range
  ["#FF0000", "#FFFF00", "#00FF00"], // output colors (red -> yellow -> green)
);
```

**Extrapolation options:** `CLAMP` (cap at edges), `EXTEND` (extrapolate linearly), `IDENTITY` (return input value). Can set left/right independently: `{ extrapolateLeft: Extrapolation.CLAMP, extrapolateRight: Extrapolation.EXTEND }`.

**`interpolateColor` modes:** `'RGB'` (default) or `'HSV'`. HSV produces more perceptually uniform transitions for hue changes.

See [examples/core.md](examples/core.md) for multi-step interpolation and color transition examples.

---

### Pattern 7: Worklet Functions

Functions that run on the UI thread. Mark with `'worklet'` directive. Reanimated auto-workletizes callbacks in `useAnimatedStyle`, gesture handlers, and animation callbacks -- you only need explicit `'worklet'` for standalone helper functions.

```typescript
import { scheduleOnRN } from "react-native-worklets";

function clampValue(value: number, min: number, max: number) {
  "worklet";
  return Math.min(Math.max(value, min), max);
}

// Use in useAnimatedStyle -- auto-workletized, no directive needed
const style = useAnimatedStyle(() => ({
  opacity: clampValue(progress.value, 0, 1),
}));
```

**Reanimated 4 threading changes:**

| Reanimated 3         | Reanimated 4 (react-native-worklets) |
| -------------------- | ------------------------------------ |
| `runOnJS(fn)("arg")` | `scheduleOnRN(fn, "arg")`            |
| `runOnUI(fn)("arg")` | `scheduleOnUI(fn, "arg")`            |

**When you need explicit `'worklet'`:**

- Standalone helper functions called from other worklets
- Functions passed to `scheduleOnUI`

**When you do NOT need it:**

- `useAnimatedStyle` callbacks (auto-workletized)
- Gesture handler callbacks (auto-workletized)
- Animation callbacks (auto-workletized)

---

### Pattern 8: CSS Animations and Transitions (Reanimated 4)

Declarative animation API modeled after web CSS. Best for state-driven animations. Worklet API remains for gesture/scroll-driven scenarios.

```typescript
import Animated from "react-native-reanimated";

const TRANSITION_DURATION = 300;

function ToggleBox({ expanded }: { expanded: boolean }) {
  return (
    <Animated.View
      style={{
        height: expanded ? 200 : 60,
        opacity: expanded ? 1 : 0.5,
        transitionProperty: "height, opacity",
        transitionDuration: `${TRANSITION_DURATION}ms`,
        transitionTimingFunction: "ease-in-out",
      }}
    />
  );
}
```

**CSS animation keyframes:**

```typescript
const PULSE_DURATION = 1000;

<Animated.View
  style={{
    animationName: {
      from: { transform: [{ scale: 1 }] },
      to: { transform: [{ scale: 1.1 }] },
    },
    animationDuration: `${PULSE_DURATION}ms`,
    animationIterationCount: "infinite",
    animationDirection: "alternate",
    animationTimingFunction: "ease-in-out",
  }}
/>
```

**When to use CSS vs worklets:**

- CSS -- state-driven toggles, hover effects, simple transitions (less code, better optimizable)
- Worklets -- gesture-driven, scroll-driven, frame-by-frame control, complex orchestration

</patterns>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Passing animated styles to regular `View`/`Text` instead of `Animated.View`/`Animated.Text` -- causes silent failure or crash
- Mutating shared values inside `useAnimatedStyle` -- causes infinite re-evaluation loops
- Using `react-native-reanimated/plugin` in Babel config with Reanimated 4 -- must use `react-native-worklets/plugin` (and it must be last in the plugins array)
- Using Reanimated 4.x with Legacy Architecture (old bridge) -- Reanimated 4 is New Architecture only
- Animating static properties in `useAnimatedStyle` instead of keeping them in `StyleSheet` -- wastes UI thread resources
- Using `restDisplacementThreshold`/`restSpeedThreshold` in `withSpring` -- removed in v4, replaced by `energyThreshold`

**Medium Priority Issues:**

- Creating layout animation builders inline in render -- allocates objects every render; define outside component or in `useMemo`
- Using `runOnJS`/`runOnUI` instead of `scheduleOnRN`/`scheduleOnUI` -- old API moved to `react-native-worklets`
- Missing `GestureHandlerRootView` at app root -- gestures silently fail without it
- Using `useAnimatedGestureHandler` -- removed in v4, migrate to Gesture Handler 2's `Gesture` API

**Gotchas and Edge Cases:**

- `withSpring` duration: actual completion time = perceptual `duration` x 1.5 -- divide v3 duration values by 1.5 when migrating
- `useScrollOffset` renamed from `useScrollViewOffset` -- deprecated alias still works temporarily
- Shared value `.value` access is synchronous on UI thread but asynchronous on JS thread -- don't rely on immediate reads after writes on JS thread
- `useWorkletCallback` removed -- replace with `useCallback` + `'worklet'` directive
- React Compiler compatibility: use `sv.get()` and `sv.set()` instead of direct `.value` access when using React Compiler
- `combineTransition` removed -- use `EntryExitTransition.entering(entering).exiting(exiting)`
- Object shared values: reassign the entire object, never mutate individual properties -- mutations break reactivity tracking
- Removing an animated style from a view does not unset the animated values -- explicitly set properties to `undefined` to reset
- On New Architecture, layout animations use `nativeID` internally -- don't overwrite it on animated components

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST use Animated components (`Animated.View`, `Animated.Text`, etc.) for any animated styles -- passing animated styles to regular components causes errors)**

**(You MUST keep static styles in `StyleSheet.create` and only animate dynamic properties in `useAnimatedStyle` -- animating static values wastes UI thread resources)**

**(You MUST NOT mutate shared values inside `useAnimatedStyle` callbacks -- read only, or you cause infinite loops)**

**(You MUST use `react-native-worklets` as a separate dependency in Reanimated 4 -- the worklet Babel plugin moved from `react-native-reanimated/plugin` to `react-native-worklets/plugin`)**

**Failure to follow these rules will cause animation failures, infinite loops, and crashes on the UI thread.**

</critical_reminders>
