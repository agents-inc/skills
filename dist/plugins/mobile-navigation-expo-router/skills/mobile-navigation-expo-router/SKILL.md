---
name: mobile-navigation-expo-router
description: File-based routing and navigation for Expo/React Native
---

# Expo Router Patterns

> **Quick Guide:** File-based routing for React Native and web. Files in `app/` become routes automatically. Use `_layout.tsx` for navigation structure (Stack, Tabs), groups `(name)/` for URL-invisible organization, `[param]` for dynamic segments. SDK 53+: use `Stack.Protected` with a `guard` prop for authentication. Enable `typedRoutes` for compile-time route safety. API routes use `+api.ts` suffix.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST define navigation structure in `_layout.tsx` files -- screens without a layout parent default to a basic Stack)**

**(You MUST use `Stack.Protected` with `guard` prop for authentication flows in SDK 53+ -- NOT imperative redirects in useEffect)**

**(You MUST use `useLocalSearchParams` for route params in screens -- `useGlobalSearchParams` causes unnecessary re-renders on unfocused screens)**

**(You MUST enable `typedRoutes` in app.json experiments for compile-time route validation -- catches invalid navigation at build time)**

</critical_requirements>

---

**Auto-detection:** expo-router, Expo Router, file-based routing, \_layout.tsx, Stack.Screen, Tabs.Screen, useRouter, useLocalSearchParams, useSegments, usePathname, Link href, router.push, router.replace, router.dismiss, router.dismissTo, +api.ts, +not-found, Stack.Protected, generateStaticParams, expo-router/head, Slot, Redirect, useFocusEffect, NativeTabs, headless tabs, TabSlot, TabTrigger

**When to use:**

- Setting up file-based navigation in an Expo app
- Implementing authentication flows with route protection
- Creating tab, stack, or modal navigation layouts
- Building API routes for server-side logic
- Configuring typed routes for compile-time safety
- Adding deep linking and static rendering for web

**Key patterns covered:**

- File convention: `_layout.tsx`, `[param]`, `[...slug]`, `(group)/`, `+api.ts`, `+not-found.tsx`
- Layout navigators: Stack, Tabs, headless tabs, native tabs
- Authentication: `Stack.Protected` guard pattern (SDK 53+), redirect pattern (SDK 52)
- Navigation hooks: `useRouter`, `useLocalSearchParams`, `useSegments`, `usePathname`
- API routes with standard Request/Response
- Typed routes with auto-generated TypeScript definitions
- Modal routes, shared routes between tabs, nested navigation

**When NOT to use:**

- Apps that need fully custom native navigation controllers beyond what React Navigation provides
- Simple single-screen apps with no navigation
- Web-only projects where a web-native router is more appropriate

---

<philosophy>

## Philosophy

Expo Router maps the filesystem to your navigation hierarchy. Every file in `app/` is a route; every `_layout.tsx` defines how its sibling routes are presented (stack, tabs, drawer). This convention-over-configuration approach means:

1. **URLs are first-class** -- every screen has a URL, enabling deep linking on mobile and SEO on web without extra configuration
2. **Layouts are composable** -- nest `_layout.tsx` files to create any navigation structure (tabs containing stacks containing modals)
3. **The file tree IS the sitemap** -- new developers understand navigation by reading the directory structure, not a central config
4. **Universal by default** -- the same route definitions work on iOS, Android, and web

**Mental model:** Think of `app/` as a website. `_layout.tsx` files are the "chrome" (nav bars, tab bars). Route files are the "pages." Groups `(name)/` organize without affecting URLs. This maps directly to how web routing works, which is intentional -- Expo Router is built on top of React Navigation but presents a web-like API.

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: File Conventions

Every file in `app/` maps to a route. Special characters change behavior:

| File             | URL                  | Purpose                                  |
| ---------------- | -------------------- | ---------------------------------------- |
| `index.tsx`      | `/` (or parent path) | Default route for directory              |
| `about.tsx`      | `/about`             | Static route                             |
| `[id].tsx`       | `/:id`               | Dynamic segment                          |
| `[...slug].tsx`  | `/a/b/c`             | Catch-all segments                       |
| `_layout.tsx`    | N/A                  | Wraps sibling routes in navigator        |
| `(group)/`       | Not in URL           | Organizes routes without URL impact      |
| `+not-found.tsx` | N/A                  | 404 fallback for unmatched routes        |
| `+api.ts`        | Server endpoint      | API route handler                        |
| `+html.tsx`      | N/A                  | Root HTML wrapper (web static rendering) |

**Key insight:** Groups `(name)/` are purely organizational. `(tabs)/home.tsx` and `home.tsx` both resolve to `/home`. Use groups to apply different layouts to different route sets without changing URLs.

> Full directory structure examples: [examples/core.md](examples/core.md)

---

### Pattern 2: Layout Routes

`_layout.tsx` files wrap their sibling routes in a navigator. The layout determines HOW routes are presented (stack push, tab switch, modal overlay).

```typescript
// app/_layout.tsx -- Root layout wrapping entire app
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: "modal" }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
```

