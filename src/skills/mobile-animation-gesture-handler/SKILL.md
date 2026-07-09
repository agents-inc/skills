---
name: mobile-animation-gesture-handler
description: React Native Gesture Handler - gesture types, GestureDetector, gesture composition, state machine, platform-specific gestures, swipeable rows, hover gestures
---

# React Native Gesture Handler Patterns

> **Quick Guide:** Use Gesture Handler's v2 builder API (`Gesture.Pan()`, `Gesture.Tap()`, etc.) with `GestureDetector` for all touch interactions. Wrap your app root in `GestureHandlerRootView`. Compose gestures with `Gesture.Simultaneous()`, `Gesture.Race()`, and `Gesture.Exclusive()`. Use `onChange` (not `onUpdate`) when working with animation shared values -- `onChange` provides deltas (`changeX`), `onUpdate` provides cumulative values (`translationX`). Gesture callbacks are automatically workletized when your animation library is installed.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST wrap the app root in `GestureHandlerRootView` -- gestures will silently fail without it)**

**(You MUST use `GestureDetector` with the builder API (`Gesture.Pan()`, etc.) -- NOT the legacy `PanGestureHandler` components)**

**(You MUST use `onChange` for incremental shared value updates and `onUpdate` for cumulative values -- mixing them causes drift)**

**(You MUST use `Gesture.Simultaneous()` for multi-touch interactions (pinch + pan) -- without it, only one gesture activates)**

**(You MUST NOT nest `GestureDetector` components using different API styles (hooks vs builder) under the same root -- this causes undefined behavior)**

</critical_requirements>

---

**Auto-detection:** react-native-gesture-handler, GestureDetector, GestureHandlerRootView, Gesture.Pan, Gesture.Tap, Gesture.Pinch, Gesture.Rotation, Gesture.LongPress, Gesture.Fling, Gesture.Hover, Gesture.Simultaneous, Gesture.Race, Gesture.Exclusive, Swipeable, ReanimatedSwipeable, onBegin, onStart, onChange, onUpdate, onEnd, onFinalize

**When to use:**

- Adding pan, pinch, tap, rotation, long-press, fling, or hover gestures to React Native views
- Composing multiple gestures on the same view (pinch-to-zoom + drag)
- Building swipeable list rows with reveal actions
- Replacing React Native's built-in Gesture Responder System (PanResponder)
- Implementing gesture-driven animations with shared values
- Adding hover interactions for iPad trackpad, desktop, or web targets

**Key patterns covered:**

- GestureDetector + builder API for all gesture types
- Gesture composition: Simultaneous, Race, Exclusive
- Gesture state machine and lifecycle callbacks
- Shared value integration in gesture callbacks (onChange vs onUpdate)
- ReanimatedSwipeable for swipeable list rows
- Hover gesture for pointer devices (iPad trackpad, mouse, stylus)
- Platform-specific gesture configuration (Android ripple, iOS haptics)
- Cross-component gesture relations (requireToFail, simultaneousWith, block)

**When NOT to use:**

- Simple button taps (use `Pressable` or `TouchableOpacity` from React Native core)
- Scroll-only interactions (use `ScrollView` or `FlatList` directly)
- Web-only applications without React Native

**Detailed Resources:**

- [examples/core.md](examples/core.md) - GestureDetector setup, pan, tap, pinch, rotation gestures with shared values
- [examples/composition.md](examples/composition.md) - Simultaneous, Race, Exclusive composition, cross-component relations
- [examples/swipeable.md](examples/swipeable.md) - ReanimatedSwipeable rows, FlatList integration, action panels
- [examples/advanced.md](examples/advanced.md) - Hover gesture, manual gesture control, platform-specific config
- [reference.md](reference.md) - Decision frameworks, gesture type reference, state machine diagram

---

<philosophy>

## Philosophy

React Native Gesture Handler replaces the built-in Gesture Responder System with native-driven gesture recognition. The key advantage is that gestures are processed on the native thread, not JS -- so they remain responsive even when JS is busy.

**Core principles:**

