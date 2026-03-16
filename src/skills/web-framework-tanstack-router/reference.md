# TanStack Router Quick Reference

> Route options, hooks, and components at a glance. See [SKILL.md](SKILL.md) for core patterns and [examples/tanstack-router.md](examples/tanstack-router.md) for practical examples.

---

## Route Options

Options passed to `createFileRoute`, `createRootRoute`, or `createRootRouteWithContext`.

| Option              | Type                              | Purpose                                                             |
| ------------------- | --------------------------------- | ------------------------------------------------------------------- |
| `component`         | `() => ReactNode`                 | Route component to render                                           |
| `loader`            | `(ctx) => Promise<T>`             | Fetch data before render (parallel with siblings)                   |
| `beforeLoad`        | `(ctx) => Promise<T>`             | Middleware: auth checks, redirects, context enrichment (sequential) |
| `validateSearch`    | `Validator \| (input) => T`       | Validate and type search params                                     |
| `pendingComponent`  | `() => ReactNode`                 | Loading UI while loader resolves                                    |
| `pendingMs`         | `number`                          | Delay (ms) before showing pending component                         |
| `pendingMinMs`      | `number`                          | Minimum display time (ms) for pending component                     |
| `errorComponent`    | `({ error, reset }) => ReactNode` | Error UI when loader throws                                         |
| `notFoundComponent` | `() => ReactNode`                 | UI when `notFound()` is thrown                                      |
| `staleTime`         | `number`                          | Cache freshness duration (ms)                                       |
| `gcTime`            | `number`                          | Cache retention duration after stale (ms)                           |
| `preloadStaleTime`  | `number`                          | Separate stale time for preloaded data                              |
| `onError`           | `(error) => void`                 | Error callback                                                      |
| `onEnter`           | `() => void`                      | Called when route is entered                                        |
| `onStay`            | `() => void`                      | Called when route params change but route stays                     |
| `onLeave`           | `() => void`                      | Called when route is left                                           |
| `search`            | `{ middlewares: [] }`             | Search param middleware (retain, strip)                             |

---

## Loader Context

Properties available in `loader` and `beforeLoad` functions.

| Property          | Available In | Type                            | Purpose                                         |
| ----------------- | ------------ | ------------------------------- | ----------------------------------------------- |
| `params`          | Both         | `RouteParams`                   | Path parameters (typed from route path)         |
| `search`          | `loader`     | `SearchSchema`                  | Validated search params                         |
| `context`         | Both         | `RouterContext & ParentContext` | Router context + parent beforeLoad additions    |
| `location`        | Both         | `ParsedLocation`                | Current location (pathname, search, hash, href) |
| `abortController` | `loader`     | `AbortController`               | Signal for cancelling fetch on navigation       |
| `cause`           | Both         | `"enter" \| "stay"`             | Why the loader is running                       |
| `preload`         | `loader`     | `boolean`                       | Whether this is a preload (not a navigation)    |

---

## Hooks

| Hook                        | Returns          | Purpose                                       |
| --------------------------- | ---------------- | --------------------------------------------- |
| `Route.useSearch()`         | `SearchSchema`   | Validated search params for this route        |
| `Route.useParams()`         | `RouteParams`    | Path params for this route                    |
| `Route.useLoaderData()`     | `LoaderReturn`   | Data from this route's loader                 |
| `Route.useRouteContext()`   | `RouteContext`   | Context for this route                        |
| `Route.useMatch()`          | `RouteMatch`     | Full match info (isFetching, status, etc.)    |
| `useSearch({ from })`       | `SearchSchema`   | Search params (specify route with `from`)     |
| `useParams({ from })`       | `RouteParams`    | Path params (specify route with `from`)       |
| `useLoaderData({ from })`   | `LoaderReturn`   | Loader data (specify route with `from`)       |
| `useRouteContext({ from })` | `RouteContext`   | Route context (specify route with `from`)     |
| `useNavigate()`             | `NavigateFn`     | Imperative navigation function                |
| `useRouter()`               | `Router`         | Router instance                               |
| `useRouterState()`          | `RouterState`    | Current router state (location, status, etc.) |
| `useMatch({ from })`        | `RouteMatch`     | Match info for a specific route               |
| `useMatches()`              | `RouteMatch[]`   | All active route matches                      |
| `useLocation()`             | `ParsedLocation` | Current location                              |

**Route-scoped vs global hooks:** `Route.useSearch()` is type-safe for that specific route. `useSearch({ from: '/posts' })` achieves the same but requires specifying the route path. Use `Route.useX()` in the route's own component; use `useX({ from })` in shared child components.

---

## Components

| Component                  | Props                           | Purpose                            |
| -------------------------- | ------------------------------- | ---------------------------------- |
| `<RouterProvider>`         | `router`                        | Provides router to the React tree  |
| `<Outlet />`               | none                            | Renders matched child route        |
| `<Link>`                   | `to, params, search, hash, ...` | Type-safe navigation link          |
| `<Navigate>`               | Same as `Link`                  | Imperative navigation on render    |
| `<CatchNotFound>`          | `fallback, onCatch`             | Catches `notFound()` from children |
| `<TanStackRouterDevtools>` | `position, initialIsOpen`       | Development tools panel            |

