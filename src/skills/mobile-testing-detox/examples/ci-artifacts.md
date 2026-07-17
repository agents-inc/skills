# CI & Artifacts Patterns

> Artifacts configuration, CI workflows, and mocking with Metro. See also: [core.md](core.md), [synchronization.md](synchronization.md).

---

## Complete .detoxrc.js Configuration

```javascript
// .detoxrc.js
/** @type {import('detox').DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      $0: "jest",
      config: "e2e/jest.config.js",
    },
    jest: {
      setupTimeout: 120000,
    },
  },
  apps: {
    "ios.debug": {
      type: "ios.app",
      binaryPath: "ios/build/Build/Products/Debug-iphonesimulator/MyApp.app",
      build:
        "xcodebuild -workspace ios/MyApp.xcworkspace -scheme MyApp -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build",
    },
    "android.debug": {
      type: "android.apk",
      binaryPath: "android/app/build/outputs/apk/debug/app-debug.apk",
      build:
        "cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug",
      reversePorts: [8081],
    },
  },
  devices: {
    simulator: { type: "ios.simulator", device: { type: "iPhone 16" } },
    emulator: {
      type: "android.emulator",
      device: { avdName: "Pixel_7_API_34" },
    },
  },
  configurations: {
    "ios.sim.debug": { device: "simulator", app: "ios.debug" },
    "android.emu.debug": { device: "emulator", app: "android.debug" },
  },
};
```

**Key decisions:**

- `setupTimeout: 120000` -- 2 minutes for CI builds (default 60s often insufficient)
- `reversePorts: [8081]` -- Android emulators need port forwarding to reach Metro bundler
- Use JSDoc `@type` for IDE autocomplete on all config options

---

## Pattern 1: Artifacts Configuration

### .detoxrc.js Artifacts Section

```javascript
/** @type {import('detox').DetoxConfig} */
module.exports = {
  // ... devices, apps, configurations ...

  artifacts: {
    rootDir: "./e2e/artifacts",
    plugins: {
      screenshot: {
        enabled: true,
        shouldTakeAutomaticSnapshots: true,
        keepOnlyFailedTestsArtifacts: true,
        takeWhen: {
          testStart: false,
          testDone: true,
          appNotReady: true,
        },
      },
      video: {
        enabled: true,
        keepOnlyFailedTestsArtifacts: true,
        android: { bitRate: 4000000 },
        simulator: { codec: "hevc" },
      },
      log: {
        enabled: true,
        keepOnlyFailedTestsArtifacts: true,
      },
    },
  },
};
```

**Why good:** keeps only failing test artifacts (saves disk space in CI), screenshots on test completion and app crashes, HEVC codec for smaller video files.

### CLI Artifact Flags (Override Config)

```bash
# Record everything for debugging
detox test --configuration ios.sim.debug \
  --record-videos all \
  --take-screenshots all \
  --record-logs all

# Record only on failure (CI default)
detox test --configuration ios.sim.debug \
  --record-videos failing \
  --take-screenshots failing \
  --record-logs failing \
  --artifacts-location ./e2e/artifacts/
```

### Per-Test Screenshots

```typescript
it("should display profile after login", async () => {
  await element(by.id("login-btn")).tap();

  // Manual screenshot at specific point
  await device.takeScreenshot("after-login");

  await expect(element(by.id("profile-screen"))).toBeVisible();

  // Element-level screenshot
  await element(by.id("profile-card")).takeScreenshot("profile-card");
});
```

---

## Pattern 2: Mocking with Metro Source Extensions

### Basic Module Override

```javascript
// src/services/api-client.js -- production
const API_BASE_URL = "https://api.production.com";

export function createApiClient() {
  return { baseURL: API_BASE_URL };
}

// src/services/api-client.mock.js -- test override
const API_BASE_URL = "http://localhost:9090";

export function createApiClient() {
  return { baseURL: API_BASE_URL };
}
```

### Environment-Based Metro Configuration

```javascript
// metro.config.js
const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");
const defaultSourceExts =
  require("metro-config/src/defaults/defaults").sourceExts;

const config = {
  resolver: {
    sourceExts:
      process.env.DETOX_MODE === "mocked"
        ? ["mock.js", "mock.ts", "mock.tsx", ...defaultSourceExts]
        : defaultSourceExts,
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
```

Start with mocking enabled:

```bash
DETOX_MODE=mocked npx react-native start
```

### Package.json Scripts

```json
{
  "scripts": {
    "e2e:build:ios": "detox build --configuration ios.sim.debug",
    "e2e:test:ios": "DETOX_MODE=mocked detox test --configuration ios.sim.debug",
    "e2e:build:android": "detox build --configuration android.emu.debug",
    "e2e:test:android": "DETOX_MODE=mocked detox test --configuration android.emu.debug"
  }
}
```

### Mock Server Pattern

```javascript
// src/services/api.mock.js
// Point API to a local mock server running in CI

const MOCK_SERVER_PORT = 9090;

export const API_URL = `http://localhost:${MOCK_SERVER_PORT}`;

