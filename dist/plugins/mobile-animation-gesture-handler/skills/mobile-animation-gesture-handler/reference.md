# Gesture Handler Quick Reference

> Decision frameworks, state machine, and gesture type reference. See [SKILL.md](SKILL.md) for philosophy and red flags.

---

## Gesture State Machine

```
                    ┌───────────────── FAILED ──────────────────┐
                    │                                           │
UNDETERMINED ──> BEGAN ──> ACTIVE ──> END ──> UNDETERMINED     │
                                │                               │
                                └──> CANCELLED ─────────────────┘
```

### State Descriptions

| State        | Meaning                                                        |
| ------------ | -------------------------------------------------------------- |
| UNDETERMINED | Initial/reset state -- gesture is idle                         |
| BEGAN        | Touch detected, gathering data (not yet recognized)            |
| ACTIVE       | Gesture recognized and tracking (finger still down)            |
| END          | Gesture completed normally (finger lifted)                     |
| FAILED       | Touch didn't meet gesture criteria (e.g., exceeded maxDist)    |
| CANCELLED    | System cancelled the gesture (another gesture won competition) |

### Common State Flows

```
Success:     UNDETERMINED -> BEGAN -> ACTIVE -> END -> UNDETERMINED
Rejection:   UNDETERMINED -> BEGAN -> FAILED -> UNDETERMINED
Cancellation: UNDETERMINED -> BEGAN -> ACTIVE -> CANCELLED -> UNDETERMINED
```

---

## Lifecycle Callback Reference

| Callback     | State Transition        | Event Data                      | Use Case                    |
| ------------ | ----------------------- | ------------------------------- | --------------------------- |
| `onBegin`    | -> BEGAN                | Touch position (x, y)           | Visual feedback (highlight) |
| `onStart`    | BEGAN -> ACTIVE         | Initial gesture data            | Begin tracking              |
| `onUpdate`   | While ACTIVE            | Cumulative: translationX, scale | Absolute positioning        |
| `onChange`   | While ACTIVE            | Incremental: changeX, changeY   | Offset accumulation         |
| `onEnd`      | ACTIVE -> END           | Velocity, final position        | Success-only cleanup        |
| `onFinalize` | -> END/FAILED/CANCELLED | Event + success boolean         | Guaranteed cleanup          |

**Key distinction:**

- `onEnd` fires ONLY on successful completion (END state)
- `onFinalize` fires on ANY terminal state (END, FAILED, CANCELLED) -- use for cleanup that must always happen

---

## Gesture Type Reference

| Gesture               | Activation Criteria                | Key Config                                  | Event Data                             |
| --------------------- | ---------------------------------- | ------------------------------------------- | -------------------------------------- |
| `Gesture.Pan()`       | Finger moves beyond minDistance    | `minDistance`, `minPointers`, `maxPointers` | translationX/Y, velocityX/Y, changeX/Y |
| `Gesture.Tap()`       | Quick touch within maxDuration     | `numberOfTaps`, `maxDuration`, `maxDelay`   | x, y, absoluteX, absoluteY             |
| `Gesture.LongPress()` | Touch held beyond minDuration      | `minDuration`, `maxDist`                    | x, y, duration                         |
| `Gesture.Pinch()`     | Two fingers move closer/apart      | --                                          | scale, velocity, focalX, focalY        |
| `Gesture.Rotation()`  | Two fingers rotate                 | --                                          | rotation (radians), velocity           |
| `Gesture.Fling()`     | Quick directional swipe            | `direction`, `numberOfPointers`             | x, y (fires only at end)               |
| `Gesture.Hover()`     | Mouse/stylus enters view area      | --                                          | x, y, absoluteX, absoluteY             |
| `Gesture.Native()`    | Wraps platform ScrollView/FlatList | --                                          | Platform-dependent                     |

---

## Composition Quick Reference

| Method                   | Behavior                                     | When to Use                               |
| ------------------------ | -------------------------------------------- | ----------------------------------------- |
| `Gesture.Simultaneous()` | All gestures can be active at the same time  | Pan + pinch + rotate (photo viewer)       |
| `Gesture.Race()`         | First to activate wins, rest fail            | Swipe vs long-press (competing actions)   |
| `Gesture.Exclusive()`    | Priority by argument order (first = highest) | Double-tap vs single-tap (disambiguation) |

### Cross-Component Relations

| Method                             | Direction     | Effect                                    |
| ---------------------------------- | ------------- | ----------------------------------------- |
| `.requireExternalGestureToFail(g)` | One-to-many   | This gesture waits for `g` to fail first  |
| `.simultaneousWith(g)`             | Bidirectional | Both gestures can be active together      |
| `.blocksExternalGesture(g)`        | Many-to-one   | This gesture prevents `g` from activating |

---

## Pan Configuration Cheat Sheet

```typescript
Gesture.Pan()
  .minDistance(10) // Min px before ACTIVE (default: 10 on iOS, varies Android)
  .minPointers(1) // Min simultaneous fingers
  .maxPointers(1) // Max simultaneous fingers (2 for two-finger pan)
  .activeOffsetX([-20, 20]) // Horizontal threshold to activate
  .activeOffsetY([-20, 20]) // Vertical threshold to activate
  .failOffsetX([-50, 50]) // Horizontal offset that causes FAIL
  .failOffsetY([-50, 50]) // Vertical offset that causes FAIL
  .averageTouches(true) // Average multi-finger position
  .enableTrackpadTwoFingerGesture(true); // iPad trackpad support
```

---

## Tap Configuration Cheat Sheet

```typescript
Gesture.Tap()
  .numberOfTaps(2) // Required taps (default: 1)
  .maxDuration(500) // Max ms per tap (default: 500)
  .maxDelay(500) // Max ms between taps (default: 500)
  .maxDistance(10) // Max finger movement between taps
  .minPointers(1); // Min simultaneous fingers per tap
```

---

## ReanimatedSwipeable Props Reference

| Prop                             | Type     | Default | Purpose                                    |
| -------------------------------- | -------- | ------- | ------------------------------------------ |
| `friction`                       | number   | 1       | Drag resistance (higher = slower response) |
| `leftThreshold`                  | number   | half    | Distance to auto-open left panel           |
| `rightThreshold`                 | number   | half    | Distance to auto-open right panel          |
| `overshootLeft`                  | boolean  | true    | Allow pulling past left panel width        |
| `overshootRight`                 | boolean  | true    | Allow pulling past right panel width       |
| `overshootFriction`              | number   | 1       | Resistance during overshoot (try 8+)       |
| `dragOffsetFromLeftEdge`         | number   | 10      | Min drag distance to start left swipe      |
| `dragOffsetFromRightEdge`        | number   | 10      | Min drag distance to start right swipe     |
| `enableTrackpadTwoFingerGesture` | boolean  | false   | iPad trackpad two-finger swiping           |
| `renderLeftActions`              | function | --      | Render left action panel                   |
| `renderRightActions`             | function | --      | Render right action panel                  |
| `onSwipeableOpen`                | callback | --      | Panel fully opened                         |
| `onSwipeableClose`               | callback | --      | Panel fully closed                         |
| `onSwipeableWillOpen`            | callback | --      | Open animation starts                      |
| `onSwipeableWillClose`           | callback | --      | Close animation starts                     |

### Ref Methods

| Method        | Purpose                          |
| ------------- | -------------------------------- |
| `close()`     | Close swipeable programmatically |
| `openLeft()`  | Open left panel                  |
| `openRight()` | Open right panel                 |
| `reset()`     | Reset state without animation    |
