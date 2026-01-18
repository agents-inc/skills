# Expo Reference

> Decision frameworks, anti-patterns, and red flags. Reference from [SKILL.md](SKILL.md).

---

## Decision Framework

### Expo Go vs Development Build

```
Starting development?
├─ Prototyping or learning?
│   └─ YES → Expo Go is fine
├─ Using custom native modules?
│   └─ YES → Development build required
├─ Testing push notifications?
│   └─ YES → Development build required
├─ Need accurate splash screen / app icon?
│   └─ YES → Development build required
├─ Using libraries with native code outside Expo SDK?
│   └─ YES → Development build required
└─ Production testing?
    └─ YES → Development build required
```

### Managed vs Bare Workflow

```
Choosing workflow?
├─ Need custom native code beyond config plugins?
│   ├─ YES → Consider Expo Modules API first
│   │   └─ Not sufficient → Prebuild (bare-like with CNG)
│   └─ NO → Continue...
├─ Team comfortable maintaining android/ios?
│   ├─ YES → Prebuild is fine
│   └─ NO → Stay managed
├─ Need control over native build settings?
│   ├─ YES → Prebuild with config plugins
│   └─ NO → Managed (fully)
└─ Default → Managed (95% of cases)
```

### Runtime Version Strategy

```
Choosing runtimeVersion policy?
├─ Simple app, minimal native dependencies?
│   └─ "appVersion" - updates work within same version
├─ Complex native dependencies?
│   └─ "fingerprint" - auto-detects native changes
├─ Want explicit control?
│   └─ Use exact string like "1.0.0"
├─ Need cross-SDK updates?
│   └─ "sdkVersion" - but carefully managed
└─ Default → "appVersion" (easiest to understand)
```

### Build Profile Selection

```
Which build profile?
├─ Local development testing?
│   ├─ On simulator/emulator → development (simulator: true)
│   └─ On physical device → development-device
├─ Testing with real team?
│   └─ preview (internal distribution)
├─ App store submission?
│   └─ production
└─ CI/CD builds?
    ├─ PR builds → preview
    └─ Main branch → production
```

### Update Channel Strategy

```
Which update channel?
├─ Development builds
│   └─ development channel (or none)
├─ Internal testing (preview builds)
│   └─ preview channel
├─ App Store releases
│   └─ production channel
└─ Hotfix?
    └─ Same channel as affected build
```

---

## Expo Router Decision Framework

### Route Type Selection

```
What type of route?
├─ Static page (about, settings)?
│   └─ about.tsx → /about
├─ Dynamic content (user profile, product)?
│   └─ [id].tsx → /users/:id
├─ Nested path (documentation sections)?
│   └─ [...slug].tsx → /docs/a/b/c
├─ Tab navigation?
│   └─ (tabs)/ group with _layout.tsx
├─ Auth-protected section?
│   └─ Conditional navigator in _layout.tsx
└─ Modal?
    └─ presentation: 'modal' in screen options
```

### Navigation Method

```
How to navigate?
├─ Static link in UI?
│   └─ <Link href="/path">
├─ Dynamic navigation in handler?
│   └─ router.push("/path")
├─ Replace current screen?
│   └─ router.replace("/path")
├─ Go back?
│   └─ router.back()
├─ Dismiss modal to specific route?
│   └─ router.dismissTo("/path")
├─ Dismiss all screens in stack?
│   └─ router.dismissAll()
├─ Prefetch for performance?
│   └─ router.prefetch("/path")
└─ Check if can go back/dismiss?
    └─ router.canGoBack() / router.canDismiss()
```

---

## RED FLAGS

### High Priority Issues

