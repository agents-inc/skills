# TanStack Router - Practical Examples

> Complete code examples for common TanStack Router patterns. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for quick API reference.

---

## Example 1: Complete Project Setup

Full setup for a React SPA with TanStack Router, file-based routing, and TanStack Query integration.

### Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
  ],
});
```

### Root Route with Context

```typescript
// src/routes/__root.tsx
import {
  createRootRouteWithContext,
  Link,
  Outlet,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import type { QueryClient } from "@tanstack/react-query";

export interface RouterContext {
  queryClient: QueryClient;
  auth: {
    isAuthenticated: boolean;
    user: User | null;
    getUser: () => Promise<User | null>;
  };
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
});

function RootLayout() {
  return (
    <>
      <header>
        <nav>
          <Link to="/" activeProps={{ className: "active" }}>
            Home
          </Link>
          <Link to="/posts" activeProps={{ className: "active" }}>
            Posts
          </Link>
          <Link to="/dashboard" activeProps={{ className: "active" }}>
            Dashboard
          </Link>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
      <TanStackRouterDevtools position="bottom-right" />
    </>
  );
}

function NotFound() {
  return (
    <div>
      <h1>404 - Page Not Found</h1>
      <p>The page you are looking for does not exist.</p>
      <Link to="/">Go Home</Link>
    </div>
  );
}
```

### Entry Point

```typescript
// src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { routeTree } from "./routeTree.gen";

const queryClient = new QueryClient();

const STALE_TIME_MS = 30_000;

const router = createRouter({
  routeTree,
  context: {
    queryClient,
    auth: {
      isAuthenticated: false,
      user: null,
      getUser: async () => null,
    },
  },
  defaultPreload: "intent",
  defaultStaleTime: STALE_TIME_MS,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const ROOT_ELEMENT_ID = "root";
const rootElement = document.getElementById(ROOT_ELEMENT_ID);
if (!rootElement) throw new Error(`Missing #${ROOT_ELEMENT_ID} element`);

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
```

---

## Example 2: File-Based Routes

### Home Page (Index Route)

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

### Posts List with Search Params

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

### Posts Layout with Sidebar

```typescript
// src/routes/posts/route.tsx
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
        <Outlet />
      </section>
    </div>
  );
}
```

### Post Detail with Dynamic Params

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

## Example 3: Search Params with Filters

A complete product listing page with validated, typed search params for pagination, filtering, and sorting.

```typescript
// src/routes/products/index.tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_SORT = "newest";
const DEFAULT_CATEGORY = "all";
const MIN_PRICE = 0;
const MAX_PRICE = 10000;

const sortOptions = ["newest", "price-asc", "price-desc", "popular"] as const;
const categoryOptions = [
  "all",
  "electronics",
  "clothing",
  "books",
  "home",
] as const;

const productsSearchSchema = z.object({
  page: fallback(z.number().min(1), DEFAULT_PAGE).default(DEFAULT_PAGE),
  pageSize: fallback(z.number().min(1).max(100), DEFAULT_PAGE_SIZE).default(
    DEFAULT_PAGE_SIZE,
  ),
  sort: fallback(z.enum(sortOptions), DEFAULT_SORT).default(DEFAULT_SORT),
  category: fallback(z.enum(categoryOptions), DEFAULT_CATEGORY).default(
    DEFAULT_CATEGORY,
  ),
  minPrice: fallback(z.number().min(MIN_PRICE), MIN_PRICE).default(MIN_PRICE),
  maxPrice: fallback(z.number().max(MAX_PRICE), MAX_PRICE).default(MAX_PRICE),
  q: fallback(z.string(), "").default(""),
  inStock: fallback(z.boolean(), false).default(false),
});

type ProductsSearch = z.infer<typeof productsSearchSchema>;

export const Route = createFileRoute("/products/")({
  validateSearch: zodValidator(productsSearchSchema),
  loader: async ({ search }) => {
    const result = await fetchProducts(search);
    return { result };
  },
  component: ProductsPage,
});

