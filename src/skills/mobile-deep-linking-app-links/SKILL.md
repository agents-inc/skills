---
name: mobile-deep-linking-app-links
description: Deep linking patterns - Universal Links (iOS), App Links (Android), URI schemes, expo-linking API, React Navigation linking config, Expo Router automatic linking, AASA/assetlinks.json setup, deferred deep links, testing
---

# Deep Linking & App Links Patterns

> **Quick Guide:** Universal Links (iOS) and App Links (Android) are the gold standard -- they use HTTPS URLs that open your app directly or fall back to the website. Custom URI schemes (`myapp://`) are simpler but less reliable (no fallback, can be hijacked). Use `expo-linking` for URL handling (`useURL`, `createURL`, `parse`). Expo Router handles deep linking automatically. React Navigation requires a `linking` config. Always test on real devices -- simulators miss edge cases.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use Universal Links (iOS) and App Links (Android) for production apps -- custom URI schemes have no fallback and can be hijacked by other apps)**

**(You MUST host AASA and assetlinks.json over HTTPS at `/.well-known/` -- Apple and Google will reject HTTP or incorrectly hosted files)**

**(You MUST handle all three app states: cold start (app not running), background (app suspended), and foreground (app active) -- missing any state causes dropped links)**

**(You MUST test deep links on real devices -- simulators and emulators do not fully replicate OS-level link handling behavior)**

**(You MUST never pass sensitive data (tokens, passwords) in deep link URLs -- URLs are logged, cached, and visible in browser history)**

</critical_requirements>

---

**Auto-detection:** deep link, deep linking, universal link, app link, URI scheme, custom scheme, expo-linking, Linking.useURL, Linking.createURL, Linking.parse, Linking.openURL, Linking.getInitialURL, linking config, apple-app-site-association, AASA, assetlinks.json, intentFilters, associatedDomains, deferred deep link, App Clip, Instant App, getInitialURL, addEventListener url

**When to use:**

- Setting up Universal Links (iOS) or App Links (Android) for HTTPS-based deep linking
- Configuring custom URI schemes for development or simple deep linking
- Handling incoming URLs across cold start, background, and foreground app states
- Configuring React Navigation linking config or using Expo Router automatic linking
- Hosting and validating AASA (iOS) or assetlinks.json (Android) verification files
- Implementing deferred deep links (link -> store -> install -> content)
- Testing deep links with CLI tools (`adb`, `xcrun simctl`, `uri-scheme`)

**Key patterns covered:**

- Universal Links (iOS) and App Links (Android) end-to-end setup
- Custom URI scheme configuration and handling
- expo-linking API: `useURL`, `createURL`, `parse`, `getInitialURL`
- React Navigation `linking` config with path mapping, parameter parsing, nested navigators
- Expo Router automatic deep linking (zero-config)
- AASA and assetlinks.json file format, hosting, and validation
- Handling incoming links in all app states
- Deferred deep linking concepts and implementation approaches
- Testing deep links with platform CLI tools

**When NOT to use:**

- Web-only routing without a native mobile app
- Push notification routing (handle in your notification skill, not deep linking)
- App-to-app communication via intents/activities (use your native modules skill)

**Detailed Resources:**

- [examples/core.md](examples/core.md) - URI schemes, expo-linking API, handling incoming URLs, React Navigation linking config, Expo Router
- [examples/verification-files.md](examples/verification-files.md) - AASA file (iOS), assetlinks.json (Android), hosting requirements, validation
- [examples/testing.md](examples/testing.md) - Testing with adb, xcrun simctl, uri-scheme, debugging tips
- [reference.md](reference.md) - API quick reference, linking config shape, testing commands

---

<philosophy>

## Philosophy

Deep linking connects the outside world to specific screens in your app. The goal is a seamless experience: user taps a link, your app opens to the right content. Three link types exist, each with different trade-offs:

1. **Universal Links (iOS) / App Links (Android)** -- HTTPS URLs verified by the OS. App opens directly without disambiguation dialog. Falls back to website if app not installed. **Use these for production.**

2. **Custom URI schemes** (`myapp://path`) -- Simple to set up but unreliable: no fallback if app not installed, any app can register the same scheme (hijacking risk), and some platforms block them. **Use for development or internal tools only.**

3. **Deferred deep links** -- User clicks link, gets sent to app store, installs app, then lands on the intended content. Requires a third-party service or custom server-side logic. **Use when acquisition funnels matter.**

**Key architectural principle:** The link handler is the entry point to your navigation. It must work in all three app states (cold start, background, foreground) and gracefully handle invalid or expired links. Never trust link parameters -- validate and sanitize them before navigating.

**Expo Router vs React Navigation:**

