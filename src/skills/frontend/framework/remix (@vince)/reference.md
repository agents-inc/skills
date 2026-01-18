# Remix Reference

> Decision frameworks, anti-patterns, and red flags for Remix development. See [SKILL.md](SKILL.md) for core concepts and [examples.md](examples.md) for code examples.

---

## React Router v7 Migration Notice

**Remix has merged into React Router v7.** The patterns documented here are for Remix v2 and remain valid for existing projects. However, several utilities are deprecated:

| Remix v2 (Deprecated) | React Router v7 (Recommended) |
|----------------------|-------------------------------|
| `json(data)` | Return raw objects directly |
| `json(data, { status, headers })` | `data(data, { status, headers })` |
| `defer({ key: promise })` | Return `{ key: promise }` with Single Fetch |
| `@remix-run/node` imports | `react-router` / `@react-router/node` |
| `LoaderFunctionArgs` | `Route.LoaderArgs` (generated types) |
| `ActionFunctionArgs` | `Route.ActionArgs` (generated types) |

**See [Upgrading from Remix](https://reactrouter.com/upgrading/remix) for migration guide.**

---

## Decision Framework

### When to Use Loader vs Action

```
Is this reading data?
├─ YES → loader
└─ NO → Is this mutating data (create/update/delete)?
    ├─ YES → action
    └─ NO → Neither (client-side only logic)
```

### When to Use defer vs json (Remix v2)

> **Note:** Both `json()` and `defer()` are deprecated in React Router v7. Use raw object returns and Single Fetch instead.

```
Is this data critical for initial render?
├─ YES → json() (wait for it) / await the data
└─ NO → Can the page be useful without this data?
    ├─ YES → defer() with Suspense fallback / return Promise directly
    └─ NO → json() / await (it's actually critical)
```

**Good candidates for streaming (defer/Promises):**
- Analytics and dashboard metrics
- Comments and social features
- Recommendations and suggestions
- Secondary content below the fold

**Keep as awaited data (critical):**
- User authentication state
- Page title and main content
- SEO-critical data
- Data needed for page structure

### When to Use Form vs useFetcher

```
Does the action change the URL or main page content?
├─ YES → <Form> (causes navigation)
└─ NO → Is this inline/partial update?
    ├─ YES → useFetcher (no navigation)
    └─ NO → Does user expect page change?
        ├─ YES → <Form>
        └─ NO → useFetcher
```

**Use `<Form>` for:**
- Creating new records (redirect to new page)
- Login/signup (redirect to dashboard)
- Multi-step wizards
- Any action that should update the URL

**Use `useFetcher` for:**
- Like/unlike buttons
- Toggle switches
- Inline editing
- Search autocomplete
- Background syncing

### When to Use Resource Routes

```
Does this route render UI?
├─ YES → Regular route with default export
└─ NO → Is it an API endpoint?
    ├─ YES → Resource route (no default export)
    └─ NO → Is it for file downloads/webhooks?
        ├─ YES → Resource route
        └─ NO → Regular route
```

### File Naming Decision Tree

```
Need URL segment?
├─ YES → Is it dynamic?
│   ├─ YES → Use $ prefix: blog.$slug.tsx
│   └─ NO → Use filename: about.tsx
└─ NO → Is it a layout?
    ├─ YES → Use _ prefix: _auth.tsx
    └─ NO → Is it the index?
        └─ YES → _index.tsx
```

### Error Handling Strategy

```
Is this an expected error (user input, authorization)?
├─ YES → throw json({ message }, { status: 4xx })
└─ NO → Is it a redirect condition?
    ├─ YES → return redirect("/path")
    └─ NO → Let it throw (caught by ErrorBoundary)
```

---

## RED FLAGS

### High Priority Issues

- **Loaders/actions in non-route files** - Remix only runs these from route modules
- **Missing type inference** - Always use `useLoaderData<typeof loader>()` for type safety
- **Fetching data client-side** - Use loaders for server data, not useEffect + fetch
- **Not throwing Response for expected errors** - Return json() for validation, throw for 404/403
- **Missing ErrorBoundary in critical routes** - Unhandled errors crash the whole page

### Medium Priority Issues

- **defer() for critical data** - Page flickers when critical content streams in late
- **useFetcher without optimistic UI** - Makes app feel slow
- **Magic numbers for HTTP status codes** - Use named constants
- **Nested fetcher.Form without key** - May cause state conflicts

### Common Mistakes

- Using useEffect to fetch data that should be in a loader
- Not validating formData types before using
- Forgetting to handle null/undefined in loader data
- Using redirect() in loader for authenticated routes (use throw instead)
- Not setting Cache-Control headers for public data

### Gotchas & Edge Cases

- **Loader runs on every navigation** - Even for child route changes, parent loaders re-run
- **Action runs before all loaders** - After action, all loaders revalidate
- **defer() requires Suspense** - Forgot `<Await>` wrapper causes errors
- **Index routes need special handling** - `?index` query param for form actions
- **meta function gets null data on error** - Must handle missing data case
- **links function can't access loader data** - Use meta with `tagName: "link"` instead

---

## Anti-Patterns

### Client-Side Data Fetching

Data that can be loaded on the server should always use loaders.

```typescript
// WRONG - Client-side fetch
export default function Users() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetch("/api/users")
      .then(res => res.json())
      .then(data => setUsers(data.users));
  }, []);

  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}

// CORRECT - Server-side loader
export async function loader() {
  const users = await db.user.findMany();
  return json({ users });
}

export default function Users() {
  const { users } = useLoaderData<typeof loader>();
  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

### Missing Type Safety

Always use `typeof loader` for type inference.

```typescript
// WRONG - No type safety
export default function Profile() {
  const data = useLoaderData(); // data is `any`
  return <h1>{data.user.name}</h1>; // No autocomplete, no error checking
}

// CORRECT - Type-safe
export default function Profile() {
  const { user } = useLoaderData<typeof loader>();
  return <h1>{user.name}</h1>; // Full autocomplete, type errors caught
}
```

### Returning Instead of Throwing for Expected Errors

Expected errors should be thrown to trigger ErrorBoundary.

```typescript
// WRONG - Returns null, component must handle
export async function loader({ params }: LoaderFunctionArgs) {
  const user = await db.user.findUnique({ where: { id: params.userId } });
  return json({ user }); // user could be null
}

export default function UserPage() {
  const { user } = useLoaderData<typeof loader>();
  if (!user) return <p>Not found</p>; // Every consumer must check
  return <h1>{user.name}</h1>;
}

// CORRECT - Throws 404, ErrorBoundary handles
export async function loader({ params }: LoaderFunctionArgs) {
  const user = await db.user.findUnique({ where: { id: params.userId } });
  if (!user) {
    throw json({ message: "User not found" }, { status: 404 });
  }
  return json({ user }); // user is guaranteed to exist
}

export default function UserPage() {
  const { user } = useLoaderData<typeof loader>();
  return <h1>{user.name}</h1>; // No null check needed
}
```

### Defer for Critical Data

Critical data should load before render, not stream in.

```typescript
// WRONG - Title flickers in after load
export async function loader() {
  return defer({
    post: getPost(), // Promise - will stream
  });
}

export default function PostPage() {
  const { post } = useLoaderData<typeof loader>();
  return (
    <Suspense fallback={<h1>Loading...</h1>}>
      <Await resolve={post}>
        {(data) => <h1>{data.title}</h1>} {/* Title flickers in */}
      </Await>
    </Suspense>
  );
}

// CORRECT - Title available immediately
export async function loader() {
  const post = await getPost(); // Wait for it
  return json({ post });
}

export default function PostPage() {
  const { post } = useLoaderData<typeof loader>();
  return <h1>{post.title}</h1>; // Available immediately
}
```

### Missing Optimistic UI with useFetcher

useFetcher without optimistic UI makes interactions feel slow.

```typescript
// WRONG - No feedback until server responds
function LikeButton({ isLiked }: { isLiked: boolean }) {
  const fetcher = useFetcher();
  return (
    <fetcher.Form method="post">
      <button>{isLiked ? "Unlike" : "Like"}</button>
    </fetcher.Form>
  );
}

// CORRECT - Immediate feedback
function LikeButton({ isLiked }: { isLiked: boolean }) {
  const fetcher = useFetcher();

  // Show expected state while request is in flight
  const optimisticIsLiked = fetcher.formData
    ? fetcher.formData.get("liked") === "true"
    : isLiked;

  return (
    <fetcher.Form method="post">
      <input type="hidden" name="liked" value={String(!optimisticIsLiked)} />
      <button>{optimisticIsLiked ? "Unlike" : "Like"}</button>
    </fetcher.Form>
  );
}
```

### Loader/Action in Non-Route Files

Loaders and actions only work in route modules.

```typescript
// WRONG - utils/data.ts (not a route)
export async function loader() { // Never called by Remix
  return json({ data: "test" });
}

// CORRECT - app/routes/data.tsx (route module)
export async function loader() { // Remix calls this
  return json({ data: "test" });
}
```

### Form Without Method

Forms default to GET, which won't trigger action.

```typescript
// WRONG - GET request, action not called
<Form>
  <input name="email" />
  <button>Subscribe</button>
</Form>

// CORRECT - POST request triggers action
<Form method="post">
  <input name="email" />
  <button>Subscribe</button>
</Form>
```

---

## Quick Reference

### Route Module Exports

| Export | Purpose | When Called |
|--------|---------|-------------|
| `loader` | Fetch data | GET requests, before render |
| `action` | Handle mutations | POST/PUT/DELETE/PATCH |
| `default` | React component | After loader/action |
| `ErrorBoundary` | Error UI | On thrown Response/Error |
| `meta` | SEO metadata | Server and client |
| `links` | Stylesheets/preloads | Server render |
| `headers` | HTTP response headers | Server render |
| `handle` | Custom route data | Available in `useMatches()` |

### Hooks

| Hook | Purpose |
|------|---------|
| `useLoaderData<typeof loader>()` | Access loader data with types |
| `useActionData<typeof action>()` | Access action return data |
| `useNavigation()` | Current navigation state |
| `useFetcher()` | Non-navigating data ops |
| `useFetchers()` | All active fetchers |
| `useRouteError()` | Error in ErrorBoundary |
| `useMatches()` | All matched routes |
| `useParams()` | URL params |
| `useSearchParams()` | URL search params |
| `useLocation()` | Current location |
| `useNavigate()` | Programmatic navigation |
| `useRevalidator()` | Manual data revalidation |

### Response Utilities

| Utility | Purpose | Status |
|---------|---------|--------|
| `json(data, init?)` | Return JSON response | **Deprecated** - use raw objects |
| `redirect(url, init?)` | Redirect response | Still valid |
| `defer({ key: promise })` | Streaming response | **Deprecated** - use raw Promises |
| `data(data, init?)` | Set headers/status (RR v7) | **New** in React Router v7 |

### Action Types (React Router v7)

| Type | Environment | Use Case |
|------|------------|----------|
| `action` | Server-only | Database operations, secure logic (recommended) |
| `clientAction` | Browser-only | Client-side API calls, local state mutations |

When both are defined, `clientAction` takes priority. Server actions are removed from client bundles.

### Component Reference

| Component | Purpose |
|-----------|---------|
| `<Form>` | Navigating form submissions |
| `<Link>` | Client-side navigation |
| `<NavLink>` | Link with active state |
| `<Outlet>` | Render child routes |
| `<Await>` | Render deferred data |
| `<Meta>` | Render meta tags (in root) |
| `<Links>` | Render link tags (in root) |
| `<Scripts>` | Render scripts (in root) |
| `<ScrollRestoration>` | Restore scroll position |

### HTTP Status Code Constants

```typescript
const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_NO_CONTENT = 204;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_METHOD_NOT_ALLOWED = 405;
const HTTP_CONFLICT = 409;
const HTTP_UNPROCESSABLE_ENTITY = 422;
const HTTP_SERVER_ERROR = 500;
```

### Checklist

- [ ] Loaders/actions are named exports in route modules only
- [ ] Using `useLoaderData<typeof loader>()` for type safety
- [ ] Throwing Response for expected errors (404, 403)
- [ ] ErrorBoundary handles both Response and Error types
- [ ] Using defer() only for non-critical data
- [ ] Optimistic UI with useFetcher mutations
- [ ] Named constants for HTTP status codes
- [ ] Forms have explicit `method="post"` for mutations
- [ ] meta function handles null data case
