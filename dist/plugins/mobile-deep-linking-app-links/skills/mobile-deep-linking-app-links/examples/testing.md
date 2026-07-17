# Deep Linking - Testing

> Testing deep links with CLI tools, debugging common issues, and validating verification files. See [SKILL.md](../SKILL.md) for decision guidance. See [examples/verification-files.md](verification-files.md) for AASA/assetlinks.json setup.

---

## Pattern 1: Testing with CLI Tools

### iOS Simulator (xcrun simctl)

```bash
# Test custom URI scheme
xcrun simctl openurl booted "myapp://profile/123"

# Test Universal Links (HTTPS)
xcrun simctl openurl booted "https://example.com/product/456"

# Test with query parameters
xcrun simctl openurl booted "myapp://settings?section=notifications"

# Specify a device (when multiple simulators are running)
xcrun simctl openurl 9F3E4A1B-2C5D-4E6F-8A7B-1C2D3E4F5A6B "myapp://profile/123"
```

**Limitation:** Universal Links on simulator are unreliable -- the OS may open Safari instead. Always validate Universal Links on a real device.

### Android Emulator/Device (adb)

```bash
# Test custom URI scheme
adb shell am start -W -a android.intent.action.VIEW \
  -d "myapp://profile/123" \
  com.example.myapp

# Test App Links (HTTPS)
adb shell am start -W -a android.intent.action.VIEW \
  -d "https://example.com/product/456" \
  com.example.myapp

# Test with query parameters
adb shell am start -W -a android.intent.action.VIEW \
  -d "myapp://settings?section=notifications" \
  com.example.myapp

# Verify App Links status for your app
adb shell pm get-app-links com.example.myapp

# Reset App Links verification (forces re-verification on next install)
adb shell pm set-app-links --package com.example.myapp 0 all
```

### Expo uri-scheme Tool

```bash
# Test on iOS
npx uri-scheme open "myapp://profile/123" --ios

# Test on Android
npx uri-scheme open "myapp://profile/123" --android

# List registered schemes
npx uri-scheme list --ios
npx uri-scheme list --android
```

**Why good:** `uri-scheme` is simpler than raw `xcrun`/`adb` commands and works in Expo-managed projects

---

## Pattern 2: Testing App States

Deep links behave differently depending on the app state. Test all three:

### Cold Start (App Not Running)

```bash
# 1. Force-quit the app
# iOS: Swipe up from app switcher
# Android:
adb shell am force-stop com.example.myapp

# 2. Open deep link (app launches from scratch)
adb shell am start -W -a android.intent.action.VIEW \
  -d "myapp://product/456" \
  com.example.myapp
```

**What to verify:** App launches and navigates directly to the target screen. The initial URL is captured by `Linking.getInitialURL()` or `useURL`.

### Background (App Suspended)

```bash
# 1. Open the app normally, then press Home button
# 2. Open deep link (app resumes from background)
adb shell am start -W -a android.intent.action.VIEW \
  -d "myapp://product/456" \
  com.example.myapp
```

**What to verify:** App comes to foreground and navigates to the target screen. The URL is captured by `addEventListener('url')` or `useURL`.

### Foreground (App Active)

```bash
# 1. Keep the app in the foreground
# 2. Open deep link from another terminal window
adb shell am start -W -a android.intent.action.VIEW \
  -d "myapp://product/456" \
  com.example.myapp
```

**What to verify:** App stays in foreground and navigates to the target screen without a visible app restart.

---

## Pattern 3: Validating Verification Files

### iOS AASA Validation

```bash
# Apple's CDN-cached version of your AASA file
curl -s "https://app-site-association.cdn-apple.com/a/v1/yourdomain.com" | jq .

# Direct fetch from your server
curl -sI "https://yourdomain.com/.well-known/apple-app-site-association"
# Verify: Content-Type is application/json, status is 200 (not redirect)

# Check the file content
curl -s "https://yourdomain.com/.well-known/apple-app-site-association" | jq .
```

**Key checks:**

- Content-Type header is `application/json`
- No redirects (must be a direct 200 response)
- `appIDs` format is `<TEAM_ID>.<BUNDLE_ID>`
- Paths match the URLs you want to handle

### Android assetlinks.json Validation

```bash
# Google's verification endpoint
curl -s "https://digitalassetlinks.googleapis.com/v1/statements:list?\
source.web.site=https://yourdomain.com&\
relation=delegate_permission/common.handle_all_urls" | jq .

# Direct fetch from your server
curl -s "https://yourdomain.com/.well-known/assetlinks.json" | jq .

# Check App Links verification status on device
adb shell pm get-app-links com.example.myapp
# Look for: "com.example.myapp: verified"
```

**Key checks:**

- Google's endpoint returns your app in the `statements` array
- `package_name` matches your app's package name
- `sha256_cert_fingerprints` includes both upload AND signing keys
- Status shows `verified` (not `legacy_failure` or `none`)

---

## Pattern 4: Common Debugging Scenarios

### Universal Links Not Opening App (iOS)

```
Problem: Tapping HTTPS link opens Safari instead of the app.

Checklist:
1. Is the link from a DIFFERENT domain? (Same-domain links always open in Safari)
2. Is the link tapped (not typed into Safari address bar)? (Typed URLs open in Safari)
3. Did you long-press and choose "Open in Safari" previously? (iOS remembers this choice)
   Fix: Long-press the link again and choose "Open in [App Name]"
4. Is the AASA file accessible? Check: curl https://yourdomain.com/.well-known/apple-app-site-association
5. Is associatedDomains configured WITHOUT https:// prefix?
6. Did you rebuild after adding associatedDomains? (Requires new native build)
7. Has the AASA cache expired? (Apple caches for up to 24 hours)
```

### App Links Not Verified (Android)

```
Problem: adb shell pm get-app-links shows "none" or "legacy_failure".

Checklist:
1. Is autoVerify: true set in intent filters?
2. Is assetlinks.json served over HTTPS with Content-Type: application/json?
3. Does the package_name match your android.package?
4. Are ALL signing key fingerprints included? (Both upload and Play Store signing keys)
5. Was the server accessible when the app was installed? (Verification happens at install time)
   Fix: Uninstall and reinstall the app
6. Try manual re-verification:
   adb shell pm set-app-links --package com.example.myapp 0 all
   adb shell pm verify-app-links --re-verify com.example.myapp
```

### Cold Start Link Not Handled

```
Problem: Opening a deep link when the app is not running does not navigate to the correct screen.

Checklist:
1. Are you calling Linking.getInitialURL() or using useURL()?
2. Is getInitialURL() called BEFORE the navigation container is ready?
   Fix: Delay navigation until the navigator is mounted
3. Is the initial URL being consumed before React Navigation processes it?
   Fix: Use React Navigation's linking config instead of manual handling
4. Is there a splash screen blocking the URL handling?
   Fix: Ensure URL processing happens after splash screen is dismissed
```

### URL Parameters Missing or Wrong

```
Problem: Screen receives empty or incorrect params from deep link.

Checklist:
1. Does the linking config path pattern match the URL structure?
   e.g., "user/:id" matches /user/123 but NOT /users/123
2. Are parse functions returning the correct types?
   e.g., parse: { id: Number } converts "123" to 123
3. Are query params being correctly extracted?
   Check: Linking.parse(url).queryParams
4. Is the URL properly encoded? Special characters need URL encoding.
```
