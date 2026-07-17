# Deep Linking - Verification Files

> AASA (iOS) and assetlinks.json (Android) setup, hosting requirements, and validation. See [SKILL.md](../SKILL.md) for decision guidance. See [examples/core.md](core.md) for app-side configuration.

---

## Pattern 1: Apple App Site Association (AASA) File

### File Location

Host at: `https://yourdomain.com/.well-known/apple-app-site-association`

In Expo Router projects, place at: `public/.well-known/apple-app-site-association`

**No file extension.** The file is named `apple-app-site-association` without `.json`.

### Modern Format (iOS 13+)

```json
{
  "applinks": {
    "details": [
      {
        "appIDs": ["ABCDE12345.com.example.myapp"],
        "components": [
          {
            "/": "/product/*",
            "comment": "Matches product pages"
          },
          {
            "/": "/user/*",
            "comment": "Matches user profiles"
          },
          {
            "/": "/order/*",
            "comment": "Matches order details"
          },
          {
            "/": "/settings",
            "comment": "Matches settings page exactly"
          },
          {
            "/": "/admin/*",
            "exclude": true,
            "comment": "Exclude admin paths from opening in app"
          }
        ]
      }
    ]
  },
  "activitycontinuation": {
    "apps": ["ABCDE12345.com.example.myapp"]
  },
  "webcredentials": {
    "apps": ["ABCDE12345.com.example.myapp"]
  }
}
```

**Format notes:**

- `appIDs` value format: `<APPLE_TEAM_ID>.<BUNDLE_ID>`
- Find your Team ID in Apple Developer portal under Membership
- `components` array uses pattern matching (iOS 13+, preferred)
- `exclude: true` prevents specific paths from opening the app
- `activitycontinuation` enables Handoff between devices
- `webcredentials` enables password autofill

### Legacy Format (iOS 12 and earlier)

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "ABCDE12345.com.example.myapp",
        "paths": ["/product/*", "/user/*", "/order/*", "NOT /admin/*"]
      }
    ]
  }
}
```

**Note:** `"apps": []` must be an empty array in the legacy format. Use `NOT` prefix to exclude paths.

### Wildcard Rules

| Pattern              | Matches                 | Does NOT Match                                       |
| -------------------- | ----------------------- | ---------------------------------------------------- |
| `/product/*`         | `/product/123`          | `/product/123/reviews` (single level only in legacy) |
| `/product/*/reviews` | `/product/123/reviews`  | `/product/123`                                       |
| `/user/?????`        | `/user/alice` (5 chars) | `/user/bob` (3 chars)                                |

**iOS 13+ components format:** The `*` wildcard in components matches across path separators, unlike the legacy format.

### App Config (Expo)

```json
{
  "expo": {
    "ios": {
      "associatedDomains": ["applinks:example.com"]
    }
  }
}
```

**Critical:** Do NOT include `https://` in the domain. Write `applinks:example.com`, not `applinks:https://example.com`.

---

## Pattern 2: Android Digital Asset Links (assetlinks.json)

### File Location

Host at: `https://yourdomain.com/.well-known/assetlinks.json`

In Expo Router projects, place at: `public/.well-known/assetlinks.json`

### File Structure

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.example.myapp",
      "sha256_cert_fingerprints": [
        "14:6D:E9:83:C5:7F:D8:4A:B4:2F:5E:E0:8F:3A:D6:F4:CA:41:1A:CF:45:BF:8D:10:76:76:CD:B1:55:AB:21:3E"
      ]
    }
  }
]
```

**Key fields:**

- `package_name`: Must match `android.package` in your app config
- `sha256_cert_fingerprints`: Array of SHA-256 fingerprints for your signing certificate(s)

### Getting SHA-256 Fingerprints

**Via EAS Build:**

```bash
eas credentials -p android
# Select your build profile
# Look for "SHA256 Fingerprint" in the output
```

**Via Google Play Console:**

Navigate to: Release > Setup > App Signing > Digital Asset Links JSON

**Via local keystore:**

```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android
# Look for SHA256 fingerprint in the output
```

**Important:** Include fingerprints for BOTH your upload key AND the Google Play signing key. If you only include the upload key, App Links will fail for Play Store builds (Google re-signs your app).

### Multiple Fingerprints (Development + Production)

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.example.myapp",
      "sha256_cert_fingerprints": ["AA:BB:CC:...", "DD:EE:FF:..."]
    }
  }
]
```

### App Config (Expo)

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
            },
            {
              "scheme": "https",
              "host": "example.com",
              "pathPrefix": "/user"
            }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

**Critical:** `autoVerify: true` is required. Without it, Android treats these as regular deep links and shows a disambiguation dialog.

---

## Pattern 3: Hosting Requirements

### Both Platforms

| Requirement   | Detail                                                   |
| ------------- | -------------------------------------------------------- |
| Protocol      | HTTPS only (no HTTP, no redirects from HTTP)             |
| Content-Type  | `application/json`                                       |
| Accessibility | Publicly accessible (no authentication, no geo-blocking) |
| Response code | 200 (not 301, 302, or any redirect)                      |
| File size     | < 128KB (Apple limit)                                    |
| CDN caching   | Be aware of cache TTL when updating files                |

### iOS-Specific

- Apple's CDN fetches and caches AASA files -- changes can take up to 24 hours to propagate
- The file is fetched when the app is installed, not when a link is tapped
- Use Apple's AASA validator: `https://app-site-association.cdn-apple.com/a/v1/yourdomain.com`

### Android-Specific

- Verification happens at app install time
- If your server is down during install, verification fails (links open in browser)
- Use Google's Digital Asset Links validator: `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://yourdomain.com&relation=delegate_permission/common.handle_all_urls`

---

## Pattern 4: Combined Setup Checklist

```
iOS Universal Links:
[ ] AASA file at /.well-known/apple-app-site-association (no .json extension)
[ ] Served over HTTPS with Content-Type: application/json
[ ] appIDs format: <TEAM_ID>.<BUNDLE_ID>
[ ] associatedDomains in app.config.js (without https://)
[ ] New native build after config change
[ ] Tested on real device (not just simulator)

Android App Links:
[ ] assetlinks.json at /.well-known/assetlinks.json
[ ] Served over HTTPS with Content-Type: application/json
[ ] package_name matches android.package in app config
[ ] SHA-256 fingerprints include BOTH upload key AND Play Store signing key
[ ] autoVerify: true in intent filters
[ ] intentFilters in app.config.js with correct host and pathPrefix
[ ] New native build after config change
[ ] Tested on real device (not just emulator)
```
