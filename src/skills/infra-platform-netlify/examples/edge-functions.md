# Netlify — Edge Functions & Blobs

> Edge function patterns (Deno runtime) and Netlify Blobs storage. See [SKILL.md](../SKILL.md) for decision guidance.

**Related examples:**

- [Core Setup & Functions](core.md) — netlify.toml, serverless functions, scheduled/background functions
- [Quick Reference](../reference.md) — CLI commands, limits, redirect syntax

---

## Edge Function — Geo-Personalization

```typescript
// netlify/edge-functions/geo-redirect.ts
import type { Config, Context } from "@netlify/edge-functions";

const COUNTRY_REDIRECTS: Record<string, string> = {
  DE: "/de",
  FR: "/fr",
  ES: "/es",
};

export default async (req: Request, context: Context) => {
  const countryCode = context.geo.country?.code;
  if (!countryCode) return; // No geo data — continue chain

  const redirectPath = COUNTRY_REDIRECTS[countryCode];
  if (redirectPath) {
    // Return URL for same-site rewrite (user sees original URL)
    return new URL(redirectPath, req.url);
  }

  // Return undefined to pass through to origin
};

export const config: Config = {
  path: "/",
  excludedPath: ["/de/*", "/fr/*", "/es/*"], // Don't redirect localized pages
};
```

**Why good:** Named constant for redirect map, `excludedPath` prevents redirect loops, returns `URL` for rewrite (not redirect — URL stays the same), returns `undefined` to pass through

---

## Edge Function — Middleware (Modify Response)

```typescript
// netlify/edge-functions/add-headers.ts
import type { Config, Context } from "@netlify/edge-functions";

export default async (req: Request, context: Context) => {
  // Call next() to get the response from downstream (origin or next edge function)
  const response = await context.next();

  // Add custom headers to the response
  response.headers.set("X-Request-Id", context.requestId);
  response.headers.set("X-Server-Region", context.server.region);
  response.headers.set("X-Geo-Country", context.geo.country?.code ?? "unknown");

  return response;
};

export const config: Config = {
  path: "/*",
  excludedPath: ["/assets/*", "*.css", "*.js", "*.png", "*.jpg", "*.svg"],
};
```

**Why good:** Uses `context.next()` to act as middleware, excludes static assets with `excludedPath` to avoid unnecessary edge function invocations

---

## Edge Function — A/B Testing with Cookies

```typescript
// netlify/edge-functions/ab-test.ts
import type { Config, Context } from "@netlify/edge-functions";

const VARIANT_COOKIE = "ab-variant";
const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

export default async (req: Request, context: Context) => {
  // Check for existing variant assignment
  let variant = context.cookies.get(VARIANT_COOKIE);

  if (!variant) {
    // Assign a variant randomly
    variant = Math.random() < 0.5 ? "control" : "experiment";
    context.cookies.set({
      name: VARIANT_COOKIE,
      value: variant,
      path: "/",
      maxAge: COOKIE_MAX_AGE_SECONDS,
    });
  }

  if (variant === "experiment") {
    return new URL("/landing-v2", req.url);
  }

  // Control group — continue to original page
};

export const config: Config = {
  path: "/landing",
};
```

---

## Edge Function — Authentication Guard

```typescript
// netlify/edge-functions/auth-guard.ts
import type { Config, Context } from "@netlify/edge-functions";

const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password"];

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);

  // Skip auth for public paths
  if (PUBLIC_PATHS.some((path) => url.pathname.startsWith(path))) {
    return;
  }

  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Validate token (example — replace with your auth provider)
  const apiUrl = Netlify.env.get("AUTH_API_URL");
  const res = await fetch(`${apiUrl}/validate`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    return new Response("Forbidden", { status: 403 });
  }

  // Token valid — continue to origin
  return context.next();
};

export const config: Config = {
  path: "/dashboard/*",
};
```

---

## Edge Function — Response Transformation

```typescript
// netlify/edge-functions/inject-banner.ts
import type { Config, Context } from "@netlify/edge-functions";

export default async (req: Request, context: Context) => {
  const response = await context.next();

  // Only transform HTML responses
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    return response;
  }

  const html = await response.text();
  const banner = `<div style="background:yellow;padding:8px;text-align:center">
    Deploy Preview — ${context.deploy.context}
  </div>`;

  const transformed = html.replace("<body>", `<body>${banner}`);

  return new Response(transformed, {
    status: response.status,
    headers: response.headers,
  });
};

export const config: Config = {
  path: "/*",
  excludedPath: ["/api/*", "*.css", "*.js", "*.png", "*.jpg"],
};
```

---

## Edge Function — Caching

