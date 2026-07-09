# Vercel -- Routing & Middleware Examples

> Routing configuration and middleware patterns for Vercel. See [SKILL.md](../SKILL.md) for decision guidance.

**Related examples:**

- [Core Configuration & Functions](core.md) -- vercel.json, functions, runtime selection
- [Cron Jobs & Scheduling](cron-jobs.md) -- Scheduled task patterns
- [Monorepo & Advanced](monorepo.md) -- Monorepo and advanced config

---

## Routing Middleware

Routing Middleware runs before the cache on every request. Create a `middleware.ts` (or `middleware.js`) at the project root.

### Basic Middleware

```typescript
// middleware.ts
export default function middleware(request: Request) {
  const url = new URL(request.url);

  // Skip middleware for static assets (adjust paths for your framework)
  if (url.pathname.startsWith("/static/") || url.pathname.includes(".")) {
    return;
  }

  // Add custom header to all responses
  const response = new Response(null, { status: 200 });
  response.headers.set("x-middleware-ran", "true");
  return response;
}
```

### Auth Check Middleware

```typescript
// middleware.ts -- protect routes with auth check
const PROTECTED_PATHS = ["/dashboard", "/settings", "/admin"];

export default async function middleware(request: Request) {
  const url = new URL(request.url);
  const isProtected = PROTECTED_PATHS.some((path) =>
    url.pathname.startsWith(path),
  );

  if (!isProtected) return;

  const token = request.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) {
    return Response.redirect(new URL("/login", request.url));
  }

  // Validate token with your auth provider
  const isValid = await validateToken(token);
  if (!isValid) {
    return Response.redirect(new URL("/login", request.url));
  }

  // Continue to the requested page (return nothing or undefined)
}
```

**Why good:** Named constant for protected paths, early return for unprotected routes, proper Bearer token extraction, redirect to login on failure

### Geo-Routing Middleware

```typescript
// middleware.ts -- route users by geography
const COUNTRY_REDIRECTS: Record<string, string> = {
  DE: "/de",
  FR: "/fr",
  JP: "/ja",
};

export default function middleware(request: Request) {
  const url = new URL(request.url);

  // Don't redirect if already on a localized path
  if (
    url.pathname.startsWith("/de") ||
    url.pathname.startsWith("/fr") ||
    url.pathname.startsWith("/ja")
  ) {
    return;
  }

  const country = request.headers.get("x-vercel-ip-country") ?? "US";
  const redirectPath = COUNTRY_REDIRECTS[country];

  if (redirectPath) {
    return Response.redirect(new URL(redirectPath + url.pathname, request.url));
  }
}
```

**Why good:** Lookup table for country mappings, avoids redirect loops by checking current path, preserves original pathname in redirect

### Changing Middleware Runtime

```typescript
// middleware.ts -- use Node.js instead of Edge (default)
export const config = {
  runtime: "nodejs", // default is "edge"
};

export default function middleware(request: Request) {
  // Full Node.js API access here
  return new Response("Hello from Node.js middleware");
}
```

---

## Headers Configuration

### Security Headers

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=63072000; includeSubDomains; preload"
        }
      ]
    }
  ]
}
```

### Cache Control for Static Assets

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "headers": [
    {
      "source": "/static/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/service-worker.js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=0, must-revalidate"
        }
      ]
    }
  ]
}
```

### Conditional Headers

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "headers": [
    {
      "source": "/:path*",
      "has": [
        {
          "type": "query",
          "key": "authorized"
        }
      ],
      "headers": [{ "key": "x-authorized", "value": "true" }]
    }
  ]
}
```

**Why good:** `has` condition only applies header when `?authorized` query param is present, avoiding unnecessary headers on all requests

---

## Redirects

### Basic Redirects

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "redirects": [
    {
      "source": "/me",
      "destination": "/profile",
      "permanent": false
    },
    {
      "source": "/blog/:slug",
      "destination": "/posts/:slug",
      "permanent": true
    },
    {
      "source": "/docs/(.*)",
      "destination": "https://docs.example.com/$1"
    }
  ]
}
```

**Key rules:**

- `permanent: true` = 308 status (browsers cache aggressively)
- `permanent: false` = 307 status (temporary, no browser caching)
- `statusCode` can override (301, 302, etc.) but cannot be combined with `permanent`

### Geo-Based Redirects

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "redirects": [
    {
      "source": "/:path((?!uk/).*)",
      "has": [
        {
          "type": "header",
          "key": "x-vercel-ip-country",
          "value": "GB"
        }
      ],
      "destination": "/uk/:path*",
      "permanent": false
    }
  ]
}
```

**Why good:** Regex negative lookahead prevents redirect loops (already on `/uk/`), uses Vercel's geo header for country detection, temporary redirect allows easy testing

**Gotcha:** `has`/`missing` conditions do not work locally with `vercel dev`, only in deployed environments.

---

## Rewrites

Rewrites map one path to another without changing the browser URL.

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    {
      "source": "/api/v1/:path*",
      "destination": "/api/:path*"
    },
    {
      "source": "/proxy/:path*",
      "destination": "https://api.external.com/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

**Use cases:**

- **API versioning**: Rewrite `/api/v1/users` to `/api/users` while keeping the v1 URL
- **External proxying**: Forward requests to an external API without exposing the URL to the client
- **SPA fallback**: Rewrite all paths to `index.html` for client-side routing

---

## has/missing Condition Reference

Both `has` and `missing` accept the same object structure:

```json
{
  "type": "header | cookie | query | host",
  "key": "the-key-name",
  "value": "optional-value-to-match"
}
```

### Examples

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "redirects": [
    {
      "source": "/feature/:path*",
      "has": [{ "type": "cookie", "key": "beta", "value": "true" }],
      "destination": "/beta/feature/:path*",
      "permanent": false
    },
    {
      "source": "/:path*",
      "missing": [{ "type": "header", "key": "x-api-key" }],
      "destination": "/unauthorized",
      "permanent": false
    }
  ]
}
```

**Why good:** Cookie-based routing enables A/B testing and beta feature rollout, missing header check enforces API key requirements at the CDN layer
