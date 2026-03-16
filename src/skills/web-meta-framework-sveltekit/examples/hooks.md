# SvelteKit Hooks Examples

> Complete code examples for SvelteKit hook patterns. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 1: Authentication with handle Hook

### Good Example — Session-Based Auth

```typescript
// src/hooks.server.ts
import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
  // 1. Extract session from cookie
  const sessionId = event.cookies.get("session");

  if (sessionId) {
    // 2. Verify session and attach user to locals
    const session = await db.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (session && session.expiresAt > new Date()) {
      event.locals.user = {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
      };
    } else if (session) {
      // Expired session — clean up
      event.cookies.delete("session", { path: "/" });
    }
  }

  // 3. Continue to route handler
  const response = await resolve(event);
  return response;
};
```

```typescript
// src/app.d.ts — Type declaration for locals
declare global {
  namespace App {
    interface Locals {
      user: {
        id: string;
        name: string;
        email: string;
        role: string;
      } | null;
    }

    interface Error {
      message: string;
      code?: string;
    }
  }
}

export {};
```

**Why good:** Session checked on every request, user attached to `event.locals` (accessible in load functions and actions), expired sessions cleaned up, typed with `App.Locals`

---

## Pattern 2: Combining Hooks with sequence

### Good Example — Multiple Hooks

```typescript
// src/hooks.server.ts
import { sequence } from "@sveltejs/kit/hooks";
import type { Handle } from "@sveltejs/kit";

const handleAuth: Handle = async ({ event, resolve }) => {
  const sessionId = event.cookies.get("session");

  if (sessionId) {
    const user = await getUserFromSession(sessionId);
    event.locals.user = user;
  }

  return resolve(event);
};

const handleLogging: Handle = async ({ event, resolve }) => {
  const start = performance.now();

  const response = await resolve(event);

  const duration = Math.round(performance.now() - start);
  console.log(
    `${event.request.method} ${event.url.pathname} — ${response.status} (${duration}ms)`,
  );

  return response;
};

const handleSecurityHeaders: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);

  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
};

// sequence runs hooks in order
export const handle = sequence(
  handleAuth,
  handleLogging,
  handleSecurityHeaders,
);
```

**Why good:** `sequence` composes multiple hooks cleanly, each hook has single responsibility, logging measures actual response time, security headers on all responses

---

## Pattern 3: handleError Hook

### Good Example — Error Logging

```typescript
// src/hooks.server.ts
import type { HandleServerError } from "@sveltejs/kit";

export const handleError: HandleServerError = async ({
  error,
  event,
  status,
  message,
}) => {
  // Log error to external service
  const errorId = crypto.randomUUID();

  console.error(`[${errorId}] ${status} ${event.url.pathname}:`, error);

  // In production, send to error tracking
  if (process.env.NODE_ENV === "production") {
    await reportErrorToService({
      errorId,
      error,
      url: event.url.pathname,
      method: event.request.method,
      userId: event.locals.user?.id,
    });
  }

  // Return user-safe error (never expose internal details)
  return {
    message: "An unexpected error occurred",
    code: errorId,
  };
};
```

```typescript
// src/hooks.client.ts
import type { HandleClientError } from "@sveltejs/kit";

export const handleError: HandleClientError = async ({
  error,
  status,
  message,
}) => {
  const errorId = crypto.randomUUID();

  console.error(`[${errorId}] Client error:`, error);

  return {
    message: "Something went wrong",
    code: errorId,
  };
};
```

**Why good:** Unique error ID for tracking, internal details not exposed to user, both server and client error handling, error reporting to external service

---

## Pattern 4: handleFetch Hook

### Good Example — API URL Rewriting for SSR

```typescript
// src/hooks.server.ts
import type { HandleFetch } from "@sveltejs/kit";

export const handleFetch: HandleFetch = async ({ event, request, fetch }) => {
  // During SSR, rewrite public API URL to internal URL
  // (avoids going through load balancer)
  if (request.url.startsWith("https://api.myapp.com/")) {
    const internalUrl = request.url.replace(
      "https://api.myapp.com/",
      "http://api-internal:3000/",
    );

    request = new Request(internalUrl, request);
  }

  // Forward auth headers to API
  if (request.url.startsWith("http://api-internal:3000/")) {
    const sessionId = event.cookies.get("session");
    if (sessionId) {
      request.headers.set("Authorization", `Bearer ${sessionId}`);
    }
  }

  return fetch(request);
};
```

