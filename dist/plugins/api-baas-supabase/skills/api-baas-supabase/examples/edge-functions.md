# Supabase Edge Functions Examples

> Deno edge functions, `Deno.serve()`, CORS handling, secrets, and Supabase client usage. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 1: Basic Edge Function

### Good Example — Hello World with CORS

```typescript
// supabase/functions/hello-world/index.ts

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { name } = await req.json();

    return new Response(JSON.stringify({ message: `Hello ${name}!` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
```

**Why good:** `Deno.serve` (not deprecated `serve` import), CORS headers on every response (including errors), OPTIONS preflight handled, JSON parsing with try/catch, proper Content-Type header

### Bad Example — Deprecated serve Import

```typescript
// BAD: Deprecated import
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  // ...
});
```

**Why bad:** `serve` from deno.land/std is deprecated, `Deno.serve` is the built-in replacement, pinned deno.land URLs break when versions are removed

---

## Pattern 2: Edge Function with Supabase Client

### Good Example — Authenticated Database Access

```typescript
// supabase/functions/get-user-posts/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create client with user's JWT — RLS enforced
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // This query is filtered by RLS using the user's JWT
    const { data, error } = await supabase
      .from("posts")
      .select("id, title, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ posts: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
```

**Why good:** `npm:` prefix for Deno package resolution, user JWT forwarded for RLS, `Deno.env.get()` for secrets (auto-injected by Supabase), error from Supabase re-thrown into catch block

### Good Example — Admin Access (Bypasses RLS)

```typescript
// supabase/functions/admin-cleanup/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  // Verify this is an internal/admin call
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${Deno.env.get("ADMIN_SECRET")}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Admin client — bypasses all RLS
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const STALE_DAYS = 30;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - STALE_DAYS);

  const { error } = await supabaseAdmin
    .from("temp_files")
    .delete()
    .lt("created_at", cutoffDate.toISOString());

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }

  return new Response(JSON.stringify({ success: true }));
});
```

**Why good:** Custom auth check for admin endpoints, `service_role` key for RLS bypass, named constant for stale threshold, used only in server-to-server calls

---

## Pattern 3: Shared Utilities

### Good Example — Reusable CORS and Client Setup

```typescript
// supabase/functions/_shared/cors.ts
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export function corsResponse() {
  return new Response("ok", { headers: corsHeaders });
}

export function jsonResponse(
  data: unknown,
  status = 200
): Response {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

export function errorResponse(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}
```

```typescript
// supabase/functions/_shared/supabase.ts
import { createClient } from "npm:@supabase/supabase-js@2";

export function createUserClient(req: Request) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: {
        headers: { Authorization: req.headers.get("Authorization")! },
      },
    }
  );
}

export function createAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}
```

```typescript
// supabase/functions/my-function/index.ts
import { corsResponse, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { createUserClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsResponse();
  }

  try {
    const supabase = createUserClient(req);
    const { data, error } = await supabase.from("posts").select("id, title");

    if (error) throw error;

    return jsonResponse({ posts: data });
  } catch (err) {
    return errorResponse(err.message);
  }
});
```

**Why good:** `_shared/` folder for reusable code, relative imports (`../`), separate user vs admin client factories, consistent response helpers, DRY CORS handling

---

## Pattern 4: Webhook Handler

### Good Example — Stripe Webhook

```typescript
// supabase/functions/stripe-webhook/index.ts
import Stripe from "npm:stripe@14";
import { createAdminClient } from "../_shared/supabase.ts";
import { jsonResponse, errorResponse } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-04-10",
});

const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return errorResponse("Missing stripe-signature header", 400);
  }

  try {
    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
    const supabase = createAdminClient();

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const { error } = await supabase
          .from("orders")
          .update({ status: "paid", stripe_session_id: session.id })
          .eq("id", session.metadata?.order_id);

        if (error) throw error;
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const { error } = await supabase
          .from("subscriptions")
          .update({ status: "cancelled" })
          .eq("stripe_subscription_id", subscription.id);

        if (error) throw error;
        break;
      }
    }

    return jsonResponse({ received: true });
  } catch (err) {
    return errorResponse(err.message, 400);
  }
});
```

