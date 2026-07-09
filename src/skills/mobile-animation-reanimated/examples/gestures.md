# Reanimated - Gesture Integration

> Gesture-driven animations using react-native-gesture-handler + Reanimated shared values. See [SKILL.md](../SKILL.md) for decision guidance.

**Related:** [core.md](core.md) for shared values and withDecay.

**Note:** This file covers Reanimated's side of gesture-driven animations. For gesture configuration details (tap, pinch, fling, simultaneous/exclusive gestures), see the gesture handler skill.

---

## Pattern 1: Draggable Element with Pan Gesture

```typescript
import { StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

const INITIAL_POSITION = 0;

export function DraggableCircle() {
  const translateX = useSharedValue(INITIAL_POSITION);
  const translateY = useSharedValue(INITIAL_POSITION);
  const savedX = useSharedValue(INITIAL_POSITION);
  const savedY = useSharedValue(INITIAL_POSITION);

  const pan = Gesture.Pan()
    .onStart(() => {
      // Save position at gesture start for relative movement
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    })
    .onUpdate((e) => {
      // Absolute translation from gesture start
      translateX.value = savedX.value + e.translationX;
      translateY.value = savedY.value + e.translationY;
    })
    .onEnd(() => {
      // Spring back to origin
      translateX.value = withSpring(INITIAL_POSITION);
      translateY.value = withSpring(INITIAL_POSITION);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.circle, animatedStyle]} />
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#3498db",
  },
});
```

**Why good:** `onStart` saves position for relative movement, `onUpdate` uses absolute translationX/Y from gesture start, `onEnd` springs back, gesture callbacks are auto-workletized

### onUpdate vs onChange

- **`onUpdate`** -- receives absolute values (`translationX`, `translationY`) relative to gesture start
- **`onChange`** -- receives delta values (`changeX`, `changeY`) since last event

Use `onChange` when accumulating position incrementally. Use `onUpdate` when setting position from a known start point.

---

## Pattern 2: Swipe-to-Dismiss

```typescript
import { Dimensions, StyleSheet, Text } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolation,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

const SCREEN_WIDTH = Dimensions.get("window").width;
const DISMISS_THRESHOLD = SCREEN_WIDTH * 0.3;
const DISMISS_VELOCITY = 500;
const ANIMATION_DURATION = 200;

interface SwipeableCardProps {
  onDismiss: () => void;
  children: React.ReactNode;
}

export function SwipeableCard({ onDismiss, children }: SwipeableCardProps) {
  const translateX = useSharedValue(0);

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])  // require 10px horizontal movement to activate
    .onChange((e) => {
      translateX.value += e.changeX;
    })
    .onFinalize((e) => {
      const shouldDismiss =
        Math.abs(translateX.value) > DISMISS_THRESHOLD ||
        Math.abs(e.velocityX) > DISMISS_VELOCITY;

      if (shouldDismiss) {
        const direction = translateX.value > 0 ? 1 : -1;
        translateX.value = withTiming(
          direction * SCREEN_WIDTH,
          { duration: ANIMATION_DURATION },
          () => {
            // scheduleOnRN to call JS function from UI thread
            scheduleOnRN(onDismiss);
          }
        );
      } else {
        // Snap back
        translateX.value = withTiming(0, { duration: ANIMATION_DURATION });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: interpolate(
      Math.abs(translateX.value),
      [0, SCREEN_WIDTH],
      [1, 0.5],
      Extrapolation.CLAMP
    ),
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.card, animatedStyle]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});
```

**Why good:** `activeOffsetX` prevents accidental activation during vertical scroll, velocity check catches fast flicks, `scheduleOnRN` bridges from UI thread callback to JS, opacity fades with distance

**Key points:**

- `scheduleOnRN` (Reanimated 4) replaces `runOnJS` for calling JS functions from worklets
- `onFinalize` fires when gesture ends regardless of success/failure -- safer than `onEnd` for cleanup
- `activeOffsetX` with symmetric values prevents horizontal pan from stealing vertical scroll

---

## Pattern 3: Gesture with Decay (Fling Momentum)

```typescript
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDecay,
} from "react-native-reanimated";

const MIN_X = 0;
const MAX_X = 300;

export function FlickableElement() {
  const offsetX = useSharedValue(0);

  const pan = Gesture.Pan()
    .onChange((e) => {
      offsetX.value += e.changeX;
    })
    .onFinalize((e) => {
      // withDecay preserves momentum from the fling
      offsetX.value = withDecay({
        velocity: e.velocityX,
        rubberBandEffect: true,    // elastic bounce at boundaries
        clamp: [MIN_X, MAX_X],    // movement boundaries
      });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offsetX.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.element, animatedStyle]} />
    </GestureDetector>
  );
}
```

**Why good:** `withDecay` takes velocity directly from gesture event, `rubberBandEffect` gives iOS-like elastic boundary, `clamp` prevents element from escaping bounds

---

## Pattern 4: Scale on Press (Tap Gesture)

```typescript
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

const SCALE_PRESSED = 0.95;
const SCALE_DEFAULT = 1;

export function PressableCard({ children }: { children: React.ReactNode }) {
  const scale = useSharedValue(SCALE_DEFAULT);

  const tap = Gesture.Tap()
    .onBegin(() => {
      scale.value = withSpring(SCALE_PRESSED, { damping: 100, stiffness: 800 });
    })
    .onFinalize(() => {
      scale.value = withSpring(SCALE_DEFAULT, { damping: 100, stiffness: 800 });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={tap}>
      <Animated.View style={[styles.card, animatedStyle]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
```

**Why good:** `onBegin` fires immediately on touch (not on release), `onFinalize` restores scale whether tap completes or cancels, spring gives natural bounce feel
