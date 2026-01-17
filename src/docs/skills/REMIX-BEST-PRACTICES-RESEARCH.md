# Remix Best Practices Research

> Research compiled: 2026-01-15
> Purpose: Atomic skill creation for Remix development patterns

---

## Table of Contents

1. [Loader Patterns](#1-loader-patterns)
2. [Action Patterns](#2-action-patterns)
3. [Nested Routes and Layouts](#3-nested-routes-and-layouts)
4. [Error Boundaries](#4-error-boundaries)
5. [Progressive Enhancement](#5-progressive-enhancement)
6. [Form Handling](#6-form-handling)
7. [Optimistic UI](#7-optimistic-ui)
8. [Resource Routes (APIs)](#8-resource-routes-apis)
9. [Cookie/Session Handling](#9-cookiesession-handling)
10. [Remix + Vite Patterns](#10-remix--vite-patterns)

---

## 1. Loader Patterns

### Core Patterns

#### Pattern 1: Type-Safe Loaders with `typeof loader`

```typescript
// app/routes/users.$userId.tsx
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";

export async function loader({ params, request }: LoaderFunctionArgs) {
  invariant(params.userId, "Expected params.userId");

  const user = await db.user.findUnique({
    where: { id: params.userId },
  });

  if (!user) {
    throw new Response("User not found", { status: 404 });
  }

  return json({ user });
}

export default function UserRoute() {
  // Type is automatically inferred from loader return
  const { user } = useLoaderData<typeof loader>();
  return <div>{user.name}</div>;
}
```

#### Pattern 2: Deferred Loading with Streaming

```typescript
// app/routes/dashboard.tsx
import type { LoaderFunctionArgs } from "@remix-run/node";
import { defer } from "@remix-run/node";
import { Await, useLoaderData } from "@remix-run/react";
import { Suspense } from "react";

export async function loader({ request }: LoaderFunctionArgs) {
  // Critical data - awaited immediately
  const user = await getUser(request);

  // Non-critical data - deferred (streamed)
  const analyticsPromise = getAnalytics(user.id);
  const recentActivityPromise = getRecentActivity(user.id);

  return defer({
    user,
    analytics: analyticsPromise,
    recentActivity: recentActivityPromise,
  });
}

export default function Dashboard() {
  const { user, analytics, recentActivity } = useLoaderData<typeof loader>();

  return (
    <div>
      <h1>Welcome, {user.name}</h1>

      <Suspense fallback={<AnalyticsSkeleton />}>
        <Await resolve={analytics}>
          {(data) => <AnalyticsChart data={data} />}
        </Await>
      </Suspense>

      <Suspense fallback={<ActivitySkeleton />}>
        <Await resolve={recentActivity}>
          {(data) => <ActivityFeed items={data} />}
        </Await>
      </Suspense>
    </div>
  );
}
```

#### Pattern 3: Parameter Validation with Invariant

```typescript
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import invariant from "tiny-invariant";

export async function loader({ params }: LoaderFunctionArgs) {
  // Validates and narrows type from string | undefined to string
  invariant(params.teamId, "Expected params.teamId");
  invariant(params.projectId, "Expected params.projectId");

  const project = await getProject(params.teamId, params.projectId);

  if (!project) {
    throw new Response("Project not found", { status: 404 });
  }

  return json({ project });
}
```

#### Pattern 4: Parallel Data Loading

```typescript
export async function loader({ params }: LoaderFunctionArgs) {
  invariant(params.productId, "Expected params.productId");

  // Load all independent data in parallel
  const [product, reviews, relatedProducts] = await Promise.all([
    getProduct(params.productId),
    getProductReviews(params.productId),
    getRelatedProducts(params.productId),
  ]);

  return json({ product, reviews, relatedProducts });
}
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: Using LoaderFunction type directly
// This returns `any`, losing type safety
export const loader: LoaderFunction = async ({ params }) => {
  return json({ user: await getUser(params.userId) });
};

// ANTI-PATTERN 2: Manually typing return values
// Types can drift from actual implementation
export async function loader(): Promise<{ user: User }> {
  // ...
}

// ANTI-PATTERN 3: Returning instead of throwing for errors
export async function loader({ params }: LoaderFunctionArgs) {
  const user = await getUser(params.userId);
  if (!user) {
    return json({ error: "Not found" }); // BAD: Component must handle this
  }
  return json({ user });
}

// ANTI-PATTERN 4: Wrapping loader in HOC
// This breaks tree-shaking and includes server code in client bundle
export const loader = makeAuthLoader(async ({ params }) => {
  // ...
});

// ANTI-PATTERN 5: Exposing sensitive data
export async function loader() {
  const user = await getUser();
  // BAD: Exposes password hash to client even if not rendered
  return json({ user });
}
```

### When to Use

| Use Loaders | Avoid Loaders |
|-------------|---------------|
| Server-side data fetching | Client-only state |
| Authentication checks | Static content |
| Database queries | Already cached data |
| API calls | Real-time subscriptions (use resource routes + SSE) |
| SEO-critical data | Large binary files (use resource routes) |

---

## 2. Action Patterns

### Core Patterns

#### Pattern 1: Basic Form Action with Validation

```typescript
// app/routes/users.new.tsx
import type { ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";
import { z } from "zod";

const CreateUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();

  const result = CreateUserSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password"),
  });

  if (!result.success) {
    return json(
      { errors: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const user = await createUser(result.data);

  // Best practice: Redirect after successful mutation
  return redirect(`/users/${user.id}`);
}

export default function NewUserRoute() {
  const actionData = useActionData<typeof action>();

  return (
    <Form method="post">
      <div>
        <label htmlFor="email">Email</label>
        <input type="email" name="email" id="email" />
        {actionData?.errors?.email && (
          <span className="error">{actionData.errors.email[0]}</span>
        )}
      </div>

      <div>
        <label htmlFor="name">Name</label>
        <input type="text" name="name" id="name" />
        {actionData?.errors?.name && (
          <span className="error">{actionData.errors.name[0]}</span>
        )}
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input type="password" name="password" id="password" />
        {actionData?.errors?.password && (
          <span className="error">{actionData.errors.password[0]}</span>
        )}
      </div>

      <button type="submit">Create User</button>
    </Form>
  );
}
```

#### Pattern 2: Multi-Action Route with Intent

```typescript
// app/routes/tasks.$taskId.tsx
import type { ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form } from "@remix-run/react";
import invariant from "tiny-invariant";

export async function action({ request, params }: ActionFunctionArgs) {
  invariant(params.taskId, "Expected params.taskId");
  const formData = await request.formData();
  const intent = formData.get("intent");

  switch (intent) {
    case "update": {
      const title = formData.get("title");
      const description = formData.get("description");
      await updateTask(params.taskId, { title, description });
      return json({ success: true });
    }

    case "delete": {
      await deleteTask(params.taskId);
      return redirect("/tasks");
    }

    case "complete": {
      await markTaskComplete(params.taskId);
      return json({ success: true });
    }

    default: {
      throw new Response(`Unknown intent: ${intent}`, { status: 400 });
    }
  }
}

export default function TaskRoute() {
  return (
    <div>
      {/* Update form */}
      <Form method="post">
        <input type="text" name="title" />
        <textarea name="description" />
        <button type="submit" name="intent" value="update">
          Save Changes
        </button>
      </Form>

      {/* Single-button forms */}
      <Form method="post">
        <button type="submit" name="intent" value="complete">
          Mark Complete
        </button>
      </Form>

      <Form method="post">
        <button type="submit" name="intent" value="delete">
          Delete Task
        </button>
      </Form>
    </div>
  );
}
```

#### Pattern 3: Action with Flash Messages

```typescript
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { getSession, commitSession } from "~/sessions.server";

export async function action({ request }: ActionFunctionArgs) {
  const session = await getSession(request.headers.get("Cookie"));

  try {
    await performDangerousOperation();
    session.flash("success", "Operation completed successfully!");
  } catch (error) {
    session.flash("error", "Something went wrong. Please try again.");
  }

  return redirect("/dashboard", {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get("Cookie"));

  const message = {
    success: session.get("success"),
    error: session.get("error"),
  };

  return json(
    { message },
    {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    }
  );
}

export default function Dashboard() {
  const { message } = useLoaderData<typeof loader>();

  return (
    <div>
      {message.success && <div className="alert-success">{message.success}</div>}
      {message.error && <div className="alert-error">{message.error}</div>}
      {/* rest of dashboard */}
    </div>
  );
}
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: Not redirecting after mutation
export async function action({ request }: ActionFunctionArgs) {
  await createItem(await request.formData());
  // BAD: User can refresh and re-submit
  return json({ success: true });
}

// ANTI-PATTERN 2: Using GET for mutations
<Form method="get"> {/* BAD: Mutations should use POST/PUT/DELETE */}
  <button type="submit">Delete</button>
</Form>

// ANTI-PATTERN 3: Manual state management for submission status
function MyComponent() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  // BAD: Remix provides this via useNavigation()
}

// ANTI-PATTERN 4: Not handling validation errors properly
export async function action({ request }: ActionFunctionArgs) {
  const data = await request.formData();
  if (!data.get("email")) {
    throw new Error("Email required"); // BAD: Throws to ErrorBoundary
  }
}

// ANTI-PATTERN 5: Calling action directly
// BAD: Don't import and call action functions directly
import { action } from "./other-route";
await action({ request, params: {} });
```

### When to Use

| Use Actions | Avoid Actions |
|-------------|---------------|
| Form submissions | GET requests (use loader) |
| Data mutations (CRUD) | File downloads (use resource routes) |
| Authentication (login/logout) | Real-time updates (use WebSockets) |
| Multi-step wizards | Read-only operations |
| File uploads | Idempotent operations that should be cached |

---

## 3. Nested Routes and Layouts

### Core Patterns

#### Pattern 1: Basic Nested Route Structure

```
app/
├── routes/
│   ├── _index.tsx           # / (home)
│   ├── dashboard.tsx        # /dashboard (layout)
│   ├── dashboard._index.tsx # /dashboard (index content)
│   ├── dashboard.settings.tsx    # /dashboard/settings
│   └── dashboard.analytics.tsx   # /dashboard/analytics
```

```typescript
// app/routes/dashboard.tsx (Parent Layout)
import { Outlet, NavLink } from "@remix-run/react";

export default function DashboardLayout() {
  return (
    <div className="dashboard">
      <nav className="dashboard-nav">
        <NavLink to="/dashboard" end>Overview</NavLink>
        <NavLink to="/dashboard/settings">Settings</NavLink>
        <NavLink to="/dashboard/analytics">Analytics</NavLink>
      </nav>

      <main className="dashboard-content">
        {/* Child routes render here */}
        <Outlet />
      </main>
    </div>
  );
}
```

#### Pattern 2: Pathless Layout Routes (Grouping)

```
app/
├── routes/
│   ├── _auth.tsx            # Pathless layout (no URL segment)
│   ├── _auth.login.tsx      # /login
│   ├── _auth.register.tsx   # /register
│   ├── _auth.forgot-password.tsx  # /forgot-password
```

```typescript
// app/routes/_auth.tsx
import { Outlet } from "@remix-run/react";

export default function AuthLayout() {
  return (
    <div className="auth-container">
      <div className="auth-card">
        <img src="/logo.svg" alt="Logo" className="auth-logo" />
        <Outlet />
      </div>
      <footer className="auth-footer">
        <p>Need help? Contact support</p>
      </footer>
    </div>
  );
}
```

#### Pattern 3: Opting Out of Layout Nesting

```
app/
├── routes/
│   ├── dashboard.tsx              # /dashboard (layout)
│   ├── dashboard.settings.tsx     # /dashboard/settings (nested in layout)
│   ├── dashboard_.print.tsx       # /dashboard/print (NOT nested - trailing _)
```

```typescript
// app/routes/dashboard_.print.tsx
// This route has the URL /dashboard/print but does NOT use dashboard.tsx layout
export default function PrintableDashboard() {
  return (
    <div className="print-only">
      {/* Full page for printing, no navigation */}
    </div>
  );
}
```

#### Pattern 4: Dynamic Segments with Layouts

```
app/
├── routes/
│   ├── teams.$teamId.tsx          # /teams/:teamId (layout)
│   ├── teams.$teamId._index.tsx   # /teams/:teamId (index)
│   ├── teams.$teamId.members.tsx  # /teams/:teamId/members
│   ├── teams.$teamId.settings.tsx # /teams/:teamId/settings
```

```typescript
// app/routes/teams.$teamId.tsx
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";

export async function loader({ params }: LoaderFunctionArgs) {
  invariant(params.teamId, "Expected params.teamId");
  const team = await getTeam(params.teamId);

  if (!team) {
    throw new Response("Team not found", { status: 404 });
  }

  return json({ team });
}

export default function TeamLayout() {
  const { team } = useLoaderData<typeof loader>();

  return (
    <div>
      <header>
        <h1>{team.name}</h1>
      </header>
      <Outlet context={{ team }} />
    </div>
  );
}

// Child route can access context
// app/routes/teams.$teamId.members.tsx
import { useOutletContext } from "@remix-run/react";
import type { Team } from "~/types";

export default function TeamMembers() {
  const { team } = useOutletContext<{ team: Team }>();
  return <div>Members of {team.name}</div>;
}
```

#### Pattern 5: Manual Route Configuration (Vite)

```typescript
// vite.config.ts
import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    remix({
      routes(defineRoutes) {
        return defineRoutes((route) => {
          // Custom route definitions
          route("/", "routes/home.tsx", { index: true });
          route("dashboard", "routes/dashboard/layout.tsx", () => {
            route("", "routes/dashboard/index.tsx", { index: true });
            route("settings", "routes/dashboard/settings.tsx");
          });
        });
      },
    }),
  ],
});
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: Prop drilling instead of Outlet context
// Parent
export default function Parent() {
  const data = useLoaderData();
  return <Child data={data} />; // BAD: Pass via context instead
}

// ANTI-PATTERN 2: Duplicating layouts
// Having multiple layout files with same code instead of using nested routes

// ANTI-PATTERN 3: Deep nesting without purpose
// app/routes/a.b.c.d.e.f.g.tsx - Too many nesting levels

// ANTI-PATTERN 4: Not using Outlet
export default function Layout() {
  return (
    <div>
      <nav>...</nav>
      {/* Missing <Outlet /> - children won't render! */}
    </div>
  );
}

// ANTI-PATTERN 5: Fetching same data in parent and child
// Parent and child both call getUser() - use parent loader + context
```

### When to Use

| Pattern | Use Case |
|---------|----------|
| Nested layouts | Shared UI (nav, sidebars) |
| Pathless layouts (`_prefix`) | Visual grouping without URL |
| Trailing underscore (`route_`) | Same URL path, different layout |
| Dynamic segments (`$param`) | Entity-specific pages |
| Catch-all (`$.tsx`) | 404 handling, legacy URLs |

---

## 4. Error Boundaries

### Core Patterns

#### Pattern 1: Root Error Boundary

```typescript
// app/root.tsx
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useRouteError,
} from "@remix-run/react";

export function ErrorBoundary() {
  const error = useRouteError();

  // Handle known response errors (404, 403, etc.)
  if (isRouteErrorResponse(error)) {
    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <Meta />
          <Links />
          <title>{error.status} {error.statusText}</title>
        </head>
        <body>
          <div className="error-container">
            <h1>{error.status}</h1>
            <p>{error.statusText}</p>
            {error.status === 404 && (
              <p>The page you're looking for doesn't exist.</p>
            )}
            <a href="/">Go back home</a>
          </div>
          <Scripts />
        </body>
      </html>
    );
  }

  // Handle unexpected errors
  const errorMessage = error instanceof Error ? error.message : "Unknown error";

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <title>Application Error</title>
      </head>
      <body>
        <div className="error-container">
          <h1>Something went wrong</h1>
          <p>{errorMessage}</p>
          <a href="/">Go back home</a>
        </div>
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
```

#### Pattern 2: Route-Specific Error Boundary

```typescript
// app/routes/products.$productId.tsx
import { useRouteError, isRouteErrorResponse, Link } from "@remix-run/react";

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return (
        <div className="product-not-found">
          <h2>Product Not Found</h2>
          <p>We couldn't find the product you're looking for.</p>
          <Link to="/products">Browse all products</Link>
        </div>
      );
    }

    if (error.status === 403) {
      return (
        <div className="product-forbidden">
          <h2>Access Denied</h2>
          <p>You don't have permission to view this product.</p>
          <Link to="/login">Log in</Link>
        </div>
      );
    }
  }

  return (
    <div className="product-error">
      <h2>Error Loading Product</h2>
      <p>Please try again later.</p>
    </div>
  );
}
```

#### Pattern 3: Throwing Responses for Controlled Errors

```typescript
// app/routes/posts.$slug.tsx
export async function loader({ params }: LoaderFunctionArgs) {
  const post = await getPost(params.slug);

  if (!post) {
    throw new Response("Post not found", {
      status: 404,
      statusText: "Not Found",
    });
  }

  if (!post.published) {
    throw new Response("This post is not yet published", {
      status: 403,
      statusText: "Forbidden",
    });
  }

  return json({ post });
}
```

#### Pattern 4: Custom Error Tracking

```typescript
// app/entry.server.tsx
import * as Sentry from "@sentry/remix";
import type { HandleErrorFunction } from "@remix-run/node";

export const handleError: HandleErrorFunction = (error, { request }) => {
  // Don't log 404s or other expected responses
  if (error instanceof Response && error.status < 500) {
    return;
  }

  // Log to error tracking service
  Sentry.captureException(error, {
    extra: {
      url: request.url,
      method: request.method,
    },
  });

  console.error(error);
};
```

#### Pattern 5: Catch-All 404 Route

```typescript
// app/routes/$.tsx
import { Link } from "@remix-run/react";

export function loader() {
  throw new Response("Not found", { status: 404 });
}

export default function CatchAll() {
  // This won't render due to the throw above
  return null;
}

// The error boundary in root.tsx or a parent layout will handle this
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: Error boundary that can throw
export function ErrorBoundary() {
  const error = useRouteError();
  // BAD: This could throw if someData is undefined
  return <div>{someData.property}</div>;
}

// ANTI-PATTERN 2: Not handling different error types
export function ErrorBoundary() {
  const error = useRouteError();
  // BAD: Assumes error is always an Error instance
  return <div>{error.message}</div>;
}

// ANTI-PATTERN 3: Using try/catch in loaders for expected cases
export async function loader({ params }: LoaderFunctionArgs) {
  try {
    const user = await getUser(params.id);
    return json({ user });
  } catch (e) {
    // BAD: Use throw new Response() instead
    return json({ error: "Not found" }, { status: 404 });
  }
}

// ANTI-PATTERN 4: Handling input validation with ErrorBoundary
// BAD: Input errors should be returned as action data, not thrown
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  if (!formData.get("email")) {
    throw new Error("Email required"); // Use actionData instead
  }
}
```

### When to Use

| Error Type | Handling Method |
|------------|-----------------|
| 404 Not Found | `throw new Response("...", { status: 404 })` |
| 403 Forbidden | `throw new Response("...", { status: 403 })` |
| 401 Unauthorized | Redirect to login |
| Form validation | Return errors via `actionData` |
| Unexpected errors | Let them propagate to ErrorBoundary |
| API failures | Catch and throw appropriate Response |

---

## 5. Progressive Enhancement

### Core Patterns

#### Pattern 1: Form That Works Without JavaScript

```typescript
// app/routes/contact.tsx
import type { ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();

  const errors: Record<string, string> = {};

  if (!formData.get("email")) {
    errors.email = "Email is required";
  }
  if (!formData.get("message")) {
    errors.message = "Message is required";
  }

  if (Object.keys(errors).length > 0) {
    return json({ errors, values: Object.fromEntries(formData) });
  }

  await sendContactEmail({
    email: formData.get("email") as string,
    message: formData.get("message") as string,
  });

  return redirect("/contact/success");
}

export default function ContactRoute() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <Form method="post">
      <div>
        <label htmlFor="email">Email</label>
        <input
          type="email"
          id="email"
          name="email"
          defaultValue={actionData?.values?.email}
          aria-invalid={actionData?.errors?.email ? true : undefined}
          aria-describedby={actionData?.errors?.email ? "email-error" : undefined}
        />
        {actionData?.errors?.email && (
          <span id="email-error" className="error">
            {actionData.errors.email}
          </span>
        )}
      </div>

      <div>
        <label htmlFor="message">Message</label>
        <textarea
          id="message"
          name="message"
          defaultValue={actionData?.values?.message}
          aria-invalid={actionData?.errors?.message ? true : undefined}
        />
        {actionData?.errors?.message && (
          <span className="error">{actionData.errors.message}</span>
        )}
      </div>

      {/* Works without JS, enhanced with JS */}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Sending..." : "Send Message"}
      </button>
    </Form>
  );
}
```

#### Pattern 2: Enhanced Search with Debouncing

```typescript
// app/routes/search.tsx
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useLoaderData, useNavigation, useSubmit } from "@remix-run/react";
import { useEffect, useRef } from "react";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";

  const results = query ? await searchProducts(query) : [];

  return json({ query, results });
}

export default function SearchRoute() {
  const { query, results } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const formRef = useRef<HTMLFormElement>(null);

  const isSearching = navigation.location?.search.includes("q=");

  // Progressive enhancement: auto-submit on type (only with JS)
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    const handleInput = debounce(() => {
      submit(form);
    }, 300);

    const input = form.querySelector('input[name="q"]');
    input?.addEventListener("input", handleInput);

    return () => input?.removeEventListener("input", handleInput);
  }, [submit]);

  return (
    <div>
      {/* Works without JS as regular form submission */}
      <Form ref={formRef} method="get">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search products..."
        />
        {/* Button for no-JS fallback */}
        <button type="submit">Search</button>
      </Form>

      {isSearching ? (
        <p>Searching...</p>
      ) : (
        <ul>
          {results.map((result) => (
            <li key={result.id}>{result.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

#### Pattern 3: Progressive Image Loading

```typescript
// app/components/progressive-image.tsx
import { useState } from "react";

interface ProgressiveImageProps {
  src: string;
  alt: string;
  placeholder?: string;
  className?: string;
}

export function ProgressiveImage({
  src,
  alt,
  placeholder = "/placeholder.svg",
  className,
}: ProgressiveImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // Works without JS - shows image directly
  // With JS - shows placeholder first, then fades in
  return (
    <div className={`progressive-image ${className || ""}`}>
      {/* No-JS: Shows immediately via noscript */}
      <noscript>
        <img src={src} alt={alt} />
      </noscript>

      {/* JS-enhanced version */}
      <img
        src={error ? placeholder : src}
        alt={alt}
        className={loaded ? "loaded" : "loading"}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        loading="lazy"
      />
    </div>
  );
}
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: Preventing default form behavior
function BadForm() {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); // BAD: Breaks without JS
    // manual fetch...
  };
  return <form onSubmit={handleSubmit}>...</form>;
}

// ANTI-PATTERN 2: Required JavaScript for basic functionality
function BadComponent() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch("/api/data").then(r => r.json()).then(setData);
  }, []);

  // BAD: Shows nothing without JS
  if (!data) return <div>Loading...</div>;
  return <div>{data.content}</div>;
}

// ANTI-PATTERN 3: onClick for navigation
function BadNav() {
  const navigate = useNavigate();
  // BAD: Doesn't work without JS, not crawlable
  return <button onClick={() => navigate("/about")}>About</button>;
}

// ANTI-PATTERN 4: Client-only state management for server data
function BadServerData() {
  const [users, setUsers] = useState([]);
  // BAD: Use loader + useLoaderData instead
  useEffect(() => {
    fetchUsers().then(setUsers);
  }, []);
}
```

### When to Use

| Enhancement Level | Implementation |
|------------------|----------------|
| Base functionality | HTML form + loader/action |
| Loading states | `useNavigation().state` |
| Optimistic UI | `useFetcher().formData` |
| Real-time updates | `useFetcher` polling / SSE |
| Complex interactions | Client-side JS after hydration |

---

## 6. Form Handling

### Core Patterns

#### Pattern 1: Basic Form with Remix's Form Component

```typescript
import { Form, useActionData, useNavigation } from "@remix-run/react";
import type { ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();

  // Validate
  const title = formData.get("title");
  const content = formData.get("content");

  if (typeof title !== "string" || title.length < 3) {
    return json({ error: "Title must be at least 3 characters" }, { status: 400 });
  }

  // Create
  const post = await createPost({ title, content: content as string });

  return redirect(`/posts/${post.id}`);
}

export default function NewPost() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  return (
    <Form method="post">
      <input type="text" name="title" required minLength={3} />
      {actionData?.error && <p className="error">{actionData.error}</p>}

      <textarea name="content" />

      <button
        type="submit"
        disabled={navigation.state === "submitting"}
      >
        {navigation.state === "submitting" ? "Creating..." : "Create Post"}
      </button>
    </Form>
  );
}
```

#### Pattern 2: useFetcher for Non-Navigation Forms

```typescript
import { useFetcher } from "@remix-run/react";

interface NewsletterFetcherData {
  success?: boolean;
  error?: string;
}

export function NewsletterSignup() {
  const fetcher = useFetcher<NewsletterFetcherData>();

  const isSubmitting = fetcher.state === "submitting";
  const isSuccess = fetcher.data?.success;
  const error = fetcher.data?.error;

  if (isSuccess) {
    return <p>Thanks for subscribing!</p>;
  }

  return (
    <fetcher.Form method="post" action="/api/newsletter">
      <input
        type="email"
        name="email"
        placeholder="your@email.com"
        required
        disabled={isSubmitting}
      />
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Subscribing..." : "Subscribe"}
      </button>
      {error && <p className="error">{error}</p>}
    </fetcher.Form>
  );
}
```

#### Pattern 3: useSubmit for Programmatic Submission

```typescript
import { useSubmit } from "@remix-run/react";
import { useRef } from "react";

export function AutoSaveForm() {
  const submit = useSubmit();
  const formRef = useRef<HTMLFormElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const handleChange = () => {
    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Debounced auto-save
    timeoutRef.current = setTimeout(() => {
      if (formRef.current) {
        submit(formRef.current, { method: "post" });
      }
    }, 1000);
  };

  return (
    <form ref={formRef} onChange={handleChange} method="post">
      <input type="text" name="title" />
      <textarea name="content" />
      {/* No submit button needed - auto-saves */}
    </form>
  );
}
```

#### Pattern 4: File Upload with Progress

```typescript
// app/routes/upload.tsx
import type { ActionFunctionArgs } from "@remix-run/node";
import { json, unstable_parseMultipartFormData } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import { uploadHandler } from "~/utils/upload.server";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await unstable_parseMultipartFormData(
    request,
    uploadHandler
  );

  const file = formData.get("file");

  if (!file || typeof file === "string") {
    return json({ error: "No file uploaded" }, { status: 400 });
  }

  return json({ success: true, filename: file.name });
}

export default function UploadRoute() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  return (
    <Form method="post" encType="multipart/form-data">
      <input type="file" name="file" accept="image/*" required />

      <button type="submit" disabled={navigation.state === "submitting"}>
        {navigation.state === "submitting" ? "Uploading..." : "Upload"}
      </button>

      {actionData?.success && <p>Uploaded: {actionData.filename}</p>}
      {actionData?.error && <p className="error">{actionData.error}</p>}
    </Form>
  );
}
```

#### Pattern 5: Multiple Forms on Same Page

```typescript
export default function TaskList() {
  return (
    <div>
      {tasks.map((task) => (
        <div key={task.id} className="task">
          <span>{task.title}</span>

          {/* Each task has its own form */}
          <Form method="post">
            <input type="hidden" name="taskId" value={task.id} />
            <button type="submit" name="intent" value="complete">
              Complete
            </button>
          </Form>

          <Form method="post">
            <input type="hidden" name="taskId" value={task.id} />
            <button type="submit" name="intent" value="delete">
              Delete
            </button>
          </Form>
        </div>
      ))}

      {/* Add new task form */}
      <Form method="post">
        <input type="text" name="title" placeholder="New task..." />
        <button type="submit" name="intent" value="create">
          Add
        </button>
      </Form>
    </div>
  );
}
```

#### Pattern 6: Cross-Component Fetcher with Key

```typescript
// Component A - Triggers the action
export function AddToCartButton({ productId }: { productId: string }) {
  const fetcher = useFetcher({ key: `cart-${productId}` });

  return (
    <fetcher.Form method="post" action="/cart">
      <input type="hidden" name="productId" value={productId} />
      <button type="submit" disabled={fetcher.state !== "idle"}>
        {fetcher.state !== "idle" ? "Adding..." : "Add to Cart"}
      </button>
    </fetcher.Form>
  );
}

// Component B - Shows the status
export function CartStatus({ productId }: { productId: string }) {
  const fetcher = useFetcher({ key: `cart-${productId}` });

  if (fetcher.state === "submitting") {
    return <span>Adding to cart...</span>;
  }

  if (fetcher.data?.success) {
    return <span>Added!</span>;
  }

  return null;
}
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: Preventing default and using fetch
function BadForm() {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/submit", { method: "POST", body: new FormData(e.target) });
  };
  // BAD: Breaks progressive enhancement, loses Remix features
  return <form onSubmit={handleSubmit}>...</form>;
}

// ANTI-PATTERN 2: Using useState for form submission state
function BadFormState() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  // BAD: Use useNavigation or useFetcher instead
}