function ProductsPage() {
  const { result } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const updateSearch = (updates: Partial<ProductsSearch>) => {
    navigate({
      search: (prev) => ({ ...prev, ...updates, page: DEFAULT_PAGE }),
    });
  };

  return (
    <div>
      {/* Filters */}
      <aside>
        <select
          value={search.category}
          onChange={(e) =>
            updateSearch({
              category: e.target.value as ProductsSearch["category"],
            })
          }
        >
          {categoryOptions.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <select
          value={search.sort}
          onChange={(e) =>
            updateSearch({ sort: e.target.value as ProductsSearch["sort"] })
          }
        >
          {sortOptions.map((sort) => (
            <option key={sort} value={sort}>
              {sort}
            </option>
          ))}
        </select>

        <label>
          <input
            type="checkbox"
            checked={search.inStock}
            onChange={(e) => updateSearch({ inStock: e.target.checked })}
          />
          In Stock Only
        </label>
      </aside>

      {/* Results */}
      <section>
        <p>
          {result.total} products found (page {search.page})
        </p>
        <ul>
          {result.items.map((product) => (
            <li key={product.id}>{product.name}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

---

## Example 4: Authentication Guard with Protected Routes

### Auth Guard Layout

```typescript
// src/routes/_authenticated.tsx
import {
  createFileRoute,
  Outlet,
  redirect,
} from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ context, location }) => {
    const user = await context.auth.getUser();
    if (!user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: location.href,
        },
      });
    }
    // Add user to context for all child routes
    return { user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <div className="authenticated-layout">
      <Outlet />
    </div>
  );
}
```

### Login Page with Redirect

```typescript
// src/routes/login.tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";

const loginSearchSchema = z.object({
  redirect: fallback(z.string(), "/").default("/"),
});

export const Route = createFileRoute("/login")({
  validateSearch: zodValidator(loginSearchSchema),
  component: LoginPage,
});

function LoginPage() {
  const { redirect: redirectTo } = Route.useSearch();
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      await loginUser({ email, password });
      await navigate({ to: redirectTo });
    } catch {
      // Handle login error
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h1>Login</h1>
      <input type="email" name="email" required />
      <input type="password" name="password" required />
      <button type="submit">Log In</button>
    </form>
  );
}
```

### Protected Dashboard

```typescript
// src/routes/_authenticated/dashboard.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: async ({ context }) => {
    // context.user is available from _authenticated beforeLoad
    const stats = await fetchDashboardStats(context.user.id);
    return { stats };
  },
  component: DashboardPage,
});

function DashboardPage() {
  const { stats } = Route.useLoaderData();
  const { user } = Route.useRouteContext();

  return (
    <div>
      <h1>Welcome, {user.name}</h1>
      <div>
        <p>Total posts: {stats.totalPosts}</p>
        <p>Total comments: {stats.totalComments}</p>
      </div>
    </div>
  );
}
```

---

## Example 5: TanStack Query Integration

Using TanStack Query with router loaders for prefetching and cache management.

### Shared Query Options

```typescript
// src/queries/post-queries.ts
import { queryOptions } from "@tanstack/react-query";
import type { Post } from "../types";

export const postsQueryOptions = queryOptions({
  queryKey: ["posts"] as const,
  queryFn: async (): Promise<Post[]> => {
    const response = await fetch("/api/posts");
    if (!response.ok) throw new Error("Failed to fetch posts");
    return response.json();
  },
});

export const postQueryOptions = (postId: string) =>
  queryOptions({
    queryKey: ["posts", postId] as const,
    queryFn: async (): Promise<Post> => {
      const response = await fetch(`/api/posts/${postId}`);
      if (!response.ok) throw new Error("Failed to fetch post");
      return response.json();
    },
  });
```

### Route with Query Prefetch

```typescript
// src/routes/posts/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { postsQueryOptions } from "../../queries/post-queries";

export const Route = createFileRoute("/posts/")({
  loader: async ({ context }) => {
    // Prefetch ensures data is in cache before component renders
    await context.queryClient.ensureQueryData(postsQueryOptions);
  },
  component: PostsPage,
});

function PostsPage() {
  // Reads from cache instantly (prefetched in loader)
  // Also subscribes to background refetches and cache updates
  const { data: posts } = useSuspenseQuery(postsQueryOptions);

  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}
```

### Route with Deferred Query

```typescript
// src/routes/posts/$postId/index.tsx
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { postQueryOptions } from "../../../queries/post-queries";

const commentsQueryOptions = (postId: string) =>
  queryOptions({
    queryKey: ["posts", postId, "comments"] as const,
    queryFn: () => fetchComments(postId),
  });

export const Route = createFileRoute("/posts/$postId/")({
  loader: async ({ context, params }) => {
    // Critical: await this (blocks render until resolved)
    const post = await context.queryClient.ensureQueryData(
      postQueryOptions(params.postId),
    );
    if (!post) throw notFound();

    // Non-critical: start fetch but don't block render
    context.queryClient.prefetchQuery(commentsQueryOptions(params.postId));
  },
  component: PostDetailPage,
});

function PostDetailPage() {
  const { postId } = Route.useParams();
  const { data: post } = useSuspenseQuery(postQueryOptions(postId));

  // Comments may still be loading (not awaited in loader)
  const { data: comments, isLoading } = useQuery(
    commentsQueryOptions(postId),
  );

  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.body}</p>

      <section>
        <h2>Comments</h2>
        {isLoading ? (
          <p>Loading comments...</p>
        ) : (
          <ul>
            {comments?.map((comment) => (
              <li key={comment.id}>{comment.text}</li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
```

---

## Example 6: Nested Layouts with Pathless Routes

### Application Structure

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

### Nested Pathless Layout

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

## Example 7: Non-Nested Route (Escaping Parent Layout)

When a route's URL is under a parent but should not use the parent's layout.

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

---

## Example 8: Catch-All (Splat) Route

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

---

## Example 9: Accessing Route Data in Shared Components

Use `getRouteApi` to access route data from components that are not directly defined in the route file.

```typescript
// src/components/post-header.tsx
import { getRouteApi, Link } from "@tanstack/react-router";

// Create a typed route API reference
const postRoute = getRouteApi("/posts/$postId/");

export function PostHeader() {
  // Fully typed - params and loader data from the post route
  const { postId } = postRoute.useParams();
  const { post } = postRoute.useLoaderData();

  return (
    <header>
      <Link to="/posts">Back</Link>
      <h1>{post.title}</h1>
      <span>Post #{postId}</span>
    </header>
  );
}
```

---

## Example 10: Route with Search Middleware

```typescript
// src/routes/products/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { retainSearchParams, stripSearchParams } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";

const DEFAULT_PAGE = 1;
const DEFAULT_SORT = "newest";

const searchSchema = z.object({
  page: fallback(z.number(), DEFAULT_PAGE).default(DEFAULT_PAGE),
  sort: fallback(z.string(), DEFAULT_SORT).default(DEFAULT_SORT),
  q: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/products/")({
  validateSearch: zodValidator(searchSchema),
  search: {
    middlewares: [
      // Keep search query when navigating to child routes
      retainSearchParams(["q"]),
      // Remove default values from URL (cleaner URLs)
      stripSearchParams({ page: DEFAULT_PAGE, sort: DEFAULT_SORT }),
    ],
  },
  loader: async ({ search }) => {
    const products = await fetchProducts(search);
    return { products };
  },
  component: ProductsPage,
});
```
