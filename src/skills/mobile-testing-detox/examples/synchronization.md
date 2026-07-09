# Synchronization Patterns

> Handling animations, manual synchronization, and debugging sync issues. See also: [core.md](core.md), [ci-artifacts.md](ci-artifacts.md).

---

## How Detox Auto-Synchronization Works

Detox automatically waits for:

- **JS thread** to be idle (no pending promises, timers, or microtasks)
- **Native UI** animations to complete
- **Network requests** to finish (unless blacklisted)
- **React Native bridge** to be idle

Only use manual synchronization (`waitFor`, `disableSynchronization`) when auto-sync genuinely cannot handle the situation.

---

## Pattern 1: Dealing with Looping Animations

Looping animations (spinners, pulse effects, shimmer placeholders) block Detox indefinitely because the app never reaches an idle state.

### Solution A: Mock Animations via Metro (Preferred)

```javascript
// src/components/loading-spinner.js -- production
import { Animated, Easing } from "react-native";

export function startPulse(animValue: Animated.Value) {
  Animated.loop(
    Animated.timing(animValue, {
      toValue: 1,
      duration: 1000,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }),
  ).start();
}

// src/components/loading-spinner.mock.js -- test override
export function startPulse(_animValue: Animated.Value) {
  // No-op: disables the animation loop for Detox tests
}
```

**Why good:** production code untouched, animation disabled only in test builds, Detox auto-sync works normally.

### Solution B: Disable Synchronization Temporarily

```typescript
const ANIMATION_TIMEOUT_MS = 3000;

it("should show content behind a looping spinner", async () => {
  await device.disableSynchronization();

  try {
    await waitFor(element(by.id("content-loaded")))
      .toBeVisible()
      .withTimeout(ANIMATION_TIMEOUT_MS);

    await expect(element(by.id("data-text"))).toHaveText("Results");
  } finally {
    await device.enableSynchronization();
  }
});
```

**Why good:** `try/finally` ensures sync is always re-enabled, waitFor polls until content appears, explicit timeout prevents infinite hang.

**When to use:** when you cannot mock the animation (third-party library, native animation).

---

## Pattern 2: Long-Polling and WebSocket Connections

Persistent connections prevent the network idle state. Blacklist their URLs.

### URL Blacklisting

```typescript
beforeAll(async () => {
  await device.launchApp({ newInstance: true });
  // Blacklist long-polling and WebSocket endpoints
  await device.setURLBlacklist([
    ".*\\/long-poll\\/.*",
    ".*\\.socket\\.io.*",
    ".*\\/realtime\\/.*",
  ]);
});
```

**Why good:** Detox stops monitoring these URLs for idle state, auto-sync works for everything else.

### Launch-Time Blacklisting

```javascript
// .detoxrc.js -- blacklist during launch
module.exports = {
  configurations: {
    "ios.sim.debug": {
      device: "simulator",
      app: "ios.debug",
      // Override at configuration level
      behavior: {
        launchApp: {
          detoxURLBlacklistRegex: "(.*long-poll.*|.*socket\\.io.*)",
        },
      },
    },
  },
};
```

---

## Pattern 3: setTimeout Loops

Detox tracks `setTimeout` calls but ignores `setInterval`. If your app uses `setTimeout` in a loop pattern, it blocks synchronization.

### Solution: Convert to setInterval

```javascript
// Bad: setTimeout loop blocks Detox sync
function pollStatus() {
  setTimeout(() => {
    checkStatus();
    pollStatus(); // Recursive setTimeout
  }, 1000);
}

// Good: setInterval is ignored by Detox sync
const POLL_INTERVAL_MS = 1000;
const intervalId = setInterval(checkStatus, POLL_INTERVAL_MS);
// Clear when done: clearInterval(intervalId);
```

**Why good:** Detox intentionally ignores `setInterval`, so the app reaches idle state between intervals.

---

## Pattern 4: Debugging Synchronization Issues

When tests hang or time out, enable synchronization debugging to find what blocks the idle loop.

### CLI Debug Flag

```bash
# Log sync status every 5 seconds
detox test --configuration ios.sim.debug --debug-synchronization 5000
```

Output shows what Detox is waiting for:

```
The app is busy with the following tasks:
- 1 enqueued native animation
- 2 pending network requests (https://api.example.com/data)
- 1 pending timer (setTimeout, 30000ms remaining)
```

### Systematic Debugging Process

1. **Enable debug sync** with `--debug-synchronization 5000`
2. **Identify the blocker** from the output (animation, network, timer)
3. **Fix the root cause:**
   - Animation loop -> Mock it via Metro extension
   - Network request -> Blacklist the URL or fix the server
   - Timer -> Convert setTimeout loop to setInterval
4. **Verify fix** by running the test without `waitFor` or `disableSynchronization`

---

## Pattern 5: Selective Synchronization Disable

For screens with unavoidable animations (e.g., third-party map SDKs, video players), disable sync only for specific interactions.

```typescript
const MAP_LOAD_TIMEOUT_MS = 5000;

it("should interact with map screen", async () => {
  // Navigate to map (auto-sync works here)
  await element(by.id("nav-map-tab")).tap();

  // Disable sync for map screen (map SDK uses continuous animations)
  await device.disableSynchronization();

  try {
    // Must use waitFor since auto-sync is off
    await waitFor(element(by.id("map-view")))
      .toBeVisible()
      .withTimeout(MAP_LOAD_TIMEOUT_MS);

    await element(by.id("map-pin-1")).tap();

    await waitFor(element(by.id("pin-detail-card")))
      .toBeVisible()
      .withTimeout(MAP_LOAD_TIMEOUT_MS);

    await expect(element(by.id("pin-detail-card.title"))).toHaveText(
      "Central Park",
    );
  } finally {
    await device.enableSynchronization();
  }
});
```

**Why good:** sync disabled only for the problematic screen, re-enabled in `finally` block, all waitFor calls have timeouts.

---

## Pattern 6: Launch Arguments for Test Mode

Pass arguments at launch to disable animations app-wide in test builds.

```typescript
beforeAll(async () => {
  await device.launchApp({
    newInstance: true,
    launchArgs: {
      disableAnimations: "true",
    },
  });
});
```

In the app, check the launch argument:

```typescript
// src/config.ts
import { NativeModules } from "react-native";

const launchArgs = NativeModules.RNDetoxLaunchArgs ?? {};

export const IS_DETOX_TEST = launchArgs.disableAnimations === "true";
```

```typescript
// src/app.tsx
import { IS_DETOX_TEST } from "./config";
import { UIManager } from "react-native";

if (IS_DETOX_TEST) {
  UIManager.setLayoutAnimationEnabledExperimental?.(false);
}
```

**Why good:** animations disabled at the source, no need for `disableSynchronization`, auto-sync works normally.

---

## Anti-Pattern: Using sleep()

```typescript
// Bad: arbitrary delay, flaky, slow
await element(by.id("save-btn")).tap();
await new Promise((resolve) => setTimeout(resolve, 3000));
await expect(element(by.id("success-toast"))).toBeVisible();
```

**Why bad:** the 3-second wait is arbitrary -- it may be too short on slow CI machines or unnecessarily long on fast ones. Masks real synchronization issues.

```typescript
// Good: let Detox auto-sync handle it
await element(by.id("save-btn")).tap();
await expect(element(by.id("success-toast"))).toBeVisible();
```

**Why good:** Detox waits exactly as long as needed. If auto-sync is insufficient, investigate what blocks idle rather than adding a timer.
