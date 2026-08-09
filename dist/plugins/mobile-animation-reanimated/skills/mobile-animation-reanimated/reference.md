# Reanimated Quick Reference

> Decision frameworks, migration guide, and API quick reference. See [SKILL.md](SKILL.md) for red flags and patterns.

---

## Decision Framework

### Which Animation Function?

```
What drives the animation?
|
+-> State change (boolean toggle, prop change)?
|   +-> Simple transition? -> CSS transitions (Reanimated 4) or withTiming
|   +-> Need spring feel? -> withSpring
|   +-> Complex keyframes? -> CSS animations (Reanimated 4) or withSequence
|
+-> User gesture (drag, swipe, pinch)?
|   +-> During gesture? -> Direct shared value update in gesture callback
|   +-> After gesture release? -> withDecay (momentum) or withSpring (snap back)
|
+-> Scroll position?
|   +-> useScrollOffset + interpolate in useAnimatedStyle
|
+-> Component mount/unmount?
    +-> Predefined? -> entering={FadeIn} exiting={FadeOut}
    +-> Custom? -> entering={customFn} with 'worklet' directive
```

### CSS Animations vs Worklets

```
Which API to use?
|
+-> State-driven (toggle, prop change)?
|   +-> CSS transitions/animations (less code, better optimizable)
|
+-> Gesture-driven (drag, swipe)?
|   +-> Worklet API (shared values + gesture callbacks)
|
+-> Scroll-driven (parallax, collapse)?
|   +-> Worklet API (useScrollOffset + interpolate)
|
+-> Frame-by-frame control needed?
|   +-> Worklet API (full control)
|
+-> Mixed?
    +-> Both work simultaneously -- use CSS for simple parts, worklets for complex
```

### withSpring Configuration

```
What kind of spring behavior?
|
+-> Need precise timing control?
|   +-> Duration-based: { duration: 500, dampingRatio: 0.8 }
|   +-> dampingRatio < 1 = bouncy, 1 = no overshoot, > 1 = overdamped
|
+-> Need natural physics feel?
|   +-> Physics-based: { damping: 100, stiffness: 800 }
|   +-> Lower damping = more bouncy, higher stiffness = snappier
|
+-> Need to prevent overshoot?
|   +-> Add overshootClamping: true
|   +-> Or use clamp: { min: 0, max: 200 }
|
+-> Don't mix physics-based and duration-based params
```

---

## Migration from 3.x to 4.x

### Dependency Changes

| Step         | 3.x                              | 4.x                                                 |
| ------------ | -------------------------------- | --------------------------------------------------- |
| Install      | `react-native-reanimated`        | `react-native-reanimated` + `react-native-worklets` |
| Babel plugin | `react-native-reanimated/plugin` | `react-native-worklets/plugin` (must be last)       |
| Architecture | Both old and new                 | New Architecture only                               |

### API Renames

| 3.x                                 | 4.x                                | Package                   |
| ----------------------------------- | ---------------------------------- | ------------------------- |
| `runOnJS(fn)("arg")`                | `scheduleOnRN(fn, "arg")`          | `react-native-worklets`   |
| `runOnUI(fn)("arg")`                | `scheduleOnUI(fn, "arg")`          | `react-native-worklets`   |
| `executeOnUIRuntimeSync(fn)("arg")` | `runOnUISync(fn, "arg")`           | `react-native-worklets`   |
| `runOnRuntime(rt, fn)("arg")`       | `scheduleOnRuntime(rt, fn, "arg")` | `react-native-worklets`   |
| `useScrollViewOffset`               | `useScrollOffset`                  | `react-native-reanimated` |

### Removed APIs

| Removed                     | Replacement                                  |
| --------------------------- | -------------------------------------------- |
| `useWorkletCallback`        | `useCallback` + `'worklet'` directive        |
| `useAnimatedGestureHandler` | Gesture Handler 2 `Gesture` API              |
| `combineTransition`         | `EntryExitTransition.entering(X).exiting(Y)` |
| `addWhitelistedNativeProps` | Remove (no-op in v4)                         |
| `addWhitelistedUIProps`     | Remove (no-op in v4)                         |
| `restDisplacementThreshold` | `energyThreshold` (or just remove)           |
| `restSpeedThreshold`        | `energyThreshold` (or just remove)           |

### withSpring Duration Change

Actual completion time = perceptual `duration` x 1.5. To get equivalent timing from v3, divide duration by 1.5.

---

## API Quick Reference

### Core Hooks

| Hook                            | Purpose                                        |
| ------------------------------- | ---------------------------------------------- |
| `useSharedValue(initial)`       | Create reactive value on UI thread             |
| `useAnimatedStyle(() => style)` | Derive animated styles from shared values      |
| `useAnimatedRef()`              | Create ref for scroll offset tracking          |
| `useScrollOffset(ref)`          | Track scroll position as shared value          |
| `useDerivedValue(() => expr)`   | Compute derived value from shared values       |
| `useAnimatedProps(() => props)` | Animate non-style props (e.g., SVG attributes) |

### Animation Functions

| Function                 | Purpose        | Key Config                                         |
| ------------------------ | -------------- | -------------------------------------------------- |
| `withTiming(to, config)` | Duration-based | `duration`, `easing`                               |
| `withSpring(to, config)` | Physics spring | `damping`/`stiffness` or `duration`/`dampingRatio` |
| `withDecay(config)`      | Momentum       | `velocity`, `clamp`, `rubberBandEffect`            |

### Modifiers

| Modifier                                | Purpose                 |
| --------------------------------------- | ----------------------- |
| `withDelay(ms, animation)`              | Delay before starting   |
| `withSequence(...animations)`           | Run animations in order |
| `withRepeat(animation, count, reverse)` | Repeat animation        |
| `withClamp({ min, max }, animation)`    | Clamp output range      |
| `cancelAnimation(sharedValue)`          | Stop running animation  |

### Extrapolation

| Type                     | Behavior                     |
| ------------------------ | ---------------------------- |
| `Extrapolation.CLAMP`    | Cap at output range edges    |
| `Extrapolation.EXTEND`   | Extend linearly beyond range |
| `Extrapolation.IDENTITY` | Return raw input value       |

### Layout Animation Modifiers

| Modifier                                     | Purpose                             |
| -------------------------------------------- | ----------------------------------- |
| `.duration(ms)`                              | Set animation length                |
| `.delay(ms)`                                 | Postpone start                      |
| `.springify()`                               | Use spring physics                  |
| `.damping(n)` / `.stiffness(n)` / `.mass(n)` | Spring config (after springify)     |
| `.withInitialValues(style)`                  | Override starting values            |
| `.withCallback(fn)`                          | Execute on completion               |
| `.reduceMotion(mode)`                        | Respect accessibility               |
| `.randomDelay()`                             | Random delay (0 to specified delay) |

### Animated Components

| Built-in              | Custom                                        |
| --------------------- | --------------------------------------------- |
| `Animated.View`       | `Animated.createAnimatedComponent(Component)` |
| `Animated.Text`       | (call at module level, not in render)         |
| `Animated.ScrollView` |                                               |
| `Animated.Image`      |                                               |
| `Animated.FlatList`   |                                               |