- **Expo Router** handles deep linking automatically -- every file-based route is a deep link with zero configuration
- **React Navigation** requires a `linking` config object that maps URL paths to screen names

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Custom URI Scheme Setup

Configure a custom scheme in your app config so links like `myapp://profile/123` open your app.

```json
{
  "expo": {
    "scheme": "myapp"
  }
}
```

After adding a scheme, rebuild the app -- scheme changes require a new native build.

**Why good:** Simple to configure, works immediately in development, no server-side setup needed

**Gotcha:** Custom schemes have no fallback -- if the app is not installed, the link fails silently. Any app can register the same scheme, so there is no guarantee your app handles it.

See [examples/core.md](examples/core.md) for handling incoming scheme URLs.

---

### Pattern 2: Universal Links (iOS) Setup

Universal Links require a two-way association: your server hosts an AASA file declaring which paths belong to your app, and your app declares the associated domain.

```json
{
  "expo": {
    "ios": {
      "associatedDomains": ["applinks:example.com"]
    }
  }
}
```

**Critical:** Omit the `https://` protocol from the domain value. The AASA file must be served over HTTPS at `https://example.com/.well-known/apple-app-site-association`.

See [examples/verification-files.md](examples/verification-files.md) for the complete AASA file format and hosting requirements.

---

### Pattern 3: App Links (Android) Setup

App Links use intent filters with `autoVerify: true` and an assetlinks.json file on your server.

```json
{
  "expo": {
    "android": {
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            {
              "scheme": "https",
              "host": "example.com",
              "pathPrefix": "/product"
            }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

**Critical:** `autoVerify: true` is required -- without it, Android treats these as regular deep links (shows disambiguation dialog instead of opening directly).

See [examples/verification-files.md](examples/verification-files.md) for the assetlinks.json file format and SHA-256 fingerprint retrieval.

---

### Pattern 4: Handling Incoming URLs with expo-linking

Use the `useURL` hook to handle URLs in all app states (cold start, background, foreground). Parse URLs with `Linking.parse()` to extract path and query parameters.

```typescript
import * as Linking from "expo-linking";

export function DeepLinkHandler() {
  const url = Linking.useURL();

  useEffect(() => {
    if (url) {
      const { hostname, path, queryParams } = Linking.parse(url);
      // Navigate based on parsed URL
    }
  }, [url]);

  return null;
}
```

**Why good:** `useURL` handles both the initial launch URL and subsequent foreground URLs -- no need to manage `getInitialURL` and `addEventListener` separately.

See [examples/core.md](examples/core.md) for `createURL`, `parse`, and complete handling patterns.

---

### Pattern 5: React Navigation Linking Config

Map URL paths to screens using the `linking` config. Paths support parameters, optional segments, regex patterns, and nested navigators.

```typescript
import * as Linking from "expo-linking";

const linking = {
  prefixes: [Linking.createURL("/"), "https://example.com", "myapp://"],
  config: {
    screens: {
      Home: "",
      Profile: "user/:id",
      Product: {
        path: "product/:slug",
        parse: { slug: (slug: string) => slug.toLowerCase() },
      },
      NotFound: "*",
    },
  },
};
```

**Why good:** Declarative path-to-screen mapping, parameter parsing built in, wildcard catch-all for unmatched URLs

See [examples/core.md](examples/core.md) for nested navigator config, parameter parsing, and static API setup.

---

### Pattern 6: Expo Router Automatic Deep Linking

With Expo Router, every file in the `app/` directory is automatically a deep linkable route. No linking config needed.

```
app/
  index.tsx           ->  /
  profile/[id].tsx    ->  /profile/123
  product/[slug].tsx  ->  /product/blue-shirt
  settings.tsx        ->  /settings
```

**Why good:** Zero configuration, file paths ARE the deep link paths, adding a screen automatically creates a deep link

**When to use:** Expo Router projects. If using React Navigation directly, use Pattern 5 instead.

---

### Pattern 7: Deferred Deep Links

Deferred deep links work when the app is not yet installed: user taps link, goes to app store, installs, then opens to the intended content. This requires server-side logic to persist the link destination through the install flow.

**Implementation approaches:**

- **Attribution SDKs** -- Third-party services handle the full deferred linking flow with install attribution
- **OS-level referrer** -- Android provides an install referrer API that can carry a URL through the Play Store install. iOS has no equivalent (clipboard-based heuristics exist but require paste permission)
- **Custom server** -- Store the link destination server-side keyed by device fingerprint, retrieve after install

**Key limitation:** Deferred deep links are inherently probabilistic on iOS. Android's install referrer provides deterministic matching.

See [examples/core.md](examples/core.md) for deferred deep link handling patterns.

</patterns>

---

<decision_framework>

## Decision Framework

### Which Link Type to Use

```
Is the app already installed on the target device?
+-- Unknown/Maybe -> Use Universal Links / App Links (HTTPS)
|   +-- Needs fallback to website? -> YES, this is why HTTPS links are preferred
|   +-- Needs app store redirect? -> Implement deferred deep linking
+-- YES (guaranteed, e.g. internal tool) -> Custom URI scheme is acceptable
+-- NO (acquisition funnel) -> Deferred deep link via attribution service

