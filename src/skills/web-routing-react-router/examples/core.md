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
// RouterProvider ships from both entry points. The react-router/dom one wires
// up react-dom's flushSync; take the bare "react-router" one only in a
// non-DOM environment such as a Node test.
import { RouterProvider } from "react-router/dom";
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

**Why:** Route config lives outside React rendering, so the router can match and run loaders before anything mounts.

**On the package name:** in v7 everything collapsed into `react-router`, with the DOM-only exports also available from `react-router/dom`. `react-router-dom` is still published as a deprecated re-export, so a stale import keeps working and gives no signal that it is wrong — v8 deletes the package, and that is when it breaks. Move the imports while nothing is on fire.

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
// BAD: neither export exists in v7 — this line fails to resolve
import { json, defer } from "react-router";

async function badPostsLoader() {
  return json({ posts: await fetchPosts() });
}

async function badPostsWithCommentsLoader() {
  return defer({ posts: fetchPosts() });
}
```

```typescript
// CORRECT in v7: a plain object
import { data } from "react-router";
import type { ActionFunctionArgs } from "react-router";

async function postsLoader() {
  const posts = await fetchPosts();
  return { posts };
}

// Deferred data: return the unresolved promise, read it with <Await>
async function postsWithCommentsLoader() {
  return {
    critical: await fetchCriticalData(),
    deferred: fetchNonCriticalData(), // Promise, not awaited
  };
}

// Custom status or headers: data(), the one thing a plain object cannot carry
async function createPostAction({ request }: ActionFunctionArgs) {
  const post = await createPost(await request.formData());
  return data({ post }, { status: 201 });
}
```

**Why bad:** `json()` wrapped `Response.json()` and `defer()` was the streaming API; v7's single-fetch format made both unnecessary and removed them. A plain object covers the common case, an unresolved promise plus `<Await>` covers streaming, and `data()` covers the remaining one — a status code or a header, without forcing serialisation into a real `Response`.
