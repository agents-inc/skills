# SvelteKit — API Routes

> `+server.ts`: one export per HTTP verb, plus streaming, uploads and content negotiation. The
> endpoint checklist is in [reference.md](../reference.md).

---

## Pattern 1: RESTful Endpoints

### Good Example — CRUD across two files

```typescript
// src/routes/api/posts/+server.ts
import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

// GET /api/posts?page=1&limit=20
export const GET: RequestHandler = async ({ url, locals }) => {
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(
      1,
      Number(url.searchParams.get("limit") ?? String(DEFAULT_PAGE_SIZE)),
    ),
  );
  const offset = (page - 1) * limit;

  const [posts, total] = await Promise.all([
    db.post.findMany({
      take: limit,
      skip: offset,
      orderBy: { createdAt: "desc" },
    }),
    db.post.count(),
  ]);

  return json({
    data: posts,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
};

// POST /api/posts
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    error(401, "Authentication required");
  }

  const body = await request.json();

  // Validate body
  if (!body.title || !body.content) {
    error(400, "Title and content are required");
  }

  const post = await db.post.create({
    data: {
      title: body.title,
      content: body.content,
      authorId: locals.user.id,
    },
  });

  return json(post, { status: 201 });
};
```

```typescript
// src/routes/api/posts/[id]/+server.ts
import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

// GET /api/posts/:id
export const GET: RequestHandler = async ({ params }) => {
  const post = await db.post.findUnique({
    where: { id: params.id },
    include: { author: { select: { name: true } } },
  });

  if (!post) {
    error(404, "Post not found");
  }

  return json(post);
};

// PATCH /api/posts/:id
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) {
    error(401, "Authentication required");
  }

  const post = await db.post.findUnique({ where: { id: params.id } });

  if (!post) {
    error(404, "Post not found");
  }

  if (post.authorId !== locals.user.id) {
    error(403, "Not authorized");
  }

  const body = await request.json();
  const updated = await db.post.update({
    where: { id: params.id },
    data: body,
  });

  return json(updated);
};

// DELETE /api/posts/:id
export const DELETE: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) {
    error(401, "Authentication required");
  }

  const post = await db.post.findUnique({ where: { id: params.id } });

  if (!post) {
    error(404, "Post not found");
  }

  if (post.authorId !== locals.user.id) {
    error(403, "Not authorized");
  }

  await db.post.delete({ where: { id: params.id } });

  return new Response(null, { status: 204 });
};
```

**Why good:** `limit` is clamped between 1 and 100, so no caller can request the whole table. Each
mutation re-reads the row and checks ownership rather than trusting the id in the URL. The status
codes carry information a client can act on: 201 with the created body, 204 with none.

---

## Pattern 2: Streaming Response

### Good Example — server-sent events

```typescript
// src/routes/api/events/+server.ts
import type { RequestHandler } from "./$types";

const HEARTBEAT_INTERVAL_MS = 30_000;

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial connection event
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected" })}\n\n`),
      );

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, HEARTBEAT_INTERVAL_MS);

      // Subscribe to events (pseudo-code — use your pub/sub solution)
      const unsubscribe = eventBus.subscribe(locals.user.id, (event) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      });

      // Cleanup on disconnect
      return () => {
        clearInterval(heartbeat);
        unsubscribe();
      };
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
};
```

**Why good:** The double newline is the SSE record separator, so omitting it means nothing is ever
delivered. The heartbeat exists because proxies close idle connections, and the cleanup returned from
`start` is what stops the interval and the subscription outliving the client.

---

## Pattern 3: File Upload

### Good Example — validating before storing

```typescript
// src/routes/api/upload/+server.ts
import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    error(401, "Authentication required");
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    error(400, "No file provided");
  }

  if (file.size > MAX_FILE_SIZE) {
    error(
      400,
      `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    );
  }

  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    error(400, `Invalid file type. Allowed: ${ALLOWED_TYPES.join(", ")}`);
  }

  // Upload to storage (defer to your storage solution)
  const buffer = Buffer.from(await file.arrayBuffer());
  const url = await uploadToStorage(buffer, file.name, file.type);

  return json({ url }, { status: 201 });
};
```

**Why good:** `file instanceof File` is the narrowing that makes `.size` and `.type` safe to read —
`formData.get` returns `FormDataEntryValue`, which may be a string. Both limits are checked before a
byte is written anywhere.

---

## Pattern 4: Response Types

### Good Example — JSON, CSV and a redirect

```typescript
// src/routes/api/health/+server.ts
import { json, text } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

// JSON response
export const GET: RequestHandler = async () => {
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  };

  return json(health);
};
```

```typescript
// src/routes/api/export/+server.ts
import type { RequestHandler } from "./$types";

// CSV response
export const GET: RequestHandler = async ({ locals }) => {
  const data = await db.export.getData(locals.user.id);

  const csv = data
    .map((row) => `${row.name},${row.email},${row.createdAt}`)
    .join("\n");

  return new Response(`name,email,created_at\n${csv}`, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="export.csv"',
    },
  });
};
```

```typescript
// src/routes/api/redirect/+server.ts
import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

// Redirect response
export const GET: RequestHandler = async ({ url }) => {
  const target = url.searchParams.get("url");

  if (!target) {
    return new Response("Missing url parameter", { status: 400 });
  }

  redirect(307, target);
};
```

**Why good:** `json()` handles the common case and a raw `Response` handles everything else — the CSV
needs `Content-Disposition` to download rather than render. `redirect()` throws, so nothing after it
runs, which is why the missing-parameter branch returns first.

---

## Pattern 5: Fallback Handler

### Good Example — a 405 for everything else

```typescript
// src/routes/api/posts/+server.ts
import { json, text } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async () => {
  // ...
  return json({ posts: [] });
};

export const POST: RequestHandler = async () => {
  // ...
  return json({ created: true }, { status: 201 });
};

// Handle any other HTTP method
export const fallback: RequestHandler = async ({ request }) => {
  return text(`Method ${request.method} not allowed`, { status: 405 });
};
```

**Why good:** Without `fallback` an unhandled verb produces SvelteKit's own 405; with it the response
names the method, which is what a client debugging its own request needs to see.

---

## Pattern 6: Content Negotiation

### Good Example — a page and an API at the same URL

```
src/routes/posts/
├── +page.svelte           # Renders HTML page
├── +page.server.ts        # Load function + form actions (handles page requests)
└── +server.ts             # API route (handles API requests)
```

```typescript
// src/routes/posts/+page.server.ts
// Handles: GET requests with Accept: text/html → page rendering
// Handles: POST requests from forms → form actions
import type { PageServerLoad, Actions } from "./$types";

export const load: PageServerLoad = async () => {
  const posts = await db.post.findMany();
  return { posts };
};

export const actions: Actions = {
  create: async ({ request }) => {
    // Form action for page form submissions
  },
};
```

```typescript
// src/routes/posts/+server.ts
// Handles: GET requests with Accept: application/json → JSON API
// Handles: POST requests without form action → API endpoint
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async () => {
  const posts = await db.post.findMany();
  return json(posts);
};
```

**Why good:** `/posts` serves HTML to a browser and JSON to a client that asks for it, from one URL —
SvelteKit picks by the `Accept` header. Form posts still reach the actions, so adding the API does not
disturb the page.

---

_Loads are in [load-functions.md](load-functions.md), mutations in
[form-actions.md](form-actions.md), request-wide concerns in [hooks.md](hooks.md)._
