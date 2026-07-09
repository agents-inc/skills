# Expo Router Quick Reference

> Decision frameworks, version compatibility, and quick-lookup tables. See [SKILL.md](SKILL.md) for decisions, philosophy, and red flags.

---

## Route Type Decision Framework

```
What type of route do you need?
|
+-> Static page (about, settings)?
|   +-> about.tsx -> /about
|
+-> Default/index for a directory?
|   +-> index.tsx -> / (or parent path)
|
+-> Dynamic content (user profile, product)?
|   +-> [id].tsx -> /users/:id
|
+-> Variable-depth path (docs, breadcrumbs)?
|   +-> [...slug].tsx -> /docs/a/b/c
|
+-> Tab navigation?
|   +-> (tabs)/ group with Tabs in _layout.tsx
|
+-> Auth-protected section?
|   +-> Stack.Protected with guard prop (SDK 53+)
|   +-> Redirect component in layout (SDK 52)
|
+-> Modal/sheet overlay?
|   +-> presentation: "modal" or "formSheet" in parent layout
|
+-> Server endpoint?
|   +-> filename+api.ts with HTTP method exports
|
+-> 404 fallback?
    +-> +not-found.tsx at desired directory level
```

---

## Navigation Method Decision Framework

```
How should navigation happen?
|
+-> Static link in UI?
|   +-> <Link href="/path"> (declarative, preferred)
|
+-> Programmatic navigation in event handler?
|   +-> router.push("/path") -- adds to history
|
+-> Replace current screen (login -> home)?
|   +-> router.replace("/path") -- no back
|
+-> Go back one screen?
|   +-> router.back()
|
+-> Dismiss modal/sheet?
|   +-> router.dismiss() -- pop one in nearest stack
|
+-> Dismiss to specific screen in stack?
|   +-> router.dismissTo("/path")
|
+-> Dismiss all screens to root of stack?
|   +-> router.dismissAll()
|
+-> Check if navigation is possible?
|   +-> router.canGoBack() / router.canDismiss()
|
+-> Preload a heavy screen?
|   +-> router.prefetch("/path")
|
+-> Redirect during render (not in handler)?
    +-> <Redirect href="/path" /> component
```

---

## Layout Navigator Selection

```
How should routes be presented?
|
+-> Push/pop screens with back button?
|   +-> Stack (default)
|
+-> Bottom tab bar with persistent screens?
|   +-> Tabs (JS-based, full control)
|   +-> NativeTabs (SDK 54+, alpha, iOS Liquid Glass)
|
+-> Fully custom tab bar UI?
|   +-> Headless tabs from expo-router/ui (TabList, TabTrigger, TabSlot)
|
+-> Overlay on top of current content?
|   +-> Stack.Screen with presentation: "modal" or "formSheet"
|
+-> Just render child route content?
    +-> <Slot /> (raw outlet, no navigator chrome)
```

---

## Hook Selection

| Hook                         | Returns                 | Re-renders when                     | Use for                             |
| ---------------------------- | ----------------------- | ----------------------------------- | ----------------------------------- |
| `useLocalSearchParams<T>()`  | Route + query params    | Screen is focused and params change | Screen-specific param access        |
| `useGlobalSearchParams<T>()` | Route + query params    | ANY route's params change           | Background analytics, rarely needed |
| `useRouter()`                | Router object           | Never (stable ref)                  | Imperative navigation in handlers   |
| `usePathname()`              | Current path string     | Path changes                        | Displaying current location         |
| `useSegments()`              | File segment array      | Segments change                     | Auth checks, conditional logic      |
| `useFocusEffect(cb)`         | void                    | Screen focus/blur                   | Data fetching on screen focus       |
| `useNavigation(parent?)`     | React Navigation object | Varies                              | Low-level navigator control         |

---

## File Convention Quick Reference

| Convention       | Example                  | Purpose                      |
| ---------------- | ------------------------ | ---------------------------- |
| `index.tsx`      | `app/index.tsx`          | Default route for directory  |
| `[param].tsx`    | `app/users/[id].tsx`     | Dynamic route segment        |
| `[...param].tsx` | `app/docs/[...slug].tsx` | Catch-all route              |
| `_layout.tsx`    | `app/(tabs)/_layout.tsx` | Navigator wrapping siblings  |
| `(group)/`       | `app/(tabs)/`            | URL-invisible grouping       |
| `(a,b)/`         | `app/(feed,search)/`     | Shared routes between groups |
| `+not-found.tsx` | `app/+not-found.tsx`     | 404 fallback                 |
| `+api.ts`        | `app/api/users+api.ts`   | Server-side API route        |
| `+html.tsx`      | `app/+html.tsx`          | Root HTML wrapper (web)      |
| `+middleware.ts` | `app/+middleware.ts`     | Server middleware (v6+)      |

---

## Version Compatibility

| Feature                              | Minimum Version         | Notes                                     |
| ------------------------------------ | ----------------------- | ----------------------------------------- |
| File-based routing                   | Expo Router v1 / SDK 49 | Core feature                              |
| Typed routes                         | Expo Router v2 / SDK 50 | `experiments.typedRoutes` in app.json     |
| `dismissTo` / `dismissAll`           | Expo Router v4 / SDK 52 | Stack dismiss methods                     |
| Headless tabs (`expo-router/ui`)     | Expo Router v4 / SDK 52 | TabList, TabTrigger, TabSlot              |
| API routes (`+api.ts`)               | Expo Router v3 / SDK 50 | Requires `web.output: "server"`           |
| Stack.Protected (guard)              | Expo Router v5 / SDK 53 | Replaces redirect-based auth              |
| Build-time redirects/rewrites        | Expo Router v5 / SDK 53 | Config in app.json                        |
| React Server Functions               | Expo Router v5 / SDK 53 | Beta, requires server output              |
| NativeTabs (Liquid Glass)            | Expo Router v6 / SDK 54 | Alpha, import from `unstable-native-tabs` |
| Link.Preview / Link.Menu             | Expo Router v6 / SDK 54 | iOS context menus                         |
| Server middleware (`+middleware.ts`) | Expo Router v6 / SDK 54 | Edge middleware                           |
| Stack.Toolbar                        | Expo Router v7 / SDK 55 | Toolbar component                         |
| SplitView (experimental)             | Expo Router v7 / SDK 55 | iPad/desktop split views                  |

---

## Anti-Patterns

> See [SKILL.md](SKILL.md) RED FLAGS section for the full anti-pattern list with explanations.
