# React Native Performance Reference

> Decision frameworks, checklists, performance targets, and quick reference. See [SKILL.md](SKILL.md) for red flags and anti-patterns.

---

## Performance Targets

| Metric                    | Target  | Acceptable | Action Required                 |
| ------------------------- | ------- | ---------- | ------------------------------- |
| JS thread FPS             | 60      | 55+        | < 50: investigate JS bottleneck |
| UI thread FPS             | 60      | 55+        | < 50: offload to native driver  |
| Cold start time           | < 1.5s  | < 3s       | > 3s: lazy load, defer init     |
| Screen render time        | < 200ms | < 500ms    | > 500ms: profile component tree |
| List scroll FPS           | 60      | 55+        | < 50: FlashList, memoize items  |
| Memory growth             | Stable  | < 5MB/min  | Growing: check for leaks        |
| Bundle size (JS)          | < 3MB   | < 5MB      | > 5MB: analyze dependencies     |
| TTI (Time to Interactive) | < 2s    | < 4s       | > 4s: defer non-critical work   |

---

## Decision Frameworks

### Optimization Decision Tree

```
Is there a measurable performance problem?
|-- NO -> Don't optimize. Ship it.
+-- YES -> Have you profiled in a RELEASE build?
    |-- NO -> Profile first. Dev mode distorts results.
    +-- YES -> What does profiling show?
        |
        |-- JS thread < 55 FPS
        |   |-- During animation -> Offload animation to UI thread
        |   |-- During transition -> InteractionManager.runAfterInteractions
        |   |-- During list scroll -> Memoize renderItem, FlashList
        |   +-- During computation -> useMemo, break into chunks
        |
        |-- UI thread < 55 FPS
        |   |-- Complex shadows/borders -> Simplify, use elevation on Android
        |   |-- Deep view hierarchy -> Flatten nesting
        |   |-- Large images -> Right-size, cache
        |   +-- Off-screen rendering -> Check with Core Animation instrument
        |
        |-- Slow startup (> 3s)
        |   |-- Large bundle -> Named imports, remove unused deps
        |   |-- Heavy init -> Defer with InteractionManager
        |   |-- Many screens -> Lazy load non-critical screens
        |   +-- Hermes disabled -> Enable Hermes (default since 0.70)
        |
        |-- High memory (growing)
        |   |-- After navigation -> Check cleanup in useEffect
        |   |-- During scroll -> Check image sizes, removeClippedSubviews
        |   |-- Over time -> Heap snapshot comparison
        |   +-- Sudden spikes -> Large data processing, use pagination
        |
        +-- Large bundle (> 5MB JS)
            |-- One large dependency -> Find lighter alternative
            |-- Many unused exports -> Named imports, tree shaking
            |-- Platform-irrelevant code -> Use .ios.tsx/.android.tsx files
            +-- Dev-only code in production -> babel-plugin-transform-remove-console
```

### List Component Decision

```
How many items?
|-- < 10 -> ScrollView + map() is fine
|-- 10-50 -> FlashList or FlatList recommended
|-- 50-500 -> FlashList strongly recommended
+-- 500+ -> FlashList v2 required for good performance

On New Architecture (0.76+)?
|-- YES -> FlashList v2 (cell recycling, auto-sizing)
+-- NO -> FlashList v1 or FlatList

Items have fixed height?
|-- YES -> FlatList with getItemLayout (eliminates measurement)
+-- NO -> FlashList v2 (handles dynamic heights automatically)
```

### Memoization Decision (with React Compiler awareness)

```
Is React Compiler enabled?
|-- YES -> Check DevTools for "Memo" badge
|   |-- Badge present -> Don't add manual memoization
|   +-- Badge absent -> Profile first, then consider manual memo
+-- NO -> Is this a list item component?
    |-- YES -> Always: React.memo + useCallback for onPress
    +-- NO -> Does profiling show unnecessary re-renders?
        |-- YES -> Add React.memo to the component
        |   +-- Props include callbacks? -> useCallback in parent
        +-- NO -> Don't memoize (adds complexity without benefit)

Is this an expensive computation?
|-- Runs on every render? -> useMemo with correct deps
|-- Runs once or rarely? -> No memoization needed
+-- Not sure? -> Profile first. If < 1ms, skip memoization.
```

### Animation Thread Decision

```
What type of animation?
|-- Simple opacity/transform -> Animated with useNativeDriver: true
|-- Layout change -> LayoutAnimation (bypasses JS thread entirely)
|-- Gesture-driven -> Animation library worklets (UI thread)
|-- Complex sequence -> Animation library (UI thread execution)
+-- Layout properties (width, height) -> JS thread (useNativeDriver not supported)
```

