# React Router Quick Reference

> Route options, hooks, and components at a glance. See [SKILL.md](SKILL.md) for core patterns and [examples/](examples/) for practical examples.

---

## Route Object Properties

Properties available on route objects passed to `createBrowserRouter`.

| Property           | Type                                   | Purpose                                                        |
| ------------------ | -------------------------------------- | -------------------------------------------------------------- |
| `path`             | `string`                               | URL path pattern (e.g. `"posts/:id"`)                          |
| `index`            | `boolean`                              | Index route (matches parent path exactly)                      |
| `element`          | `ReactNode`                            | Component to render (JSX)                                      |
| `Component`        | `React.ComponentType`                  | Component to render (reference, avoids JSX in config)          |
| `loader`           | `LoaderFunction`                       | Fetch data before render                                       |
| `action`           | `ActionFunction`                       | Handle form submissions/mutations                              |
| `errorElement`     | `ReactNode`                            | Error UI for this route's errors                               |
| `ErrorBoundary`    | `React.ComponentType`                  | Error component (reference, alternative to `errorElement`)     |
| `children`         | `RouteObject[]`                        | Nested child routes                                            |
| `lazy`             | `() => Promise<RouteModule>` or object | Lazy-load route module(s)                                      |
| `shouldRevalidate` | `ShouldRevalidateFunction`             | Control when loaders re-run after actions                      |
| `handle`           | `any`                                  | Custom data attached to route (accessible via `useMatches`)    |
| `id`               | `string`                               | Unique route identifier (for `useRouteLoaderData`)             |
| `HydrateFallback`  | `React.ComponentType`                  | UI shown during initial hydration (replaces `fallbackElement`) |

---

## Loader and Action Function Signatures

```typescript
// Loader — fetches data before the route renders
interface LoaderFunctionArgs {
  request: Request; // Standard Web Request (URL, headers, signal)
  params: Params; // Path params (always strings)
}
type LoaderFunction = (args: LoaderFunctionArgs) => Promise<any> | any;

// Action — handles Form/fetcher submissions
interface ActionFunctionArgs {
  request: Request; // Contains FormData, JSON, etc.
  params: Params; // Path params (always strings)
}
type ActionFunction = (args: ActionFunctionArgs) => Promise<any> | any;
```

**Key:** `request` is a standard Web `Request`. Use `request.formData()` for form submissions, `request.json()` for JSON bodies, `request.url` for search params.

---

## Hooks

| Hook                     | Returns                    | Purpose                                             |
| ------------------------ | -------------------------- | --------------------------------------------------- |
| `useLoaderData()`        | `any`                      | Data returned from the route's loader               |
| `useActionData()`        | `any \| undefined`         | Data returned from the route's action               |
| `useNavigation()`        | `Navigation`               | Current navigation state (idle/loading/submitting)  |
| `useNavigate()`          | `NavigateFunction`         | Imperative navigation                               |
| `useParams()`            | `Params`                   | Path parameters (always strings)                    |
| `useSearchParams()`      | `[URLSearchParams, SetFn]` | Read/write URL search parameters                    |
| `useRouteError()`        | `unknown`                  | Error caught by nearest `errorElement`              |
| `useFetcher()`           | `Fetcher`                  | Non-navigating loader/action calls                  |
| `useFetchers()`          | `Fetcher[]`                | All active fetchers                                 |
| `useLocation()`          | `Location`                 | Current location (pathname, search, hash, state)    |
| `useOutletContext<T>()`  | `T`                        | Context from parent's `<Outlet context={...} />`    |
| `useOutlet()`            | `ReactElement \| null`     | The child route element (alternative to `<Outlet>`) |
| `useMatch(pattern)`      | `PathMatch \| null`        | Match result for a path pattern                     |
| `useMatches()`           | `RouteMatch[]`             | All matched routes (includes `handle` data)         |
| `useRevalidator()`       | `Revalidator`              | Manually trigger loader revalidation                |
| `useRouteLoaderData(id)` | `any`                      | Loader data from a specific route by ID             |
| `useSubmit()`            | `SubmitFunction`           | Imperative form submission                          |
| `useBlocker(when)`       | `Blocker`                  | Block navigation (unsaved changes prompt)           |
| `useBeforeUnload(cb)`    | `void`                     | Run callback before page unload                     |

---

## Navigation Object (useNavigation)

| Property      | Type                                  | Purpose                                       |
| ------------- | ------------------------------------- | --------------------------------------------- |
| `state`       | `"idle" \| "loading" \| "submitting"` | Current navigation phase                      |
| `location`    | `Location \| undefined`               | Destination location (if navigating)          |
| `formMethod`  | `string \| undefined`                 | HTTP method (uppercase: `"POST"`, `"DELETE"`) |
| `formAction`  | `string \| undefined`                 | Action URL being submitted to                 |
| `formData`    | `FormData \| undefined`               | Form data being submitted                     |
| `formEncType` | `string \| undefined`                 | Form encoding type                            |
| `json`        | `any \| undefined`                    | JSON data being submitted                     |
| `text`        | `string \| undefined`                 | Text data being submitted                     |

---

## Fetcher Object (useFetcher)

