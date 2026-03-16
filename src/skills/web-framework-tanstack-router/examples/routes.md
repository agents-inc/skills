# TanStack Router -- Routes & Layouts Examples

> File-based routing conventions, nested layouts, pathless layouts, non-nested routes, and catch-all routes. See [SKILL.md](../SKILL.md) for core patterns and [reference.md](../reference.md) for API reference.

**Related examples:**

- [Setup & Configuration](setup.md) -- project setup, Vite plugin, root route
- [Navigation](navigation.md) -- Link, useNavigate, redirect
- [Auth & Context](auth-and-context.md) -- auth guards, route context, dependency injection

---

## File Structure Overview

```
src/routes/
  __root.tsx              # Root layout (required)
  index.tsx               # / (home page)
  about.tsx               # /about
  posts/
    index.tsx             # /posts
    $postId/
      index.tsx           # /posts/:postId
      edit.tsx            # /posts/:postId/edit
    route.tsx             # /posts layout wrapper
  _authenticated.tsx      # Pathless layout (no URL segment)
  _authenticated/
    dashboard.tsx         # /dashboard (wrapped by _authenticated layout)
    settings.tsx          # /settings (wrapped by _authenticated layout)
```

---

## Naming Conventions

| Convention   | Example              | Purpose                                  |
| ------------ | -------------------- | ---------------------------------------- |
| `__root.tsx` | `__root.tsx`         | Root layout, wraps entire app            |
| `index.tsx`  | `posts/index.tsx`    | Index route for directory (`/posts`)     |
| `$param`     | `$postId/index.tsx`  | Dynamic path parameter                   |
| `$`          | `$.tsx`              | Splat/catch-all route                    |
| `_prefix`    | `_authenticated.tsx` | Pathless layout route (no URL segment)   |
| `route.tsx`  | `posts/route.tsx`    | Layout for directory children            |
| `-prefix`    | `-components.tsx`    | Ignored by router (not a route)          |
| `(group)`    | `(admin)/`           | Organizational grouping (no URL effect)  |
| `suffix_`    | `posts_.detail.tsx`  | Non-nested route (escapes parent layout) |

---

## Basic File Route (Index)

```typescript
// src/routes/index.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div>
      <h1>Welcome</h1>
      <p>This is the home page.</p>
    </div>
  );
}
```

---

## Directory File Route

```typescript
// src/routes/posts/index.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/posts/")({
  component: PostsIndex,
});

function PostsIndex() {
  return <h1>All Posts</h1>;
}
```

**Why:** `createFileRoute` path string is validated against the actual file location at build time. The plugin generates typed route trees automatically.

```typescript
// BAD: Manual route definition with file-based routing
import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./__root";

// WRONG: Don't define routes manually when using the router plugin
const postsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/posts",
  component: PostsIndex,
});
```

**Why bad:** Manual route definitions bypass the plugin's type generation and route tree. The path string is not validated against the file system. Creates maintenance burden of manual route tree assembly.

---

## Dynamic Param Route

```typescript
// src/routes/posts/$postId/index.tsx
import { createFileRoute, notFound } from "@tanstack/react-router";

const PENDING_DELAY_MS = 200;

export const Route = createFileRoute("/posts/$postId/")({
  pendingMs: PENDING_DELAY_MS,
  pendingComponent: () => <div>Loading post...</div>,
  errorComponent: ({ error, reset }) => (
    <div role="alert">
      <h2>Error loading post</h2>
      <pre>{error.message}</pre>
      <button type="button" onClick={reset}>
        Retry
      </button>
    </div>
  ),
  notFoundComponent: () => (
    <div>
      <h2>Post Not Found</h2>
      <p>This post does not exist or has been removed.</p>
    </div>
  ),
  loader: async ({ params }) => {
    const post = await fetchPost(params.postId);
    if (!post) {
      throw notFound();
    }
    return { post };
  },
  component: PostDetailPage,
});

function PostDetailPage() {
  const { post } = Route.useLoaderData();

  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.body}</p>
      <footer>
        <Link to="/posts">Back to posts</Link>
      </footer>
    </article>
  );
}
```

---

## Directory Layout Route

Layout routes wrap child routes with shared UI.

```typescript
// src/routes/posts/route.tsx - Layout for all /posts/* routes
import { createFileRoute, Outlet, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/posts")({
  component: PostsLayout,
});

function PostsLayout() {
  return (
    <div className="posts-layout">
      <aside>
        <h2>Posts</h2>
        <nav>
          <Link to="/posts" activeOptions={{ exact: true }}>
            All Posts
          </Link>
        </nav>
      </aside>
      <section>
        <Outlet /> {/* Renders /posts/, /posts/$postId, etc. */}
      </section>
    </div>
  );
}
```

**Why:** `<Outlet />` renders the matched child route. Forgetting it renders nothing for child routes.

---

## Pathless Layout Route (Auth Guard Pattern)

Wraps children without adding a URL segment. Commonly used for authentication guards.

