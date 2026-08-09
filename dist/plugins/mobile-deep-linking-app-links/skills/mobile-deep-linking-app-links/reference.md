# Deep Linking & App Links Reference

> Quick-lookup tables and API reference. See [SKILL.md](SKILL.md) for decision frameworks, red flags, and anti-patterns. See [examples/testing.md](examples/testing.md) for debugging scenarios.

---

## expo-linking API Quick Reference

| Method                        | Returns                   | Purpose                                     |
| ----------------------------- | ------------------------- | ------------------------------------------- |
| `useURL()`                    | `string \| null`          | Hook: initial URL + subsequent URL changes  |
| `getInitialURL()`             | `Promise<string \| null>` | Cold start URL (one-time)                   |
| `addEventListener('url', cb)` | `Subscription`            | Listen for URL changes while app is running |
| `createURL(path, opts?)`      | `string`                  | Build a deep link URL for your app          |
| `parse(url)`                  | `ParsedURL`               | Extract scheme, hostname, path, queryParams |
| `openURL(url)`                | `Promise<true>`           | Open a URL in the appropriate app           |
| `canOpenURL(url)`             | `Promise<boolean>`        | Check if a URL can be handled               |

### ParsedURL Shape

```typescript
interface ParsedURL {
  scheme: string | null;
  hostname: string | null;
  path: string | null;
  queryParams: Record<string, string>;
}
```

---

## React Navigation Linking Config Shape

```typescript
interface LinkingOptions<ParamList> {
  prefixes: string[];
  config?: {
    screens: {
      [ScreenName: string]:
        | string
        | {
            path: string;
            exact?: boolean;
            parse?: Record<string, (value: string) => unknown>;
            stringify?: Record<string, (value: unknown) => string>;
            screens?: {
              /* nested screens */
            };
            initialRouteName?: string;
            alias?: string[];
          };
    };
  };
  getInitialURL?: () => Promise<string | null>;
  subscribe?: (listener: (url: string) => void) => () => void;
  getStateFromPath?: (path: string, options?: object) => object;
  getPathFromState?: (state: object, options?: object) => string;
  filter?: (url: string) => boolean;
}
```

---

## Testing Commands Quick Reference

```bash
# iOS Simulator
xcrun simctl openurl booted "myapp://profile/123"
xcrun simctl openurl booted "https://example.com/product/456"

# Android
adb shell am start -W -a android.intent.action.VIEW -d "myapp://profile/123" com.example.myapp
adb shell pm get-app-links com.example.myapp
adb shell pm verify-app-links --re-verify com.example.myapp

# Expo uri-scheme
npx uri-scheme open "myapp://profile/123" --ios
npx uri-scheme open "myapp://profile/123" --android
npx uri-scheme list --ios

# Validate server files
curl -s "https://app-site-association.cdn-apple.com/a/v1/yourdomain.com" | jq .
curl -s "https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://yourdomain.com&relation=delegate_permission/common.handle_all_urls" | jq .
```