**Why good:** Webhook signature verification for security, `npm:` prefix with pinned version, admin client for webhook (no user JWT), switch on event type, named constant for webhook secret

---

## Pattern 5: Multi-Route Edge Function

### Good Example — Fat Function with Hono

```typescript
// supabase/functions/api/index.ts
import { Hono } from "npm:hono@4";
import { createUserClient } from "../_shared/supabase.ts";
import { corsHeaders } from "../_shared/cors.ts";

const app = new Hono();

// CORS middleware
app.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  await next();
  // Add CORS headers to all responses
  Object.entries(corsHeaders).forEach(([key, value]) => {
    c.res.headers.set(key, value);
  });
});

app.get("/api/posts", async (c) => {
  const supabase = createUserClient(c.req.raw);
  const { data, error } = await supabase
    .from("posts")
    .select("id, title")
    .eq("published", true);

  if (error) return c.json({ error: error.message }, 400);
  return c.json({ posts: data });
});

app.post("/api/posts", async (c) => {
  const supabase = createUserClient(c.req.raw);
  const body = await c.req.json();

  const { data, error } = await supabase
    .from("posts")
    .insert(body)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 400);
  return c.json({ post: data }, 201);
});

Deno.serve(app.fetch);
```

**Why good:** Single "fat function" reduces cold starts, Hono for clean routing, CORS middleware applies to all routes, per-request user client for RLS, `npm:` prefix with pinned version

**When to use:** Multiple related endpoints that share logic. "Fat functions" with fewer, larger functions minimize cold starts compared to many small functions.

---

## Pattern 6: Background Processing

### Good Example — Fire and Forget with waitUntil

```typescript
// supabase/functions/process-upload/index.ts
import { createAdminClient } from "../_shared/supabase.ts";
import { jsonResponse, corsResponse, errorResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsResponse();
  }

  try {
    const { fileId } = await req.json();

    // Start background processing — does NOT block the response
    EdgeRuntime.waitUntil(processFileInBackground(fileId));

    // Return immediately
    return jsonResponse({ status: "processing", fileId });
  } catch (err) {
    return errorResponse(err.message);
  }
});

async function processFileInBackground(fileId: string) {
  const supabase = createAdminClient();

  // Update status
  await supabase
    .from("files")
    .update({ status: "processing" })
    .eq("id", fileId);

  // Do heavy work (image resize, PDF generation, etc.)
  // ...

  // Update status when done
  await supabase
    .from("files")
    .update({ status: "completed" })
    .eq("id", fileId);
}
```

**Why good:** `EdgeRuntime.waitUntil()` runs work after response is sent, immediate response to client, status tracking in database, heavy work doesn't block the HTTP response

**When to use:** Image processing, PDF generation, sending emails, any work that takes longer than the user should wait for. The client gets an immediate response and can poll for status.

---

## Pattern 7: Accessing Secrets

### Good Example — Environment Variables

```typescript
// Secrets set via CLI: npx supabase secrets set MY_API_KEY=abc123

Deno.serve(async (req) => {
  // Auto-injected by Supabase
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Custom secrets
  const apiKey = Deno.env.get("MY_API_KEY")!;
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET")!;

  // Use secrets...
  return new Response("ok");
});
```

**Why good:** `Deno.env.get()` for all secrets, Supabase auto-injects project URL and keys, custom secrets set via CLI, never hardcode secrets

### Bad Example — Hardcoded Secrets

```typescript
// BAD: Hardcoded secrets
const API_KEY = "sk_live_abc123"; // Exposed in source code!
const SUPABASE_URL = "https://abc.supabase.co"; // Should be env var
```

**Why bad:** Secrets in source code are exposed in version control, cannot rotate without redeploying, environment variables are the correct approach

---

_For auth patterns, see [auth.md](auth.md). For database queries, see [database.md](database.md). For storage patterns, see [storage.md](storage.md)._
