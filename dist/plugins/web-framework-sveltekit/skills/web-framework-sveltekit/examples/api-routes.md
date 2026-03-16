# SvelteKit API Routes Examples

> Complete code examples for SvelteKit API route patterns (+server.ts). See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 1: RESTful API Routes

### Good Example — CRUD Endpoints

```typescript
// src/routes/api/posts/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

// GET /api/posts?page=1&limit=20
export const GET: RequestHandler = async ({ url, locals }) => {
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(url.searchParams.get('limit') ?? String(DEFAULT_PAGE_SIZE)))
  );
  const offset = (page - 1) * limit;

  const [posts, total] = await Promise.all([
    db.post.findMany({
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
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
    error(401, 'Authentication required');
  }

  const body = await request.json();

  // Validate body
  if (!body.title || !body.content) {
    error(400, 'Title and content are required');
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
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET /api/posts/:id
export const GET: RequestHandler = async ({ params }) => {
  const post = await db.post.findUnique({
    where: { id: params.id },
    include: { author: { select: { name: true } } },
  });

  if (!post) {
    error(404, 'Post not found');
  }

  return json(post);
};

// PATCH /api/posts/:id
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) {
    error(401, 'Authentication required');
  }

  const post = await db.post.findUnique({ where: { id: params.id } });

  if (!post) {
    error(404, 'Post not found');
  }

  if (post.authorId !== locals.user.id) {
    error(403, 'Not authorized');
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
    error(401, 'Authentication required');
  }

  const post = await db.post.findUnique({ where: { id: params.id } });

  if (!post) {
    error(404, 'Post not found');
  }

  if (post.authorId !== locals.user.id) {
    error(403, 'Not authorized');
  }

  await db.post.delete({ where: { id: params.id } });

  return new Response(null, { status: 204 });
};
```

**Why good:** Named constants for pagination limits, auth checks on mutations, ownership checks, proper HTTP status codes (201 Created, 204 No Content), parallel queries with Promise.all

---

## Pattern 2: Streaming Response

### Good Example — Server-Sent Events (SSE)

```typescript
// src/routes/api/events/+server.ts
import type { RequestHandler } from './$types';

const HEARTBEAT_INTERVAL_MS = 30_000;

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial connection event
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`)
      );

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(': heartbeat\n\n'));
      }, HEARTBEAT_INTERVAL_MS);

      // Subscribe to events (pseudo-code — use your pub/sub solution)
      const unsubscribe = eventBus.subscribe(locals.user.id, (event) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
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
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
};
```

**Why good:** SSE format (`data: ...\n\n`), heartbeat prevents timeout, cleanup on disconnect, auth check, proper headers

---

## Pattern 3: File Upload

### Good Example — File Upload Endpoint

```typescript
// src/routes/api/upload/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    error(401, 'Authentication required');
  }

  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    error(400, 'No file provided');
  }

  if (file.size > MAX_FILE_SIZE) {
    error(400, `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  if (!ALLOWED_TYPES.includes(file.type as typeof ALLOWED_TYPES[number])) {
    error(400, `Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}`);
  }

  // Upload to storage (defer to your storage solution)
  const buffer = Buffer.from(await file.arrayBuffer());
  const url = await uploadToStorage(buffer, file.name, file.type);

  return json({ url }, { status: 201 });
};
```

**Why good:** Named constants for limits, type validation, size validation, auth check, proper status code

---

## Pattern 4: Response Helpers

### Good Example — Different Response Types

```typescript
// src/routes/api/health/+server.ts
import { json, text } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// JSON response
export const GET: RequestHandler = async () => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  };

  return json(health);
};
```

```typescript
// src/routes/api/export/+server.ts
import type { RequestHandler } from './$types';

// CSV response
export const GET: RequestHandler = async ({ locals }) => {
  const data = await db.export.getData(locals.user.id);

  const csv = data
    .map(row => `${row.name},${row.email},${row.createdAt}`)
    .join('\n');

  return new Response(`name,email,created_at\n${csv}`, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="export.csv"',
    },
  });
};
```

```typescript
// src/routes/api/redirect/+server.ts
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Redirect response
export const GET: RequestHandler = async ({ url }) => {
  const target = url.searchParams.get('url');

  if (!target) {
    return new Response('Missing url parameter', { status: 400 });
  }

  redirect(307, target);
};
```

**Why good:** `json()` helper for JSON responses, custom `Response` for other formats, `redirect()` for redirects, proper headers for file downloads

---

## Pattern 5: Fallback Handler

### Good Example — Handling Unsupported Methods

```typescript
// src/routes/api/posts/+server.ts
import { json, text } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

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

**Why good:** `fallback` catches unhandled methods, returns proper 405 status, descriptive error message

---

## Pattern 6: Content Negotiation

### Good Example — Page + API on Same Route

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
import type { PageServerLoad, Actions } from './$types';

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
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const posts = await db.post.findMany();
  return json(posts);
};
```

**Why good:** Same route serves both HTML pages and JSON API, SvelteKit routes based on Accept header and request type, forms go to actions, API calls go to server routes

---

_For load function patterns, see [load-functions.md](load-functions.md). For form actions, see [form-actions.md](form-actions.md). For hooks, see [hooks.md](hooks.md)._
