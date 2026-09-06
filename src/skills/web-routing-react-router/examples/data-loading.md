# React Router -- Data Loading & Actions

> Loaders, actions, Form component, useFetcher, revalidation, and deferred data. See [SKILL.md](../SKILL.md) for core patterns and [reference.md](../reference.md) for API reference.

**Related examples:**

- [Core Setup & Route Config](core.md) -- createBrowserRouter, route objects
- [Navigation & Search Params](navigation.md) -- redirect after actions, useSearchParams
- [Error Handling & Code Splitting](error-handling.md) -- errorElement, error responses
- [Layouts & Auth Guards](layouts.md) -- auth checks in loaders

---

## Loader with Params

```typescript
import type { LoaderFunctionArgs } from "react-router";

export async function postLoader({ params }: LoaderFunctionArgs) {
  // params are always strings — parse if needed
  const response = await fetch(`/api/posts/${params.postId}`);
  if (response.status === 404) {
    throw new Response("Post not found", { status: 404 });
  }
  if (!response.ok) {
    throw new Response("Server error", { status: response.status });
  }
  return response.json();
}
```

```typescript
// Component consumes loader data
import { useLoaderData } from "react-router";

export function PostDetailPage() {
  const post = useLoaderData() as Post;
  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.body}</p>
    </article>
  );
}
```

**Why:** the loader runs before the component mounts, so the component carries no loading state, and the route's `errorElement` catches what it throws. `params` is `Record<string, string | undefined>` — parse anything numeric here rather than in the component.

---

## Loader with Search Params

```typescript
import type { LoaderFunctionArgs } from "react-router";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

export async function productsLoader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page")) || DEFAULT_PAGE;
  const pageSize =
    Number(url.searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE;
  const category = url.searchParams.get("category") ?? "all";

  const response = await fetch(
    `/api/products?page=${page}&pageSize=${pageSize}&category=${category}`,
  );
  if (!response.ok)
    throw new Response("Failed to load products", { status: 500 });

  return response.json();
}
```

**Why:** `request.url` contains the full URL including search params. The loader re-runs when search params change (e.g. pagination), keeping the data in sync with the URL.

---

## Action with Form Component

`<Form>` submits to the route's action. Every active loader revalidates afterwards — but only when the action finished on a non-error status.

```typescript
import type { ActionFunctionArgs } from "react-router";
import { redirect, Form, useActionData, useNavigation } from "react-router";

export async function createPostAction({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const title = formData.get("title") as string;
  const body = formData.get("body") as string;

  if (!title.trim()) {
    // Return validation errors — NOT a redirect
    return { errors: { title: "Title is required" } };
  }

  const response = await fetch("/api/posts", {
    method: "POST",
    body: JSON.stringify({ title, body }),
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    return { errors: { form: "Failed to create post. Try again." } };
  }

  const post = await response.json();
  // Redirect after success — throw, not return
  throw redirect(`/posts/${post.id}`);
}

export function CreatePostPage() {
  const actionData = useActionData() as { errors?: Record<string, string> } | undefined;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <Form method="POST">
      <div>
        <label htmlFor="title">Title</label>
        <input id="title" name="title" required />
        {actionData?.errors?.title && (
          <p className="error">{actionData.errors.title}</p>
        )}
      </div>
      <div>
        <label htmlFor="body">Body</label>
        <textarea id="body" name="body" />
      </div>
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create Post"}
      </button>
      {actionData?.errors?.form && (
        <p className="error">{actionData.errors.form}</p>
      )}
    </Form>
  );
}
```

**Why:** `<Form method="POST">` submits to the current route's action. `useActionData()` returns the action's return value (validation errors). `useNavigation()` tracks submission state. After successful create, `throw redirect()` navigates and revalidates all loaders.

---

## Prefer `throw redirect()` in Shared Helpers

Returned directly from a loader or action the two are identical — the router processes the `Response` either way. They diverge inside a helper.

```typescript
// GOOD: throw unwinds the whole call stack, so the caller never resumes
async function requireAuth(request: Request) {
  const user = await getUser(request);
  if (!user) throw redirect("/login");
  return user;
}
```

```typescript
// BAD: return only exits requireAuth. The loader carries on with a Response
// sitting in `user`, and the redirect never happens.
async function requireAuthByReturn(request: Request) {
  const user = await getUser(request);
  if (!user) return redirect("/login");
  return user;
}
```

**Why:** the difference only shows up one frame up. `throw` short-circuits every caller; `return` hands a `Response` back as an ordinary value, and the loader that called it reads properties off it as though it were a user.

---

## useFetcher for Non-Navigating Mutations

`useFetcher` is for mutations that should not change the URL — inline forms, toggle buttons, "like" actions, auto-save.

```typescript
import { useFetcher } from "react-router";

function LikeButton({ postId }: { postId: string }) {
  const fetcher = useFetcher();
  const isLiking = fetcher.state !== "idle";

  return (
    <fetcher.Form method="POST" action={`/posts/${postId}/like`}>
      <button type="submit" disabled={isLiking}>
        {isLiking ? "..." : "Like"}
      </button>
    </fetcher.Form>
  );
}
```

