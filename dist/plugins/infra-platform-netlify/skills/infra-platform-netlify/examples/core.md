# Netlify — Core Setup & Serverless Functions

> Core configuration and serverless function patterns for Netlify projects. See [SKILL.md](../SKILL.md) for decision guidance.

**Related examples:**

- [Edge Functions & Blobs](edge-functions.md) — Edge function patterns and Netlify Blobs storage
- [Quick Reference](../reference.md) — CLI commands, limits, redirect syntax

---

## netlify.toml — Full Configuration

```toml
# netlify.toml — the single source of truth for Netlify configuration
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"

# Function bundler — esbuild is faster than the default zisi
[functions]
  node_bundler = "esbuild"

# Deploy context overrides — build settings cascade
[context.production.environment]
  API_URL = "https://api.example.com"

[context.deploy-preview.environment]
  API_URL = "https://staging-api.example.com"

[context.branch-deploy]
  command = "npm run build:staging"

# Specific branch override (highest priority)
[context.staging]
  command = "npm run build:staging"
  [context.staging.environment]
    API_URL = "https://staging-api.example.com"

# Redirects — GLOBAL, not scoped to contexts. First match wins.

# SPA fallback — serves index.html for all unmatched routes
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

# API proxy — avoids CORS by proxying through Netlify's CDN
[[redirects]]
  from = "/api/*"
  to = "https://api.example.com/:splat"
  status = 200
  force = true

  [redirects.headers]
    X-Custom-Header = "netlify-proxy"

# Permanent redirect for moved pages
[[redirects]]
  from = "/old-blog/*"
  to = "/blog/:splat"
  status = 301

# Country-based redirect
[[redirects]]
  from = "/*"
  to = "/de/:splat"
  status = 302
  conditions = { Country = ["DE"] }

# Custom headers — also GLOBAL
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

# Build plugins
[[plugins]]
  package = "@netlify/plugin-lighthouse"

  [plugins.inputs]
    output_path = "reports/lighthouse.html"

# Scheduled function config (alternative to inline config export)
[functions."daily-cleanup"]
  schedule = "@daily"
```

---

## Serverless Function — Basic API Endpoint

```typescript
// netlify/functions/users.mts
import type { Config, Context } from "@netlify/functions";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export default async (req: Request, context: Context) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(req.url);
  const limit = Math.min(
    Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT),
    MAX_LIMIT,
  );

  const apiKey = Netlify.env.get("API_KEY");
  if (!apiKey) {
    return Response.json({ error: "Server misconfigured" }, { status: 500 });
  }

  try {
    const response = await fetch(
      `https://api.example.com/users?limit=${limit}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      },
    );
    const data = await response.json();
    return Response.json(data);
  } catch {
    return Response.json({ error: "Upstream request failed" }, { status: 502 });
  }
};

export const config: Config = {
  path: "/api/users",
};
```

**Why good:** Uses `Netlify.env.get()` (not `process.env`), named constants for limits, proper error handling, `Config` export for custom route path

---

## Serverless Function — Route Params and POST

```typescript
// netlify/functions/items.mts
import type { Config, Context } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  const { id } = context.params;

  switch (req.method) {
    case "GET": {
      const item = await fetchItem(id);
      if (!item) return new Response("Not found", { status: 404 });
      return Response.json(item);
    }

    case "PUT": {
      const body = await req.json();
      const updated = await updateItem(id, body);
      return Response.json(updated);
    }

    case "DELETE": {
      await deleteItem(id);
      return new Response(null, { status: 204 });
    }

    default:
      return new Response("Method not allowed", { status: 405 });
  }
};

export const config: Config = {
  path: "/api/items/:id",
  method: ["GET", "PUT", "DELETE"],
};
```

**Why good:** Route params via `context.params`, method-specific handling, `config.method` restricts allowed methods

---

## Serverless Function — Using Context

```typescript
// netlify/functions/context-example.mts
import type { Config, Context } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  // Geo data
  const { city, country, timezone } = context.geo;

  // Cookies
  const theme = context.cookies.get("theme") ?? "light";

  // Site and deploy metadata
  const { name: siteName, url: siteUrl } = context.site;
  const { context: deployContext } = context.deploy; // "production" | "deploy-preview" | "branch-deploy"

  // Request metadata
  const clientIp = context.ip;
  const requestId = context.requestId;
  const region = context.server.region;

  // Background work — runs after response is sent
  context.waitUntil(logAnalytics({ city, country: country.code, requestId }));

  return Response.json({
    greeting: `Hello from ${city}, ${country.name}!`,
    theme,
    deployContext,
    region,
  });
};

