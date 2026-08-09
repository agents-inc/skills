# React Native Performance - Profiling & Monitoring

> Profiling tools, memory analysis, bundle inspection, and production monitoring. See [core.md](core.md) for optimization patterns. See [SKILL.md](../SKILL.md) for decision frameworks.

**Prerequisites**: Understand React Native's threading model (JS thread vs UI thread) and basics of profiling tools.

---

## Pattern 1: React Native DevTools Profiler

React Native DevTools (default since 0.76) replaces Flipper for JavaScript-level profiling. It includes React Profiler for component render analysis and Performance panel for JS execution traces.

### Launching DevTools

```bash
# DevTools opens automatically when running Metro
npx react-native start

# Or open manually via the Dev Menu:
# Shake device / Cmd+D (iOS) / Cmd+M (Android emulator)
# Select "Open DevTools"
```

### React Profiler Workflow

1. **Open the Profiler tab** in React Native DevTools
2. **Click Record** and interact with the feature you want to profile
3. **Click Stop** to analyze the recording
4. **Read the flame graph** -- taller bars = more render time, gray bars = components that didn't re-render

**Key metrics to look for:**

| Metric                          | Target            | Action if exceeded                    |
| ------------------------------- | ----------------- | ------------------------------------- |
| Component render time           | < 16ms            | Memoize, simplify, or split component |
| Re-render count per interaction | Minimal           | Add React.memo, check prop stability  |
| Commit frequency                | 1 per interaction | Check for cascading state updates     |

### Highlight Re-Renders

```
Settings (gear icon) -> Check "Highlight updates when components render"
```

Components that re-render flash with colored borders. If the entire screen flashes when a single input changes, you have a re-render propagation problem.

---

## Pattern 2: Performance Monitor (In-App FPS)

The built-in Perf Monitor shows real-time FPS for both JS and UI threads.

```
# Enable via Dev Menu:
Shake device -> "Show Perf Monitor"

# Or programmatically in development:
if (__DEV__) {
  // The perf monitor overlay appears showing:
  // - JS thread FPS (target: 60)
  // - UI thread FPS (target: 60)
  // - RAM usage
  // - Views count
}
```

**Reading the Perf Monitor:**

| Indicator       | Meaning                   | Action                                    |
| --------------- | ------------------------- | ----------------------------------------- |
| JS FPS < 55     | JS thread congested       | Defer work, reduce re-renders             |
| UI FPS < 55     | UI thread congested       | Offload to native driver, simplify layout |
| Both low        | General overload          | Profile to find root cause                |
| JS low, UI fine | Computation bottleneck    | InteractionManager, useMemo, workers      |
| JS fine, UI low | Layout/drawing bottleneck | Simplify views, reduce nesting            |

**Warning:** Perf Monitor shows dev-mode FPS which includes dev overhead. Only trust release build measurements for accurate profiling.

---

## Pattern 3: Hermes CPU Profiling

Hermes profiles show exactly which functions consume CPU time. Use this to identify expensive functions and hot code paths.

### Recording a Hermes Profile

```
# Via Dev Menu:
Shake device -> "Start/Stop Sampling Profiler"

# The profile is saved to a file on device.
# Pull it and open in Chrome DevTools (chrome://tracing)
# or in React Native DevTools Performance panel (0.83+)
```

### What to Look For

```
Recording workflow:
1. Start profile
2. Reproduce the slow interaction
3. Stop profile
4. Analyze in chrome://tracing or DevTools Performance panel

Key observations:
- Functions consuming > 10% of total time -> optimize or defer
- Long synchronous blocks on JS thread -> break into chunks
- Frequent GC pauses -> check for excessive object allocation
- Bridge calls (legacy arch) -> consider JSI migration
```

**Hermes-specific considerations:**

- Hermes compiles JS to bytecode at build time -- startup is fast but some runtime optimizations differ from V8/JSC
- Hermes GC is incremental and concurrent -- large allocations still cause pauses
- Profile in release mode for accurate timings (dev mode adds instrumentation)

---

## Pattern 4: Platform-Specific Profilers

### iOS: Xcode Instruments

