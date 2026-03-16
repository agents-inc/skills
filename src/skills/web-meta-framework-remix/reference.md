# Remix Reference

> Decision frameworks, anti-patterns, and quick reference for Remix / React Router v7 development. See [SKILL.md](SKILL.md) for core concepts and `examples/` for code examples.

---

## Decision Framework

### When to Use Loader vs Action

```
Is this reading data?
|- YES -> loader
|- NO -> Is this mutating data (create/update/delete)?
    |- YES -> action
    |- NO -> Neither (client-side only logic)
```

### When to Stream (defer / raw Promises)

> **Note:** `defer()` is deprecated in React Router v7. Return Promises directly in objects with Single Fetch.

```
Is this data critical for initial render?
|- YES -> await the data (return resolved value)
|- NO -> Can the page be useful without this data?
    |- YES -> Return as Promise (stream with Suspense)
    |- NO -> await (it's actually critical)
```

**Good candidates for streaming:**

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
|- YES -> <Form> (causes navigation)
|- NO -> Is this inline/partial update?
    |- YES -> useFetcher (no navigation)
    |- NO -> Does user expect page change?
        |- YES -> <Form>
        |- NO -> useFetcher
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
|- YES -> Regular route with default export
|- NO -> Is it an API endpoint, webhook, or file download?
    |- YES -> Resource route (no default export)
    |- NO -> Regular route
```

### File Naming Decision Tree

```
Need URL segment?
|- YES -> Is it dynamic?
|   |- YES -> Use $ prefix: blog.$slug.tsx
|   |- NO -> Use filename: about.tsx
|- NO -> Is it a layout?
    |- YES -> Use _ prefix: _auth.tsx
    |- NO -> Is it the index?
        |- YES -> _index.tsx
```

### Error Handling Strategy

```
Is this an expected error (user input, authorization)?
|- YES -> throw json({ message }, { status: 4xx })
|- NO -> Is it a redirect condition?
    |- YES -> return redirect("/path")
    |- NO -> Let it throw (caught by ErrorBoundary)
```

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

### Returning Instead of Throwing for Expected Errors

```typescript
// WRONG - Returns null, component must handle
export async function loader({ params }: LoaderFunctionArgs) {
  const user = await db.user.findUnique({ where: { id: params.userId } });
  return json({ user }); // user could be null
}

// CORRECT - Throws 404, ErrorBoundary handles
const HTTP_NOT_FOUND = 404;

export async function loader({ params }: LoaderFunctionArgs) {
  const user = await db.user.findUnique({ where: { id: params.userId } });
  if (!user) {
    throw json({ message: "User not found" }, { status: HTTP_NOT_FOUND });
  }
  return json({ user }); // user is guaranteed to exist
}
```

### Streaming Critical Data

```typescript
// WRONG - Title flickers in after load
return defer({ post: getPost() }); // Promise -- will stream

// CORRECT - Title available immediately
const post = await getPost();
return json({ post });
```

### Missing Optimistic UI with useFetcher

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

### Form Without Method

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

| Export             | Purpose                 | When Called                 |
| ------------------ | ----------------------- | --------------------------- |
| `loader`           | Fetch data              | GET requests, before render |
| `action`           | Handle mutations        | POST/PUT/DELETE/PATCH       |
| `clientLoader`     | Browser-side loading    | Client navigations (RR v7)  |
| `clientAction`     | Browser-side mutations  | Form submissions (RR v7)    |
| `default`          | React component         | After loader/action         |
| `ErrorBoundary`    | Error UI                | On thrown Response/Error    |
| `HydrateFallback`  | Loading UI (RR v7)      | While clientLoader runs     |
| `meta`             | SEO metadata            | Server and client           |
| `links`            | Stylesheets/preloads    | Server render               |
| `headers`          | HTTP response headers   | Server render               |
| `handle`           | Custom route data       | Available in `useMatches()` |
| `shouldRevalidate` | Opt out of revalidation | After navigations/actions   |

### Hooks

| Hook                             | Purpose                       |
| -------------------------------- | ----------------------------- |
| `useLoaderData<typeof loader>()` | Access loader data with types |
| `useActionData<typeof action>()` | Access action return data     |
| `useNavigation()`                | Current navigation state      |
| `useFetcher()`                   | Non-navigating data ops       |
| `useFetchers()`                  | All active fetchers           |
| `useRouteError()`                | Error in ErrorBoundary        |
| `useMatches()`                   | All matched routes            |
| `useParams()`                    | URL params                    |
| `useSearchParams()`              | URL search params             |
| `useLocation()`                  | Current location              |
| `useNavigate()`                  | Programmatic navigation       |
| `useRevalidator()`               | Manual data revalidation      |

### Response Utilities

| Utility                   | Purpose                    | Status                            |
| ------------------------- | -------------------------- | --------------------------------- |
| `json(data, init?)`       | Return JSON response       | **Deprecated** - use raw objects  |
| `redirect(url, init?)`    | Redirect response          | Still valid                       |
| `defer({ key: promise })` | Streaming response         | **Deprecated** - use raw Promises |
| `data(data, init?)`       | Set headers/status (RR v7) | **New** in React Router v7        |

### Component Reference

| Component             | Purpose                     |
| --------------------- | --------------------------- |
| `<Form>`              | Navigating form submissions |
| `<Link>`              | Client-side navigation      |
| `<NavLink>`           | Link with active state      |
| `<Outlet>`            | Render child routes         |
| `<Await>`             | Render deferred data        |
| `<Meta>`              | Render meta tags (in root)  |
| `<Links>`             | Render link tags (in root)  |
| `<Scripts>`           | Render scripts (in root)    |
| `<ScrollRestoration>` | Restore scroll position     |

### HTTP Status Code Constants

```typescript
const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_UNPROCESSABLE_ENTITY = 422;
const HTTP_SERVER_ERROR = 500;
```

### Checklist

- [ ] Loaders/actions are named exports in route modules only
- [ ] Using `useLoaderData<typeof loader>()` for type safety (or `Route.ComponentProps` in RR v7)
- [ ] Throwing Response for expected errors (404, 403)
- [ ] ErrorBoundary handles both Response and Error types
- [ ] Streaming only non-critical data
- [ ] Optimistic UI with useFetcher mutations
- [ ] Named constants for HTTP status codes
- [ ] Forms have explicit `method="post"` for mutations
- [ ] meta function handles null data case
