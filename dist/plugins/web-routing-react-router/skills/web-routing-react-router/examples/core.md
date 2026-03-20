# React Router -- Core Setup & Route Config

> Data Mode setup with `createBrowserRouter`, `RouterProvider`, route objects, and basic loaders. See [SKILL.md](../SKILL.md) for core patterns and [reference.md](../reference.md) for API reference.

**Related examples:**

- [Data Loading & Actions](data-loading.md) -- loaders, actions, Form, useFetcher
- [Navigation & Search Params](navigation.md) -- Link, NavLink, useNavigate, useSearchParams
- [Error Handling & Code Splitting](error-handling.md) -- errorElement, route.lazy
- [Layouts & Auth Guards](layouts.md) -- Outlet, protected routes

---

## Minimal Data Mode Setup

```typescript
// src/router.tsx
import { createBrowserRouter } from "react-router";
import { RootLayout } from "./layouts/root-layout";
import { HomePage } from "./pages/home";
import { AboutPage } from "./pages/about";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "about", element: <AboutPage /> },
    ],
  },
]);
```

```typescript
// src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { router } from "./router";

const ROOT_ELEMENT_ID = "root";
const rootElement = document.getElementById(ROOT_ELEMENT_ID);
if (!rootElement) throw new Error(`Missing #${ROOT_ELEMENT_ID} element`);

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
```

**Why:** Route config lives outside React rendering. All imports come from `"react-router"` in v7 — the `react-router-dom` package is removed.

---

## Complete App with Loaders, Actions, and Error Handling

```typescript
// src/router.tsx
import { createBrowserRouter, redirect } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { RootLayout } from "./layouts/root-layout";
import { RootError } from "./components/root-error";
import { HomePage } from "./pages/home";
import { PostsPage } from "./pages/posts";
import { PostDetailPage } from "./pages/post-detail";
import { CreatePostPage } from "./pages/create-post";

async function postsLoader() {
  const response = await fetch("/api/posts");
  if (!response.ok) {
    throw new Response("Failed to load posts", { status: response.status });
  }
  return response.json();
}

async function postDetailLoader({ params }: LoaderFunctionArgs) {
  const response = await fetch(`/api/posts/${params.postId}`);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Response("Post not found", { status: 404 });
    }
    throw new Response("Failed to load post", { status: response.status });
  }
  return response.json();
}

async function createPostAction({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const response = await fetch("/api/posts", {
    method: "POST",
    body: JSON.stringify({
      title: formData.get("title"),
      body: formData.get("body"),
    }),
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    return { error: "Failed to create post" };
  }

  const post = await response.json();
  throw redirect(`/posts/${post.id}`);
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <RootError />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: "posts",
        children: [
          { index: true, element: <PostsPage />, loader: postsLoader },
          {
            path: ":postId",
            element: <PostDetailPage />,
            loader: postDetailLoader,
          },
          {
            path: "new",
            element: <CreatePostPage />,
            action: createPostAction,
          },
        ],
      },
    ],
  },
]);
```

**Why:** Error handling is at the root — any unhandled error from loaders, actions, or components gets caught by `RootError`. Loaders throw `Response` objects for HTTP errors (enabling `isRouteErrorResponse` in the error UI). Actions throw `redirect()` after mutations.

---

## Root Layout with Outlet

```typescript
// src/layouts/root-layout.tsx
import { Outlet, NavLink, ScrollRestoration, useNavigation } from "react-router";

export function RootLayout() {
  const navigation = useNavigation();
  const isNavigating = navigation.state !== "idle";

  return (
    <>
      <header>
        <nav>
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/posts">Posts</NavLink>
          <NavLink to="/about">About</NavLink>
        </nav>
        {isNavigating && <div className="nav-spinner" aria-busy="true" />}
      </header>
      <main>
        <Outlet />
      </main>
      <ScrollRestoration />
    </>
  );
}
```

**Why:** `<Outlet />` renders the matched child route. `useNavigation()` enables a global loading indicator. `<ScrollRestoration />` auto-restores scroll position on back/forward navigation. `NavLink` provides `isActive` and `isPending` states.

---

## Root Error Boundary

```typescript
// src/components/root-error.tsx
import { useRouteError, isRouteErrorResponse, Link } from "react-router";

export function RootError() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <div role="alert">
        <h1>{error.status}</h1>
        <p>{error.statusText || error.data}</p>
        <Link to="/">Return Home</Link>
      </div>
    );
  }

  const message = error instanceof Error ? error.message : "An unexpected error occurred";

  return (
    <div role="alert">
      <h1>Something went wrong</h1>
      <pre>{message}</pre>
      <Link to="/">Return Home</Link>
    </div>
  );
}
```

**Why:** `isRouteErrorResponse` distinguishes HTTP errors (thrown `Response` from loaders) from unexpected exceptions. The root error boundary is the last line of defense — without it, the entire app shows a white screen.

---

## BAD: Declarative Mode with Loaders

```typescript
// BAD: loaders do NOT work with BrowserRouter + Routes
import { BrowserRouter, Routes, Route } from "react-router";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        {/* loader prop is SILENTLY IGNORED here */}
        <Route path="/posts" element={<Posts />} loader={postsLoader} />
      </Routes>
    </BrowserRouter>
  );
}
```

**Why bad:** `<BrowserRouter>` with `<Routes>` is Declarative Mode. Loaders, actions, errorElement, and all Data Mode features are completely ignored. No error, no warning — they just do nothing. Use `createBrowserRouter` for Data Mode features.

---

## BAD: Using json() or defer() in v7

```typescript
// BAD: json() and defer() are removed in React Router v7
import { json, defer } from "react-router"; // IMPORT ERROR in v7

async function loader() {
  // WRONG in v7
  return json({ posts: await fetchPosts() });
  return defer({ posts: fetchPosts() }); // Also removed
}

// CORRECT in v7: return plain objects
async function loader() {
  const posts = await fetchPosts();
  return { posts };
}

// For streaming/deferred data in v7, return promises directly:
async function loader() {
  return {
    critical: await fetchCriticalData(),
    deferred: fetchNonCriticalData(), // Promise, not awaited
  };
}
```

**Why bad:** `json()` was a convenience wrapper for `Response.json()`. `defer()` was the streaming data API. Both are removed in v7. Return plain objects from loaders. For deferred data, return unresolved promises and use `<Await>` in the component.