| Property/Method | Type                                  | Purpose                                   |
| --------------- | ------------------------------------- | ----------------------------------------- |
| `state`         | `"idle" \| "loading" \| "submitting"` | Fetcher phase (independent of navigation) |
| `data`          | `any`                                 | Data returned from action or loader       |
| `Form`          | `React.ComponentType`                 | Form that submits without navigation      |
| `load(href)`    | `(href: string) => void`              | Load data from a route's loader           |
| `submit(data)`  | `SubmitFunction`                      | Submit to a route's action                |
| `reset()`       | `() => void`                          | Clear fetcher state and data              |
| `key`           | `string`                              | Unique identifier for this fetcher        |
| `formMethod`    | `string \| undefined`                 | HTTP method being used                    |
| `formAction`    | `string \| undefined`                 | Action URL being submitted to             |
| `formData`      | `FormData \| undefined`               | Form data being submitted                 |

---

## Components

| Component             | Key Props                                                      | Purpose                               |
| --------------------- | -------------------------------------------------------------- | ------------------------------------- |
| `<RouterProvider>`    | `router`                                                       | Provides router to the React tree     |
| `<Outlet />`          | `context?`                                                     | Renders matched child route           |
| `<Link>`              | `to, replace, state, preventScrollReset`                       | Navigation link                       |
| `<NavLink>`           | Same as Link + `className(isActive)`, `style(isActive)`, `end` | Link with active state                |
| `<Navigate>`          | `to, replace, state`                                           | Imperative navigation on render       |
| `<Form>`              | `method, action, encType, navigate`                            | Data mutation form (triggers action)  |
| `<ScrollRestoration>` | `getKey?`                                                      | Restore scroll position on navigation |
| `<Await>`             | `resolve, errorElement, children`                              | Render deferred promise data          |

---

## Link and NavLink Props

| Prop                 | Type                      | Default   | Purpose                       |
| -------------------- | ------------------------- | --------- | ----------------------------- |
| `to`                 | `string \| Partial<Path>` | required  | Target URL                    |
| `replace`            | `boolean`                 | `false`   | Replace history entry         |
| `state`              | `any`                     | -         | Location state (not in URL)   |
| `preventScrollReset` | `boolean`                 | `false`   | Keep scroll position          |
| `relative`           | `"route" \| "path"`       | `"route"` | How to resolve relative links |
| `reloadDocument`     | `boolean`                 | `false`   | Full page reload              |
| `viewTransition`     | `boolean`                 | `false`   | Enable View Transitions API   |

**NavLink extras:**

| Prop        | Type                                          | Purpose                                   |
| ----------- | --------------------------------------------- | ----------------------------------------- |
| `className` | `string \| ((props) => string)`               | Dynamic class based on active/pending     |
| `style`     | `CSSProperties \| ((props) => CSSProperties)` | Dynamic style based on active/pending     |
| `end`       | `boolean`                                     | Match exact path only (not children)      |
| `children`  | `ReactNode \| ((props) => ReactNode)`         | Render function with active/pending state |

**NavLink render function props:** `{ isActive: boolean, isPending: boolean, isTransitioning: boolean }`

---

## Utility Functions

| Function                        | Purpose                                               |
| ------------------------------- | ----------------------------------------------------- |
| `redirect(url, init?)`          | Create a redirect Response (throw from loader/action) |
| `redirectDocument(url)`         | Full-page redirect (not client-side)                  |
| `isRouteErrorResponse(e)`       | Type guard: is error from a thrown Response?          |
| `generatePath(pattern, params)` | Generate a path string from a pattern and params      |
| `matchPath(pattern, pathname)`  | Test if a path matches a pattern                      |
| `matchRoutes(routes, location)` | Find matching routes for a location                   |
| `createSearchParams(init)`      | Create URLSearchParams from various input types       |
| `parsePath(path)`               | Parse a path string into pathname/search/hash         |

---

## createBrowserRouter Options

| Option                    | Type                          | Purpose                                                  |
| ------------------------- | ----------------------------- | -------------------------------------------------------- |
| `basename`                | `string`                      | Base path prefix for all routes                          |
| `hydrationData`           | `HydrationData`               | Server-rendered data for SSR hydration                   |
| `getContext`              | `() => RouterContextProvider` | Context provided to loaders, actions, middleware (v7.9+) |
| `patchRoutesOnNavigation` | `PatchFunction`               | Lazily add routes on navigation (fog of war)             |
| `dataStrategy`            | `DataStrategyFunction`        | Override default parallel loader execution               |
| `window`                  | `Window`                      | Window override (for testing)                            |

---

## Common Patterns Cheat Sheet

```typescript
// Read loader data
const data = useLoaderData();

// Read action result
const result = useActionData();

// Navigate imperatively
const navigate = useNavigate();
navigate("/posts/123");
navigate(-1); // back
navigate("/login", { replace: true });

// Redirect from loader/action
throw redirect("/login");
throw redirect("/posts/123", { status: 303 });

// Throw not-found in loader
throw new Response("Not Found", { status: 404 });

// Read search params
const [searchParams, setSearchParams] = useSearchParams();
const page = searchParams.get("page");
setSearchParams({ page: "2", sort: "date" });

// Read path params
const { id } = useParams();

// Check navigation state
const navigation = useNavigation();
const isLoading = navigation.state === "loading";
const isSubmitting = navigation.state === "submitting";

// Non-navigating mutation
const fetcher = useFetcher();
<fetcher.Form method="POST" action="/api/save">...</fetcher.Form>
fetcher.submit({ key: "value" }, { method: "POST", action: "/api/save" });

// Access error in errorElement
const error = useRouteError();
if (isRouteErrorResponse(error)) { /* HTTP error */ }

// Manual revalidation
const revalidator = useRevalidator();
revalidator.revalidate();

// Outlet context
<Outlet context={{ user, theme }} />
const { user, theme } = useOutletContext<{ user: User; theme: Theme }>();

// Block navigation (unsaved changes)
const blocker = useBlocker(hasUnsavedChanges);
```