```typescript
// src/routes/_authenticated.tsx
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: "/login" });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <div className="authenticated-layout">
      <header>{/* Authenticated header with user info */}</header>
      <Outlet /> {/* Renders /dashboard, /settings, etc. */}
    </div>
  );
}

// src/routes/_authenticated/dashboard.tsx -> URL: /dashboard
// src/routes/_authenticated/settings.tsx  -> URL: /settings
```

**Why:** Pathless layout (`_` prefix) adds shared UI and auth guards without affecting the URL. All children inherit the `beforeLoad` auth check.

```typescript
// BAD: Checking auth in every child route
// src/routes/dashboard.tsx
export const Route = createFileRoute("/dashboard/")({
  beforeLoad: async ({ context }) => {
    // WRONG: duplicating auth check in every protected route
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: "/login" });
    }
  },
  component: Dashboard,
});
```

**Why bad:** Auth logic duplicated in every protected route instead of a single layout. Easy to forget on new routes, creating security holes.

---

## Nested Pathless Layouts

Multiple pathless layouts can be nested for layered UI composition.

```
src/routes/
  __root.tsx                    # Global layout
  index.tsx                     # / (home)
  login.tsx                     # /login (public)
  _authenticated.tsx            # Auth guard (pathless layout)
  _authenticated/
    _dashboard.tsx              # Dashboard layout (pathless, nested)
    _dashboard/
      index.tsx                 # /dashboard (redirects or default view)
      analytics.tsx             # /analytics
      reports.tsx               # /reports
    settings.tsx                # /settings
    profile.tsx                 # /profile
```

```typescript
// src/routes/_authenticated/_dashboard.tsx
import { createFileRoute, Outlet, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  return (
    <div className="dashboard-layout">
      <nav className="dashboard-sidebar">
        <Link
          to="/analytics"
          activeProps={{ className: "active" }}
        >
          Analytics
        </Link>
        <Link
          to="/reports"
          activeProps={{ className: "active" }}
        >
          Reports
        </Link>
      </nav>
      <div className="dashboard-content">
        <Outlet />
      </div>
    </div>
  );
}

// src/routes/_authenticated/_dashboard/analytics.tsx
// URL: /analytics (no _authenticated or _dashboard in URL)
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_dashboard/analytics")({
  loader: async ({ context }) => {
    const data = await fetchAnalytics(context.user.id);
    return { data };
  },
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { data } = Route.useLoaderData();
  return <div>Analytics: {JSON.stringify(data)}</div>;
}
```

---

## Non-Nested Route (Escaping Parent Layout)

When a route's URL is under a parent but should NOT use the parent's layout, use the `suffix_` convention.

```typescript
// src/routes/posts_.create.tsx
// URL: /posts/create
// Component tree: renders WITHOUT the posts layout (route.tsx)
import { createFileRoute, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/posts_/create")({
  component: CreatePostPage,
});

function CreatePostPage() {
  const navigate = useNavigate();

  const handleSubmit = async (data: PostFormData) => {
    const post = await createPost(data);
    await navigate({
      to: "/posts/$postId",
      params: { postId: post.id },
    });
  };

  return (
    <div className="full-width-form">
      <h1>Create New Post</h1>
      {/* Full-width form without posts sidebar layout */}
      <PostForm onSubmit={handleSubmit} />
    </div>
  );
}
```

**Why:** The `_` suffix on `posts_` tells the router this route's URL starts with `/posts/` but it does NOT nest inside the `posts/route.tsx` layout. Useful for full-page forms or other pages that need a different layout.

---

## Catch-All (Splat) Route

```typescript
// src/routes/$.tsx
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/$")({
  component: CatchAllPage,
});

function CatchAllPage() {
  const { _splat } = Route.useParams();

  return (
    <div>
      <h1>Page Not Found</h1>
      <p>
        No page exists at <code>/{_splat}</code>
      </p>
      <Link to="/">Return Home</Link>
    </div>
  );
}
```

**Why:** The `$` file matches any unmatched path. `_splat` contains the matched path segments. Useful for custom 404 pages that show the attempted URL.

---

## Posts List with Search Params

A complete route combining file-based routing with search param validation and a loader.

```typescript
// src/routes/posts/index.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;

const postsSearchSchema = z.object({
  page: fallback(z.number().min(1), DEFAULT_PAGE).default(DEFAULT_PAGE),
  pageSize: fallback(z.number().min(1).max(50), DEFAULT_PAGE_SIZE).default(
    DEFAULT_PAGE_SIZE,
  ),
  tag: fallback(z.string().optional(), undefined),
});

export const Route = createFileRoute("/posts/")({
  validateSearch: zodValidator(postsSearchSchema),
  loader: async ({ search }) => {
    const posts = await fetchPosts({
      page: search.page,
      pageSize: search.pageSize,
      tag: search.tag,
    });
    return { posts };
  },
  component: PostsListPage,
});

function PostsListPage() {
  const { posts } = Route.useLoaderData();
  const { page } = Route.useSearch();

  return (
    <div>
      <h1>Posts</h1>
      <ul>
        {posts.items.map((post) => (
          <li key={post.id}>
            <Link to="/posts/$postId" params={{ postId: post.id }}>
              {post.title}
            </Link>
          </li>
        ))}
      </ul>

      <nav>
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
      </nav>
    </div>
  );
}
```
