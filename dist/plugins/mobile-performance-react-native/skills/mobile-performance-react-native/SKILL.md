---
name: mobile-performance-react-native
description: React Native performance profiling, optimization, and monitoring - JS/UI thread analysis, re-render prevention, list optimization, image performance, bundle size, startup time, memory leaks, React Compiler, New Architecture benefits
---

# React Native Performance Patterns

> **Quick Guide:** Profile before optimizing -- use React Native DevTools Profiler (replaces Flipper since 0.76) and platform profilers to find actual bottlenecks. Target 60 FPS (16.67ms per frame). Understand JS thread vs UI thread: animations on the UI thread, business logic on JS. Use React.memo + useCallback for list items, FlashList for large lists, InteractionManager to defer heavy work during transitions. React Compiler (v1.0+) auto-memoizes most components -- verify before adding manual memoization. Always test in release builds; dev mode adds significant overhead.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST profile BEFORE optimizing -- use React Native DevTools Profiler or platform tools to identify actual bottlenecks, never optimize blindly)**

**(You MUST test performance in RELEASE builds -- dev mode adds significant overhead that masks real performance characteristics)**

**(You MUST understand the JS thread vs UI thread distinction -- animations belong on the UI thread, heavy computation must be deferred with InteractionManager)**

**(You MUST memoize renderItem callbacks and item components for FlashList/FlatList -- inline functions break virtualization performance)**

**(You MUST check if React Compiler is enabled before adding manual useMemo/useCallback/React.memo -- the compiler auto-memoizes and manual hints become redundant)**

</critical_requirements>

---

**Auto-detection:** React Native performance, FPS, frame rate, JS thread, UI thread, re-render, React.memo, useMemo, useCallback, FlashList optimization, FlatList optimization, InteractionManager, requestAnimationFrame, Hermes, bytecode, bundle size, Metro, tree shaking, startup time, memory leak, heap snapshot, React Compiler, auto-memoization, react-native-performance, Flipper profiler, React Native DevTools, Perf Monitor, useNativeDriver, LayoutAnimation, Reanimated worklet

**When to use:**

- Diagnosing dropped frames, jank, or slow transitions
- Optimizing list scrolling performance (FlashList/FlatList)
- Reducing re-renders in component trees
- Profiling JS thread vs UI thread bottlenecks
- Reducing app startup time or bundle size
- Detecting and fixing memory leaks
- Deciding whether to add manual memoization vs relying on React Compiler
- Monitoring performance in production

**When NOT to use:**

- General React Native component architecture (use the framework skill)
- Navigation setup and patterns (use the framework skill)
- Styling and theming patterns (use the framework skill)
- Animation API patterns (use the animation skill)

**Key patterns covered:**

- JS thread vs UI thread mental model and frame budget
- Profiling with React Native DevTools, platform profilers, and Hermes profiles
- Re-render optimization (React.memo, useCallback, useMemo, React Compiler)
- List optimization (FlashList cell recycling, FlatList tuning, memoized items)
- Image optimization (sizing, caching, preloading, placeholder strategies)
- Bundle size reduction (tree shaking, named imports, code splitting)
- Startup time optimization (Hermes bytecode, lazy loading, deferred work)
- Memory leak detection and prevention
- Production performance monitoring

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Re-render optimization, list performance, deferred work
- [examples/profiling.md](examples/profiling.md) - Profiling tools, memory analysis, production monitoring
- [reference.md](reference.md) - Decision frameworks, performance checklists, targets

---

<philosophy>

## Philosophy

React Native performance optimization follows one principle: **measure first, optimize second**. Most performance issues stem from a small number of root causes -- unnecessary re-renders, JS thread congestion during animations, unoptimized lists, and memory leaks. Profiling identifies which of these is the actual problem.

**The threading model is key:**