// ANTI-PATTERN 3: Not using hidden inputs for IDs
<Form method="post" action={`/tasks/${task.id}/delete`}>
  {/* BAD: URL-based actions harder to manage */}
</Form>

// BETTER:
<Form method="post">
  <input type="hidden" name="taskId" value={task.id} />
  <button name="intent" value="delete">Delete</button>
</Form>

// ANTI-PATTERN 4: Calling action from component
import { action } from "./route";
// BAD: Don't import and call actions directly
```

### When to Use

| Hook/Component | Use Case |
|----------------|----------|
| `<Form>` | Page-level forms, navigation after submit |
| `useFetcher` | In-page mutations, no navigation needed |
| `useSubmit` | Programmatic submission, auto-save |
| `<form>` | Only for `reloadDocument` fallbacks |

---

## 7. Optimistic UI

### Core Patterns

#### Pattern 1: Optimistic Create with useFetcher

```typescript
import { useFetcher } from "@remix-run/react";

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

export function TodoList({ todos }: { todos: Todo[] }) {
  const fetcher = useFetcher();

  // Get optimistic todo from pending submission
  const optimisticTodo = fetcher.formData
    ? {
        id: "temp-" + Date.now(),
        title: fetcher.formData.get("title") as string,
        completed: false,
      }
    : null;

  // Combine real todos with optimistic one
  const allTodos = optimisticTodo ? [...todos, optimisticTodo] : todos;

  return (
    <div>
      <ul>
        {allTodos.map((todo) => (
          <li
            key={todo.id}
            className={todo.id.startsWith("temp-") ? "optimistic" : ""}
          >
            {todo.title}
          </li>
        ))}
      </ul>

      <fetcher.Form method="post">
        <input type="text" name="title" placeholder="New todo..." />
        <button type="submit" name="intent" value="create">
          Add Todo
        </button>
      </fetcher.Form>
    </div>
  );
}
```

#### Pattern 2: Optimistic Update

```typescript
import { useFetcher } from "@remix-run/react";

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