---

## Link Component Props

| Prop             | Type                                          | Default  | Purpose                              |
| ---------------- | --------------------------------------------- | -------- | ------------------------------------ |
| `to`             | `string`                                      | required | Target route path (type-safe)        |
| `params`         | `RouteParams`                                 | -        | Path parameters                      |
| `search`         | `SearchSchema \| (prev) => SearchSchema`      | -        | Search params (object or updater)    |
| `hash`           | `string`                                      | -        | URL hash fragment                    |
| `from`           | `string`                                      | -        | Base route for relative resolution   |
| `replace`        | `boolean`                                     | `false`  | Replace history entry                |
| `preload`        | `"intent" \| "render" \| "viewport" \| false` | -        | Preload strategy                     |
| `preloadDelay`   | `number`                                      | -        | Delay (ms) before intent preload     |
| `activeProps`    | `LinkProps`                                   | -        | Props applied when route is active   |
| `inactiveProps`  | `LinkProps`                                   | -        | Props applied when route is inactive |
| `activeOptions`  | `{ exact, includeSearch, includeHash }`       | -        | Active detection config              |
| `disabled`       | `boolean`                                     | `false`  | Disable navigation                   |
| `resetScroll`    | `boolean`                                     | `true`   | Reset scroll on navigation           |
| `viewTransition` | `boolean`                                     | -        | Enable View Transitions API          |

**Active state data attributes:** Active links get `data-status="active"` and `aria-current="page"`.

---

## Router Options

Options passed to `createRouter()`.

| Option                     | Type                                          | Default   | Purpose                              |
| -------------------------- | --------------------------------------------- | --------- | ------------------------------------ |
| `routeTree`                | `RouteTree`                                   | required  | Generated route tree                 |
| `context`                  | `RouterContext`                               | -         | Initial router context               |
| `defaultPreload`           | `"intent" \| "render" \| "viewport" \| false` | `false`   | Default preload strategy             |
| `defaultStaleTime`         | `number`                                      | `0`       | Default loader cache freshness (ms)  |
| `defaultGcTime`            | `number`                                      | `1800000` | Default cache retention (ms, 30 min) |
| `defaultPreloadStaleTime`  | `number`                                      | `30000`   | Default preload stale time (ms, 30s) |
| `defaultPendingMs`         | `number`                                      | `1000`    | Default pending delay (ms)           |
| `defaultPendingMinMs`      | `number`                                      | `500`     | Default minimum pending display (ms) |
| `defaultNotFoundComponent` | `() => ReactNode`                             | -         | Global 404 component                 |
| `defaultErrorComponent`    | `ErrorComponent`                              | -         | Global error component               |
| `Wrap`                     | `({ children }) => ReactNode`                 | -         | Wrap entire router (providers)       |
| `InnerWrap`                | `({ children }) => ReactNode`                 | -         | Wrap inside router context           |

---

## File Naming Quick Reference

| Convention       | File                       | URL             | Notes                      |
| ---------------- | -------------------------- | --------------- | -------------------------- |
| Index route      | `routes/index.tsx`         | `/`             | Home page                  |
| Static route     | `routes/about.tsx`         | `/about`        | Static path segment        |
| Dynamic param    | `routes/$postId.tsx`       | `/:postId`      | String parameter           |
| Directory index  | `routes/posts/index.tsx`   | `/posts`        | Index for directory        |
| Directory layout | `routes/posts/route.tsx`   | `/posts/*`      | Layout wrapper             |
| Pathless layout  | `routes/_auth.tsx`         | (none)          | Layout without URL segment |
| Non-nested       | `routes/posts_.detail.tsx` | `/posts/detail` | Escapes parent layout      |
| Catch-all        | `routes/$.tsx`             | `/*`            | Splat route                |
| Ignored          | `routes/-utils.tsx`        | (none)          | Not a route                |
| Group            | `routes/(admin)/`          | (none)          | Organizational only        |

---

## Search Param Validation Quick Reference

```typescript
// With Zod adapter
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";

const schema = z.object({
  page: fallback(z.number(), 1).default(1),
  q: fallback(z.string(), "").default(""),
});

validateSearch: zodValidator(schema);

// Plain function
validateSearch: (input: Record<string, unknown>): SearchType => ({
  page: Number(input.page ?? 1) || 1,
});

// Zod 3.24.0+ Standard Schema (no adapter needed)
validateSearch: z.object({
  page: z.number().default(1),
});
```

---

## Common Patterns Cheat Sheet

```typescript
// Navigate imperatively
const navigate = useNavigate();
navigate({ to: "/posts/$postId", params: { postId: "1" } });

// Redirect from loader
throw redirect({ to: "/login", search: { redirect: location.href } });

// Throw not-found
throw notFound();

// Access loader data
const data = Route.useLoaderData();

// Access search params
const search = Route.useSearch();

// Access path params
const params = Route.useParams();

// Access route context
const ctx = Route.useRouteContext();

// Invalidate loader cache
router.invalidate();

// Check if fetching (background refetch)
const { isFetching } = Route.useMatch();
```