**Why good:** Internal API calls skip load balancer during SSR, auth forwarded to API, only modifies requests to known APIs

---

## Pattern 5: Route Protection with Hooks

### Good Example — Path-Based Auth Guard

```typescript
// src/hooks.server.ts
import { redirect, type Handle } from "@sveltejs/kit";

const PROTECTED_PATHS = ["/dashboard", "/settings", "/admin"];
const ADMIN_PATHS = ["/admin"];

export const handle: Handle = async ({ event, resolve }) => {
  // Auth check
  const sessionId = event.cookies.get("session");
  const user = sessionId ? await getUserFromSession(sessionId) : null;
  event.locals.user = user;

  const { pathname } = event.url;

  // Check protected routes
  const isProtected = PROTECTED_PATHS.some((path) => pathname.startsWith(path));
  if (isProtected && !user) {
    redirect(303, `/login?redirectTo=${encodeURIComponent(pathname)}`);
  }

  // Check admin routes
  const isAdmin = ADMIN_PATHS.some((path) => pathname.startsWith(path));
  if (isAdmin && user?.role !== "admin") {
    redirect(303, "/dashboard");
  }

  return resolve(event);
};
```

**Why good:** Centralized auth checks, named constants for protected paths, redirectTo preserves original destination, admin role check, runs before any load function

---

## Pattern 6: Modifying Response with resolve Options

### Good Example — Custom HTML Transform

```typescript
// src/hooks.server.ts
import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
  const theme = event.cookies.get("theme") ?? "light";

  const response = await resolve(event, {
    // Transform HTML chunks
    transformPageChunk: ({ html }) => {
      return html.replace("%theme%", theme);
    },

    // Control which headers are serialized for server load responses
    filterSerializedResponseHeaders: (name) => {
      return name === "content-type" || name === "cache-control";
    },

    // Control preloading
    preload: ({ type }) => {
      return type === "font" || type === "js" || type === "css";
    },
  });

  return response;
};
```

```html
<!-- src/app.html -->
<html data-theme="%theme%">
  <head>
    ...
  </head>
  <body>
    %sveltekit.body%
  </body>
</html>
```

**Why good:** `transformPageChunk` injects theme into HTML, `filterSerializedResponseHeaders` controls which headers are serialized, `preload` optimizes resource loading

---

## Pattern 7: init Hook

### Good Example — Server Startup Initialization

```typescript
// src/hooks.server.ts
import type { ServerInit } from "@sveltejs/kit";

export const init: ServerInit = async () => {
  // Runs once when the server starts — NOT on each request
  // Use for database connections, config validation, etc.
  await db.connect();

  // Validate required environment variables early
  const requiredVars = ["DATABASE_URL", "SESSION_SECRET"];
  for (const envVar of requiredVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  console.log("Server initialized");
};
```

**Why good:** Fails fast on startup if database or env vars are misconfigured, runs once (not per-request), introduced in SvelteKit 2.10

---

## Pattern 8: reroute Hook

### Good Example — i18n URL Rewriting

```typescript
// src/hooks.ts (universal hooks file)
import type { Reroute } from "@sveltejs/kit";

const SUPPORTED_LOCALES = ["en", "fr", "de", "es"];

export const reroute: Reroute = ({ url }) => {
  const segments = url.pathname.split("/").filter(Boolean);
  const maybeLocale = segments[0];

  // Strip locale prefix and serve the same route
  // /fr/about → renders /about (with locale available via url)
  if (SUPPORTED_LOCALES.includes(maybeLocale)) {
    return "/" + segments.slice(1).join("/");
  }
};
```

**Why good:** Runs before `handle`, rewrites URL before route matching, locale prefix removed without duplicating route files, returns `void` to skip rewriting

---

## Pattern 9: transport Hook

### Good Example — Custom Type Serialization

```typescript
// src/hooks.ts (universal hooks file)
import type { Transport } from "@sveltejs/kit";

class Money {
  constructor(
    public amount: number,
    public currency: string,
  ) {}

  format() {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: this.currency,
    }).format(this.amount);
  }
}

export const transport: Transport = {
  Money: {
    encode: (value) => value instanceof Money && [value.amount, value.currency],
    decode: ([amount, currency]) => new Money(amount, currency),
  },
};
```

**Why good:** Custom classes survive the server-to-client boundary, `encode` returns `false` for non-matching values, `decode` reconstructs the instance on the client, methods are preserved

---

_For API route patterns, see [api-routes.md](api-routes.md). For form actions, see [form-actions.md](form-actions.md)._