---

## Performance Checklist

### Before Release

- [ ] All performance testing done in RELEASE build (not dev)
- [ ] No `console.log` in production (use `babel-plugin-transform-remove-console`)
- [ ] FlatList/FlashList renderItem wrapped in useCallback
- [ ] List item components wrapped in React.memo (unless React Compiler is active)
- [ ] No inline styles in frequently re-rendering components
- [ ] Animations use useNativeDriver where possible
- [ ] Heavy initialization deferred with InteractionManager
- [ ] No memory leaks (useEffect cleanup for timers, subscriptions, async)

### List Performance

- [ ] Using FlashList or FlatList (not ScrollView + map) for 20+ items
- [ ] renderItem wrapped in useCallback with minimal dependencies
- [ ] Item components wrapped in React.memo
- [ ] keyExtractor returns stable unique ID (not array index)
- [ ] getItemLayout provided for fixed-height FlatList items
- [ ] windowSize, maxToRenderPerBatch, initialNumToRender tuned
- [ ] removeClippedSubviews gated to Android only
- [ ] No `key` prop on FlashList items (breaks recycling)
- [ ] getItemType provided for heterogeneous FlashList lists

### Image Performance

- [ ] Images sized to display dimensions (not source dimensions)
- [ ] PixelRatio considered for CDN image requests
- [ ] Critical images preloaded before needed
- [ ] Optimized image library used for image-heavy screens
- [ ] resizeMode set appropriately (cover, contain, center)
- [ ] Placeholder/loading states for network images

### Memory

- [ ] All useEffect hooks have cleanup functions
- [ ] Timers (setInterval, setTimeout) cleared on unmount
- [ ] Event listeners removed on unmount
- [ ] Async operations guarded against unmounted state updates
- [ ] Large data sets paginated (not loaded all at once)
- [ ] Heap snapshot comparison shows no leak growth

### Startup Time

- [ ] Hermes enabled (default since 0.70)
- [ ] Non-critical screens lazy-loaded
- [ ] Heavy initialization deferred with InteractionManager
- [ ] Named imports used (not namespace imports)
- [ ] Unused dependencies removed
- [ ] Bundle size analyzed and within targets

---

## Profiling Tools Quick Reference

| Tool                             | What It Shows                            | When to Use                     |
| -------------------------------- | ---------------------------------------- | ------------------------------- |
| React Native DevTools Profiler   | Component render times, re-render counts | Diagnosing re-render issues     |
| Perf Monitor (Dev Menu)          | Real-time JS/UI thread FPS               | Quick check during development  |
| Hermes CPU Profile               | Function-level CPU time                  | Identifying expensive functions |
| Xcode Instruments                | Native CPU, memory, GPU, energy          | iOS-specific deep profiling     |
| Android Studio Profiler          | Native CPU, memory, network              | Android-specific deep profiling |
| react-native-bundle-visualizer   | Bundle composition treemap               | Reducing bundle size            |
| Heap Snapshots (DevTools Memory) | Object retention, memory leaks           | Diagnosing memory growth        |
| Core Animation (Xcode)           | Blended layers, offscreen rendering      | iOS GPU optimization            |
| systrace (Android)               | Low-level frame analysis                 | Android frame drop analysis     |

---

## Frame Budget Reference

```
60 FPS = 16.67ms per frame

Each frame must complete within budget on BOTH threads:

JS Thread (16.67ms budget):
├── React reconciliation (diffing)
├── State updates and effects
├── Event handlers
├── API calls (scheduling, not waiting)
└── Bridge communication (legacy) / JSI calls (new arch)

UI Thread (16.67ms budget):
├── Layout calculation
├── View rendering
├── Native animations
├── Touch event handling
└── Scroll handling
```

---

## Quick Performance Wins

| Problem                   | Quick Fix                                   | Impact |
| ------------------------- | ------------------------------------------- | ------ |
| Jank during navigation    | `InteractionManager.runAfterInteractions()` | High   |
| Slow FlatList scrolling   | `getItemLayout` for fixed-height items      | High   |
| List items all re-render  | `React.memo` + `useCallback` for renderItem | High   |
| Slow startup              | `lazy()` for non-critical screens           | Medium |
| Large bundle              | Named imports + remove unused deps          | Medium |
| Console.log in production | `babel-plugin-transform-remove-console`     | Medium |
| Image jank in lists       | Right-size + preload + caching library      | Medium |
| Sluggish touch response   | `requestAnimationFrame(() => heavyWork())`  | Low    |
| Inline styles in lists    | `StyleSheet.create` + style arrays          | Low    |