- **JS Thread** -- Runs your React code, business logic, API calls, event handlers. When overloaded, UI updates are delayed and animations stutter.
- **UI Thread (Main Thread)** -- Renders native views, handles touch events, runs native animations. Must stay free for smooth 60 FPS.
- **Background Threads** -- Hermes GC, image decoding, network. These don't directly block the UI.

**Frame budget: 16.67ms.** Every frame must complete within this budget on both threads. A single dropped frame is perceptible; consistent drops create jank.

**The optimization hierarchy:**

1. **Architecture** -- New Architecture (Fabric + JSI) provides foundational performance gains. Enable it first.
2. **Algorithmic** -- Reduce work: fewer re-renders, smaller lists, deferred computation.
3. **Memoization** -- React Compiler handles most cases automatically. Add manual memoization only where profiling shows it helps.
4. **Native offloading** -- Move animations to the UI thread (useNativeDriver, animation library worklets), defer heavy work with InteractionManager.

**React Compiler changes the game:**

React Compiler (v1.0, stable since October 2025) auto-memoizes components, hooks, and values at build time. With React Compiler enabled, manual `useMemo`, `useCallback`, and `React.memo` are largely unnecessary. Check your project setup before adding manual memoization -- it may already be handled.

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: JS Thread vs UI Thread Optimization