export const config: Config = {
  path: "/api/context",
};
```

---

## Scheduled Function

```typescript
// netlify/functions/daily-report.mts
import type { Config } from "@netlify/functions";

export default async (req: Request) => {
  const { next_run } = await req.json();
  console.log("Generating daily report. Next run:", next_run);

  const apiKey = Netlify.env.get("REPORT_API_KEY");
  await fetch("https://api.example.com/reports/generate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ date: new Date().toISOString() }),
  });

  console.log("Daily report generated successfully");
};

export const config: Config = {
  schedule: "@daily", // Also accepts cron: "0 9 * * 1-5" (weekdays at 9am UTC)
};
```

**Cron expression format** (UTC timezone):

| Expression     | Schedule                       |
| -------------- | ------------------------------ |
| `@hourly`      | Every hour at minute 0         |
| `@daily`       | Every day at midnight          |
| `@weekly`      | Every Sunday at midnight       |
| `@monthly`     | First day of month at midnight |
| `0 9 * * 1-5`  | Weekdays at 9:00 AM UTC        |
| `*/15 * * * *` | Every 15 minutes               |

**Limitations:** 60-second execution limit. Cannot be invoked via URL. Only runs on published deploys.

---

## Background Function

```typescript
// netlify/functions/process-upload-background.mts
// NOTE: The "-background" suffix in the filename makes this a background function.
// The client receives a 202 immediately. Return value is ignored.
import type { Context } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  const data = await req.json();
  console.log(`Processing upload for user: ${data.userId}`);

  // This can run for up to 15 minutes
  for (const file of data.files) {
    await processFile(file);
    console.log(`Processed: ${file.name}`);
  }

  console.log("All files processed");
  // Return value is ignored — client already received 202
};
```

**Key rules:**

- File must have `-background` suffix (e.g., `process-upload-background.mts`)
- Client receives `202 Accepted` immediately
- Maximum execution time: 15 minutes
- Maximum payload: 256 KB (vs 6 MB for sync functions)

---

## Response Streaming

```typescript
// netlify/functions/stream.mts
import type { Config } from "@netlify/functions";

const STREAM_INTERVAL_MS = 1_000;
const STREAM_ITEM_COUNT = 5;

export default async () => {
  const encoder = new TextEncoder();

  const body = new ReadableStream({
    start(controller) {
      let count = 0;
      const timer = setInterval(() => {
        controller.enqueue(
          encoder.encode(
            `data: Event ${count + 1} at ${new Date().toISOString()}\n\n`,
          ),
        );
        count++;
        if (count >= STREAM_ITEM_COUNT) {
          controller.close();
          clearInterval(timer);
        }
      }, STREAM_INTERVAL_MS);
    },
  });

  return new Response(body, {
    headers: { "content-type": "text/event-stream" },
  });
};

export const config: Config = {
  path: "/api/stream",
};
```

**Streaming limits:** 60-second execution time, 20 MB response size (vs 6 MB for buffered responses).

---

## Netlify Forms (Static HTML)

Netlify detects forms with the `data-netlify="true"` attribute during build and sets up form handling automatically. No serverless function needed.

```html
<!-- Basic form with honeypot spam filter -->
<form
  name="contact"
  method="POST"
  data-netlify="true"
  netlify-honeypot="bot-field"
>
  <!-- Hidden honeypot field — bots fill it, humans don't see it -->
  <p class="hidden">
    <label>Don't fill this out: <input name="bot-field" /></label>
  </p>

  <p>
    <label>Name: <input type="text" name="name" required /></label>
  </p>
  <p>
    <label>Email: <input type="email" name="email" required /></label>
  </p>
  <p>
    <label>Message: <textarea name="message" required></textarea></label>
  </p>
  <p>
    <button type="submit">Send</button>
  </p>
</form>
```

**Spam filtering layers:**

1. **Akismet** — built-in, filters all submissions automatically
2. **Honeypot field** — `netlify-honeypot="bot-field"` attribute + hidden input
3. **reCAPTCHA 2** — add `data-netlify-recaptcha="true"` to form + empty `<div data-netlify-recaptcha="true"></div>`

**Submissions** are viewable in the Netlify UI under the site's Forms tab. You can configure email/Slack/webhook notifications for new submissions.