Edge function responses can be cached at the CDN level, reducing invocations and improving performance.

```typescript
// netlify/edge-functions/cached-data.ts
import type { Config, Context } from "@netlify/edge-functions";

const CACHE_MAX_AGE_SECONDS = 300; // 5 minutes

export default async (req: Request, context: Context) => {
  // Use conditional request to check if CDN has a cached version
  const response = await context.next({ sendConditionalRequest: true });

  if (response.status === 304) {
    return response; // Cached version is still valid
  }

  // Set cache headers for CDN caching
  response.headers.set(
    "Cache-Control",
    `public, max-age=${CACHE_MAX_AGE_SECONDS}`,
  );
  response.headers.set(
    "Netlify-CDN-Cache-Control",
    `max-age=${CACHE_MAX_AGE_SECONDS}`,
  );

  return response;
};

export const config: Config = {
  path: "/api/public-data",
  cache: "manual", // Required to enable CDN caching for edge functions
};
```

**Key rule:** Set `cache: "manual"` in the config to enable CDN caching. Cached responses do not count toward edge function invocation limits.

---

## Netlify Blobs — Key-Value Storage

```typescript
// netlify/functions/preferences.mts
import { getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  const store = getStore("user-preferences");
  const { userId } = context.params;

  switch (req.method) {
    case "GET": {
      const prefs = await store.get(userId, { type: "json" });
      if (!prefs) return new Response("Not found", { status: 404 });
      return Response.json(prefs);
    }

    case "PUT": {
      const data = await req.json();
      await store.setJSON(userId, data, {
        metadata: { updatedAt: new Date().toISOString() },
      });
      return new Response("Saved", { status: 200 });
    }

    case "DELETE": {
      await store.delete(userId);
      return new Response(null, { status: 204 });
    }

    default:
      return new Response("Method not allowed", { status: 405 });
  }
};

export const config: Config = {
  path: "/api/preferences/:userId",
  method: ["GET", "PUT", "DELETE"],
};
```

---

## Netlify Blobs — With Metadata and Listing

```typescript
// netlify/functions/uploads.mts
import { getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export default async (req: Request, context: Context) => {
  const store = getStore("file-uploads");

  if (req.method === "POST") {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file || file.size > MAX_FILE_SIZE_BYTES) {
      return Response.json(
        { error: "Invalid or oversized file" },
        { status: 400 },
      );
    }

    const key = `${context.geo.country?.code ?? "unknown"}/${crypto.randomUUID()}`;
    await store.set(key, file, {
      metadata: {
        originalName: file.name,
        contentType: file.type,
        uploadedBy: context.ip,
        uploadedAt: new Date().toISOString(),
      },
    });

    return Response.json({ key });
  }

  if (req.method === "GET") {
    // List with directory browsing
    const prefix = new URL(req.url).searchParams.get("prefix") ?? "";
    const { blobs, directories } = await store.list({
      prefix,
      directories: true,
    });

    return Response.json({
      files: blobs.map((b) => b.key),
      directories,
    });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/uploads",
  method: ["GET", "POST"],
};
```

---

## Netlify Blobs — Strong Consistency

```typescript
import { getStore } from "@netlify/blobs";
import type { Context } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  // Option 1: Strong consistency for entire store
  const store = getStore({ name: "counters", consistency: "strong" });

  // Option 2: Strong consistency for individual reads
  const eventualStore = getStore("counters");
  const value = await eventualStore.get("page-views", {
    type: "json",
    consistency: "strong", // Override for this read only
  });

  // Conditional writes with ETags (optimistic concurrency)
  const result = await store.getWithMetadata("page-views", { type: "json" });
  if (result) {
    const { data, etag } = result;
    const newCount = (data as { count: number }).count + 1;
    await store.setJSON(
      "page-views",
      { count: newCount },
      {
        onlyIfMatch: etag, // Fails if another write happened since our read
      },
    );
  }

  return new Response("OK");
};
```

---

## Netlify Blobs — In Edge Functions

Blobs are also accessible from edge functions using the same API.

```typescript
// netlify/edge-functions/cached-config.ts
import { getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/edge-functions";

export default async (req: Request, context: Context) => {
  const store = getStore("site-config");
  const config = await store.get("feature-flags", { type: "json" });

  if (!config) {
    return context.next();
  }

  // Inject feature flags as a header for downstream consumption
  const response = await context.next();
  response.headers.set("X-Feature-Flags", JSON.stringify(config));
  return response;
};

export const config: Config = {
  path: "/*",
  excludedPath: ["*.css", "*.js", "*.png", "*.jpg", "*.svg"],
};
```
