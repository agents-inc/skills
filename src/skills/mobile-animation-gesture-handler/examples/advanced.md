# Gesture Handler - Advanced Patterns

> Hover gestures, manual control, platform config. See [core.md](core.md) for fundamentals, [composition.md](composition.md) for multi-gesture.

**Related:** [SKILL.md](../SKILL.md) for decision framework, [reference.md](../reference.md) for gesture type table.

---

## Pattern 1: Hover Gesture (Pointer Devices)

Hover gestures detect mouse, stylus, or trackpad hovering. They fire on iPad (with trackpad/mouse), macOS, and web -- but NOT on phone touch.

```typescript
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

const HOVER_SCALE = 1.05;
const TIMING_CONFIG = { duration: 150 };

function HoverableCard({ children }: { children: React.ReactNode }) {
  const isHovered = useSharedValue(false);

  const hover = Gesture.Hover()
    .onBegin(() => {
      isHovered.value = true;
    })
    .onEnd(() => {
      isHovered.value = false;
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withTiming(
          isHovered.value ? HOVER_SCALE : 1,
          TIMING_CONFIG,
        ),
      },
    ],
    shadowOpacity: withTiming(isHovered.value ? 0.2 : 0.1, TIMING_CONFIG),
  }));

  return (
    <GestureDetector gesture={hover}>
      <Animated.View style={[styles.card, animatedStyle]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
```

**Why good:** `onBegin`/`onEnd` for hover enter/exit, `withTiming` for smooth transitions, works on iPad trackpad and web

### iOS System Hover Effects

On iOS 17.0+, `GestureDetector` supports a `hoverEffect` prop for system-provided visual effects. These are lightweight alternatives to custom hover animations.

```typescript
<GestureDetector gesture={tap} hoverEffect="lift">
  <Animated.View style={styles.button}>
    <Text>Hover me</Text>
  </Animated.View>
</GestureDetector>
```

Available effects: `"highlight"` (dim overlay), `"lift"` (raise with shadow), `"automatic"` (system chooses).

**Platform note:** `hoverEffect` only works on iOS 17.0+ with pointer devices. It is ignored on Android and earlier iOS versions.

---

## Pattern 2: Manual Gesture (Custom Recognition Logic)

Use `Gesture.Manual()` when none of the built-in gestures match your recognition criteria. You control state transitions manually via the `GestureStateManager`.

```typescript
import {
  Gesture,
  GestureDetector,
  GestureStateManager,
} from "react-native-gesture-handler";

const MIN_MOVEMENT = 30;
const MAX_TIME_MS = 500;

function CustomGestureView() {
  const gesture = Gesture.Manual()
    .onTouchesDown((event, stateManager) => {
      // Only recognize single-finger touches
      if (event.numberOfTouches === 1) {
        stateManager.begin();
      } else {
        stateManager.fail();
      }
    })
    .onTouchesMove((event, stateManager) => {
      const touch = event.allTouches[0];
      if (touch && Math.abs(touch.absoluteX - touch.x) > MIN_MOVEMENT) {
        stateManager.activate();
      }
    })
    .onTouchesUp((_event, stateManager) => {
      stateManager.end();
    });

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.container} />
    </GestureDetector>
  );
}
```

**Why good:** full control over state transitions (begin, activate, fail, end), useful for gestures that don't fit any standard type

**When to use:** complex multi-step gesture recognition, gestures combining time + distance thresholds, or custom shapes (circle gesture, Z-pattern, etc.).

---

## Pattern 3: Platform-Specific Gesture Config

```typescript
import { Platform } from "react-native";

const PAN_MIN_DISTANCE_IOS = 10;
const PAN_MIN_DISTANCE_ANDROID = 15; // Android touch slop is slightly larger

const pan = Gesture.Pan()
  .minDistance(
    Platform.select({
      ios: PAN_MIN_DISTANCE_IOS,
      android: PAN_MIN_DISTANCE_ANDROID,
      default: PAN_MIN_DISTANCE_IOS,
    }),
  )
  .onChange((event) => {
    translateX.value += event.changeX;
  });
```

**Why good:** Android has a larger default touch slop than iOS; matching platform defaults prevents gestures feeling too sensitive or too sluggish per platform

### iPad Trackpad Two-Finger Pan

```typescript
const pan = Gesture.Pan()
  .enableTrackpadTwoFingerGesture(true)
  .onChange((event) => {
    translateX.value += event.changeX;
  });
```

**Why good:** enables two-finger trackpad swiping on iPad, which is the standard gesture for horizontal navigation; without this flag, trackpad two-finger gestures are not recognized

---

## Pattern 4: Gesture with runOnJS Bridge

When gesture callbacks need to trigger JS-thread operations (navigation, API calls, state updates in non-worklet stores), use `runOnJS`.

```typescript
import { runOnJS } from "react-native-reanimated";

function SwipeToDismiss({ onDismiss }: { onDismiss: () => void }) {
  const translateX = useSharedValue(0);
  const DISMISS_THRESHOLD = 150;

  const pan = Gesture.Pan()
    .onChange((event) => {
      translateX.value += event.changeX;
    })
    .onEnd(() => {
      if (Math.abs(translateX.value) > DISMISS_THRESHOLD) {
        // Bridge to JS thread for navigation/state
        runOnJS(onDismiss)();
      } else {
        translateX.value = withSpring(0);
      }
    });

  // ...
}
```

**Why good:** gesture callbacks run on UI thread (worklets) for performance; `runOnJS` safely bridges back to JS when needed for non-animation logic

**Gotcha:** Do NOT call `runOnJS` inside `onChange`/`onUpdate` (fires every frame) -- only in `onEnd`/`onFinalize`/`onStart` to avoid flooding the JS thread.

---

## Pattern 5: Fling Gesture (Quick Directional Swipe)

Unlike Pan, Fling fires once at the end of a quick swipe in a specific direction. Use it for page navigation or dismissal, not for continuous tracking.

```typescript
import { Directions } from "react-native-gesture-handler";

function FlingNavigator({ onSwipeLeft, onSwipeRight }: NavigatorProps) {
  const swipeLeft = Gesture.Fling()
    .direction(Directions.LEFT)
    .onStart(() => {
      runOnJS(onSwipeLeft)();
    });

  const swipeRight = Gesture.Fling()
    .direction(Directions.RIGHT)
    .onStart(() => {
      runOnJS(onSwipeRight)();
    });

  const flings = Gesture.Simultaneous(swipeLeft, swipeRight);

  return (
    <GestureDetector gesture={flings}>
      <View style={styles.page}>{/* Page content */}</View>
    </GestureDetector>
  );
}
```

**Why good:** Fling is optimized for quick swipes, fires once with direction info, `Simultaneous` allows both directions to be recognized

**When to use Fling vs Pan:** Use `Fling` for discrete navigation actions (go to next page). Use `Pan` when you need continuous position tracking during the swipe (dragging a card).
