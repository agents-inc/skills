# React Router -- Navigation & Search Params

> Link, NavLink, useNavigate, redirect, useSearchParams, and programmatic navigation. See [SKILL.md](../SKILL.md) for core patterns and [reference.md](../reference.md) for API reference.

**Related examples:**

- [Data Loading & Actions](data-loading.md) -- redirect after actions
- [Layouts & Auth Guards](layouts.md) -- redirect in auth loaders
- [Core Setup & Route Config](core.md) -- route config with NavLink

---

## Link Component

```typescript
import { Link } from "react-router";

function PostList({ posts }: { posts: Post[] }) {
  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>
          <Link to={`/posts/${post.id}`}>{post.title}</Link>
        </li>
      ))}
    </ul>
  );
}
```

**Why:** `<Link>` performs client-side navigation without a full page reload. `to` accepts a string path. Unlike `<a>`, it does not trigger a new HTTP request.

---

## NavLink with Active State

`NavLink` provides `isActive`, `isPending`, and `isTransitioning` states for styling.

```typescript
import { NavLink } from "react-router";

function Navigation() {
  return (
    <nav>
      {/* Function-based className */}
      <NavLink
        to="/posts"
        className={({ isActive, isPending }) =>
          isActive ? "nav-active" : isPending ? "nav-pending" : ""
        }
      >
        Posts
      </NavLink>

      {/* end prop: only active on exact match, not children */}
      <NavLink to="/dashboard" end>
        Dashboard Home
      </NavLink>

      {/* Without end: active on /dashboard AND /dashboard/analytics */}
      <NavLink to="/dashboard">Dashboard Section</NavLink>
    </nav>
  );
}
```

**Why:** `isActive` is `true` when the current URL matches the link's `to`. `isPending` is `true` when a navigation to this link is in progress (loader running). `end` restricts active matching to exact path only — without it, `/dashboard` is active on `/dashboard/analytics` too.

---

## useNavigate (Imperative Navigation)

Use `useNavigate` after side effects like form submissions, mutations, or conditional logic.

```typescript
import { useNavigate } from "react-router";

function LogoutButton() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logoutUser();
    navigate("/login", { replace: true });
  };

  return (
    <button type="button" onClick={handleLogout}>
      Log Out
    </button>
  );
}
```

**Why:** `replace: true` prevents the back button from returning to the authenticated page. `navigate(-1)` goes back, `navigate(1)` goes forward. Prefer `<Link>` for clickable elements — `useNavigate` is for side effects only.

---

## redirect() in Loaders and Actions

Throw `redirect()` in loaders and actions to short-circuit the route and navigate.

```typescript
import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

export async function dashboardLoader({ request }: LoaderFunctionArgs) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    // Capture the intended destination for post-login redirect
    const url = new URL(request.url);
    throw redirect(`/login?returnTo=${encodeURIComponent(url.pathname)}`);
  }
  return { user };
}
```

**Why:** `redirect()` creates a `Response` with a `Location` header. Throwing it prevents the component from rendering. Search params on the redirect URL capture context (intended destination, error message).

**Critical:** Always **throw** `redirect()`. Returning it treats the Response as data, not a navigation instruction.

---

## Search Params with useSearchParams

```typescript
import { useSearchParams } from "react-router";

const DEFAULT_PAGE = "1";
const DEFAULT_SORT = "newest";

function ProductFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = searchParams.get("page") ?? DEFAULT_PAGE;
  const sort = searchParams.get("sort") ?? DEFAULT_SORT;

  const handleSortChange = (newSort: string) => {
    setSearchParams((prev) => {
      prev.set("sort", newSort);
      prev.set("page", DEFAULT_PAGE); // Reset to page 1 on filter change
      return prev;
    });
  };

  const handleNextPage = () => {
    setSearchParams((prev) => {
      prev.set("page", String(Number(prev.get("page") ?? DEFAULT_PAGE) + 1));
      return prev;
    });
  };

  return (
    <div>
      <select value={sort} onChange={(e) => handleSortChange(e.target.value)}>
        <option value="newest">Newest</option>
        <option value="price-asc">Price: Low to High</option>
        <option value="price-desc">Price: High to Low</option>
      </select>

      <button type="button" onClick={handleNextPage}>
        Next Page
      </button>
      <span>Page {page}</span>
    </div>
  );
}
```

**Why:** `useSearchParams` is a tuple like `useState`. The setter accepts a callback that receives the current `URLSearchParams`. Setting search params triggers a navigation, which re-runs the route's loader if present.

---

## Search Params in Links

```typescript
import { Link } from "react-router";

function Pagination({ currentPage, totalPages }: { currentPage: number; totalPages: number }) {
  return (
    <nav>
      {currentPage > 1 && (
        <Link to={`?page=${currentPage - 1}`}>Previous</Link>
      )}
      <span>
        Page {currentPage} of {totalPages}
      </span>
      {currentPage < totalPages && (
        <Link to={`?page=${currentPage + 1}`}>Next</Link>
      )}
    </nav>
  );
}
```

**Why:** `to="?page=2"` updates search params relative to the current path. This triggers the route's loader with the new search params. Declarative approach — no `useState` or `useEffect` needed.

---

## Search Params + Loader Integration

```typescript
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, Link } from "react-router";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

export async function productsLoader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page")) || DEFAULT_PAGE;
  const pageSize = Number(url.searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE;

  const response = await fetch(
    `/api/products?page=${page}&pageSize=${pageSize}`,
  );
  return response.json();
}

export function ProductsPage() {
  const { items, total } = useLoaderData() as { items: Product[]; total: number };
  const [searchParams] = useSearchParams();
  const page = Number(searchParams.get("page")) || DEFAULT_PAGE;
  const pageSize = Number(searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <ul>
        {items.map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
      <nav>
        <Link to={`?page=${Math.max(1, page - 1)}`}>Previous</Link>
        <span>Page {page} of {totalPages}</span>
        <Link to={`?page=${Math.min(totalPages, page + 1)}`}>Next</Link>
      </nav>
    </div>
  );
}
```

**Why:** The loader reads search params from `request.url`. When the URL changes (via `<Link>` or `setSearchParams`), the loader re-runs with the new params. The component reads current params via `useSearchParams` for display. Single source of truth: the URL.

---

## BAD: Reading window.location Directly

```typescript
// BAD: bypasses router, does not react to changes
function SearchResults() {
  const params = new URLSearchParams(window.location.search);
  const query = params.get("q") ?? "";

  return <p>Results for: {query}</p>;
}
```

**Why bad:** `window.location.search` is not reactive — the component does not re-render when the URL changes. Bypasses the router's navigation cycle (loaders do not re-run). Use `useSearchParams()` or read `request.url` in loaders.

---

## Navigation Decision Quick Reference

```
Need to navigate?
  +-- Clickable element in JSX?
  |   +-- YES -> <Link> or <NavLink>
  |   +-- NO -> After side effect (logout, mutation)?
  |       +-- YES -> useNavigate()
  |       +-- NO -> In a loader or action?
  |           +-- YES -> throw redirect()
  |           +-- NO -> router.navigate() (rare)
```