**Why:** `fetcher.Form` changes no URL and moves no `useNavigation` state. Each fetcher carries its own `state` and `data`, several can be in flight at once, and each one that succeeds revalidates the active loaders.

---

## useFetcher with Optimistic UI

```typescript
import { useFetcher } from "react-router";

function ToggleFavorite({ postId, isFavorite }: { postId: string; isFavorite: boolean }) {
  const fetcher = useFetcher();

  // Optimistic: use submitted value if available, otherwise current
  const optimisticFavorite =
    fetcher.formData != null
      ? fetcher.formData.get("favorite") === "true"
      : isFavorite;

  return (
    <fetcher.Form method="POST" action={`/posts/${postId}/favorite`}>
      <input type="hidden" name="favorite" value={String(!optimisticFavorite)} />
      <button type="submit">
        {optimisticFavorite ? "Unfavorite" : "Favorite"}
      </button>
    </fetcher.Form>
  );
}
```

**Why:** `fetcher.formData` is available immediately when the form submits — before the action completes. Reading the submitted value lets you update the UI optimistically. If the action fails, the next revalidation corrects the UI.

---

## useFetcher.load() for Background Data

```typescript
import { useFetcher } from "react-router";
import { useEffect } from "react";

function Notifications() {
  const fetcher = useFetcher();

  useEffect(() => {
    // Load data from a route's loader without navigation
    fetcher.load("/api/notifications");
  }, []);

  if (fetcher.state === "loading") return <span>...</span>;
  if (!fetcher.data) return null;

  return <span className="badge">{fetcher.data.count}</span>;
}
```

**Why:** `fetcher.load(href)` calls a route's loader without navigating. Useful for loading data for UI elements (notification counts, user menus) that do not correspond to the current route.

---

## Deferred Data with Await

In v7, return unresolved promises from loaders. Use `<Await>` with `<Suspense>` to render when the promise resolves.

```typescript
import { Suspense } from "react";
import { useLoaderData, Await } from "react-router";

// Loader: return critical data (awaited) + deferred data (promise)
export async function postDetailLoader({ params }: LoaderFunctionArgs) {
  return {
    post: await fetchPost(params.postId), // Critical: blocks render
    comments: fetchComments(params.postId), // Deferred: renders via Await
  };
}

export function PostDetailPage() {
  const { post, comments } = useLoaderData() as {
    post: Post;
    comments: Promise<Comment[]>;
  };

  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.body}</p>

      <Suspense fallback={<p>Loading comments...</p>}>
        <Await resolve={comments} errorElement={<p>Error loading comments</p>}>
          {(resolvedComments) => (
            <ul>
              {resolvedComments.map((c) => (
                <li key={c.id}>{c.text}</li>
              ))}
            </ul>
          )}
        </Await>
      </Suspense>
    </article>
  );
}
```

**Why:** Critical data (`post`) is awaited so it is available on first render. Non-critical data (`comments`) is returned as a promise — `<Await>` renders a `<Suspense>` fallback until it resolves. No `defer()` needed in v7.

---

## shouldRevalidate: Control Loader Re-Runs

By default every active loader revalidates after an action that returned a non-error status; after an action _error_ none of them do. `shouldRevalidate` adjusts both halves.

```typescript
{
  path: "settings",
  element: <SettingsPage />,
  loader: settingsLoader,
  shouldRevalidate: ({ actionResult, currentUrl, nextUrl, defaultShouldRevalidate }) => {
    // Only revalidate if the settings route's own action ran
    if (actionResult) return true;
    // Skip revalidation for search param changes on other routes
    if (currentUrl.pathname !== nextUrl.pathname) return false;
    return defaultShouldRevalidate;
  },
}
```

**Why:** Without `shouldRevalidate`, the settings loader re-runs whenever ANY action fires anywhere in the app. This is wasteful for data that rarely changes. `defaultShouldRevalidate` is the router's built-in logic — use it as a fallback.

---

## Manual Revalidation

```typescript
import { useRevalidator } from "react-router";

function RefreshButton() {
  const revalidator = useRevalidator();

  return (
    <button
      type="button"
      onClick={() => revalidator.revalidate()}
      disabled={revalidator.state !== "idle"}
    >
      {revalidator.state === "idle" ? "Refresh" : "Refreshing..."}
    </button>
  );
}
```

**Why:** `useRevalidator()` re-runs all active loaders on demand. Useful for "pull to refresh" or "refresh data" buttons. `revalidator.state` tracks whether revalidation is in progress.

---

## BAD: Fetching Data in useEffect

```typescript
// BAD: Data fetching in component creates waterfall
function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/posts")
      .then((r) => r.json())
      .then(setPosts)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading...</p>;
  return <ul>{posts.map((p) => <li key={p.id}>{p.title}</li>)}</ul>;
}
```

**Why bad:** Component renders empty, then fires fetch, then re-renders with data. This creates a waterfall when nested (parent loads, mounts child, child loads, mounts grandchild...). Loaders run before any component mounts and run in parallel for sibling routes.