1. **Native-first** -- Gesture recognition runs natively; callbacks optionally run as worklets on the UI thread
2. **Declarative composition** -- Define gestures as objects, compose them with `Simultaneous`, `Race`, `Exclusive`
3. **State machine driven** -- Every gesture follows UNDETERMINED -> BEGAN -> ACTIVE -> END/FAILED/CANCELLED
4. **Builder API** -- Chain configuration methods: `Gesture.Pan().minDistance(10).onUpdate(handler)`
5. **One GestureDetector per gesture (or composed gesture)** -- Don't attach multiple unrelated gestures via separate nested detectors

**Mental model:** Think of each gesture as a state machine that competes with other gestures for activation. Composition methods (`Simultaneous`, `Race`, `Exclusive`) define the competition rules. The gesture that wins transitions to ACTIVE; the rest FAIL or get CANCELLED.

**v3 hooks API (beta):** RNGH v3 introduces a hooks-based API (`usePanGesture`, `useSimultaneousGestures`, etc.) that is cleaner but still in beta. The v2 builder API (`Gesture.Pan()`, `GestureDetector`) is the stable production API documented here.

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: GestureHandlerRootView Setup

Every app using Gesture Handler must wrap its root in `GestureHandlerRootView`. Without it, gestures silently fail -- no errors, just no recognition.

```typescript
import { GestureHandlerRootView } from "react-native-gesture-handler";

export function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppContent />
    </GestureHandlerRootView>
  );
}
```

**Why good:** single root wrapper, `flex: 1` ensures full-screen coverage

**Gotcha (Android modals):** React Native Modals on Android create a separate native view hierarchy. Wrap Modal content in its own `GestureHandlerRootView` -- gestures inside a Modal won't work otherwise.

**Gotcha (native navigation):** When using a native navigation library (separate screen containers per screen), wrap each registered screen individually rather than a single app-level root.

See [examples/core.md](examples/core.md) for the full setup pattern.

---

### Pattern 2: Pan Gesture with Shared Values

The most common pattern: drag an element by tracking translation deltas.

```typescript
const offset = useSharedValue(0);

const pan = Gesture.Pan()
  .onChange((event) => {
    offset.value += event.changeX; // Incremental delta
  })
  .onFinalize((event) => {
    offset.value = withDecay({ velocity: event.velocityX });
  });

// Wrap with GestureDetector + Animated.View
<GestureDetector gesture={pan}>
  <Animated.View style={animatedStyle} />
</GestureDetector>
```

**Why `onChange` over `onUpdate`:** `onChange` provides `changeX`/`changeY` (delta since last event) -- add it to an offset. `onUpdate` provides `translationX`/`translationY` (cumulative since gesture start) -- use it as an absolute position. Mixing them causes position drift.

See [examples/core.md](examples/core.md) for complete pan, tap, pinch, and rotation examples.

---

### Pattern 3: Gesture Composition

Compose multiple gestures on the same view with three strategies:

```typescript
const pan = Gesture.Pan().onChange(/* ... */);
const pinch = Gesture.Pinch().onUpdate(/* ... */);
const rotation = Gesture.Rotation().onUpdate(/* ... */);

// All three active simultaneously (photo viewer)
const composed = Gesture.Simultaneous(pan, pinch, rotation);

// First to activate wins, rest fail (swipe vs long-press)
const racing = Gesture.Race(pan, longPress);

// Priority order: first arg wins ties (double-tap beats single-tap)
const exclusive = Gesture.Exclusive(doubleTap, singleTap);

<GestureDetector gesture={composed}>
  <Animated.View />
</GestureDetector>
```

**Key rule:** Pass the composed gesture to a single `GestureDetector`. Do not nest multiple `GestureDetector` components for gestures that should interact -- use composition instead.

See [examples/composition.md](examples/composition.md) for full photo viewer and tap disambiguation patterns.

---

### Pattern 4: Gesture State Machine

Every gesture follows a state machine. Understanding it is critical for debugging gesture conflicts:

```
UNDETERMINED ──> BEGAN ──> ACTIVE ──> END ──> UNDETERMINED
                  │                    │
                  ├──> FAILED ─────────┘
                  │                    │
                  └──> (ACTIVE) ──> CANCELLED ──> UNDETERMINED
```

