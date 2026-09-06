# SvelteKit — Hooks

> `handle`, `handleFetch`, `handleError`, `init`, `reroute`, `transport` and `sequence` — everything
> that applies to a request rather than to a route.

---

## Pattern 1: Authentication with the handle Hook

### Good Example — session-based auth

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

**Why good:** One place resolves the session, and every load function and action downstream reads
`locals.user` instead of parsing the cookie again. `event.locals` is request-scoped, so there is no
risk of one request seeing another's user. The `App.Locals` declaration is what makes it typed rather
than `any`.

---

## Pattern 2: Combining Hooks with sequence

### Good Example — three concerns, three hooks

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

**Why good:** Each hook does one thing and can be reordered or removed on its own. The order matters:
auth runs first so the logger and the header hook both see a resolved user, and the timing wraps
everything inside it.

---

## Pattern 3: handleError

### Good Example — reporting without leaking

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

**Why good:** The returned object is what `+error.svelte` renders, so it must not carry a stack trace
or a query fragment. The generated id is the bridge: the user quotes it, and it matches the log entry
holding everything that was withheld.

---

## Pattern 4: handleFetch

### Good Example — rewriting an API URL during SSR

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

**Why good:** A load function writes one public URL and this hook decides how it is reached, so the
server-side call skips the public hop while the browser's identical call still goes through it. The
prefix check keeps the rewrite from touching third-party requests.

---

## Pattern 5: Route Protection in a Hook

### Good Example — guarding by path prefix

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

**Why good:** The guard runs before any load function, so a protected route's load never executes for
an anonymous visitor. The trade-off against a layout guard: this one is a path-prefix list that has to
be maintained, where a layout guards whatever is nested under it automatically.

---

## Pattern 6: resolve Options

### Good Example — transforming the HTML

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

**Why good:** The theme is in the server's first byte, so there is no flash of the wrong one while
JavaScript loads — which is the failure a client-side theme switch produces.
`filterSerializedResponseHeaders` matters for correctness rather than speed: headers from a load's
own `fetch` are otherwise replayed to the client.

---

## Pattern 7: init

### Good Example — failing fast at startup

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

**Why good:** A throw here stops the server from starting, so a missing environment variable is a
deploy failure rather than a 500 on whichever request first needs it. Introduced in SvelteKit 2.10.

---

## Pattern 8: reroute

### Good Example — stripping a locale prefix

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

**Why good:** `reroute` runs before route matching, so `/fr/about` and `/about` resolve to the same
route file — four locales need no duplicated route tree. Returning nothing leaves the URL alone,
which is why the non-locale case needs no branch.

From SvelteKit 2.18, `reroute` also receives `fetch` and may be async:
`({ url, fetch }) => MaybePromise<string | void>`.

---

## Pattern 9: transport

### Good Example — a class that survives the boundary

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

**Why good:** A server load normally flattens a class to a plain object, losing `format()`. `transport`
is what lifts that restriction — `encode` returns a falsy value for anything it does not recognise, so
SvelteKit knows to try the next entry, and `decode` rebuilds the instance with its methods intact.

---

_Endpoints are in [api-routes.md](api-routes.md); mutations in
[form-actions.md](form-actions.md)._
