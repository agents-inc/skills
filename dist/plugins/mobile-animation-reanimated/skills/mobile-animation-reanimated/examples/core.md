# Reanimated - Core Patterns

> Shared values, animated styles, animation functions, and interpolation. See [SKILL.md](../SKILL.md) for decision guidance and red flags.

**Prerequisites:** Reanimated 4 installed with `react-native-worklets`. New Architecture enabled (React Native 0.76+).

---

## Pattern 1: Shared Value + Animated Style Basics

```typescript
import { useState } from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

const BOX_SIZE = 100;
const SCALE_ACTIVE = 1.2;
const SCALE_INACTIVE = 1;
const OPACITY_ACTIVE = 1;
const OPACITY_INACTIVE = 0.5;
const ANIMATION_DURATION = 300;

export function AnimatedBox() {
  const [active, setActive] = useState(false);
  const scale = useSharedValue(SCALE_INACTIVE);
  const opacity = useSharedValue(OPACITY_INACTIVE);

  // Only dynamic properties in useAnimatedStyle
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePress = () => {
    const nextActive = !active;
    setActive(nextActive);
    scale.value = withTiming(
      nextActive ? SCALE_ACTIVE : SCALE_INACTIVE,
      { duration: ANIMATION_DURATION }
    );
    opacity.value = withTiming(
      nextActive ? OPACITY_ACTIVE : OPACITY_INACTIVE,
      { duration: ANIMATION_DURATION }
    );
  };

  return (
    <Pressable onPress={handlePress}>
      {/* Static styles in StyleSheet, dynamic in animatedStyle */}
      <Animated.View style={[styles.box, animatedStyle]}>
        <Text>{active ? "Active" : "Inactive"}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    width: BOX_SIZE,
    height: BOX_SIZE,
    backgroundColor: "#3498db",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
```

**Why good:** static styles (width, height, backgroundColor, borderRadius) stay in StyleSheet, only dynamic properties (scale, opacity) in useAnimatedStyle, named constants for all values

---

## Pattern 2: React Compiler Compatibility

When using React Compiler, use `get()` and `set()` instead of direct `.value` access to avoid the compiler misinterpreting shared value reactivity.

```typescript
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

const TARGET_POSITION = 200;
const INITIAL_POSITION = 0;

export function CompilerSafeAnimation() {
  const translateX = useSharedValue(INITIAL_POSITION);

  // get() instead of .value in animated style
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.get() }],
  }));

  const handlePress = () => {
    // set() with updater function instead of .value assignment
    translateX.set((current) =>
      current === INITIAL_POSITION ? TARGET_POSITION : INITIAL_POSITION
    );
  };

  return (
    <Pressable onPress={handlePress}>
      <Animated.View style={[styles.box, animatedStyle]} />
    </Pressable>
  );
}
```

**Why good:** `get()`/`set()` are React Compiler safe -- direct `.value` access may be misinterpreted by the compiler's memoization analysis

**When to use:** only when your project uses React Compiler. Direct `.value` access remains valid without the compiler.

---

## Pattern 3: withSpring Configuration

Two modes: physics-based (damping/stiffness) and duration-based (duration/dampingRatio). Don't mix parameters from both modes.

```typescript
import { useSharedValue, withSpring } from "react-native-reanimated";

const TARGET = 100;

// Physics-based: natural feel, bouncy
// Lower damping = more bouncy, higher stiffness = snappier
function physicsSpring(sv: ReturnType<typeof useSharedValue<number>>) {
  sv.value = withSpring(TARGET, {
    damping: 80, // how quickly it settles (default: 120)
    stiffness: 600, // how bouncy (default: 900)
    mass: 1, // weight (default: 4)
  });
}

// Duration-based: predictable timing with spring feel
// dampingRatio < 1 = bouncy, 1 = critically damped (no overshoot), > 1 = overdamped
function durationSpring(sv: ReturnType<typeof useSharedValue<number>>) {
  sv.value = withSpring(TARGET, {
    duration: 400, // perceptual duration in ms (default: 550)
    dampingRatio: 0.7, // < 1 bouncy, 1 no bounce, > 1 overdamped
  });
}

// Clamped spring: prevents overshoot past boundaries
function clampedSpring(sv: ReturnType<typeof useSharedValue<number>>) {
  sv.value = withSpring(TARGET, {
    duration: 400,
    dampingRatio: 0.7,
    clamp: { min: 0, max: 120 }, // limits movement range
  });
}

// With completion callback
function springWithCallback(sv: ReturnType<typeof useSharedValue<number>>) {
  sv.value = withSpring(TARGET, { damping: 100 }, (finished) => {
    "worklet";
    if (finished) {
      // Animation completed -- safe to trigger next animation
    }
  });
}
```

**Why good:** clear separation of physics-based vs duration-based configs, clamp prevents visual overshoot, callback for chaining

**Migration note:** `restDisplacementThreshold` and `restSpeedThreshold` are removed in v4. The new `energyThreshold` (default `6e-9`) is relative to the animation. In most cases, just delete the old threshold parameters.

---

## Pattern 4: withTiming and Easing