Do you need the OS to open your app without a disambiguation dialog?
+-- YES -> Universal Links (iOS) / App Links (Android) with verified domains
+-- NO  -> Custom URI scheme (shows "Open with..." on some devices)
```

### Navigation Integration

```
Which router are you using?
+-- Expo Router -> Automatic. No configuration needed. File paths = deep links.
+-- React Navigation (static API) -> Add `linking` property per screen definition
+-- React Navigation (dynamic API) -> Pass `linking` prop to NavigationContainer
+-- Custom navigation -> Use expo-linking useURL hook + manual navigation logic
```

### Link Type Comparison

| Feature               | Custom URI Scheme     | Universal Links (iOS) | App Links (Android)       |
| --------------------- | --------------------- | --------------------- | ------------------------- |
| Format                | `myapp://path`        | `https://domain/path` | `https://domain/path`     |
| Fallback              | None (fails silently) | Opens website         | Opens website             |
| Verification          | None                  | AASA file on server   | assetlinks.json on server |
| Hijack risk           | Any app can register  | OS-verified, secure   | OS-verified, secure       |
| Setup complexity      | Low                   | Medium                | Medium                    |
| Works without install | No                    | Yes (opens website)   | Yes (opens website)       |
| Disambiguation dialog | Sometimes             | Never (verified)      | Never (verified)          |

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Using custom URI schemes in production without Universal Links / App Links -- no fallback when app is not installed, links fail silently
- Missing `autoVerify: true` on Android intent filters -- without it, App Links behave as regular deep links (disambiguation dialog shown)
- Hosting AASA or assetlinks.json over HTTP instead of HTTPS -- Apple and Google reject non-HTTPS verification files
- Not handling cold start URLs -- `useURL` handles this, but manual implementations that only use `addEventListener` will miss the launch URL
- Passing sensitive data (auth tokens, passwords, PII) in deep link URLs -- URLs are logged in analytics, cached by CDNs, visible in browser history

**Medium Priority Issues:**

- Not including `https://` prefix in React Navigation linking `prefixes` array -- Universal Links/App Links will not be matched
- Forgetting to rebuild after changing URI scheme or associated domains -- these are native-level changes that require a new build
- Not setting `initialRouteName` in nested navigator linking config -- back navigation will not work correctly from deep-linked screens
- Hardcoding development tunnel URLs in production builds -- use environment-specific prefix arrays

**Gotchas & Edge Cases:**

- iOS caches AASA files for up to 24 hours -- changes to the file will not take effect immediately on devices that have already fetched it
- Universal Links do not work when typed directly into Safari's address bar -- they must be tapped from another app, Messages, Mail, or a webpage on a different domain
- Universal Links do not work when opened from the same domain -- a link on `example.com` pointing to `example.com/product/123` will NOT open the app
- Android App Links verification happens at install time -- if your server is down during install, verification fails and the link opens in the browser
- `Linking.parse()` handles non-standard URL formats (like Expo Go URLs with `--` separators) -- use it instead of `new URL()` for consistency
- Expo Go uses `exp://` scheme with a different URL format (`exp://127.0.0.1:8081/--/path`) -- test with development builds for production-accurate behavior
- Wildcard paths in AASA (`*`) do not match `/` or `.` characters -- use multiple path entries if needed
- Deep links received while the app is in the background may arrive with a delay on Android due to Doze mode and battery optimization

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST use Universal Links (iOS) and App Links (Android) for production apps -- custom URI schemes have no fallback and can be hijacked by other apps)**

**(You MUST host AASA and assetlinks.json over HTTPS at `/.well-known/` -- Apple and Google will reject HTTP or incorrectly hosted files)**

**(You MUST handle all three app states: cold start (app not running), background (app suspended), and foreground (app active) -- missing any state causes dropped links)**

**(You MUST test deep links on real devices -- simulators and emulators do not fully replicate OS-level link handling behavior)**

**(You MUST never pass sensitive data (tokens, passwords) in deep link URLs -- URLs are logged, cached, and visible in browser history)**

**Failure to follow these rules will result in broken deep links, security vulnerabilities, and poor user experience when links fail silently.**

</critical_reminders>