**Why this matters:** Without a `_layout.tsx`, routes get a default Stack navigator with default headers. Always define layouts explicitly for control over headers, transitions, and navigation structure.

**Gotcha:** The `name` prop in `Stack.Screen`/`Tabs.Screen` must match the filename (without extension) or directory name exactly. `name="(tabs)"` matches the `(tabs)/` directory.

> Full layout examples (tabs, nested stacks, drawers): [examples/core.md](examples/core.md)

---

### Pattern 3: Navigation Hooks

```typescript
import {
  useRouter,
  useLocalSearchParams,
  usePathname,
  useSegments,
} from "expo-router";

// useRouter -- imperative navigation
const router = useRouter();
router.push("/users/123"); // Add to stack
router.replace("/home"); // Replace current (no back)
router.back(); // Go back
router.dismiss(); // Pop one screen in nearest stack
router.dismissTo("/home"); // Pop until reaching /home
router.dismissAll(); // Pop to first screen in stack
router.canGoBack(); // Check if back is possible
router.canDismiss(); // Check if dismiss is possible
router.prefetch("/heavy-screen"); // Preload in background

// useLocalSearchParams -- route params for focused screen only
const { id } = useLocalSearchParams<{ id: string }>();

// usePathname -- current path without query params
const pathname = usePathname(); // "/users/123"

// useSegments -- raw file segments of current route
const segments = useSegments(); // ["users", "[id]"]
```

**Critical:** Use `useLocalSearchParams` over `useGlobalSearchParams`. The global variant re-renders the component whenever ANY route's params change -- even when the screen is unfocused in the background. Local only updates when the screen is focused.

> Full hook usage examples: [examples/core.md](examples/core.md)

---

### Pattern 4: Authentication with Stack.Protected (SDK 53+)

The recommended pattern uses `Stack.Protected` with a `guard` prop to declaratively show/hide routes based on auth state.

```typescript
// app/_layout.tsx
import { Stack } from "expo-router";
import { useSession } from "../ctx";

function RootNavigator() {
  const { session } = useSession();

  return (
    <Stack>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>

      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}
```

**How `guard` works:** When `guard` is `false`, the screens inside are inaccessible. If a user tries to navigate to a protected screen, or a screen becomes protected while active, they are redirected to the first available unprotected screen.

**Gotcha:** All routes remain defined and accessible in the file system. `Stack.Protected` controls runtime accessibility, not build-time elimination. Deep links to protected routes trigger redirects to the sign-in screen.

> Full auth pattern with SessionProvider and splash screen: [examples/auth.md](examples/auth.md)
> Legacy redirect pattern (SDK 52): [examples/auth.md](examples/auth.md)

---

### Pattern 5: Modal Routes

Modals are defined as regular route files but configured with `presentation: "modal"` in the parent layout.

```typescript
// app/_layout.tsx
<Stack>
  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
  <Stack.Screen
    name="modal"
    options={{
      presentation: "modal",
      headerShown: true,
      title: "Settings",
    }}
  />
  <Stack.Screen
    name="sheet"
    options={{
      presentation: "formSheet",
      sheetGrabberVisible: true,
      sheetCornerRadius: 16,
    }}
  />
</Stack>
```

**Key insight:** Modals sit outside tab groups so they overlay the entire app. Navigation to a modal from any tab: `router.push("/modal")`. Dismiss with `router.back()` or `router.dismiss()`.

> Full modal examples: [examples/core.md](examples/core.md)

---

### Pattern 6: API Routes

Files with `+api.ts` suffix define server-side endpoints. They use standard Web `Request`/`Response` APIs.

```typescript
// app/api/users+api.ts
export async function GET(request: Request) {
  const users = await db.users.findMany();
  return Response.json(users);
}

export async function POST(request: Request) {
  const body = await request.json();
  const user = await db.users.create(body);
  return Response.json(user, { status: 201 });
}
```

**Requires** `web.output: "server"` in app.json. For native apps, set `origin` in the expo-router plugin config to point to your deployed server.

**Limitation:** API routes bundle to CommonJS, no dynamic imports, no platform-specific extensions (`+api.web.ts` does not work).

> Full API route examples with error handling: [examples/api-routes.md](examples/api-routes.md)

---

### Pattern 7: Typed Routes

Enable compile-time route validation by setting `experiments.typedRoutes: true` in app.json. The dev server auto-generates type definitions.

```typescript
// With typedRoutes enabled:
router.push("/about"); // OK
router.push("/nonexistent"); // TypeScript error
router.push({
  pathname: "/users/[id]",
  params: { id: "123" }, // Typed params required
});

// Typed search params
const { id } = useLocalSearchParams<"/users/[id]">();
// id is typed as string
```

**Gotcha:** Generated types are git-ignored. CI pipelines need `npx expo customize tsconfig.json` to regenerate types before type-checking. Relative paths are not supported -- always use absolute paths.

> Typed routes setup and examples: [examples/core.md](examples/core.md)

---

### Pattern 8: Static Rendering and Head Metadata (Web)

Static rendering generates HTML at build time for SEO and fast initial loads.