```typescript
import {
  withTiming,
  Easing,
  withSequence,
  withRepeat,
  withDelay,
} from "react-native-reanimated";

const ANIMATION_DURATION = 300;
const FADE_DELAY = 200;
const SHAKE_OFFSET = 10;
const SHAKE_DURATION = 80;
const SHAKE_REPETITIONS = 3;

// Basic timing with easing
function fadeIn(sv: SharedValue<number>) {
  sv.value = withTiming(1, {
    duration: ANIMATION_DURATION,
    easing: Easing.bezierFn(0.25, 0.1, 0.25, 1),
  });
}

// Delayed animation
function delayedFade(sv: SharedValue<number>) {
  sv.value = withDelay(
    FADE_DELAY,
    withTiming(1, { duration: ANIMATION_DURATION }),
  );
}

// Sequence: shake animation
function shake(sv: SharedValue<number>) {
  sv.value = withSequence(
    withTiming(-SHAKE_OFFSET, { duration: SHAKE_DURATION }),
    withRepeat(
      withTiming(SHAKE_OFFSET, { duration: SHAKE_DURATION }),
      SHAKE_REPETITIONS,
      true, // reverse each iteration
    ),
    withTiming(0, { duration: SHAKE_DURATION }),
  );
}
```

**Easing presets:** `Easing.linear`, `Easing.ease`, `Easing.quad`, `Easing.cubic`, `Easing.bezierFn(x1, y1, x2, y2)`, `Easing.inOut(Easing.quad)`, `Easing.in(Easing.elastic(1))`, `Easing.out(Easing.bounce)`.

---

## Pattern 5: withDecay (Momentum)

Simulates friction-based deceleration. Commonly used after gesture fling to maintain momentum.

```typescript
import { withDecay, withClamp } from "react-native-reanimated";

const MIN_POSITION = 0;
const MAX_POSITION = 300;

// Basic decay with velocity from gesture
function applyDecay(sv: SharedValue<number>, velocity: number) {
  sv.value = withDecay({
    velocity,
    rubberBandEffect: true, // bounces at edges instead of hard stop
    clamp: [MIN_POSITION, MAX_POSITION], // boundaries
  });
}

// Alternative: withClamp modifier wrapping other animations
function clampedDecay(sv: SharedValue<number>, velocity: number) {
  sv.value = withClamp(
    { min: MIN_POSITION, max: MAX_POSITION },
    withDecay({ velocity }),
  );
}
```

**Why good:** `rubberBandEffect` gives iOS-like elastic boundary behavior, `clamp` prevents values escaping range

---

## Pattern 6: Interpolation

Map value ranges. Use in `useAnimatedStyle` for scroll-driven or gesture-driven transformations.

```typescript
import {
  interpolate,
  interpolateColor,
  Extrapolation,
  useAnimatedStyle,
} from "react-native-reanimated";

const SCROLL_THRESHOLD = 100;
const HEADER_MAX = 200;
const HEADER_MIN = 60;

// Number interpolation with clamping
function useHeaderStyle(scrollY: SharedValue<number>) {
  return useAnimatedStyle(() => {
    const height = interpolate(
      scrollY.value,
      [0, HEADER_MAX - HEADER_MIN],
      [HEADER_MAX, HEADER_MIN],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      scrollY.value,
      [0, SCROLL_THRESHOLD],
      [1, 0],
      Extrapolation.CLAMP,
    );
    return { height, opacity };
  });
}

// Color interpolation: progress bar changes color
function useProgressColor(progress: SharedValue<number>) {
  return useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      progress.value,
      [0, 0.5, 1],
      ["#FF3B30", "#FFCC00", "#34C759"], // red -> yellow -> green
    );
    return { backgroundColor };
  });
}

// Mixed left/right extrapolation
function useParallax(scrollY: SharedValue<number>) {
  return useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollY.value,
      [0, SCROLL_THRESHOLD],
      [0, -50],
      {
        extrapolateLeft: Extrapolation.CLAMP, // don't go past 0
        extrapolateRight: Extrapolation.EXTEND, // continue beyond range
      },
    );
    return { transform: [{ translateY }] };
  });
}
```

**Extrapolation types:**

| Type       | Behavior                      |
| ---------- | ----------------------------- |
| `CLAMP`    | Caps output at range edges    |
| `EXTEND`   | Continues linearly past range |
| `IDENTITY` | Returns the raw input value   |

**`interpolateColor` modes:** `'RGB'` (default) or `'HSV'`. HSV produces perceptually smoother hue transitions (e.g., red to blue through purple, not through muddy brown).

---

## Pattern 7: Animated Text and Animated.createAnimatedComponent

Not all components have `Animated.*` wrappers. Use `Animated.createAnimatedComponent` for custom components.

```typescript
import Animated from "react-native-reanimated";
import { TextInput } from "react-native";

// Built-in: Animated.View, Animated.Text, Animated.ScrollView, Animated.Image, Animated.FlatList
// Custom: wrap any component that accepts style prop
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

// Usage
function AnimatedSearch() {
  const width = useSharedValue(200);

  const style = useAnimatedStyle(() => ({
    width: width.value,
  }));

  return <AnimatedTextInput style={[styles.input, style]} placeholder="Search..." />;
}
```

**Why good:** extends Reanimated to any component that accepts a `style` prop, type-safe with the wrapped component's props

**Gotcha:** `createAnimatedComponent` should be called at module level, not inside a component -- calling it in render creates a new component type each time, breaking React reconciliation.
