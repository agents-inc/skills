# Remix / React Router v7 Reference

> Decision trees, the route module surface, and anti-patterns with code. See [SKILL.md](SKILL.md) for
> the patterns and red flags, and `examples/` for working code.

---

## Decision Trees

### What should be streamed

```
Is this data needed for the first paint?
├─ YES → await it
└─ NO → can the page be useful without it?
    ├─ YES → return the Promise; render it behind Suspense + Await
    └─ NO  → it was critical after all; await it
```

Stream analytics, comments, recommendations, anything below the fold. Await authentication state,
the page title, SEO-visible content, and anything the layout's structure depends on.

### Form or fetcher

```
Should this change the URL or the main content?
├─ YES → <Form> — it navigates, and the browser history records it
└─ NO → <fetcher.Form> or fetcher.submit — no navigation, no history entry
```

`<Form>` suits creating a record, logging in, and multi-step flows. `useFetcher` suits likes,
toggles, inline edits, autocomplete and background syncing — and gives each item on a list its own
independent state.

### How an error should leave a loader

```
What kind of failure is it?
├─ Expected — bad input, no permission, not found → throw a Response with a 4xx status
├─ A condition that should send the user elsewhere → return redirect("/path")
└─ Unexpected → let it throw; the ErrorBoundary catches it
```

---

## Route Module Surface

### Exports

| Export             | Purpose                  | When it runs                  |
| ------------------ | ------------------------ | ----------------------------- |
| `loader`           | Fetch data               | GET requests, before render   |
| `action`           | Handle mutations         | POST/PUT/DELETE/PATCH         |
| `clientLoader`     | Browser-side loading     | Client navigations (v7)       |
| `clientAction`     | Browser-side mutations   | Form submissions (v7)         |
| `default`          | The React component      | After loader/action           |
| `ErrorBoundary`    | Error UI                 | On a thrown Response or Error |
| `HydrateFallback`  | Loading UI (v7)          | While `clientLoader` runs     |
| `meta`             | Head tags                | Server and client             |
| `links`            | Stylesheets and preloads | Server render                 |
| `headers`          | HTTP response headers    | Server render                 |
| `handle`           | Arbitrary route data     | Read through `useMatches()`   |
| `shouldRevalidate` | Opt out of revalidation  | After navigations and actions |

### Hooks

| Hook                             | Purpose                            |
| -------------------------------- | ---------------------------------- |
| `useLoaderData<typeof loader>()` | Loader data, typed                 |
| `useActionData<typeof action>()` | What the action returned           |
| `useNavigation()`                | The current navigation's state     |
| `useFetcher()`                   | Load or submit without navigating  |
| `useFetchers()`                  | Every active fetcher               |
| `useRouteError()`                | The error, inside an ErrorBoundary |
| `useMatches()`                   | Every matched route                |
| `useParams()`                    | URL parameters                     |
| `useSearchParams()`              | Read and write search params       |
| `useLocation()`                  | The current location               |
| `useNavigate()`                  | Navigate imperatively              |
| `useSubmit()`                    | Submit a form imperatively         |
| `useRevalidator()`               | Re-run the loaders on demand       |

### Response utilities

| Utility                   | Purpose                  | Status                                  |
| ------------------------- | ------------------------ | --------------------------------------- |
| `json(data, init?)`       | JSON response            | **Deprecated** — return the raw object  |
| `defer({ key: promise })` | Streaming response       | **Deprecated** — return the raw Promise |
| `data(data, init?)`       | Custom headers or status | **New** in React Router v7              |
| `redirect(url, init?)`    | Redirect response        | Current                                 |

### Components

| Component             | Purpose                           |
| --------------------- | --------------------------------- |
| `<Form>`              | A submission that navigates       |
| `<Link>`              | Client-side navigation            |
| `<NavLink>`           | A link that knows if it is active |
| `<Outlet>`            | Where child routes render         |
| `<Await>`             | Resolve a streamed Promise        |
| `<Meta>`              | Render the meta tags (in root)    |
| `<Links>`             | Render the link tags (in root)    |
| `<Scripts>`           | Render the scripts (in root)      |
| `<ScrollRestoration>` | Restore scroll position           |

### Status code constants

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

---

## Anti-Patterns

### Fetching on the client what a loader could fetch

```typescript
// WRONG — the page renders empty, then fetches, then renders again
export default function Users() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetch("/api/users").then((res) => res.json()).then((data) => setUsers(data.users));
  }, []);

  return <ul>{users.map((u) => <li key={u.id}>{u.name}</li>)}</ul>;
}

// CORRECT — the data is in the first HTML response
export async function loader() {
  return json({ users: await listUsers() });
}

export default function Users() {
  const { users } = useLoaderData<typeof loader>();
  return <ul>{users.map((u) => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

### Returning a nullable value instead of throwing

```typescript
// WRONG — every consumer now has to null-check, and the status is 200
export async function loader({ params }: LoaderFunctionArgs) {
  const user = await getUser(params.userId);
  return json({ user });
}

// CORRECT — the ErrorBoundary handles it, and the response says 404
const HTTP_NOT_FOUND = 404;

export async function loader({ params }: LoaderFunctionArgs) {
  const user = await getUser(params.userId);
  if (!user) {
    throw json({ message: "User not found" }, { status: HTTP_NOT_FOUND });
  }
  return json({ user }); // user is non-null from here on
}
```

### A fetcher with no optimistic read

```typescript
// WRONG — the button does nothing visible until the round trip returns
function LikeButton({ isLiked }: { isLiked: boolean }) {
  const fetcher = useFetcher();
  return (
    <fetcher.Form method="post">
      <button>{isLiked ? "Unlike" : "Like"}</button>
    </fetcher.Form>
  );
}

// CORRECT — the in-flight submission is already readable
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

---

## Checklist

- [ ] Loaders and actions are named exports of route modules, and nowhere else
- [ ] `useLoaderData<typeof loader>()`, or `Route.ComponentProps` on v7
- [ ] Expected failures throw a Response with a status that matches
- [ ] `ErrorBoundary` branches on `isRouteErrorResponse` before assuming an `Error`
- [ ] Only non-critical data is streamed
- [ ] Every `useFetcher` mutation reads `fetcher.formData` for its optimistic state
- [ ] Status codes are named constants
- [ ] Every mutating form carries `method="post"`
- [ ] `meta` handles the `undefined` data case