```
Xcode -> Product -> Profile (Cmd+I)

Key instruments for React Native:
- Time Profiler: CPU usage by function (covers both native and JS)
- Allocations: Memory allocation patterns, leak detection
- Core Animation (Graphics): FPS, GPU utilization, off-screen rendering
- Network: Network request timing and size
- Energy Log: Battery impact of background operations
```

**Core Animation instrument checklist:**

- [ ] Color Blended Layers -- red areas = expensive alpha compositing (fix: opaque backgrounds)
- [ ] Color Off-screen Rendered -- yellow areas = offscreen rendering (fix: reduce shadows, masks, corner radius)
- [ ] Hit Testing -- verify touch targets are efficient

### Android: Android Studio Profiler

```
Android Studio -> View -> Tool Windows -> Profiler

Key profiler views:
- CPU: Method traces, flame charts, thread activity
- Memory: Heap dump, allocation tracking, GC events
- Network: Request timeline with payload sizes
- Energy: Wake locks, alarms, battery drain

Connect to running app:
1. Run app in debug mode
2. Open Profiler in Android Studio
3. Select your app process
4. Record the specific interaction
```

**Android-specific tips:**

- Use systrace for low-level frame analysis: `npx react-native systrace`
- Check GPU rendering with "Profile HWUI Rendering" in Developer Options
- Green bars = within 16ms budget, red bars = dropped frames

---

## Pattern 5: Memory Leak Detection

### Heap Snapshot Workflow

Use React Native DevTools Memory panel (0.83+) or Chrome DevTools to capture heap snapshots.

```
Heap snapshot workflow:
1. Navigate to the suspect screen
2. Take Snapshot A (baseline)
3. Perform the action (navigate away and back, open/close modal, etc.)
4. Force garbage collection (click the trash icon in DevTools)
5. Take Snapshot B
6. Compare A and B -- look for objects that should have been freed

Common leak indicators:
- Growing "Detached" DOM nodes (Fiber nodes in RN)
- Event listener count increasing over time
- Closure references holding large data structures
- Timer handles accumulating without cleanup
```

### Common Memory Leak Patterns

```typescript
// LEAK: Timer not cleared on unmount
useEffect(() => {
  const timer = setInterval(refresh, POLL_INTERVAL_MS);
  // Missing: return () => clearInterval(timer);
}, []);

// LEAK: Subscription not removed
useEffect(() => {
  const sub = eventEmitter.addListener("event", handler);
  // Missing: return () => sub.remove();
}, []);

// LEAK: Async callback updates state after unmount
useEffect(() => {
  fetchData().then((data) => setState(data));
  // Missing: mounted flag to prevent state update after unmount
}, []);

// FIXED: All three patterns with proper cleanup
useEffect(() => {
  let isMounted = true;
  const timer = setInterval(refresh, POLL_INTERVAL_MS);
  const sub = eventEmitter.addListener("event", handler);

  fetchData().then((data) => {
    if (isMounted) setState(data);
  });

  return () => {
    isMounted = false;
    clearInterval(timer);
    sub.remove();
  };
}, []);
```

### Platform-Specific Leak Detection

```
iOS:
- Xcode Memory Graph Debugger: Debug -> Debug Memory Graph
  Shows all live objects and their retain chains
  Purple markers indicate potential leaks
- Instruments Allocations: Track allocation growth over time

Android:
- LeakCanary: Automatic detection of Activity/Fragment leaks
  Notifies when objects that should be GC'd are retained
- Android Studio Heap Dump: Capture and analyze live heap
  Filter by package name to find your app's retained objects
```

---

## Pattern 6: Bundle Size Analysis

### Visualizing the Bundle

```bash
# Install the bundle visualizer
npx react-native-bundle-visualizer

# Generates an interactive treemap showing:
# - Total bundle size
# - Per-module size contribution
# - Dependency tree visualization
```

### Bundle Size Reduction Strategies

```typescript
// GOOD: Named imports for tree shaking
import { format, parseISO } from "date-fns";

// BAD: Imports entire library
import * as dateFns from "date-fns";
import _ from "lodash"; // Pulls in entire lodash (~70KB)

// GOOD: Import specific lodash functions
import debounce from "lodash/debounce"; // Only debounce (~1KB)
```

### Production Build Optimization

