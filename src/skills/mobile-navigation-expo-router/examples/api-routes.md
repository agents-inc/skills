# API Routes

> Server-side endpoints with +api.ts files. See [SKILL.md](../SKILL.md) for decisions, [core.md](core.md) for navigation basics.

---

## Setup

API routes require server output mode in app.json:

```json
{
  "expo": {
    "web": {
      "output": "server"
    },
    "plugins": [
      [
        "expo-router",
        {
          "origin": "https://api.example.com/"
        }
      ]
    ]
  }
}
```

The `origin` property tells native apps where to send API requests. Without it, native API calls have no server to target.

---

## Basic CRUD Routes

```typescript
// app/api/users+api.ts
export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = url.searchParams.get("page") ?? "1";
  const limit = url.searchParams.get("limit") ?? "20";

  const users = await db.users.findMany({
    skip: (Number(page) - 1) * Number(limit),
    take: Number(limit),
  });

  return Response.json(users);
}

export async function POST(request: Request) {
  const body = await request.json();

  const user = await db.users.create({
    data: body,
  });

  return Response.json(user, { status: 201 });
}
```

```typescript
// app/api/users/[id]+api.ts -- Dynamic API route
export async function GET(request: Request, { id }: { id: string }) {
  const user = await db.users.findUnique({ where: { id } });

  if (!user) {
    return new Response("User not found", { status: 404 });
  }

  return Response.json(user);
}

export async function PUT(request: Request, { id }: { id: string }) {
  const body = await request.json();
  const user = await db.users.update({
    where: { id },
    data: body,
  });

  return Response.json(user);
}

export async function DELETE(_request: Request, { id }: { id: string }) {
  await db.users.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
```

---

## Error Handling with StatusError

```typescript
// app/api/posts+api.ts
import { StatusError } from "expo-server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const postId = url.searchParams.get("id");

  if (!postId) {
    throw new StatusError(400, "Missing required parameter: id");
  }

  const post = await db.posts.findUnique({ where: { id: postId } });

  if (!post) {
    throw new StatusError(404, "Post not found");
  }

  return Response.json(post);
}
```

---

## Secure API Route (Token Validation)

```typescript
// app/api/protected+api.ts

const BEARER_PREFIX = "Bearer ";

function getAuthToken(request: Request): string | null {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith(BEARER_PREFIX)) return null;
  return auth.slice(BEARER_PREFIX.length);
}

export async function GET(request: Request) {
  const token = getAuthToken(request);

  if (!token) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await validateToken(token);
  if (!user) {
    return Response.json({ error: "Invalid token" }, { status: 403 });
  }

  return Response.json({ user });
}
```

---

## Background Tasks (SDK 54+)

```typescript
// app/api/webhook+api.ts
import { runTask, deferTask } from "expo-server";

export async function POST(request: Request) {
  const payload = await request.json();

  // runTask: executes concurrently, response waits for completion
  await runTask(async () => {
    await processWebhookPayload(payload);
  });

  // deferTask: executes AFTER response is sent to client
  deferTask(async () => {
    await sendNotification(payload.userId);
  });

  return Response.json({ received: true });
}
```

---

## Key Limitations

- **No dynamic imports** -- external deps with platform binaries cannot be bundled
- **Bundles to CommonJS** -- ESM syntax is recommended but transpiles to CJS
- **No platform-specific extensions** -- `users+api.web.ts` does not work
- **Environment variables** -- non-public env vars (without `EXPO_PUBLIC_` prefix) are accessible since these run server-side
- **Deployment** -- use `npx expo export --platform web` and deploy the `dist/` directory
