# TanStack Router -- Navigation Examples

> Type-safe Link component, useNavigate hook, redirect from loaders, and programmatic navigation. See [SKILL.md](../SKILL.md) for core patterns and [reference.md](../reference.md) for API reference.

**Related examples:**

- [Routes & Layouts](routes.md) -- defining routes, nested layouts
- [Search Params](search-params.md) -- search param validation, updating search
- [Auth & Context](auth-and-context.md) -- redirect in auth guards

---

## Link Component (Declarative Navigation)

```typescript
import { Link } from "@tanstack/react-router";

function PostList({ posts }: { posts: Post[] }) {
  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>
          <Link
            to="/posts/$postId"
            params={{ postId: post.id }}
            search={{ tab: "comments" }}
            activeProps={{ className: "font-bold" }}
            preload="intent"
          >
            {post.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

**Why:** TypeScript validates that `/posts/$postId` exists in the route tree. `params` is required and typed to match the route's path params. `search` is validated against the route's search schema. `preload="intent"` prefetches data on hover for instant navigation.

---

## Link with Active State

```typescript
import { Link } from "@tanstack/react-router";

function Navigation() {
  return (
    <nav>
      {/* Active when exactly on /posts */}
      <Link
        to="/posts"
        activeOptions={{ exact: true }}
        activeProps={{ className: "active" }}
      >
        All Posts
      </Link>

      {/* Active when on /posts or any /posts/* child */}
      <Link
        to="/posts"
        activeProps={{ className: "active" }}
      >
        Posts Section
      </Link>
    </nav>
  );
}
```

**Why:** Active links automatically get `data-status="active"` and `aria-current="page"` attributes. `activeOptions.exact` controls whether child routes also trigger the active state.

---

## Link with Search Param Updater

```typescript
import { Link } from "@tanstack/react-router";

function Pagination({ page }: { page: number }) {
  return (
    <div>
      <Link
        to="."
        search={(prev) => ({ ...prev, page: Math.max(1, prev.page - 1) })}
        disabled={page <= 1}
      >
        Previous
      </Link>
      <span>Page {page}</span>
      <Link to="." search={(prev) => ({ ...prev, page: prev.page + 1 })}>
        Next
      </Link>
    </div>
  );
}
```

**Why:** Functional updater `(prev) => ({...prev, ...})` preserves other search params while updating one. `to="."` navigates to the current route.

---

## useNavigate (Imperative Navigation)

Use `useNavigate` for navigation after side effects like form submissions or mutations.

```typescript
import { useNavigate } from "@tanstack/react-router";

function CreatePostForm() {
  const navigate = useNavigate();

  const handleSubmit = async (data: PostFormData) => {
    const post = await createPost(data);
    // Navigate after successful mutation
    await navigate({
      to: "/posts/$postId",
      params: { postId: post.id },
      replace: true,
    });
  };

  return <form onSubmit={handleSubmit}>{/* form fields */}</form>;
}
```

**Why:** `useNavigate` is for imperative navigation after side effects (mutations, async actions). `replace: true` prevents the back button from returning to the form. All params are type-checked against the route tree.

---

## useNavigate with Search Param Updates

```typescript
import { useNavigate } from "@tanstack/react-router";
import { Route } from "./products";

function ProductFilters() {
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();

  const handleSortChange = (sort: string) => {
    navigate({
      search: (prev) => ({ ...prev, sort, page: 1 }),
    });
  };

  const handleCategoryChange = (category: string) => {
    navigate({
      search: (prev) => ({ ...prev, category, page: 1 }),
    });
  };

  return (
    <div>
      <select value={search.sort} onChange={(e) => handleSortChange(e.target.value)}>
        <option value="newest">Newest</option>
        <option value="price-asc">Price: Low to High</option>
      </select>
    </div>
  );
}
```

**Why:** `from: Route.fullPath` anchors type inference to the correct route's search schema. The functional updater preserves existing params while resetting `page` to 1.

---

## redirect() in Loaders and beforeLoad

```typescript
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/")({
  beforeLoad: async ({ context }) => {
    if (!context.auth.isAdmin) {
      throw redirect({
        to: "/",
        search: { error: "unauthorized" },
      });
    }
  },
  component: AdminDashboard,
});
```

**Why:** `redirect()` accepts the same typed options as `navigate`. Throwing it from `beforeLoad` prevents the component from ever rendering. Search params on redirect are validated against the target route's schema.

**Critical:** `redirect()` must be **thrown**, not returned. `throw redirect(...)` is correct.

---

## Navigation Decision Quick Reference

```
Need to navigate?
  +-- Is it a clickable element in JSX?
  |   +-- YES -> Use <Link to="..." />
  |   +-- NO -> Is it after a side effect (form submit, mutation)?
  |       +-- YES -> Use useNavigate()
  |       +-- NO -> Is it in a loader/beforeLoad?
  |           +-- YES -> throw redirect()
  |           +-- NO -> Use router.navigate()
```