```javascript
// babel.config.js -- remove console.log in production
module.exports = {
  presets: ["module:@react-native/babel-preset"],
  env: {
    production: {
      plugins: ["transform-remove-console"],
    },
  },
};
```

### Platform-Specific Code Splitting

```
// Use platform extensions to avoid shipping irrelevant code
component.ios.tsx    -- iOS-only implementation
component.android.tsx -- Android-only implementation

// Metro resolves the correct file per platform at build time
// The other platform's code is NOT included in the bundle
import { Component } from "./component"; // Resolves to .ios.tsx or .android.tsx
```

---

## Pattern 7: Performance Monitoring Hook

A development-only hook to detect excessive re-renders. Useful during development to catch performance regressions early.

```typescript
import { useEffect, useRef } from "react";

const RENDER_THRESHOLD = 10;
const RAPID_RENDER_MS = 16; // One frame at 60fps

export function useRenderMonitor(componentName: string) {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(Date.now());

  useEffect(() => {
    if (!__DEV__) return;

    renderCount.current += 1;
    const now = Date.now();
    const elapsed = now - lastRenderTime.current;
    lastRenderTime.current = now;

    if (renderCount.current > RENDER_THRESHOLD) {
      console.warn(
        `[Perf] ${componentName}: ${renderCount.current} renders`,
      );
    }

    if (elapsed < RAPID_RENDER_MS && renderCount.current > 1) {
      console.warn(
        `[Perf] ${componentName}: rapid re-render (${elapsed}ms gap)`,
      );
    }
  });

  // Log total on unmount
  useEffect(() => {
    return () => {
      if (__DEV__ && renderCount.current > RENDER_THRESHOLD) {
        console.log(
          `[Perf] ${componentName} total renders: ${renderCount.current}`,
        );
      }
    };
  }, [componentName]);
}

// Usage: Add to suspect components during debugging
function SuspectComponent() {
  useRenderMonitor("SuspectComponent");
  return <View>{/* ... */}</View>;
}
```

**Why good:** Catches excessive re-renders during development without production overhead (`__DEV__` guard). Rapid re-render detection catches cascading state updates.

**When to use:** During development to diagnose re-render problems. Remove or leave in place (the `__DEV__` guard ensures zero production cost).

---

## Pattern 8: Production Performance Monitoring

For production apps, use a monitoring SDK to capture real-user performance data. Generic pattern for any monitoring solution:

```typescript
import { AppState, type AppStateStatus } from "react-native";

const COLD_START_THRESHOLD_MS = 3000;
const SCREEN_RENDER_THRESHOLD_MS = 500;

// Track app startup time
export function measureStartupTime() {
  const startTime = global.__APP_START_TIME ?? Date.now();
  const endTime = Date.now();
  const startupMs = endTime - startTime;

  if (startupMs > COLD_START_THRESHOLD_MS) {
    // Report slow startup to your monitoring solution
    reportMetric("cold_start_ms", startupMs);
  }
}

// Track screen render time
export function useScreenRenderTime(screenName: string) {
  const mountTime = useRef(Date.now());

  useEffect(() => {
    const renderTime = Date.now() - mountTime.current;
    reportMetric("screen_render_ms", renderTime, { screen: screenName });

    if (renderTime > SCREEN_RENDER_THRESHOLD_MS) {
      reportMetric("slow_screen_render", renderTime, { screen: screenName });
    }
  }, [screenName]);
}

// Track app state changes (background/foreground)
export function useAppStateMonitoring() {
  const lastBackgroundTime = useRef<number | null>(null);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "background") {
        lastBackgroundTime.current = Date.now();
      } else if (nextState === "active" && lastBackgroundTime.current) {
        const bgDuration = Date.now() - lastBackgroundTime.current;
        reportMetric("background_duration_ms", bgDuration);
        lastBackgroundTime.current = null;
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );
    return () => subscription.remove();
  }, []);
}
```

**Key production metrics to track:**

| Metric              | Target  | Concern Threshold |
| ------------------- | ------- | ----------------- |
| Cold start time     | < 2s    | > 3s              |
| Screen render time  | < 300ms | > 500ms           |
| JS thread FPS       | 60      | < 50              |
| Memory usage        | Stable  | Growing over time |
| Crash-free sessions | > 99.5% | < 99%             |