**Lifecycle callbacks map to states:**

| Callback     | When it fires                                              |
| ------------ | ---------------------------------------------------------- |
| `onBegin`    | UNDETERMINED -> BEGAN (touch detected, not yet recognized) |
| `onStart`    | BEGAN -> ACTIVE (gesture recognized, meets criteria)       |
| `onUpdate`   | While ACTIVE (cumulative: `translationX`, `scale`)         |
| `onChange`   | While ACTIVE (incremental: `changeX`, `changeY`)           |
| `onEnd`      | ACTIVE -> END (finger lifted normally)                     |
| `onFinalize` | Fires for ANY terminal state (END, FAILED, CANCELLED)      |

**`onEnd` vs `onFinalize`:** Use `onEnd` for success-only cleanup (save position). Use `onFinalize` for guaranteed cleanup (reset state regardless of outcome). `onFinalize` receives a second `success` boolean parameter.

See [reference.md](reference.md) for the complete state transition diagram.

---

### Pattern 5: Cross-Component Gesture Relations

When gestures live on different components (parent scroll + child drag), use relation methods:

```typescript
const childPan = Gesture.Pan();
const parentScroll = Gesture.Native(); // Wraps native ScrollView gesture

// Child drag must fail before parent scroll activates
parentScroll.requireExternalGestureToFail(childPan);

// Or: both active simultaneously
childPan.simultaneousWith(parentScroll);

// Or: child blocks parent while active
childPan.blocksExternalGesture(parentScroll);
```

**Key difference from composition:** `Gesture.Simultaneous()` composes gestures on the same component. `.simultaneousWith()` relates gestures across different components in the view hierarchy.

See [examples/composition.md](examples/composition.md) for cross-component patterns.

---

### Pattern 6: ReanimatedSwipeable for List Rows

Use `ReanimatedSwipeable` (not the legacy `Swipeable`) for swipeable list items with smooth 60fps animations.

```typescript
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";

const SWIPE_THRESHOLD = 40;
const OVERSHOOT_FRICTION = 8;

<ReanimatedSwipeable
  friction={2}
  rightThreshold={SWIPE_THRESHOLD}
  overshootFriction={OVERSHOOT_FRICTION}
  renderRightActions={renderRightActions}
  onSwipeableOpen={handleDelete}
>
  <ListItemContent />
</ReanimatedSwipeable>
```

**Why ReanimatedSwipeable over Swipeable:** Rewritten with worklets for native-thread animations. The legacy `Swipeable` animates on JS thread and drops frames during heavy renders.

See [examples/swipeable.md](examples/swipeable.md) for full implementation with action panels and FlatList integration.

---

### Pattern 7: Hover Gesture (Pointer Devices)

Hover gesture detects mouse/stylus/trackpad hovering -- useful for iPad with trackpad, macOS, and web targets. Does not fire on phone touch.

```typescript
const hover = Gesture.Hover()
  .onBegin(() => {
    isHovered.value = true;
  })
  .onEnd(() => {
    isHovered.value = false;
  });
```

**Platform support:** iOS (iPad with trackpad/mouse), macOS, web. Does NOT work on Android touch or iPhone touch. On iOS, the optional `hoverEffect` prop on `GestureDetector` provides system-level visual effects (highlight, lift, automatic).

See [examples/advanced.md](examples/advanced.md) for hover with visual effects.

</patterns>

---

<decision_framework>

## Decision Framework

### Which Gesture Type?

```
What user interaction are you handling?
├─ Drag/move element         → Gesture.Pan()
├─ Single tap                → Gesture.Tap()
├─ Double tap                → Gesture.Tap().numberOfTaps(2)
├─ Long press                → Gesture.LongPress()
├─ Pinch to zoom             → Gesture.Pinch()
├─ Two-finger rotate         → Gesture.Rotation()
├─ Quick directional swipe   → Gesture.Fling()
├─ Mouse/trackpad hover      → Gesture.Hover()
└─ Wrap a native gesture     → Gesture.Native() (for ScrollView, etc.)
```

### Which Composition?

