# Gesture Handler - Core Patterns

> Fundamental gesture setup and individual gesture types. See [SKILL.md](../SKILL.md) for decision guidance and red flags.

**Related:** [composition.md](composition.md) for multi-gesture patterns, [swipeable.md](swipeable.md) for list rows, [advanced.md](advanced.md) for hover and manual control.

---

## Pattern 1: App Root Setup

```typescript
import { GestureHandlerRootView } from "react-native-gesture-handler";

// CRITICAL: Must be at the actual root of the app
export function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Your navigation, providers, etc. */}
      <AppContent />
    </GestureHandlerRootView>
  );
}
```

**Why good:** single root, flex: 1 covers full screen, all gestures and relations work within this root

```typescript
// BAD: Missing GestureHandlerRootView
export function App() {
  return <AppContent />; // Gestures silently fail everywhere
}
```

**Why bad:** gestures won't be recognized anywhere in the app, and no error is thrown

### Android Modal Gotcha

```typescript
import { Modal } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// Android modals create a separate native view hierarchy
function MyModal({ visible, onClose }: ModalProps) {
  return (
    <Modal visible={visible} onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ModalContent />
      </GestureHandlerRootView>
    </Modal>
  );
}
```

**Why good:** Modal on Android has its own view hierarchy; without a separate root, gestures inside modals fail silently

---

## Pattern 2: Pan Gesture (Drag)

Two approaches depending on how you use position data:

### onChange for Offset Accumulation (Most Common)

```typescript
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDecay,
} from "react-native-reanimated";

const MIN_PAN_DISTANCE = 10;

function DraggableBox() {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const pan = Gesture.Pan()
    .minDistance(MIN_PAN_DISTANCE)
    .onChange((event) => {
      // onChange provides DELTAS (changeX, changeY)
      translateX.value += event.changeX;
      translateY.value += event.changeY;
    })
    .onFinalize((event) => {
      // Decay animation using final velocity
      translateX.value = withDecay({ velocity: event.velocityX });
      translateY.value = withDecay({ velocity: event.velocityY });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.box, animatedStyle]} />
    </GestureDetector>
  );
}
```

**Why good:** `onChange` gives deltas, so `+=` accumulates correctly; `onFinalize` runs on any terminal state; `minDistance` prevents accidental activation

### onUpdate for Absolute Position

```typescript
function DraggableFromOrigin() {
  const startX = useSharedValue(0);
  const translateX = useSharedValue(0);

  const pan = Gesture.Pan()
    .onStart(() => {
      // Save current position at gesture start
      startX.value = translateX.value;
    })
    .onUpdate((event) => {
      // onUpdate provides CUMULATIVE translation from gesture start
      translateX.value = startX.value + event.translationX;
    });

  // ... animatedStyle and render same as above
}
```

**Why good:** `onUpdate` gives cumulative translation, combined with saved start position for absolute positioning

```typescript
// BAD: Mixing onChange deltas with onUpdate cumulative values
const pan = Gesture.Pan().onUpdate((event) => {
  translateX.value += event.translationX; // WRONG: translationX is cumulative, not delta
});
```

**Why bad:** `translationX` grows each frame, so `+=` causes exponential drift instead of linear movement

---

## Pattern 3: Tap Gesture

```typescript
const TAP_MAX_DURATION = 300;

function TappableCard({ onTap }: { onTap: () => void }) {
  const scale = useSharedValue(1);

  const tap = Gesture.Tap()
    .maxDuration(TAP_MAX_DURATION)
    .onBegin(() => {
      // Visual feedback when touch starts (BEGAN state)
      scale.value = withTiming(0.95);
    })
    .onStart(() => {
      // Gesture recognized (ACTIVE state) -- fire action
      runOnJS(onTap)();
    })
    .onFinalize(() => {
      // Reset regardless of success/failure/cancel
      scale.value = withTiming(1);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={tap}>
      <Animated.View style={[styles.card, animatedStyle]}>
        <Text>Tap me</Text>
      </Animated.View>
    </GestureDetector>
  );
}
```

**Why good:** `onBegin` for immediate visual feedback (before recognition), `onStart` for the action, `onFinalize` for guaranteed cleanup, `runOnJS` bridges worklet back to JS

### Double Tap

```typescript
const DOUBLE_TAP_MAX_DELAY = 250;

const doubleTap = Gesture.Tap()
  .numberOfTaps(2)
  .maxDelay(DOUBLE_TAP_MAX_DELAY)
  .onStart(() => {
    scale.value = scale.value === 1 ? 2 : 1;
  });
```

**Gotcha:** When combining single and double tap on the same view, use `Gesture.Exclusive(doubleTap, singleTap)` -- double-tap must be the FIRST argument (higher priority). If single-tap goes first, it fires immediately and double-tap never gets a chance.

---

## Pattern 4: Pinch Gesture (Zoom)

```typescript
function PinchableImage({ source }: { source: ImageSourcePropType }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      // event.scale is relative to gesture start (1.0 = no change)
      scale.value = savedScale.value * event.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={pinch}>
      <Animated.Image source={source} style={[styles.image, animatedStyle]} />
    </GestureDetector>
  );
}
```

**Why good:** `savedScale` preserves accumulated scale between gestures; `event.scale` is multiplicative (1.0 = unchanged, 2.0 = doubled)

**Gotcha:** `event.scale` starts at 1.0 for each gesture, not from the previous scale. Always multiply by the saved value.

---

## Pattern 5: Rotation Gesture

```typescript
function RotatableView() {
  const rotation = useSharedValue(0);
  const savedRotation = useSharedValue(0);

  const rotationGesture = Gesture.Rotation()
    .onUpdate((event) => {
      // event.rotation is in radians, relative to gesture start
      rotation.value = savedRotation.value + event.rotation;
    })
    .onEnd(() => {
      savedRotation.value = rotation.value;
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}rad` }],
  }));

  return (
    <GestureDetector gesture={rotationGesture}>
      <Animated.View style={[styles.dial, animatedStyle]} />
    </GestureDetector>
  );
}
```

**Why good:** same saved-value pattern as pinch; rotation in radians is additive (not multiplicative like scale)

---

## Pattern 6: Long Press Gesture

```typescript
const LONG_PRESS_DURATION = 500;

function LongPressableItem({ onLongPress }: { onLongPress: () => void }) {
  const isPressed = useSharedValue(false);

  const longPress = Gesture.LongPress()
    .minDuration(LONG_PRESS_DURATION)
    .onBegin(() => {
      isPressed.value = true; // Immediate visual feedback
    })
    .onStart(() => {
      // Fires after minDuration elapses with finger still down
      runOnJS(onLongPress)();
    })
    .onFinalize(() => {
      isPressed.value = false;
    });

  // ... animated style using isPressed.value for opacity/scale

  return (
    <GestureDetector gesture={longPress}>
      <Animated.View style={animatedStyle}>
        <Text>Hold me</Text>
      </Animated.View>
    </GestureDetector>
  );
}
```

**Key distinction:** `onBegin` fires when touch is detected (visual feedback). `onStart` fires only after `minDuration` milliseconds with finger still down (action trigger). If the user lifts their finger before `minDuration`, the gesture transitions to FAILED and `onStart` never fires.