export async function fetchProducts() {
  const response = await fetch(`${API_URL}/products`);
  return response.json();
}
```

**Why good:** production code unchanged, test infrastructure entirely separate, Metro resolves `.mock.js` files automatically when source extensions are configured.

---

## Pattern 3: Jest Integration

### e2e/jest.config.js

```javascript
/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  rootDir: "..",
  testMatch: ["<rootDir>/e2e/**/*.test.ts"],
  testTimeout: 120000,
  maxWorkers: 1, // Detox tests must run sequentially
  globalSetup: "detox/runners/jest/globalSetup",
  globalTeardown: "detox/runners/jest/globalTeardown",
  reporters: ["detox/runners/jest/reporter"],
  testEnvironment: "detox/runners/jest/testEnvironment",
  verbose: true,
};
```

**Why good:** sequential execution (required for device), Detox-provided setup/teardown handles lifecycle, long timeout for slow CI machines.

### Test File Structure

```typescript
// e2e/checkout.test.ts
import { by, device, element, expect, waitFor } from "detox";

const CHECKOUT_TIMEOUT_MS = 10000;

describe("Checkout flow", () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    // Navigate to product screen
    await element(by.id("nav-products-tab")).tap();
  });

  it("should add item to cart and complete purchase", async () => {
    await element(by.id("product-list.item-0")).tap();
    await element(by.id("product-detail.add-to-cart-btn")).tap();
    await element(by.id("nav-cart-tab")).tap();

    await expect(element(by.id("cart-screen.item-count"))).toHaveText("1 item");

    await element(by.id("cart-screen.checkout-btn")).tap();

    await waitFor(element(by.id("order-confirmation")))
      .toBeVisible()
      .withTimeout(CHECKOUT_TIMEOUT_MS);
  });
});
```

---

## Pattern 4: CI Workflow (GitHub Actions)

### iOS Workflow

```yaml
name: Detox iOS
on: [push]

jobs:
  detox-ios:
    runs-on: macos-14 # Apple Silicon runner
    timeout-minutes: 60

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Install macOS dependencies
        run: |
          brew tap wix/brew
          brew install applesimutils

      - name: Install CocoaPods
        run: cd ios && pod install

      - name: Build for Detox
        run: npx detox build --configuration ios.sim.debug

      - name: Run Detox tests
        run: |
          npx detox test --configuration ios.sim.debug \
            --headless \
            --record-videos failing \
            --take-screenshots failing \
            --record-logs failing

      - name: Upload artifacts on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: detox-ios-artifacts
          path: e2e/artifacts/
          retention-days: 7
```

### Android Workflow

```yaml
name: Detox Android
on: [push]

jobs:
  detox-android:
    runs-on: ubuntu-latest
    timeout-minutes: 60

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 17
          cache: gradle

      - name: Build for Detox
        run: npx detox build --configuration android.emu.debug

      - name: Run Detox tests
        uses: reactivecircus/android-emulator-runner@v2
        with:
          api-level: 34
          arch: x86_64
          profile: Pixel 7
          emulator-options: -no-snapshot-save -no-window -gpu swiftshader_indirect -noaudio -no-boot-anim
          script: |
            npx detox test --configuration android.emu.debug \
              --headless \
              --record-videos failing \
              --take-screenshots failing \
              --record-logs failing

      - name: Upload artifacts on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: detox-android-artifacts
          path: e2e/artifacts/
          retention-days: 7
```

**Why good:** Apple Silicon runner for iOS (faster builds), `--headless` for CI, artifacts uploaded only on failure, proper caching for dependencies.

---

## Pattern 5: Multi-App Testing

Test interactions between multiple apps (e.g., app + notification extension).

```javascript
// .detoxrc.js
module.exports = {
  apps: {
    "ios.main": {
      type: "ios.app",
      binaryPath: "ios/build/Build/Products/Debug-iphonesimulator/MainApp.app",
      build: "xcodebuild -workspace ios/MainApp.xcworkspace ...",
    },
    "ios.companion": {
      type: "ios.app",
      binaryPath:
        "ios/build/Build/Products/Debug-iphonesimulator/CompanionApp.app",
      build: "xcodebuild -workspace ios/CompanionApp.xcworkspace ...",
    },
  },
  configurations: {
    "ios.multi": {
      device: "simulator",
      apps: ["ios.main", "ios.companion"],
    },
  },
};
```

```typescript
// Switch between apps during test
it("should sync data between apps", async () => {
  await device.selectApp("ios.main");
  await device.launchApp({ newInstance: true });
  await element(by.id("create-item-btn")).tap();

  await device.selectApp("ios.companion");
  await device.launchApp({ newInstance: true });
  await expect(element(by.id("synced-item"))).toBeVisible();
});
```

---

## Anti-Pattern: Not Collecting CI Artifacts

```bash
# Bad: no artifacts, impossible to debug failures
detox test --configuration ios.sim.debug
```

**Why bad:** when a test fails in CI, you have no screenshots, videos, or logs to diagnose the issue. Debugging becomes guesswork.

```bash
# Good: collect artifacts on failure
detox test --configuration ios.sim.debug \
  --record-videos failing \
  --take-screenshots failing \
  --record-logs failing
```

**Why good:** failing tests produce videos and screenshots that show exactly what the UI looked like at failure time.