export function TodoItem({ todo }: { todo: Todo }) {
  const fetcher = useFetcher();

  // Determine displayed state - optimistic or actual
  const isCompleted = fetcher.formData
    ? fetcher.formData.get("completed") === "true"
    : todo.completed;

  return (
    <li className={isCompleted ? "completed" : ""}>
      <fetcher.Form method="post">
        <input type="hidden" name="todoId" value={todo.id} />
        <input type="hidden" name="completed" value={String(!isCompleted)} />

        <button type="submit" name="intent" value="toggle">
          <span className={isCompleted ? "checked" : "unchecked"}>
            {isCompleted ? "✓" : "○"}
          </span>
          {todo.title}
        </button>
      </fetcher.Form>
    </li>
  );
}
```

#### Pattern 3: Optimistic Delete

```typescript
import { useFetcher } from "@remix-run/react";

export function TodoItem({ todo }: { todo: Todo }) {
  const fetcher = useFetcher();

  // Hide item immediately when deleting
  const isDeleting =
    fetcher.state !== "idle" &&
    fetcher.formData?.get("intent") === "delete";

  if (isDeleting) {
    return null; // Optimistically remove from UI
  }

  return (
    <li>
      <span>{todo.title}</span>
      <fetcher.Form method="post">
        <input type="hidden" name="todoId" value={todo.id} />
        <button type="submit" name="intent" value="delete">
          Delete
        </button>
      </fetcher.Form>
    </li>
  );
}
```

#### Pattern 4: Multiple Concurrent Optimistic Updates

```typescript
import { useFetcher, useFetchers } from "@remix-run/react";

