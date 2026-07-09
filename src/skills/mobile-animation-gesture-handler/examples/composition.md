# Gesture Handler - Composition Patterns

> Multi-gesture composition and cross-component relations. See [core.md](core.md) for individual gesture types.

**Related:** [SKILL.md](../SKILL.md) for composition decision framework, [reference.md](../reference.md) for quick reference tables.

---

## Pattern 1: Simultaneous Pan + Pinch + Rotation (Photo Viewer)

The classic image viewer: drag, zoom, and rotate all at once.

```typescript
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

function PhotoViewer({ source }: { source: ImageSourcePropType }) {
  // Pan state
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  // Pinch state
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  // Rotation state
  const rotation = useSharedValue(0);
  const savedRotation = useSharedValue(0);

  const pan = Gesture.Pan()
    .onChange((event) => {
      translateX.value += event.changeX;
      translateY.value += event.changeY;
    });

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = savedScale.value * event.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const rotate = Gesture.Rotation()
    .onUpdate((event) => {
      rotation.value = savedRotation.value + event.rotation;
    })
    .onEnd(() => {
      savedRotation.value = rotation.value;
    });

  // All three gestures active at the same time
  const composed = Gesture.Simultaneous(pan, pinch, rotate);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
      { rotate: `${rotation.value}rad` },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.Image source={source} style={[styles.image, animatedStyle]} />
    </GestureDetector>
  );
}
```

**Why good:** single `GestureDetector` with composed gesture, each gesture manages its own shared values, `Simultaneous` allows all three to be ACTIVE at once

```typescript
// BAD: Separate GestureDetectors for gestures that should interact
<GestureDetector gesture={pan}>
  <GestureDetector gesture={pinch}>
    <GestureDetector gesture={rotate}>
      <Animated.Image source={source} style={animatedStyle} />
    </GestureDetector>
  </GestureDetector>
</GestureDetector>
```

**Why bad:** nested detectors without explicit composition causes gestures to compete by default -- only one activates, the rest fail

---

## Pattern 2: Exclusive Double-Tap vs Single-Tap

Double-tap and single-tap on the same element. Double-tap must have higher priority.

```typescript
const DOUBLE_TAP_MAX_DELAY = 250;

function TapableCard({ onTap, onDoubleTap }: TapHandlers) {
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(DOUBLE_TAP_MAX_DELAY)
    .onStart(() => {
      runOnJS(onDoubleTap)();
    });

  const singleTap = Gesture.Tap()
    .onStart(() => {
      runOnJS(onTap)();
    });

  // CRITICAL: doubleTap FIRST = higher priority
  const taps = Gesture.Exclusive(doubleTap, singleTap);

  return (
    <GestureDetector gesture={taps}>
      <View style={styles.card}>
        <Text>Tap or double-tap</Text>
      </View>
    </GestureDetector>
  );
}
```

**Why good:** `Exclusive` with doubleTap first means the system waits to see if a second tap comes; if it does, doubleTap activates; if not, singleTap activates after the delay

```typescript
// BAD: Wrong priority order
const taps = Gesture.Exclusive(singleTap, doubleTap);
```

**Why bad:** singleTap has higher priority, fires immediately on first tap, doubleTap never gets recognized

---

## Pattern 3: Race -- Swipe vs Long Press

When two gestures compete and only one should win.

```typescript
const LONG_PRESS_DURATION = 400;
const MIN_SWIPE_DISTANCE = 50;

function MessageBubble({ onSwipeReply, onLongPressMenu }: MessageHandlers) {
  const translateX = useSharedValue(0);

  const swipe = Gesture.Pan()
    .activeOffsetX([-MIN_SWIPE_DISTANCE, MIN_SWIPE_DISTANCE])
    .onChange((event) => {
      translateX.value += event.changeX;
    })
    .onFinalize(() => {
      if (Math.abs(translateX.value) > MIN_SWIPE_DISTANCE) {
        runOnJS(onSwipeReply)();
      }
      translateX.value = withTiming(0);
    });

  const longPress = Gesture.LongPress()
    .minDuration(LONG_PRESS_DURATION)
    .onStart(() => {
      runOnJS(onLongPressMenu)();
    });

  // First gesture to activate wins -- the other fails
  const gesture = Gesture.Race(swipe, longPress);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={animatedStyle}>
        <Text>Message content</Text>
      </Animated.View>
    </GestureDetector>
  );
}
```

**Why good:** `Race` ensures only one interaction happens -- either the user swipes (reply) or long-presses (context menu), never both; `activeOffsetX` delays pan activation until meaningful horizontal movement

---

## Pattern 4: Cross-Component Relations (Drag Inside ScrollView)

When a draggable child lives inside a scrollable parent, use cross-component relations.

```typescript
function DraggableInScrollView() {
  const childPan = Gesture.Pan()
    .onChange((event) => {
      translateY.value += event.changeY;
    });

  // Wrap the native ScrollView gesture so we can reference it
  const scrollGesture = Gesture.Native();

  // Method 1: Scroll waits for drag to fail
  // (scroll only works when not touching the draggable child)
  scrollGesture.requireExternalGestureToFail(childPan);

  // Method 2: Both active simultaneously
  // (scroll AND drag work at the same time -- rare but useful for parallax)
  // childPan.simultaneousWith(scrollGesture);

  // Method 3: Child blocks scroll while dragging
  // (scroll stops when dragging starts)
  // childPan.blocksExternalGesture(scrollGesture);

  return (
    <GestureDetector gesture={scrollGesture}>
      <Animated.ScrollView>
        <View style={styles.content}>
          <GestureDetector gesture={childPan}>
            <Animated.View style={[styles.draggable, animatedStyle]} />
          </GestureDetector>
        </View>
      </Animated.ScrollView>
    </GestureDetector>
  );
}
```

**Key differences from composition:**

| Same component               | Different components                |
| ---------------------------- | ----------------------------------- |
| `Gesture.Simultaneous(a, b)` | `a.simultaneousWith(b)`             |
| `Gesture.Race(a, b)`         | `a.requireExternalGestureToFail(b)` |
| `Gesture.Exclusive(a, b)`    | `a.blocksExternalGesture(b)`        |

**Why this distinction matters:** Composition methods create a single composed gesture for one `GestureDetector`. Cross-component relations connect gestures on separate `GestureDetector` components in the view hierarchy.

---

## Pattern 5: Pan with Axis Locking

Restrict pan to horizontal or vertical based on initial movement direction.

```typescript
const AXIS_LOCK_THRESHOLD = 15;

function AxisLockedPan() {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const horizontalPan = Gesture.Pan()
    .activeOffsetX([-AXIS_LOCK_THRESHOLD, AXIS_LOCK_THRESHOLD])
    .failOffsetY([-AXIS_LOCK_THRESHOLD, AXIS_LOCK_THRESHOLD])
    .onChange((event) => {
      translateX.value += event.changeX;
    });

  const verticalPan = Gesture.Pan()
    .activeOffsetY([-AXIS_LOCK_THRESHOLD, AXIS_LOCK_THRESHOLD])
    .failOffsetX([-AXIS_LOCK_THRESHOLD, AXIS_LOCK_THRESHOLD])
    .onChange((event) => {
      translateY.value += event.changeY;
    });

  // Only one direction wins
  const pan = Gesture.Race(horizontalPan, verticalPan);

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={animatedStyle} />
    </GestureDetector>
  );
}
```

**Why good:** `activeOffsetX` + `failOffsetY` means the horizontal pan activates when horizontal movement exceeds threshold BUT fails if vertical movement exceeds threshold first. The `Race` composition ensures only one direction wins.