```
How should multiple gestures interact?
├─ All active at once (pan + pinch + rotate in photo viewer)
│   └─ Gesture.Simultaneous(gesture1, gesture2, ...)
├─ First to activate wins (swipe vs long-press on same view)
│   └─ Gesture.Race(gesture1, gesture2, ...)
├─ Priority order (double-tap must beat single-tap)
│   └─ Gesture.Exclusive(highPriority, lowPriority)
└─ Gestures on DIFFERENT components (child drag vs parent scroll)
    ├─ Parent waits for child to fail → parent.requireExternalGestureToFail(child)
    ├─ Both active simultaneously     → child.simultaneousWith(parent)
    └─ Child blocks parent            → child.blocksExternalGesture(parent)
```

### onChange vs onUpdate?

```
How are you using the gesture position data?
├─ Adding to an offset (shared value += delta)
│   └─ Use onChange (provides changeX, changeY)
├─ Setting absolute position from gesture start
│   └─ Use onUpdate (provides translationX, translationY)
└─ Need both (rare)
    └─ Use onChange for offsets + onUpdate for display values
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Missing `GestureHandlerRootView` at app root -- gestures silently fail with no error message
- Using legacy `PanGestureHandler`/`TapGestureHandler` components -- deprecated, use `Gesture.Pan()` + `GestureDetector`
- Using `onUpdate` to add deltas to shared values -- `onUpdate` provides cumulative values, not deltas; use `onChange` for incremental updates
- Nesting multiple `GestureDetector` components for gestures that should compose -- use `Gesture.Simultaneous()`/`Race()`/`Exclusive()` instead
- Using `React.PanResponder` -- replaced entirely by Gesture Handler; PanResponder runs on JS thread and blocks the UI

**Medium Priority Issues:**

- Not specifying `minDistance` on `Gesture.Pan()` when coexisting with tap gestures -- pan activates immediately at 0px, stealing taps
- Missing `onFinalize` cleanup -- `onEnd` only fires on success; cancelled/failed gestures skip it
- Using `Swipeable` instead of `ReanimatedSwipeable` -- legacy component runs animations on JS thread
- Creating new gesture instances inside render (not in useMemo or outside component) -- causes gesture to reset every render

**Gotchas & Edge Cases:**

- `Gesture.Exclusive(doubleTap, singleTap)` -- double-tap MUST be the first argument (higher priority) or it will never fire because single-tap activates first
- Android modals need their own `GestureHandlerRootView` -- gestures in modals fail silently without it
- `onChange` callback is NOT available in the v3 hooks API -- it was removed; use `onUpdate` with the `change*` properties on the event object instead
- Gesture callbacks are automatically workletized when your animation library is installed -- don't manually add `"worklet"` directives unless you need them without the animation library
- `Gesture.Native()` wraps platform-native gestures (ScrollView, FlatList) -- use it when you need to create relations between custom gestures and native scrolling
- `onFinalize` receives `(event, success)` -- the `success` boolean tells you whether the gesture ended normally (END) or was cancelled/failed
- Reusing the same gesture instance across multiple `GestureDetector` components causes undefined behavior -- create separate instances
- iPad trackpad two-finger gestures require `enableTrackpadTwoFingerGesture` on both Pan and `ReanimatedSwipeable`
- `hoverEffect` prop on GestureDetector only works on iOS 17.0+ and provides system-level visual effects
- `Gesture.Fling()` only fires at the end of the fling, not continuously -- use `Gesture.Pan()` if you need continuous position tracking during a swipe

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST wrap the app root in `GestureHandlerRootView` -- gestures will silently fail without it)**

**(You MUST use `GestureDetector` with the builder API (`Gesture.Pan()`, etc.) -- NOT the legacy `PanGestureHandler` components)**

**(You MUST use `onChange` for incremental shared value updates and `onUpdate` for cumulative values -- mixing them causes drift)**

**(You MUST use `Gesture.Simultaneous()` for multi-touch interactions (pinch + pan) -- without it, only one gesture activates)**

**(You MUST NOT nest `GestureDetector` components using different API styles (hooks vs builder) under the same root -- this causes undefined behavior)**

**Failure to follow these rules will cause silent gesture failures, animation drift, and broken multi-touch interactions.**

</critical_reminders>
