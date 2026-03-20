# Qwik City Routing & Server Features

> Code examples for file-based routing, routeLoader$, routeAction$, server$, layouts, and middleware. See [SKILL.md](../SKILL.md) for core concepts.

**Prerequisites**: Understand component$, useSignal, useStore from [core.md](core.md) first.

---

## Pattern 1: File-Based Route Structure

### Good Example - Project Structure to URL Mapping

```
src/routes/
├── index.tsx              → /
├── about/
│   └── index.tsx          → /about
├── layout.tsx             → Wraps all pages (root layout)
├── blog/
│   ├── index.tsx          → /blog
│   ├── layout.tsx         → Wraps all /blog/* pages
│   └── [slug]/
│       └── index.tsx      → /blog/:slug
├── docs/
│   └── [...catchall]/
│       └── index.tsx      → /docs/*, /docs/*/*, etc.
├── (auth)/                → Route group (no URL segment)
│   ├── login/
│   │   └── index.tsx      → /login (NOT /auth/login)
│   └── register/
│       └── index.tsx      → /register
├── dashboard/
│   ├── index.tsx          → /dashboard
│   └── index@minimal.tsx  → Uses layout-minimal.tsx instead
└── api/
    └── search/
        └── index.ts       → API endpoint: /api/search
```

**Why good:** Directories = URL segments, `index.tsx` = page, `layout.tsx` = shared wrapper, `[param]` = dynamic, `[...rest]` = catch-all, `(group)` = pathless grouping, `@layout` = named layout override

---

## Pattern 2: Layouts and Nested Layouts

### Good Example - Root and Nested Layouts

```tsx
// src/routes/layout.tsx - Root layout (wraps everything)
import { component$, Slot } from "@builder.io/qwik";

export default component$(() => {
  return (
    <>
      <header>
        <nav>
          <a href="/">Home</a>
          <a href="/blog">Blog</a>
          <a href="/about">About</a>
        </nav>
      </header>
      <main>
        <Slot /> {/* Page content renders here */}
      </main>
      <footer>
        <p>&copy; 2025</p>
      </footer>
    </>
  );
});
```

```tsx
// src/routes/blog/layout.tsx - Blog-specific layout (nests inside root)
import { component$, Slot } from "@builder.io/qwik";

export default component$(() => {
  return (
    <div class="blog-layout">
      <aside class="blog-sidebar">
        <h3>Categories</h3>
        <Slot name="sidebar" />
      </aside>
      <article class="blog-content">
        <Slot /> {/* Blog page content */}
      </article>
    </div>
  );
});
```

**Why good:** Layouts compose automatically via directory nesting. `/blog/my-post` gets root layout > blog layout > page content. Named slots allow pages to inject sidebar content.

---

## Pattern 3: Dynamic Routes

### Good Example - Route Parameters

```tsx
// src/routes/users/[userId]/index.tsx
import { component$ } from "@builder.io/qwik";
import { routeLoader$, useLocation } from "@builder.io/qwik-city";

export const useUser = routeLoader$(async (requestEvent) => {
  const userId = requestEvent.params.userId;
  const user = await db.users.findById(userId);

  if (!user) {
    return requestEvent.fail(404, {
      errorMessage: `User ${userId} not found`,
    });
  }

  return user;
});

export default component$(() => {
  const user = useUser();
  const location = useLocation(); // { params, url, isNavigating }

  if (user.value.failed) {
    return <p>{user.value.errorMessage}</p>;
  }

  return (
    <div>
      <h1>{user.value.name}</h1>
      <p>Current URL: {location.url.pathname}</p>
    </div>
  );
});
```

**Why good:** `requestEvent.params` provides route parameters, `fail()` returns typed error instead of throwing, `useLocation()` gives current URL and navigation state

---

## Pattern 4: routeLoader$ Patterns

### Good Example - Multiple Loaders with Cross-Loader Dependencies

```tsx
// src/routes/dashboard/index.tsx
import { component$ } from "@builder.io/qwik";
import { routeLoader$ } from "@builder.io/qwik-city";

export const useCurrentUser = routeLoader$(async (requestEvent) => {
  const session = requestEvent.cookie.get("session");
  if (!session) {
    throw requestEvent.redirect(302, "/login");
  }
  return await db.users.findBySession(session.value);
});

// Second loader can depend on the first
export const useUserProjects = routeLoader$(async (requestEvent) => {
  const user = await requestEvent.resolveValue(useCurrentUser);
  return await db.projects.findByUser(user.id);
});

export default component$(() => {
  const user = useCurrentUser();
  const projects = useUserProjects();

  return (
    <div>
      <h1>Welcome, {user.value.name}</h1>
      <h2>Your Projects</h2>
      <ul>
        {projects.value.map((p) => (
          <li key={p.id}>{p.name}</li>
        ))}
      </ul>
    </div>
  );
});
```