The most common performance issue is JS thread congestion during animations or transitions. When the JS thread is busy, native animations keep running (they're on the UI thread), but React updates stall.

```typescript
import { InteractionManager } from "react-native";

// Defer heavy work until after navigation transition completes
function ScreenWithDeferredLoad() {
  const [data, setData] = useState<Item[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      const result = expensiveComputation();
      setData(result);
      setIsReady(true);
    });
    return () => task.cancel();
  }, []);

  if (!isReady) return <LoadingPlaceholder />;
  return <ItemList data={data} />;
}
```

**Why good:** InteractionManager waits until animations/transitions finish before running heavy work, keeping transitions smooth at 60 FPS

```typescript
// BAD: Heavy computation runs immediately, blocking transition
function BadScreen() {
  const data = expensiveComputation(); // Blocks JS thread during navigation
  return <ItemList data={data} />;
}
```

**Why bad:** Synchronous heavy work during mount blocks the JS thread, causing the navigation animation to stutter or freeze

See [examples/core.md](examples/core.md) for requestAnimationFrame patterns and touch response optimization.

---

### Pattern 2: Re-Render Prevention

Unnecessary re-renders are the most common React Native performance problem. Profile first to find which components re-render unnecessarily, then apply targeted fixes.

```typescript
import { memo, useCallback } from "react";

// Memoized list item -- only re-renders when props change
const ProductItem = memo(function ProductItem({
  item,
  onPress,
}: ProductItemProps) {
  const handlePress = useCallback(() => {
    onPress(item.id);
  }, [item.id, onPress]);

  return (
    <Pressable onPress={handlePress}>
      <Text>{item.name}</Text>
    </Pressable>
  );
});
```

**Why good:** memo prevents re-renders when parent re-renders but item props haven't changed, useCallback gives a stable function reference

```typescript
// BAD: Inline function creates new reference every render
<FlatList
  renderItem={({ item }) => (
    <Pressable onPress={() => handlePress(item.id)}>
      <Text>{item.name}</Text>
    </Pressable>
  )}
/>
```

**Why bad:** New function reference on every render defeats FlatList's recycling optimization, every item re-renders on any parent state change

**React Compiler note:** If React Compiler is enabled (check your Babel config for `babel-plugin-react-compiler`), it auto-memoizes components and callbacks. Verify with the "Memo" badge in React DevTools before adding manual `memo`/`useCallback`.

See [examples/core.md](examples/core.md) for full re-render optimization patterns with custom comparators.

---

### Pattern 3: List Performance (FlashList and FlatList)

Lists are the primary performance concern in mobile apps. FlashList uses cell recycling (reuses component instances) while FlatList uses virtualization (creates/destroys). Key rules: memoize renderItem, never add `key` props to FlashList items, use `getItemType` for heterogeneous lists.

```typescript
const ITEM_HEIGHT = 80;

// Stable renderItem with useCallback
const renderItem = useCallback(
  ({ item }: { item: Product }) => (
    <ProductItem item={item} onPress={onProductPress} />
  ),
  [onProductPress],
);

<FlashList
  data={products}
  renderItem={renderItem}
  estimatedItemSize={ITEM_HEIGHT}
  getItemType={(item) => item.category}
/>
```

**Why good:** useCallback gives stable renderItem reference, getItemType optimizes recycling pools, estimatedItemSize helps initial render (optional in FlashList v2)

See [examples/core.md](examples/core.md) for FlatList tuning props (windowSize, maxToRenderPerBatch), SectionList optimization, and anti-patterns.

---

### Pattern 4: Image Optimization

Images are a common source of jank and memory pressure. Key principles: size images appropriately (don't load 4K for thumbnails), use caching, preload critical images, and use placeholders.

```typescript
// Key principles for image performance
const THUMBNAIL_SIZE = 80;

// Size images to their display size, not source size
<Image
  source={{ uri: thumbnailUrl }}
  style={{ width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE }}
  resizeMode="cover"
/>

// Preload critical images before they're needed
Image.prefetch(heroImageUrl);

// For image-heavy apps, use an optimized image library
// that provides: disk/memory caching, blur placeholders,
// priority loading, progressive rendering
```

**Key decisions:** Use the built-in `Image` for simple cases. For image-heavy apps (feeds, galleries, e-commerce), adopt an optimized image library that provides caching, placeholders, and priority loading.

See [examples/core.md](examples/core.md) for image sizing strategies and placeholder patterns.

---

### Pattern 5: Bundle Size Reduction

Smaller bundles mean faster downloads and faster Hermes bytecode compilation. Key strategies: use named imports, audit dependencies, enable tree shaking.

```typescript
// GOOD: Named import -- tree-shakeable
import { format } from "date-fns";

// BAD: Namespace import pulls in entire library
import * as dateFns from "date-fns";

// GOOD: Platform-specific imports reduce per-platform bundle
// component.ios.tsx -- iOS-only code
// component.android.tsx -- Android-only code
```

**Key strategies:**

- Use named imports for tree-shakeable libraries
- Audit dependencies with `npx react-native-bundle-visualizer`
- Remove unused dependencies and dev-only code
- Use platform-specific files (`.ios.tsx`/`.android.tsx`) to avoid shipping platform-irrelevant code
- Consider `babel-plugin-transform-remove-console` for production

See [examples/profiling.md](examples/profiling.md) for bundle analysis tools and strategies.

---

### Pattern 6: Startup Time Optimization

App startup is the first impression. Hermes compiles JS to bytecode at build time (avoiding JIT at runtime). Beyond Hermes: lazy-load non-critical screens, defer initialization, minimize synchronous work in the root component.

```typescript
import { lazy, Suspense } from "react";

// Lazy-load heavy screens that aren't needed immediately
const AnalyticsScreen = lazy(() => import("./screens/analytics"));
const SettingsScreen = lazy(() => import("./screens/settings"));

// Defer non-critical initialization
useEffect(() => {
  const task = InteractionManager.runAfterInteractions(() => {
    initializeAnalytics();
    prefetchUserData();
  });
  return () => task.cancel();
}, []);
```

**Why good:** Lazy loading splits the bundle so non-critical screens don't block initial render, InteractionManager defers initialization until the UI is interactive

**Hermes optimization:** Hermes is enabled by default and compiles JS to bytecode at build time. No configuration needed. For further startup gains, minimize synchronous require() calls and avoid heavy top-level module initialization.

---

### Pattern 7: Memory Leak Prevention

Memory leaks in React Native cause gradual performance degradation and eventual crashes. The most common sources: uncleared timers, uncanceled subscriptions, and stale closures in async operations.

```typescript
// GOOD: Cleanup all subscriptions and timers
useEffect(() => {
  const subscription = eventEmitter.addListener("update", handleUpdate);
  const timer = setInterval(pollData, POLL_INTERVAL_MS);

  return () => {
    subscription.remove();
    clearInterval(timer);
  };
}, []);

// GOOD: Cancel async operations on unmount
useEffect(() => {
  let isMounted = true;

  async function fetchData() {
    const result = await api.getData();
    if (isMounted) setData(result);
  }

  fetchData();
  return () => {
    isMounted = false;
  };
}, []);
```

**Why good:** Cleanup functions prevent subscriptions from accumulating, isMounted flag prevents state updates on unmounted components

```typescript
// BAD: Timer never cleared
useEffect(() => {
  setInterval(pollData, POLL_INTERVAL_MS); // Leaks on unmount
}, []);

// BAD: Event listener never removed
useEffect(() => {
  eventEmitter.addListener("update", handleUpdate); // Accumulates listeners
}, []);
```

**Why bad:** Each mount creates a new timer/listener without removing the old one, memory grows unbounded as components mount and unmount

See [examples/profiling.md](examples/profiling.md) for heap snapshot analysis and memory profiling techniques.

---

### Pattern 8: React Compiler (Auto-Memoization)

React Compiler (v1.0, October 2025) eliminates most manual memoization. It analyzes your code at build time and automatically inserts the equivalent of `memo`, `useMemo`, and `useCallback` where beneficial. Available in React Native 0.78+ (React 19).

```typescript
// With React Compiler enabled, this component is auto-memoized.
// No need for React.memo wrapper.
function ProductCard({ product, onPress }: ProductCardProps) {
  // No need for useCallback -- compiler auto-memoizes
  const handlePress = () => onPress(product.id);

  // No need for useMemo -- compiler auto-memoizes
  const formattedPrice = formatCurrency(product.price);

  return (
    <Pressable onPress={handlePress}>
      <Text>{product.name}</Text>
      <Text>{formattedPrice}</Text>
    </Pressable>
  );
}
```

**Why good:** Cleaner code with identical performance to manually memoized version, compiler optimizes more consistently than humans

**How to verify:** Open React DevTools Components panel. Components optimized by the compiler show a "Memo" badge. If you see it, manual memoization is redundant for that component.

**When manual memoization is still needed:**

- Components/hooks the compiler can't analyze (complex dynamic patterns)
- Libraries that haven't been compiled (third-party components)
- Performance-critical paths where you've profiled and confirmed the compiler missed an optimization

</patterns>

---

<decision_framework>

## Decision Framework

### Should I Optimize This?

```
Is there a measurable performance problem?
|-- NO -> Don't optimize. Premature optimization wastes time.
+-- YES -> Have you profiled to identify the root cause?
    |-- NO -> Profile first (React Native DevTools Profiler, Perf Monitor)
    +-- YES -> What is the bottleneck?
        |-- JS thread congested -> Defer work (InteractionManager), reduce re-renders
        |-- UI thread dropping frames -> Offload to native (useNativeDriver, worklets)
        |-- List scrolling jank -> FlashList, memoize renderItem, getItemType
        |-- Slow startup -> Lazy load screens, defer initialization
        |-- High memory usage -> Check for leaks (heap snapshots)
        +-- Large bundle -> Named imports, tree shaking, bundle visualization
```

### Manual Memoization Decision

```
Is React Compiler enabled in your project?
|-- YES -> Does the component show "Memo" badge in DevTools?
|   |-- YES -> Manual memoization is redundant. Don't add it.
|   +-- NO -> Is this a third-party component or complex dynamic pattern?
|       |-- YES -> Manual memo/useCallback may be needed. Profile first.
|       +-- NO -> The compiler should handle it. File a bug if it doesn't.
+-- NO -> Is this component in a list (renderItem)?
    |-- YES -> Always React.memo + useCallback
    +-- NO -> Does profiling show unnecessary re-renders?
        |-- YES -> Add React.memo, useCallback for callback props
        +-- NO -> Don't memoize. It adds complexity without benefit.
```

### Animation Performance Decision

```
What type of animation?
|-- Layout change (appear/disappear) -> LayoutAnimation (Core Animation, bypasses JS)
|-- Simple transform/opacity -> Animated API with useNativeDriver: true
|-- Gesture-driven -> Use your animation library's worklet-based API (runs on UI thread)
+-- Complex multi-step -> Use your animation library for UI thread execution
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Optimizing without profiling first -- you're guessing, not solving. Profile to identify the actual bottleneck.
- Testing performance in dev mode -- dev mode adds significant overhead (console logging, error checking, hot reload). Always benchmark in release builds.
- Inline functions in FlatList/FlashList renderItem -- creates new function reference every render, defeats recycling/virtualization.
- Adding `key` props to FlashList items -- breaks cell recycling, the core performance advantage of FlashList.
- Running heavy computation synchronously during screen transitions -- blocks the JS thread, causes transition jank.
- Using `console.log` in production bundles -- causes JS thread bottlenecks. Use `babel-plugin-transform-remove-console`.

**Medium Priority Issues:**

- Adding manual useMemo/useCallback everywhere without profiling -- adds code complexity, may be redundant with React Compiler.
- Using ScrollView + map() for lists with 50+ items -- no virtualization, all items rendered in memory simultaneously.
- Inline style objects in frequently re-rendering components -- creates new object reference every render.
- Not providing getItemLayout for fixed-height FlatList items -- forces measurement on every scroll, missing a significant optimization.
- Namespace imports (`import * as`) for large libraries -- prevents tree shaking, inflates bundle.

**Gotchas & Edge Cases:**

- `removeClippedSubviews` helps memory on Android but can cause blank areas on iOS -- use `Platform.OS === "android"` guard.
- `useNativeDriver: true` only supports non-layout properties (transform, opacity) -- width, height, padding animations must run on JS thread.
- FlatList `onEndReached` fires immediately if initial data fits the screen -- set `onEndReachedThreshold` carefully and guard against duplicate calls.
- Hermes heap snapshots show retained objects including JS engine internals -- filter for your app's classes/closures when analyzing.
- React Compiler cannot optimize components that use `arguments`, `eval`, or non-standard patterns -- these fall back to uncompiled behavior.
- LayoutAnimation affects ALL layout changes in the next cycle, not just the one you intended -- scope it carefully or use the Animated API for targeted animations.
- `InteractionManager.runAfterInteractions` tasks are canceled if the component unmounts -- always clean up with `task.cancel()` in useEffect return.
- FlashList v2 requires New Architecture -- use FlashList v1 or FlatList if on legacy architecture.
- Dev mode "Perf Monitor" shows in-app FPS but includes dev overhead -- only trust release build measurements.

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST profile BEFORE optimizing -- use React Native DevTools Profiler or platform tools to identify actual bottlenecks, never optimize blindly)**

**(You MUST test performance in RELEASE builds -- dev mode adds significant overhead that masks real performance characteristics)**

**(You MUST understand the JS thread vs UI thread distinction -- animations belong on the UI thread, heavy computation must be deferred with InteractionManager)**

**(You MUST memoize renderItem callbacks and item components for FlashList/FlatList -- inline functions break virtualization performance)**

**(You MUST check if React Compiler is enabled before adding manual useMemo/useCallback/React.memo -- the compiler auto-memoizes and manual hints become redundant)**

**Failure to follow these rules will result in blind optimization that misses real bottlenecks, jank during transitions, and unnecessary code complexity.**

</critical_reminders>
