# TanStack Router -- Core Setup & Configuration

> Router plugin configuration, root route, entry point, router creation, and devtools. See [SKILL.md](../SKILL.md) for core patterns and [reference.md](../reference.md) for API reference.

**Related examples:**

- [Routes & Layouts](routes.md) -- defining routes, nested layouts, pathless routes
- [Navigation](navigation.md) -- Link, useNavigate, redirect
- [Data Loading](data-loading.md) -- loaders, data fetching integration

---

## Router Plugin Configuration

The plugin ships one entry point per bundler; the config below uses `@tanstack/router-plugin/vite`.

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [
    // Router plugin MUST come before the React plugin
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
  ],
});
```

**Why:** `autoCodeSplitting: true` splits route components and loaders into separate chunks automatically. The plugin generates `routeTree.gen.ts` with full type safety. Placing it before the React plugin ensures correct transform order.

---

## Root Route with Context

`createRootRoute` takes the same options minus the context generic — use it only when no route needs an injected service.

```typescript
// src/routes/__root.tsx
import {
  createRootRouteWithContext,
  Link,
  Outlet,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

// Define the shape of your router context
// Include any services or clients you need in loaders/beforeLoad
// `User` is your own domain type, not a router export
export interface RouterContext {
  auth: {
    isAuthenticated: boolean;
    user: User | null;
    getUser: () => Promise<User | null>;
  };
  // Add other services here — an API client, a cache client, anything loaders need
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

---

## Entry Point with Router Registration

```typescript
// src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

const STALE_TIME_MS = 30_000;

const router = createRouter({
  routeTree,
  context: {
    auth: {
      isAuthenticated: false,
      user: null,
      getUser: async () => null,
    },
    // Pass services here - they become available in all loaders/beforeLoad
  },
  defaultPreload: "intent",
  defaultStaleTime: STALE_TIME_MS,
});

// Register router for app-wide type safety
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
    <RouterProvider router={router} />
  </StrictMode>,
);
```

**Why:** `declare module` registration enables type-safe `Link` and `useNavigate` across the entire app. Passing services via router context makes them available to all loaders without global imports, improving testability.

---

## Devtools Setup

Rendering `<TanStackRouterDevtools />` inside the root component is enough — it hides itself when `process.env.NODE_ENV === "production"`. Lazy-loading it additionally keeps it out of the development bundle until it is needed.

```typescript
// src/routes/__root.tsx
import { lazy, Suspense } from "react";
import { createRootRoute, Outlet } from "@tanstack/react-router";

const RouterDevtools =
  process.env.NODE_ENV === "production"
    ? () => null
    : lazy(() =>
        import("@tanstack/react-router-devtools").then((mod) => ({
          default: mod.TanStackRouterDevtools,
        })),
      );

export const Route = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <Suspense>
        <RouterDevtools position="bottom-right" />
      </Suspense>
    </>
  ),
});
```

**Why:** Lazy-loaded devtools avoid increasing initial bundle size in development. Production build tree-shakes the entire import.