**Why good:** `requestEvent.redirect()` handles auth redirects, `requestEvent.resolveValue()` chains loader dependencies, both loaders run server-side before render, cookie access for session management

### Bad Example - Fetching in useTask$

```tsx
// BAD: Data fetching in useTask$ instead of routeLoader$
export default component$(() => {
  const projects = useSignal<Project[]>([]);

  useTask$(async () => {
    // This blocks rendering and doesn't integrate with SSR streaming
    const res = await fetch("/api/projects");
    projects.value = await res.json();
  });

  return <ProjectList items={projects.value} />;
});
```

**Why bad:** `useTask$` blocks rendering until the fetch completes, doesn't integrate with SSR streaming, requires a loading state the user shouldn't see during SSR. Use `routeLoader$` instead.

---

## Pattern 5: routeAction$ with Zod Validation

### Good Example - Form with Validation and Error Handling

```tsx
// src/routes/posts/new/index.tsx
import { component$ } from "@builder.io/qwik";
import { routeAction$, Form, zod$, z } from "@builder.io/qwik-city";

export const useCreatePost = routeAction$(
  async (data, requestEvent) => {
    const session = requestEvent.cookie.get("session");
    if (!session) {
      return requestEvent.fail(401, { message: "Not authenticated" });
    }

    try {
      const post = await db.posts.create({
        title: data.title,
        body: data.body,
        authorId: session.value,
      });

      throw requestEvent.redirect(302, `/posts/${post.id}`);
    } catch (error) {
      return requestEvent.fail(500, { message: "Failed to create post" });
    }
  },
  zod$({
    title: z.string().min(3, "Title must be at least 3 characters"),
    body: z.string().min(10, "Body must be at least 10 characters"),
  }),
);

export default component$(() => {
  const createPost = useCreatePost();

  return (
    <Form action={createPost}>
      <div>
        <label for="title">Title</label>
        <input id="title" name="title" />
        {createPost.value?.fieldErrors?.title && (
          <span class="error">{createPost.value.fieldErrors.title}</span>
        )}
      </div>

      <div>
        <label for="body">Body</label>
        <textarea id="body" name="body" />
        {createPost.value?.fieldErrors?.body && (
          <span class="error">{createPost.value.fieldErrors.body}</span>
        )}
      </div>

      {createPost.value?.failed && !createPost.value?.fieldErrors && (
        <div class="error">{createPost.value.message}</div>
      )}

      <button type="submit" disabled={createPost.isRunning}>
        {createPost.isRunning ? "Creating..." : "Create Post"}
      </button>
    </Form>
  );
});
```

**Why good:** `<Form>` component works without JS (progressive enhancement), Zod validation with per-field errors, `fail()` for typed error responses, `isRunning` for submit state, redirect on success

---

## Pattern 6: Programmatic Action Submission

### Good Example - Action Without a Form

```tsx
import { component$, useSignal } from "@builder.io/qwik";
import { routeAction$ } from "@builder.io/qwik-city";

export const useToggleFavorite = routeAction$(async (data, requestEvent) => {
  const userId = requestEvent.cookie.get("userId")?.value;
  if (!userId) return requestEvent.fail(401, { message: "Not logged in" });

  await db.favorites.toggle(userId, data.postId);
  return { favorited: true };
});

export default component$(() => {
  const toggleFav = useToggleFavorite();

  return (
    <button
      onClick$={async () => {
        // Programmatic submission - no <Form> needed
        await toggleFav.submit({ postId: "post-123" });
      }}
      disabled={toggleFav.isRunning}
    >
      {toggleFav.isRunning ? "..." : "Favorite"}
    </button>
  );
});
```

**Why good:** `.submit()` enables programmatic calls without `<Form>`, returns a Promise, works for actions that don't map to traditional form submissions

---

## Pattern 7: server$ for Ad-Hoc RPC

### Good Example - Server Function with Streaming

