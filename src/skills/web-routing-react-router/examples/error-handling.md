# React Router -- Error Handling & Code Splitting

> Error boundaries with errorElement, useRouteError, pending UI, and code splitting with route.lazy. See [SKILL.md](../SKILL.md) for core patterns and [reference.md](../reference.md) for API reference.

**Related examples:**

- [Core Setup & Route Config](core.md) -- root error boundary, router setup
- [Data Loading & Actions](data-loading.md) -- throwing responses from loaders
- [Layouts & Auth Guards](layouts.md) -- redirect patterns in loaders

---

## Per-Route Error Boundary

```typescript
import { useRouteError, isRouteErrorResponse, Link } from "react-router";

function PostError() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return (
        <div>
          <h2>Post Not Found</h2>
          <p>The post you are looking for does not exist.</p>
          <Link to="/posts">Back to Posts</Link>
        </div>
      );
    }

    return (
      <div role="alert">
        <h2>Error {error.status}</h2>
        <p>{error.data || error.statusText}</p>
      </div>
    );
  }

  return (
    <div role="alert">
      <h2>Unexpected Error</h2>
      <pre>{error instanceof Error ? error.message : "Unknown error"}</pre>
    </div>
  );
}

// Route config
{
  path: ":postId",
  element: <PostDetailPage />,
  errorElement: <PostError />,
  loader: postDetailLoader,
}
```

**Why:** `errorElement` catches errors from the route's loader, action, AND component rendering. `isRouteErrorResponse` narrows to HTTP errors (thrown `Response` objects). Without `errorElement`, the error bubbles to the parent route's `errorElement`.

---

## Error Bubbling Behavior

Errors bubble up through the route tree until they hit an `errorElement`.

```typescript
const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <RootError />,   // Catches all unhandled errors
    children: [
      { index: true, element: <HomePage /> },
      {
        path: "posts",
        element: <PostsLayout />,
        errorElement: <PostsError />,  // Catches posts subtree errors
        children: [
          { index: true, element: <PostsList />, loader: postsLoader },
          {
            path: ":postId",
            element: <PostDetail />,
            errorElement: <PostDetailError />,  // Most specific
            loader: postDetailLoader,
          },
        ],
      },
    ],
  },
]);
```

**Why:** If `postDetailLoader` throws and `:postId` has `errorElement`, that catches it. If `:postId` does NOT have `errorElement`, the error bubbles to `PostsError`. If neither has one, `RootError` catches it. The layout of the parent remains visible — only the error boundary's portion is replaced.

---

## Throwing HTTP Errors from Loaders

```typescript
import type { LoaderFunctionArgs } from "react-router";

export async function postLoader({ params }: LoaderFunctionArgs) {
  const response = await fetch(`/api/posts/${params.postId}`);

  // Throw Response for HTTP errors — caught by errorElement
  if (response.status === 404) {
    throw new Response("Post not found", { status: 404 });
  }

  if (response.status === 403) {
    throw new Response("You do not have access to this post", { status: 403 });
  }

  if (!response.ok) {
    throw new Response("Failed to load post", { status: response.status });
  }

  return response.json();
}
```

**Why:** Thrown `Response` objects become `ErrorResponse` instances accessible via `useRouteError()`. `isRouteErrorResponse(error)` returns `true` for these, giving access to `error.status`, `error.statusText`, and `error.data`. Regular thrown `Error` objects do not have these properties.

---

## ErrorBoundary Component (Alternative to errorElement)

```typescript
// Using ErrorBoundary component reference instead of errorElement JSX
{
  path: ":postId",
  element: <PostDetailPage />,
  loader: postDetailLoader,
  ErrorBoundary: PostDetailError, // Component reference, not JSX
}
```

**Why:** `ErrorBoundary` takes a component reference (no JSX). Equivalent to `errorElement: <PostDetailError />`. Useful when you prefer to keep route config free of JSX.

---

## Navigation Pending UI

```typescript
import { useNavigation } from "react-router";

function GlobalPendingIndicator() {
  const navigation = useNavigation();

  if (navigation.state === "idle") return null;

  return (
    <div className="global-pending" role="progressbar" aria-busy="true">
      <div className="pending-bar" />
    </div>
  );
}
```

**Why:** `navigation.state` is `"loading"` during loader execution and `"submitting"` during action execution. Place this in your root layout for a global loading indicator.

---

## Pending UI for Form Submissions

```typescript
import { Form, useNavigation } from "react-router";

function ContactForm() {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const isRedirecting =
    navigation.state === "loading" &&
    navigation.formAction != null;

  return (
    <Form method="POST">
      <input name="email" type="email" required />
      <textarea name="message" required />
      <button type="submit" disabled={isSubmitting || isRedirecting}>
        {isSubmitting
          ? "Sending..."
          : isRedirecting
            ? "Redirecting..."
            : "Send Message"}
      </button>
    </Form>
  );
}
```

**Why:** After the action completes, the navigation transitions to `"loading"` while the redirect's target loader runs. Checking `navigation.formAction` distinguishes a post-action redirect from a normal navigation. This prevents the button from flashing back to "Send Message" during the redirect.

---

## Code Splitting with route.lazy (Function-Based)

```typescript
const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <RootError />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: "admin",
        // Lazy-load entire route module
        lazy: () => import("./pages/admin"),
      },
      {
        path: "settings",
        lazy: () => import("./pages/settings"),
      },
    ],
  },
]);
```

```typescript
// src/pages/admin.tsx — must export properties that match route options
import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  // Auth check for admin
  const user = await getUser(request);
  if (!user?.isAdmin) throw redirect("/");
  return { user };
}

// Must be named "Component" (capital C)
export function Component() {
  return <div>Admin Dashboard</div>;
}

export function ErrorBoundary() {
  return <div>Admin Error</div>;
}
```

**Why:** `route.lazy` keeps the admin code out of the initial bundle. The module must export named properties matching route options: `Component` (not `element`), `loader`, `action`, `ErrorBoundary`, etc. The `path`, `index`, and `children` properties CANNOT be lazy — they must be in the static config.

---

## Code Splitting with route.lazy (Object-Based, v7.5+)

```typescript
{
  path: "admin",
  lazy: {
    loader: async () => (await import("./pages/admin.loader")).loader,
    Component: async () => (await import("./pages/admin.component")).AdminPage,
    ErrorBoundary: async () => (await import("./pages/admin.error")).AdminError,
  },
}
```

**Why:** Object-based lazy splits each property into its own chunk. Loader and component download in parallel. More granular than function-based lazy which loads everything in one chunk. Available in v7.5+.

---

## Code Splitting with React.lazy (Without route.lazy)

```typescript
import { lazy, Suspense } from "react";

const AdminPage = lazy(() => import("./pages/admin"));

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        path: "admin",
        element: (
          <Suspense fallback={<div>Loading admin...</div>}>
            <AdminPage />
          </Suspense>
        ),
      },
    ],
  },
]);
```

**Why:** `React.lazy` works but does NOT integrate with loaders — the component loads on render, not on navigation. `route.lazy` is preferred because it loads the module (including the loader) before the component mounts, preventing waterfalls.

---

## BAD: Missing errorElement on Root

```typescript
// BAD: No error handling — loader failure crashes the app
const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    // NO errorElement here!
    children: [
      { path: "posts", element: <Posts />, loader: postsLoader },
    ],
  },
]);
```

**Why bad:** If `postsLoader` throws and no route in the tree has `errorElement`, the error is unhandled. React Router renders its internal default error UI — a plain text dump. In production this is a white screen with an error message. Always add `errorElement` at minimum on the root route.