- **Using Expo Go for production testing** - missing native modules, push notifications, accurate splash screens; always use development builds
- **Not updating runtimeVersion after native changes** - OTA updates will crash apps with incompatible native code
- **Storing secrets in EXPO_PUBLIC_ variables** - these are embedded in JavaScript bundle, visible to anyone
- **Manually editing android/ios in managed workflow** - changes lost on `prebuild --clean`; use config plugins instead
- **Mixing version numbers incorrectly** - iOS buildNumber must be string, Android versionCode must be integer
- **Using expo-av Video API** - deprecated in SDK 52+; migrate to `expo-video` (expo-av removed in SDK 55)
- **Using expo-av Audio API** - deprecated in SDK 53+; migrate to `expo-audio` (expo-av removed in SDK 55)
- **Not handling edge-to-edge display (Android)** - mandatory in SDK 54, cannot be disabled; use react-native-safe-area-context (React Native's SafeAreaView is deprecated)
- **Using expo-file-system without updating imports (SDK 54+)** - default imports changed; legacy API moved to `expo-file-system/legacy`

### Medium Priority Issues

- **Not using config plugins for native customization** - leads to maintenance burden when using prebuild
- **Hardcoded values instead of environment variables** - impossible to have different configs per environment
- **Missing SplashScreen.preventAutoHideAsync()** - flash of white/blank screen while fonts load
- **Not handling update errors gracefully** - app crashes instead of continuing with current version
- **Using synchronous environment variable patterns** - `const { VAR } = process.env` doesn't work with Metro

### Common Mistakes

- **Using `@expo/vector-icons` incorrectly in production** - prefer custom icon fonts for smaller bundle
- **Not setting up iOS provisioning profiles for internal distribution** - preview builds fail to install
- **Forgetting to configure EAS project ID** - updates and builds fail with cryptic errors
- **Not testing on both platforms regularly** - expo-specific issues compound when ignored
- **Assuming Expo Go has all capabilities** - many SDK features require development builds

### Gotchas and Edge Cases

- **Metro requires direct property access for env vars** - `process.env.EXPO_PUBLIC_*` only, not destructuring
- **iOS simulator builds won't install on devices** - need separate device build profile
- **runtimeVersion "fingerprint" can be too aggressive** - flags changes that don't affect native code
- **EAS Update has ~50MB limit** - large assets should use CDN, not bundled
- **expo-dev-client overrides Expo Go** - can't use both in same build
- **Android versionCode must strictly increase** - Play Store rejects same or lower values
- **Push notifications removed from Expo Go (Android) in SDK 53** - use development builds
- **Google Maps removed from Expo Go (Android) in SDK 53** - use development builds or expo-maps
- **React 19 breaking changes in SDK 53** - state updates are batched differently; review React 19 upgrade guide
- **AppDelegate is Swift in SDK 53+** - config plugins must use Swift modifications, not Objective-C
- **package.json exports enforced in SDK 53** - Metro enforces ES Module resolution; some libraries may break
- **expo-av completely removed in SDK 55** - must migrate to expo-video/expo-audio before upgrading
- **Legacy Architecture removed after SDK 54** - React Native 0.82+ won't permit opting out
- **Native tabs are alpha (SDK 54+)** - import from `expo-router/unstable-native-tabs`, API may change
- **Android limited to 5 native tabs** - Material Design constraint, cannot be overridden

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Expo Go for Production Testing

```typescript
// ANTI-PATTERN: Testing production features in Expo Go
// Expo Go doesn't support:
// - Push notifications (no project credentials)
// - Custom native modules
// - Accurate splash/icons
// - Deep linking with custom schemes
// - Many Expo SDK features requiring dev builds

// Result: "Works in development, crashes in production"
```

**Why it's wrong:** Expo Go is a generic client without your app's native configuration. Features relying on native setup will fail silently or crash.

**What to do instead:**

```bash
# Create development build for accurate testing
eas build --profile development --platform ios

# Or build locally
npx expo run:ios
```

---

### Anti-Pattern 2: Manual Native Directory Edits

```typescript
// ANTI-PATTERN: Editing android/app/build.gradle directly

android {
    defaultConfig {
        minSdkVersion 24  // Manual edit - will be lost!
    }
}

// After `npx expo prebuild --clean`:
// Your changes are GONE
```

**Why it's wrong:** Expo's Continuous Native Generation treats android/ios as build artifacts. Manual changes don't survive regeneration.

**What to do instead:**

```typescript
// app.config.ts - Use config plugins
export default {
  plugins: [
    [
      "expo-build-properties",
      {
        android: {
          minSdkVersion: 24,
        },
      },
    ],
  ],
};
```

---

### Anti-Pattern 3: Secrets in EXPO_PUBLIC_ Variables

```bash
# ANTI-PATTERN: Exposing secrets
EXPO_PUBLIC_API_KEY=sk_live_xxx123  # EXPOSED IN BUNDLE!
EXPO_PUBLIC_DATABASE_URL=postgres://user:pass@host/db  # EXPOSED!
```

**Why it's wrong:** `EXPO_PUBLIC_` variables are embedded in the JavaScript bundle and visible to anyone who decompiles the app.

**What to do instead:**

```bash
# EAS Secrets for sensitive build-time values
eas secret:create --name API_KEY --value "sk_live_xxx123"

# Access via server - never client-side
# Use backend proxy for sensitive operations
```

---

### Anti-Pattern 4: Missing runtimeVersion Updates

```typescript
// ANTI-PATTERN: Not updating runtimeVersion after native changes

// Week 1: Ship with expo-camera
// Week 2: Add expo-notifications (native dependency)
// Week 3: OTA update without updating runtimeVersion

// Result: Crash! Old builds don't have notification native code
```

**Why it's wrong:** OTA updates can only change JavaScript. If native code changed, the update crashes because expected native modules don't exist.

**What to do instead:**

```typescript
// app.config.ts
export default {
  runtimeVersion: {
    policy: "fingerprint", // Auto-detects native changes
  },
  // OR explicit version bump when adding native deps
  // runtimeVersion: "2.0.0",
};
```

---

### Anti-Pattern 5: Destructuring Environment Variables

```typescript
// ANTI-PATTERN: Metro can't statically analyze this

// These DON'T work:
const { EXPO_PUBLIC_API_URL } = process.env;  // undefined
const url = process.env['EXPO_PUBLIC_API_URL'];  // undefined
const keys = Object.keys(process.env);  // Doesn't include EXPO_PUBLIC_*

// CORRECT: Direct property access only
const API_URL = process.env.EXPO_PUBLIC_API_URL;  // Works!
```

**Why it's wrong:** Metro bundler requires static analysis to inline environment variables. Dynamic access patterns can't be resolved at build time.

**What to do instead:**

```typescript
// config/env.ts
const API_URL = process.env.EXPO_PUBLIC_API_URL;
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (!API_URL) {
  throw new Error("EXPO_PUBLIC_API_URL is required");
}

export const env = {
  apiUrl: API_URL,
  sentryDsn: SENTRY_DSN,
} as const;
```

---

### Anti-Pattern 6: Ignoring Platform Testing

```typescript
// ANTI-PATTERN: Only testing on one platform

// "It works on iOS simulator"
// Ship to Play Store
// Crash reports flood in

// Common iOS-specific patterns that break on Android:
// - SafeAreaView behavior differences
// - Shadow properties (iOS) vs elevation (Android)
// - Font weight values
// - StatusBar handling
```

**Why it's wrong:** Platform differences compound. Small issues become major problems when discovered after release.

**What to do instead:**

```bash
# Test on both platforms during development
npx expo start --ios
npx expo start --android

# Create preview builds for both
eas build --profile preview --platform all

# Verify on physical devices before release
```

---

## Expo SDK Compatibility Reference

### SDK 52

- New Architecture enabled by default for new projects
- React Native 0.76
- Expo Router v4 with `dismissTo`
- iOS 18 support, iOS minimum raised to 15.1
- Android minSdkVersion 24, compileSdkVersion 35
- `expo-video` stable (replaces expo-av Video)
- Headless `<Tabs />` component (expo-router/ui)

### SDK 53

- New Architecture enabled by default for ALL projects
- React Native 0.79 with React 19
- Edge-to-edge display enabled by default (Android)
- `expo-audio` stable (replaces expo-av Audio)
- `expo-background-task` (replaces expo-background-fetch)
- `expo/fetch` with streaming support
- AppDelegate migrated to Swift (iOS)
- Push notifications removed from Expo Go (Android)

### SDK 54 (Latest)

- React Native 0.81 with React 19.1
- Expo Router v6 with Native Tabs (alpha via `expo-router/unstable-native-tabs`)
- iOS 26 Liquid Glass support with Expo UI (beta)
- Android 16 target (API 36), edge-to-edge mandatory and cannot be disabled
- Precompiled React Native XCFrameworks for faster iOS builds (~10x improvement)
- expo-file-system new API is default (legacy moved to `expo-file-system/legacy`)
- **Final SDK supporting Legacy Architecture** - React Native 0.82+ won't permit opting out
- Deprecated expo-notifications function exports removed
- Minimum Node.js bumped to 20.19.4
- Minimum Xcode bumped to 16.1 (Xcode 26 recommended)

### Migration Checklist

When upgrading SDK:

- [ ] Run `npx expo install expo@latest`
- [ ] Run `npx expo install --fix` for peer deps
- [ ] Run `npx expo-doctor` for validation
- [ ] Check deprecated APIs in changelog
- [ ] Run `npx expo prebuild --clean`
- [ ] Test on both platforms
- [ ] Update runtimeVersion if native changes

---

## CLI Commands Quick Reference

### Development

```bash
npx expo start              # Start dev server
npx expo start --clear      # Clear cache and start
npx expo start --ios        # Start with iOS
npx expo start --android    # Start with Android
npx expo run:ios            # Build and run iOS locally
npx expo run:android        # Build and run Android locally
```

### Project Management

```bash
npx expo install [package]  # Install with correct version
npx expo install --fix      # Fix peer dependencies
npx expo-doctor             # Validate project configuration
npx expo prebuild           # Generate native directories
npx expo prebuild --clean   # Clean regeneration
```

### EAS Build

```bash
eas build --profile [profile] --platform [ios|android|all]
eas build:list              # List builds
eas build:view [id]         # View build details
eas build:run --platform [platform]  # Run built app
```

### EAS Update

```bash
eas update --channel [channel] --message "description"
eas update:list             # List updates
eas update:rollback --channel [channel]
```

### EAS Submit

```bash
eas submit --platform [ios|android]
eas submit --platform [platform] --id [build-id]
```

### EAS Credentials

```bash
eas credentials --platform [ios|android]
eas secret:create --name [name] --value [value]
eas secret:list
eas device:create           # Register iOS device
eas device:list
```