export function TodoList({ todos }: { todos: Todo[] }) {
  // Get all active fetchers for this list
  const fetchers = useFetchers();

  // Build optimistic state from all pending operations
  const optimisticTodos = todos.map((todo) => {
    // Find any fetcher operating on this todo
    const fetcher = fetchers.find(
      (f) => f.formData?.get("todoId") === todo.id
    );

    if (fetcher?.formData) {
      const intent = fetcher.formData.get("intent");

      if (intent === "toggle") {
        return {
          ...todo,
          completed: fetcher.formData.get("completed") === "true",
        };
      }

      if (intent === "delete") {
        return null; // Mark for removal
      }
    }

    return todo;
  }).filter(Boolean) as Todo[];

  // Add any optimistic creates
  const pendingCreates = fetchers
    .filter((f) => f.formData?.get("intent") === "create")
    .map((f) => ({
      id: "pending-" + f.key,
      title: f.formData!.get("title") as string,
      completed: false,
    }));

  const allTodos = [...optimisticTodos, ...pendingCreates];

  return (
    <ul>
      {allTodos.map((todo) => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </ul>
  );
}
```

#### Pattern 5: Optimistic UI with Rollback on Error

```typescript
import { useFetcher } from "@remix-run/react";
import { useEffect, useState } from "react";

export function LikeButton({ postId, initialLikes }: { postId: string; initialLikes: number }) {
  const fetcher = useFetcher<{ likes: number; error?: string }>();
  const [showError, setShowError] = useState(false);

  // Optimistic count
  const optimisticLikes =
    fetcher.state !== "idle" && fetcher.formData
      ? initialLikes + 1
      : (fetcher.data?.likes ?? initialLikes);

  // Show error briefly if action failed
  useEffect(() => {
    if (fetcher.data?.error) {
      setShowError(true);
      const timer = setTimeout(() => setShowError(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [fetcher.data?.error]);

  return (
    <div>
      <fetcher.Form method="post" action="/api/like">
        <input type="hidden" name="postId" value={postId} />
        <button type="submit">
          ❤️ {optimisticLikes}
        </button>
      </fetcher.Form>
      {showError && (
        <span className="error">Failed to like. Please try again.</span>
      )}
    </div>
  );
}
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: Using useState for optimistic state
function BadOptimistic() {
  const [optimisticValue, setOptimisticValue] = useState(value);
  // BAD: Use fetcher.formData instead
}

// ANTI-PATTERN 2: Not handling errors/rollback
function BadNoRollback() {
  // Assumes every operation succeeds
  // BAD: Handle fetcher.data?.error cases
}

// ANTI-PATTERN 3: Optimistic UI for critical operations
function BadCriticalOptimistic() {
  // BAD: Don't use optimistic UI for payments, deletions of important data
  // Wait for server confirmation for critical operations
}

// ANTI-PATTERN 4: Complex optimistic state without useFetchers
function BadSingleFetcher() {
  const fetcher = useFetcher();
  // BAD: Single fetcher can't track multiple concurrent operations
  // Use useFetchers() for multiple items
}
```

### When to Use

| Scenario | Use Optimistic UI? |
|----------|-------------------|
| Toggle states (like, favorite) | Yes |
| Add items to list | Yes |
| Edit inline text | Yes |
| Delete non-critical items | Yes |
| Payments/purchases | No - wait for confirmation |
| Delete important data | No - confirm first |
| Complex multi-step operations | No - show progress |

---

## 8. Resource Routes (APIs)

### Core Patterns

#### Pattern 1: JSON API Endpoint

```typescript
// app/routes/api.users.ts (no default export = resource route)
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

// GET /api/users
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "10");

  const users = await getUsers({ page, limit });

  return json({
    data: users,
    meta: {
      page,
      limit,
      total: await getUsersCount(),
    },
  });
}

// POST /api/users
export async function action({ request }: ActionFunctionArgs) {
  const contentType = request.headers.get("Content-Type");

  let data;
  if (contentType?.includes("application/json")) {
    data = await request.json();
  } else {
    const formData = await request.formData();
    data = Object.fromEntries(formData);
  }

  const user = await createUser(data);

  return json({ data: user }, { status: 201 });
}
```

#### Pattern 2: RESTful Resource with Multiple Methods

```typescript
// app/routes/api.users.$userId.ts
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import invariant from "tiny-invariant";

// GET /api/users/:userId
export async function loader({ params }: LoaderFunctionArgs) {
  invariant(params.userId, "userId is required");

  const user = await getUser(params.userId);

  if (!user) {
    throw new Response("User not found", { status: 404 });
  }

  return json({ data: user });
}

// PATCH/PUT/DELETE /api/users/:userId
export async function action({ request, params }: ActionFunctionArgs) {
  invariant(params.userId, "userId is required");

  switch (request.method) {
    case "PATCH":
    case "PUT": {
      const updates = await request.json();
      const user = await updateUser(params.userId, updates);
      return json({ data: user });
    }

    case "DELETE": {
      await deleteUser(params.userId);
      return json({ success: true });
    }

    default: {
      return json(
        { error: `Method ${request.method} not allowed` },
        { status: 405 }
      );
    }
  }
}
```

#### Pattern 3: Webhook Handler

```typescript
// app/routes/webhooks.stripe.ts
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function action({ request }: ActionFunctionArgs) {
  const payload = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      payload,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed");
    return json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutComplete(session);
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionUpdate(subscription);
      break;
    }
  }

  return json({ received: true });
}
```

#### Pattern 4: File Download/Stream

```typescript
// app/routes/api.exports.$reportId[.csv].ts
import type { LoaderFunctionArgs } from "@remix-run/node";
import invariant from "tiny-invariant";

export async function loader({ params }: LoaderFunctionArgs) {
  invariant(params.reportId, "reportId is required");

  const report = await getReport(params.reportId);

  if (!report) {
    throw new Response("Report not found", { status: 404 });
  }

  const csv = convertToCSV(report.data);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="report-${params.reportId}.csv"`,
    },
  });
}
```

#### Pattern 5: Server-Sent Events (SSE)

```typescript
// app/routes/api.events.ts
import type { LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const sendEvent = (data: unknown) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      // Initial event
      sendEvent({ type: "connected", timestamp: Date.now() });

      // Periodic updates
      const interval = setInterval(() => {
        sendEvent({ type: "ping", timestamp: Date.now() });
      }, 30000);

      // Subscribe to events
      const unsubscribe = eventEmitter.on("update", (data) => {
        sendEvent(data);
      });

      // Cleanup on client disconnect
      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
```

#### Pattern 6: Image/Asset Generation

```typescript
// app/routes/api.og[.png].tsx
import type { LoaderFunctionArgs } from "@remix-run/node";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const title = url.searchParams.get("title") || "Default Title";

  // Generate SVG with Satori
  const svg = await satori(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#1a1a2e",
        color: "white",
        fontSize: 60,
      }}
    >
      {title}
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: [/* font config */],
    }
  );

  // Convert to PNG
  const resvg = new Resvg(svg);
  const png = resvg.render().asPng();

  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: Adding default export to resource route
export default function ApiRoute() {
  // BAD: This makes it a UI route, not a resource route
  return <div>This shouldn't render</div>;
}

// ANTI-PATTERN 2: Not validating authentication
export async function loader() {
  // BAD: No auth check - anyone can access
  return json(await getAllUsers());
}

// ANTI-PATTERN 3: Inconsistent response format
export async function loader() {
  const user = await getUser();
  return json(user); // Sometimes returns user
  // return json({ data: user }); // Sometimes returns wrapped
  // BAD: Be consistent with response structure
}

// ANTI-PATTERN 4: Not handling content types
export async function action({ request }: ActionFunctionArgs) {
  const data = await request.json(); // BAD: Assumes JSON
  // Handle both FormData and JSON
}

// ANTI-PATTERN 5: Coupling API routes to UI routes
// BAD: Importing from UI routes creates tight coupling
import { getLoaderData } from "./ui-route";
```

### When to Use

| Use Resource Routes | Use UI Routes Instead |
|--------------------|----------------------|
| Mobile app API | Web forms with progressive enhancement |
| Webhooks | User-facing pages |
| File downloads | Interactive dashboards |
| SSE/WebSocket endpoints | Search pages |
| Third-party integrations | CRUD operations with UI |
| OG image generation | - |

---

## 9. Cookie/Session Handling

### Core Patterns

#### Pattern 1: Basic Session Storage Setup

```typescript
// app/sessions.server.ts
import { createCookieSessionStorage } from "@remix-run/node";

type SessionData = {
  userId: string;
  role: "admin" | "user";
};

type SessionFlashData = {
  success: string;
  error: string;
};

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be set");
}

export const sessionStorage = createCookieSessionStorage<
  SessionData,
  SessionFlashData
>({
  cookie: {
    name: "__session",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: "/",
    sameSite: "lax",
    secrets: [SESSION_SECRET],
    secure: process.env.NODE_ENV === "production",
  },
});

export const { getSession, commitSession, destroySession } = sessionStorage;
```

#### Pattern 2: Authentication Flow

```typescript
// app/routes/login.tsx
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";
import { getSession, commitSession } from "~/sessions.server";
import { verifyLogin } from "~/models/user.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get("Cookie"));

  // Already logged in - redirect to dashboard
  if (session.has("userId")) {
    return redirect("/dashboard");
  }

  return json({});
}

export async function action({ request }: ActionFunctionArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const formData = await request.formData();

  const email = formData.get("email");
  const password = formData.get("password");

  const user = await verifyLogin(email as string, password as string);

  if (!user) {
    return json(
      { error: "Invalid email or password" },
      { status: 400 }
    );
  }

  session.set("userId", user.id);
  session.set("role", user.role);

  return redirect("/dashboard", {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}

export default function LoginRoute() {
  const actionData = useActionData<typeof action>();

  return (
    <Form method="post">
      <input type="email" name="email" required />
      <input type="password" name="password" required />
      {actionData?.error && <p className="error">{actionData.error}</p>}
      <button type="submit">Log In</button>
    </Form>
  );
}
```

#### Pattern 3: Logout Flow

```typescript
// app/routes/logout.tsx
import type { ActionFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { getSession, destroySession } from "~/sessions.server";

export async function action({ request }: ActionFunctionArgs) {
  const session = await getSession(request.headers.get("Cookie"));

  return redirect("/login", {
    headers: {
      "Set-Cookie": await destroySession(session),
    },
  });
}

// Usage in component:
// <Form method="post" action="/logout">
//   <button type="submit">Log Out</button>
// </Form>
```

#### Pattern 4: Protected Route Helper

```typescript
// app/utils/auth.server.ts
import { redirect } from "@remix-run/node";
import { getSession } from "~/sessions.server";

export async function requireUser(request: Request) {
  const session = await getSession(request.headers.get("Cookie"));
  const userId = session.get("userId");

  if (!userId) {
    const url = new URL(request.url);
    throw redirect(`/login?redirectTo=${encodeURIComponent(url.pathname)}`);
  }

  return userId;
}

export async function requireAdmin(request: Request) {
  const session = await getSession(request.headers.get("Cookie"));
  const userId = session.get("userId");
  const role = session.get("role");

  if (!userId) {
    throw redirect("/login");
  }

  if (role !== "admin") {
    throw new Response("Forbidden", { status: 403 });
  }

  return userId;
}

// Usage in loader:
export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUser(request);
  // User is authenticated, proceed...
}
```

#### Pattern 5: Flash Messages

```typescript
// app/routes/settings.tsx
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { getSession, commitSession } from "~/sessions.server";

export async function action({ request }: ActionFunctionArgs) {
  const session = await getSession(request.headers.get("Cookie"));

  try {
    await updateSettings(await request.formData());
    session.flash("success", "Settings updated successfully!");
  } catch (error) {
    session.flash("error", "Failed to update settings. Please try again.");
  }

  return redirect("/settings", {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get("Cookie"));

  const data = {
    success: session.get("success"),
    error: session.get("error"),
    settings: await getSettings(),
  };

  return json(data, {
    headers: {
      // Commit to clear flash messages after reading
      "Set-Cookie": await commitSession(session),
    },
  });
}

export default function SettingsRoute() {
  const { success, error, settings } = useLoaderData<typeof loader>();

  return (
    <div>
      {success && <div className="alert-success">{success}</div>}
      {error && <div className="alert-error">{error}</div>}
      {/* Settings form */}
    </div>
  );
}
```

#### Pattern 6: Theme/Preferences Cookie

```typescript
// app/cookies.server.ts
import { createCookie } from "@remix-run/node";

export const themeCookie = createCookie("theme", {
  maxAge: 60 * 60 * 24 * 365, // 1 year
  sameSite: "lax",
  path: "/",
});

// app/routes/api.theme.ts (resource route)
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { themeCookie } from "~/cookies.server";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const theme = formData.get("theme");

  return json(
    { theme },
    {
      headers: {
        "Set-Cookie": await themeCookie.serialize(theme),
      },
    }
  );
}

// app/root.tsx
export async function loader({ request }: LoaderFunctionArgs) {
  const cookieHeader = request.headers.get("Cookie");
  const theme = (await themeCookie.parse(cookieHeader)) || "light";

  return json({ theme });
}
```

#### Pattern 7: Secret Rotation

```typescript
// app/sessions.server.ts
export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    // New secret first, old secrets after for rotation
    secrets: [
      process.env.SESSION_SECRET_NEW!,
      process.env.SESSION_SECRET_OLD!, // Still accepted, but new cookies use first
    ],
    secure: process.env.NODE_ENV === "production",
  },
});
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: Storing sensitive data in cookies
session.set("creditCard", cardNumber); // BAD: Store reference in DB instead

// ANTI-PATTERN 2: Not using httpOnly
createCookieSessionStorage({
  cookie: {
    httpOnly: false, // BAD: Exposes to XSS attacks
  },
});

// ANTI-PATTERN 3: Weak/missing secrets
createCookieSessionStorage({
  cookie: {
    secrets: ["secret"], // BAD: Use strong, env-based secrets
  },
});

// ANTI-PATTERN 4: Not committing session after changes
export async function action({ request }: ActionFunctionArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  session.set("userId", user.id);
  return redirect("/dashboard"); // BAD: Missing Set-Cookie header!
}

// ANTI-PATTERN 5: Exceeding cookie size limit
session.set("largeData", veryLargeObject); // BAD: Cookies limited to 4KB
// Use database storage for large data

// ANTI-PATTERN 6: Not securing in production
createCookieSessionStorage({
  cookie: {
    secure: false, // BAD in production: Use secure: process.env.NODE_ENV === "production"
  },
});
```

### When to Use

| Storage Type | Use Case |
|--------------|----------|
| Cookie Session | Small data (<4KB), serverless/stateless |
| Database Session | Large data, session revocation needed |
| Simple Cookie | Non-sensitive preferences (theme, locale) |
| Memory Session | Development only |

---

## 10. Remix + Vite Patterns

### Core Patterns

#### Pattern 1: Basic Vite Configuration

```typescript
// vite.config.ts
import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    remix({
      // Enable future flags for forward compatibility
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
      },
    }),
    tsconfigPaths(),
  ],
});
```

#### Pattern 2: Environment Variables

```typescript
// vite.config.ts
import { defineConfig, loadEnv } from "vite";
import { vitePlugin as remix } from "@remix-run/dev";

export default defineConfig(({ mode }) => {
  // Load env file based on `mode`
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [remix()],
    define: {
      // Only expose specific public env vars to client
      "process.env.PUBLIC_API_URL": JSON.stringify(env.PUBLIC_API_URL),
    },
  };
});
```

#### Pattern 3: Custom Route Configuration

```typescript
// vite.config.ts
import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    remix({
      // Ignore test files in routes
      ignoredRouteFiles: ["**/*.test.{ts,tsx}", "**/__tests__/**"],

      // Custom route definitions
      routes(defineRoutes) {
        return defineRoutes((route) => {
          // Version 2 API routes
          route("/api/v2/*", "routes/api-v2.ts");

          // Admin section with custom layout
          route("admin", "routes/admin/_layout.tsx", () => {
            route("", "routes/admin/dashboard.tsx", { index: true });
            route("users", "routes/admin/users.tsx");
            route("settings", "routes/admin/settings.tsx");
          });
        });
      },
    }),
  ],
});
```

#### Pattern 4: Asset Handling

```typescript
// vite.config.ts
import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";

export default defineConfig({
  plugins: [
    remix(),
    // Import SVGs as React components
    svgr({
      svgrOptions: {
        icon: true,
      },
    }),
  ],
  // Asset optimization
  build: {
    assetsInlineLimit: 4096, // Inline assets < 4KB
    rollupOptions: {
      output: {
        // Chunk splitting for better caching
        manualChunks: {
          vendor: ["react", "react-dom"],
        },
      },
    },
  },
});

// Usage in component:
import Logo from "./logo.svg?react";

export function Header() {
  return <Logo className="header-logo" />;
}
```

#### Pattern 5: Development Server Configuration

```typescript
// vite.config.ts
import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [remix()],
  server: {
    port: 3000,
    // Proxy API requests to backend
    proxy: {
      "/api/external": {
        target: "http://localhost:8080",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/external/, ""),
      },
    },
    // HTTPS for local development
    // https: {
    //   key: fs.readFileSync("./certs/key.pem"),
    //   cert: fs.readFileSync("./certs/cert.pem"),
    // },
  },
});
```

#### Pattern 6: CSS/Styling Setup

```typescript
// vite.config.ts
import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [remix()],
  css: {
    modules: {
      // CSS Modules configuration
      localsConvention: "camelCase",
      generateScopedName: "[name]__[local]__[hash:base64:5]",
    },
    preprocessorOptions: {
      scss: {
        // Global SCSS imports
        additionalData: `@use "@/styles/variables" as *;`,
      },
    },
  },
});
```

#### Pattern 7: Production Build Optimization

```typescript
// vite.config.ts
import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig(({ mode }) => ({
  plugins: [
    remix({
      // Server bundling for deployment target
      serverBuildFile: "index.js",
      serverModuleFormat: "esm",
    }),
    // Bundle analysis (only in analyze mode)
    mode === "analyze" &&
      visualizer({
        open: true,
        filename: "dist/stats.html",
      }),
  ].filter(Boolean),
  build: {
    // Minification
    minify: "esbuild",
    // Source maps for error tracking
    sourcemap: true,
    // Target modern browsers
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Vendor chunking strategy
          if (id.includes("node_modules")) {
            if (id.includes("@radix-ui")) {
              return "radix";
            }
            if (id.includes("react")) {
              return "react";
            }
            return "vendor";
          }
        },
      },
    },
  },
}));
```

#### Pattern 8: Path Aliases

```typescript
// vite.config.ts
import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [remix()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./app"),
      "@components": resolve(__dirname, "./app/components"),
      "@utils": resolve(__dirname, "./app/utils"),
      "@styles": resolve(__dirname, "./app/styles"),
    },
  },
});

// tsconfig.json should match:
// {
//   "compilerOptions": {
//     "paths": {
//       "@/*": ["./app/*"],
//       "@components/*": ["./app/components/*"],
//       "@utils/*": ["./app/utils/*"],
//       "@styles/*": ["./app/styles/*"]
//     }
//   }
// }
```

#### Pattern 9: Server Adapter Configuration

```typescript
// vite.config.ts for Cloudflare
import { vitePlugin as remix } from "@remix-run/dev";
import { cloudflareDevProxyVitePlugin as cloudflare } from "@remix-run/cloudflare";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    cloudflare(),
    remix({
      serverModuleFormat: "esm",
    }),
  ],
});

// vite.config.ts for Vercel
import { vitePlugin as remix } from "@remix-run/dev";
import { vercelPreset } from "@vercel/remix/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    remix({
      presets: [vercelPreset()],
    }),
  ],
});
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: Using CJS modules in Vite config
const remix = require("@remix-run/dev"); // BAD: Use ESM imports

// ANTI-PATTERN 2: Not using future flags
remix({
  // BAD: Missing future flags means bigger migration later
});

// ANTI-PATTERN 3: Hardcoding environment values
define: {
  "process.env.API_KEY": "sk-12345", // BAD: Use loadEnv()
},

// ANTI-PATTERN 4: Importing server code in client
// vite.config.ts
export default defineConfig({
  // BAD: Server-only modules in client bundle
  // Use .server.ts convention for server-only files
});

// ANTI-PATTERN 5: Not configuring for target platform
// BAD: Using Node.js APIs when deploying to Cloudflare Workers
// Ensure serverModuleFormat and platform-specific plugins are correct

// ANTI-PATTERN 6: Missing tsconfig paths plugin
export default defineConfig({
  plugins: [remix()],
  // BAD: tsconfig paths won't work without vite-tsconfig-paths
});
```

### When to Use

| Configuration | Use Case |
|---------------|----------|
| Custom routes | Non-standard URL structure, API versioning |
| ignoredRouteFiles | Co-located tests, helper files |
| CSS preprocessors | SCSS/Less projects |
| Path aliases | Clean imports in large projects |
| Proxy | Local API development |
| Manual chunks | Performance optimization |
| Server adapters | Edge deployments (Cloudflare, Vercel) |

---

## Summary: Skill Creation Recommendations

Based on this research, here are recommended atomic skills for Remix:

### High Priority Skills

1. **remix-loader-patterns** - Type-safe loaders, defer/streaming, parallel loading
2. **remix-action-patterns** - Form mutations, multi-action routes, validation
3. **remix-form-handling** - Form, useFetcher, useSubmit patterns
4. **remix-error-handling** - Error boundaries, response throwing, error tracking
5. **remix-session-auth** - Cookie sessions, authentication flows, protected routes

### Medium Priority Skills

6. **remix-nested-routes** - Layout patterns, pathless routes, outlet context
7. **remix-optimistic-ui** - Optimistic create/update/delete, concurrent updates
8. **remix-resource-routes** - JSON APIs, webhooks, file downloads, SSE
9. **remix-vite-config** - Build configuration, plugins, optimization

### Supporting Skills

10. **remix-progressive-enhancement** - Forms without JS, graceful degradation
11. **remix-data-revalidation** - shouldRevalidate optimization patterns

---

## Sources

- [Remix Data Loading Documentation](https://remix.run/docs/en/main/guides/data-loading)
- [Remix Loader Reference](https://remix.run/docs/en/main/route/loader)
- [Remix Action Reference](https://remix.run/docs/en/main/route/action)
- [Remix Data Writes Guide](https://remix.run/docs/en/main/guides/data-writes)
- [Remix Routing Guide](https://remix.run/docs/en/main/guides/routing)
- [Understanding Routes in Remix - LogRocket](https://blog.logrocket.com/understanding-routes-route-nesting-remix/)
- [Structure with Nested Layouts - Jacob Paris](https://www.jacobparis.com/content/using-nested-layouts-with-remix)
- [Remix Error Handling - Better Stack](https://betterstack.com/community/guides/scaling-nodejs/error-handling-remix/)
- [Remix ErrorBoundary Reference](https://remix.run/docs/en/main/route/error-boundary)
- [Remix Progressive Enhancement Discussion](https://v2.remix.run/docs/discussion/progressive-enhancement/)
- [Remix useFetcher Reference](https://remix.run/docs/en/main/hooks/use-fetcher)
- [Remix useSubmit Reference](https://remix.run/docs/en/main/hooks/use-submit)
- [Form vs Fetcher - Remix Docs](https://remix.run/docs/en/main/discussion/form-vs-fetcher)
- [Remix Pending UI Guide](https://remix.run/docs/en/main/discussion/pending-ui)
- [Remix Optimistic UI Guide](https://remix.run/docs/en/main/guides/optimistic-ui)
- [Optimistic UI Guidelines - Jacob Paris](https://www.jacobparis.com/content/remix-crud-ui)
- [Remix Resource Routes](https://v2.remix.run/docs/guides/resource-routes/)
- [Remix API Routes Guide](https://remix.run/docs/en/main/guides/api-routes)
- [Remix Sessions Documentation](https://v2.remix.run/docs/utils/sessions/)
- [Remix Cookies Documentation](https://v2.remix.run/docs/utils/cookies/)
- [Cookie-based Authentication in Remix - Tiger Abrodi](https://tigerabrodi.blog/cookie-based-authentication-in-remix)
- [Remix Vite Guide](https://v2.remix.run/docs/guides/vite/)
- [Remix Hearts Vite Blog Post](https://remix.run/blog/remix-heart-vite)
- [Remix Streaming Guide](https://remix.run/docs/en/main/guides/streaming)
- [Remix shouldRevalidate Reference](https://v2.remix.run/docs/route/should-revalidate/)
- [React Router v7 Migration](https://reactrouter.com/upgrading/remix)
- [Typing Remix Loaders - Francisco Sousa](https://jfranciscosousa.com/blog/typing-remix-loaders-with-confidence)
- [Migrating from Remix to React Router v7 - KahWee](https://kahwee.com/2025/migrating-from-remix-to-react-router-v7/)