```typescript
// app.json: { "web": { "output": "static" } }

// app/about.tsx
import Head from "expo-router/head";
import { Text } from "react-native";

export default function AboutPage() {
  return (
    <>
      <Head>
        <title>About Us</title>
        <meta name="description" content="Learn about our company" />
      </Head>
      <Text>About page content</Text>
    </>
  );
}
```

For dynamic routes, export `generateStaticParams` to pre-render pages at build time:

```typescript
export async function generateStaticParams() {
  const posts = await getPosts();
  return posts.map((post) => ({ id: post.id }));
}
```

> Full static rendering and Head examples: [examples/web.md](examples/web.md)

</patterns>

---

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Directory structure, layouts, tabs, navigation hooks, typed routes, modals
- [examples/auth.md](examples/auth.md) - Stack.Protected pattern, SessionProvider, legacy redirect pattern
- [examples/api-routes.md](examples/api-routes.md) - API route handlers, error handling, deployment
- [examples/web.md](examples/web.md) - Static rendering, Head metadata, root HTML
- [reference.md](reference.md) - Decision frameworks, version compatibility

---

<decision_framework>

## Decision Frameworks

Expo Router provides multiple navigation patterns. The key decisions:

1. **Route type** -- static, dynamic, catch-all, grouped, API? See [reference.md](reference.md) for the full route type decision tree.
2. **Navigation method** -- declarative `<Link>` vs imperative `router.push/replace/dismiss`? See [reference.md](reference.md) for the navigation method decision tree.
3. **Layout navigator** -- Stack, Tabs, NativeTabs, headless tabs, or `<Slot />`? See [reference.md](reference.md) for the layout navigator selection guide.
4. **Hook choice** -- `useLocalSearchParams` vs `useGlobalSearchParams`, `useRouter` vs `<Link>`, `useFocusEffect` vs `useEffect`? See [reference.md](reference.md) for the hook selection table.

**Quick rules:**

- Prefer `<Link>` for static navigation in UI, `router.push` for programmatic navigation in event handlers
- Always use `useLocalSearchParams` unless you specifically need background screen updates
- Use `useFocusEffect` instead of `useEffect` when data should refresh on screen focus

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- **Using `useGlobalSearchParams` when `useLocalSearchParams` works** -- global causes re-renders on ALL route changes, even when screen is in background; use local for screen-specific params
- **Imperative redirects in useEffect for auth (SDK 53+)** -- use `Stack.Protected` with `guard` prop instead; it's declarative, handles edge cases, and integrates with deep linking correctly
- **Missing `_layout.tsx` in route groups** -- without a layout, the default Stack has default headers and no control over transitions; always define layouts explicitly
- **Storing secrets in API route responses without authentication** -- API routes are public endpoints; validate authentication tokens before returning sensitive data

**Medium Priority Issues:**

- **`name` prop mismatch in layout screens** -- `Stack.Screen name="tabs"` does not match directory `(tabs)/`; must be `name="(tabs)"` exactly
- **Not using `presentation: "modal"` in parent layout** -- configuring modal in the modal file's own layout does nothing; modals must be configured in the parent navigator
- **Calling `router.replace` in initial render** -- causes navigation before the navigator is ready; use `Redirect` component or `useFocusEffect` instead

**Gotchas & Edge Cases:**

- **Deep links to protected routes:** `Stack.Protected` redirects to the first unprotected screen -- deep link target is lost unless you store and replay it after auth
- **Catch-all `[...slug]` params:** Always an array, but `useLocalSearchParams` may return a string if only one segment; always normalize with `Array.isArray(slug) ? slug : [slug]`
- **Tab groups reset on tab switch:** By default, switching tabs resets the tab's stack; use `backBehavior: "history"` in Tabs layout to preserve stack per tab
- **Android 5-tab limit:** Material Design constrains bottom tabs to 5; native tabs enforce this
- **`+not-found.tsx` only catches at its directory level** -- a `+not-found.tsx` in `app/` won't catch 404s inside `app/docs/`; each directory needs its own if required
- **Static rendering `generateStaticParams` runs in Node.js** -- no access to React Native APIs, browser APIs, or native modules
- **API route limitation:** No dynamic imports, no platform-specific extensions (`+api.web.ts` is invalid), bundles to CommonJS
- **Typed routes are git-ignored** -- CI pipelines fail type checks unless types are regenerated with `npx expo customize tsconfig.json`
- **Route files require `export default`** -- Expo Router discovers screens via default exports; this overrides project "named exports only" conventions for files in `app/`

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST define navigation structure in `_layout.tsx` files -- screens without a layout parent default to a basic Stack)**

**(You MUST use `Stack.Protected` with `guard` prop for authentication flows in SDK 53+ -- NOT imperative redirects in useEffect)**

**(You MUST use `useLocalSearchParams` for route params in screens -- `useGlobalSearchParams` causes unnecessary re-renders on unfocused screens)**

**(You MUST enable `typedRoutes` in app.json experiments for compile-time route validation -- catches invalid navigation at build time)**

**Failure to follow these rules will cause navigation bugs, auth bypasses, unnecessary re-renders, and runtime routing errors that typed routes would catch at compile time.**

</critical_reminders>