```tsx
import { component$, useSignal } from "@builder.io/qwik";
import { server$ } from "@builder.io/qwik-city";

// Simple server function - runs on server, callable from client
const getServerTime = server$(function () {
  // Access request context via 'this'
  const userAgent = this.headers.get("user-agent");
  return {
    time: new Date().toISOString(),
    userAgent,
  };
});

// Streaming server function using async generator
const streamData = server$(async function* (query: string) {
  const results = await db.search(query);
  for (const result of results) {
    yield result;
    await new Promise((r) => setTimeout(r, 100)); // Simulate delay
  }
});

export default component$(() => {
  const results = useSignal<string[]>([]);

  return (
    <div>
      <button
        onClick$={async () => {
          // Simple call
          const { time } = await getServerTime();
          // Use server time

          // Streaming call
          const stream = await streamData("search term");
          for await (const item of stream) {
            results.value = [...results.value, item];
          }
        }}
      >
        Fetch from server
      </button>

      <ul>
        {results.value.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
    </div>
  );
});
```

**Why good:** `server$` creates type-safe RPC with no API route boilerplate, `this` gives request context, async generators enable streaming responses, callable directly from event handlers

**Gotcha:** Middleware defined in `layout.tsx` does NOT run for `server$` calls. If you need auth checks on `server$` calls, use `plugin.ts` or check auth inside the function itself.

---

## Pattern 8: API Endpoints

### Good Example - REST Endpoint

```typescript
// src/routes/api/posts/index.ts
import type { RequestHandler } from "@builder.io/qwik-city";

export const onGet: RequestHandler = async (requestEvent) => {
  const limit = Number(requestEvent.url.searchParams.get("limit")) || 10;
  const posts = await db.posts.findMany({ take: limit });

  requestEvent.json(200, posts);
};

export const onPost: RequestHandler = async (requestEvent) => {
  const body = await requestEvent.parseBody();

  if (!body || typeof body !== "object") {
    requestEvent.json(400, { error: "Invalid body" });
    return;
  }

  const post = await db.posts.create(body);
  requestEvent.json(201, post);
};
```

**Why good:** HTTP method handlers (`onGet`, `onPost`) for REST semantics, `requestEvent.json()` for typed responses, query params and body parsing built-in

---

## Pattern 9: Middleware with onRequest

### Good Example - Auth Middleware

```tsx
// src/routes/dashboard/layout.tsx
import { component$, Slot } from "@builder.io/qwik";
import type { RequestHandler } from "@builder.io/qwik-city";

// Middleware runs before loaders and page rendering
export const onRequest: RequestHandler = async (requestEvent) => {
  const session = requestEvent.cookie.get("session");
  if (!session) {
    throw requestEvent.redirect(302, "/login");
  }

  // Share data with downstream loaders via sharedMap
  const user = await db.users.findBySession(session.value);
  requestEvent.sharedMap.set("user", user);
};

export default component$(() => {
  return (
    <div class="dashboard-layout">
      <Slot />
    </div>
  );
});
```

```tsx
// src/routes/dashboard/index.tsx - page inherits middleware
import { component$ } from "@builder.io/qwik";
import { routeLoader$ } from "@builder.io/qwik-city";

export const useUser = routeLoader$(async (requestEvent) => {
  // User already validated by layout middleware
  return requestEvent.sharedMap.get("user");
});

export default component$(() => {
  const user = useUser();
  return <h1>Welcome, {user.value.name}</h1>;
});
```

**Why good:** `onRequest` runs before any loader or component, `sharedMap` passes data downstream without re-fetching, redirect throws to halt execution, layout middleware protects all child routes

---

## Pattern 10: Navigation

### Good Example - Programmatic and Link Navigation

```tsx
import { component$ } from "@builder.io/qwik";
import { Link, useNavigate, useLocation } from "@builder.io/qwik-city";

export default component$(() => {
  const nav = useNavigate();
  const loc = useLocation();

  return (
    <div>
      {/* Link component - SPA navigation, prefetch defaults to true */}
      <Link href="/about">About (SPA)</Link>
      <Link href="/blog" prefetch={false}>
        Blog (no prefetch)
      </Link>

      {/* Regular anchor - full page reload */}
      <a href="/external">External (MPA)</a>

      {/* Programmatic navigation */}
      <button
        onClick$={async () => {
          await nav("/dashboard");
        }}
      >
        Go to Dashboard
      </button>

      {/* Navigation state */}
      {loc.isNavigating && <p>Loading...</p>}
      <p>Current path: {loc.url.pathname}</p>
    </div>
  );
});
```

**Why good:** `<Link>` for SPA navigation (no full reload, prefetch defaults to `true`), `useNavigate()` for programmatic nav, `useLocation().isNavigating` for loading indicators, regular `<a>` for MPA behavior when needed

---

_See [core.md](core.md) for component, state, and event patterns. See [serialization.md](serialization.md) for $ boundary rules._
