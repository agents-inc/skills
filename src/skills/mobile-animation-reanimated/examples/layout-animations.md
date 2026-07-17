# Reanimated - Layout Animations

> Entering/exiting animations, predefined builders, custom animations. See [SKILL.md](../SKILL.md) for decision guidance.

**Related:** [core.md](core.md) for shared values and animation functions.

---

## Pattern 1: Predefined Entering/Exiting

Apply to `Animated.*` components. Component must be conditionally rendered (mount/unmount triggers the animation).

```typescript
import { useState } from "react";
import { Pressable, Text, StyleSheet, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
  ZoomIn,
  BounceIn,
} from "react-native-reanimated";

const ANIMATION_DURATION = 400;
const STAGGER_DELAY = 100;

export function NotificationList({ items }: { items: Notification[] }) {
  return (
    <View style={styles.list}>
      {items.map((item, index) => (
        <Animated.View
          key={item.id}
          entering={SlideInRight.delay(index * STAGGER_DELAY).duration(ANIMATION_DURATION)}
          exiting={SlideOutLeft.duration(ANIMATION_DURATION)}
          style={styles.item}
        >
          <Text>{item.message}</Text>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  item: {
    padding: 16,
    backgroundColor: "#F0F0F0",
    borderRadius: 8,
  },
});
```

**Why good:** staggered delay based on index creates cascade effect, separate entering/exiting animations for different UX feel

### Available Builder Families

| Family     | Entering            | Exiting              | Variants                                |
| ---------- | ------------------- | -------------------- | --------------------------------------- |
| Fade       | `FadeIn`            | `FadeOut`            | Up, Down, Left, Right                   |
| Slide      | `SlideInRight`      | `SlideOutLeft`       | Up, Down, Left, Right                   |
| Zoom       | `ZoomIn`            | `ZoomOut`            | Up, Down, Left, Right, EasyUp, EasyDown |
| Bounce     | `BounceIn`          | `BounceOut`          | Up, Down, Left, Right                   |
| Flip       | `FlipInEasyX`       | `FlipOutEasyX`       | X, Y, XUp, XDown, YLeft, YRight         |
| LightSpeed | `LightSpeedInRight` | `LightSpeedOutRight` | Left, Right                             |
| Rotate     | `RotateInDownLeft`  | `RotateOutDownLeft`  | Up/Down + Left/Right                    |
| Pinwheel   | `PinwheelIn`        | `PinwheelOut`        | (no variants)                           |
| Roll       | `RollInLeft`        | `RollOutLeft`        | Left, Right                             |
| Stretch    | `StretchInX`        | `StretchOutX`        | X, Y                                    |

---

## Pattern 2: Modifier Chaining

Customize predefined animations with modifier methods.

```typescript
import Animated, { FadeIn, SlideInUp, BounceIn } from "react-native-reanimated";

const ENTER_DURATION = 500;
const EXIT_DURATION = 300;
const ENTER_DELAY = 200;

// Duration + easing
<Animated.View entering={FadeIn.duration(ENTER_DURATION).easing(Easing.bezierFn(0.25, 0.1, 0.25, 1))} />

// Spring-based (replaces default timing with spring physics)
<Animated.View entering={BounceIn.springify().damping(12).stiffness(200)} />

// Delay + callback
<Animated.View
  entering={SlideInUp.delay(ENTER_DELAY).withCallback((finished) => {
    "worklet";
    if (finished) {
      // Animation completed on UI thread
    }
  })}
/>

// Override initial values
<Animated.View
  entering={FadeIn.withInitialValues({ opacity: 0.3, transform: [{ scale: 0.8 }] })}
/>

// Accessibility: respect reduced motion preference
<Animated.View entering={FadeIn.reduceMotion(ReduceMotion.System)} />
```

**Performance tip:** Define builders outside the component or memoize them -- inline creation in JSX allocates new objects every render.

```typescript
// Good: defined once at module level
const ENTER_ANIMATION = FadeIn.duration(400).delay(100);
const EXIT_ANIMATION = FadeOut.duration(300);

function Card() {
  return <Animated.View entering={ENTER_ANIMATION} exiting={EXIT_ANIMATION} />;
}
```

---

## Pattern 3: EntryExitTransition (Replacing combineTransition)

`combineTransition` was removed in v4. Use `EntryExitTransition` to combine different entering and exiting animations into a single layout transition.

```typescript
import Animated, {
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
  EntryExitTransition,
} from "react-native-reanimated";

// Combine different entering and exiting animations
const LAYOUT_TRANSITION = EntryExitTransition
  .entering(SlideInRight)
  .exiting(FadeOut);

function AnimatedList({ items }: { items: Item[] }) {
  return (
    <View>
      {items.map((item) => (
        <Animated.View
          key={item.id}
          layout={LAYOUT_TRANSITION}
          style={styles.item}
        >
          <Text>{item.name}</Text>
        </Animated.View>
      ))}
    </View>
  );
}
```

---

## Pattern 4: Custom Entering/Exiting Animation

Build fully custom animations when predefined builders don't fit.

```typescript
import Animated, { withTiming, withSpring, type EntryAnimationsValues } from "react-native-reanimated";

const CUSTOM_DURATION = 600;
const INITIAL_OFFSET = 50;

// Custom entering animation function
function customEnteringAnimation(values: EntryAnimationsValues) {
  "worklet";
  const animations = {
    opacity: withTiming(1, { duration: CUSTOM_DURATION }),
    transform: [
      { translateY: withSpring(0, { damping: 100 }) },
      { scale: withSpring(1, { damping: 80 }) },
    ],
  };
  const initialValues = {
    opacity: 0,
    transform: [
      { translateY: INITIAL_OFFSET },
      { scale: 0.9 },
    ],
  };
  return { initialValues, animations };
}

function CustomAnimatedCard() {
  return (
    <Animated.View entering={customEnteringAnimation} style={styles.card}>
      <Text>Custom animation</Text>
    </Animated.View>
  );
}
```

**Why good:** full control over initial values and animation config per property, can mix spring and timing in one entering animation, `values` parameter provides target layout measurements (width, height, targetOriginX, etc.)

**Custom animation callback shape:**

- Receives `EntryAnimationsValues` (entering) or `ExitAnimationsValues` (exiting) with target layout info
- Must return `{ initialValues, animations }` where each has the same style property keys
- Must be marked with `'worklet'` directive
