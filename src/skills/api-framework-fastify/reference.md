# Fastify Reference

> Decision frameworks, anti-patterns, and red flags for Fastify development. Referenced from [SKILL.md](SKILL.md).

---

<decision_framework>

## Decision Framework

### When to Use Fastify

```
Need a Node.js web framework?
├─ Is performance critical (>10k req/sec)?
│   ├─ YES → Fastify (2-3x faster than Express)
│   └─ NO → Any framework works
├─ Need schema validation at framework level?
│   ├─ YES → Fastify (built-in JSON Schema)
│   └─ NO → Manual validation works
├─ Building large modular application?
│   ├─ YES → Fastify (plugin encapsulation)
│   └─ NO → Simpler patterns may suffice
└─ Need Express middleware compatibility?
    ├─ YES → Consider Express or @fastify/express adapter
    └─ NO → Fastify native plugins preferred
```

### Type Provider Selection

```
Which type provider?
├─ Want single source for types + validation?
│   ├─ YES → TypeBox (@fastify/type-provider-typebox)
│   └─ Already using Zod elsewhere?
│       ├─ YES → fastify-type-provider-zod
│       └─ NO → TypeBox (best integration)
├─ Have existing JSON Schemas?
│   └─ YES → @fastify/type-provider-json-schema-to-ts
└─ Default recommendation → TypeBox
```

### Plugin Encapsulation Decision

```
Creating a new plugin?
├─ Is it shared infrastructure? (db, cache, logger)
│   └─ YES → Use fastify-plugin (break encapsulation)
├─ Is it a domain/feature module?
│   └─ YES → Keep encapsulated (default behavior)
├─ Does it add decorators other plugins need?
│   └─ YES → Use fastify-plugin
└─ Default → Keep encapsulated (safer)
```

### Hook Selection

```
When should this code run?
├─ Before ANY processing (logging, request ID)?
│   └─ onRequest
├─ Need to transform raw request stream?
│   └─ preParsing
├─ Before schema validation?
│   └─ preValidation
├─ After validation, before handler?
│   └─ preHandler (authentication, authorization)
├─ Need to transform response object?
│   └─ preSerialization
├─ Need to modify final payload string/buffer?
│   └─ onSend (compression, encryption)
├─ After response sent (non-blocking)?
│   └─ onResponse (metrics, logging)
└─ On errors?
    └─ onError (custom error logging)
```

### Decorator vs Hook Decision

```
Need to add functionality?
├─ Is it a utility/service available to all requests?
│   └─ decorate() on FastifyInstance
├─ Is it per-request state?
│   └─ decorateRequest() with hook to populate
├─ Is it response helper methods?
│   └─ decorateReply()
├─ Is it cross-cutting behavior (auth, logging)?
│   └─ addHook()
└─ Is it one-time setup?
    └─ Run in plugin registration function
```

### Response Schema Decision

```
Should I define a response schema?
├─ Is this a production API?
│   └─ YES → Always define response schemas
├─ Is performance important?
│   └─ YES → Response schemas enable fast-json-stringify
├─ Need to prevent accidental data leaks?
│   └─ YES → Response schemas filter extra properties
└─ Default → Define response schemas (best practice)
```

</decision_framework>

---

## Red Flags

> See [SKILL.md](SKILL.md) for the full red flags list.

---

<anti_patterns>

## Anti-Patterns to Avoid

### Missing Type Provider

```typescript
// WRONG: No type provider
import Fastify from "fastify";

const server = Fastify();

server.get("/users", async (request) => {
  const limit = request.query.limit; // Type: unknown
  return { users: [] };
});
```

```typescript
// CORRECT: Type provider configured
import Fastify from "fastify";
import { Type, TypeBoxTypeProvider } from "@fastify/type-provider-typebox";

const server = Fastify().withTypeProvider<TypeBoxTypeProvider>();

server.get(
  "/users",
  {
    schema: {
      querystring: Type.Object({
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
      }),
    },
  },
  async (request) => {
    const limit = request.query.limit; // Type: number | undefined
    return { users: [] };
  },
);
```

**Why it matters:** Without type provider, request.query/body/params are `unknown`, losing TypeScript benefits.

---

### Shared Plugin Without fastify-plugin

```typescript
// WRONG: Decorator not accessible outside plugin
import type { FastifyPluginAsync } from "fastify";

export const databasePlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate("db", createDatabaseClient());
};

// Usage - THIS FAILS:
server.register(databasePlugin);
server.register(async (fastify) => {
  const users = await fastify.db.query("..."); // db is undefined!
});
```

```typescript
// CORRECT: Use fastify-plugin for shared decorators
import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    db: DatabaseClient;
  }
}

const databasePlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate("db", createDatabaseClient());
};

export const database = fp(databasePlugin, { name: "database" });

// Usage - THIS WORKS:
server.register(database);
server.register(async (fastify) => {
  const users = await fastify.db.query("..."); // db is accessible!
});
```

**Why it matters:** Without fastify-plugin, decorators are encapsulated and invisible to sibling/parent contexts.

---

### Magic Numbers for Status Codes

```typescript
// WRONG: Magic numbers scattered throughout code
server.get("/:id", async (request, reply) => {
  const user = await findUser(request.params.id);

  if (!user) {
    return reply.status(404).send({ error: "Not found" });
  }

  return reply.status(200).send(user);
});

server.post("/", async (request, reply) => {
  try {
    const user = await createUser(request.body);
    return reply.status(201).send(user);
  } catch {
    return reply.status(500).send({ error: "Failed" });
  }
});
```

```typescript
// CORRECT: Named constants
const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_NOT_FOUND = 404;
const HTTP_INTERNAL_ERROR = 500;

server.get("/:id", async (request, reply) => {
  const user = await findUser(request.params.id);

  if (!user) {
    return reply.status(HTTP_NOT_FOUND).send({ error: "Not found" });
  }

  return reply.status(HTTP_OK).send(user);
});

server.post("/", async (request, reply) => {
  try {
    const user = await createUser(request.body);
    return reply.status(HTTP_CREATED).send(user);
  } catch {
    return reply.status(HTTP_INTERNAL_ERROR).send({ error: "Failed" });
  }
});
```

**Why it matters:** Named constants document intent, enable search/replace, prevent typos.

---

### Reference Types in Request Decorators

```typescript
// WRONG: Shared mutable state across requests
fastify.decorateRequest("userData", { name: "", permissions: [] });

fastify.addHook("preHandler", async (request) => {
  request.userData.name = "John"; // MUTATES SHARED OBJECT!
  request.userData.permissions.push("read"); // ACCUMULATES ACROSS REQUESTS!
});
```

```typescript
// CORRECT: Initialize per-request in hook
fastify.decorateRequest("userData", null);

fastify.addHook("preHandler", async (request) => {
  request.userData = {
    name: "John",
    permissions: ["read"],
  };
});
```

**Why it matters:** Reference type decorators are shared across ALL requests - mutations persist and accumulate.

---

### Missing Response Schema

```typescript
// WRONG: No response schema
server.get("/users", async () => {
  const users = await db.query("SELECT * FROM users"); // May include password_hash!
  return { users };
});
```

```typescript
// CORRECT: Response schema filters and optimizes
server.get(
  "/users",
  {
    schema: {
      response: {
        200: Type.Object({
          users: Type.Array(
            Type.Object({
              id: Type.String(),
              username: Type.String(),
              email: Type.String(),
              // password_hash NOT included - filtered out!
            }),
          ),
        }),
      },
    },
  },
  async () => {
    const users = await db.query("SELECT * FROM users");
    return { users }; // password_hash automatically removed
  },
);
```

**Why it matters:** Response schemas prevent accidental data leaks AND enable fast-json-stringify (2-3x faster).

---

### God Route Files

```typescript
// WRONG: All routes in one file
// routes.ts - 2000+ lines
server.get("/users", async () => {});
server.get("/users/:id", async () => {});
server.post("/users", async () => {});
server.get("/posts", async () => {});
server.get("/posts/:id", async () => {});
server.post("/posts", async () => {});
// ... 50+ more routes
```

```typescript
// CORRECT: Modular route plugins
// server.ts
server.register(userRoutes, { prefix: "/users" });
server.register(postRoutes, { prefix: "/posts" });

// routes/users.ts
export const userRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", listUsers);
  fastify.get("/:id", getUser);
  fastify.post("/", createUser);
};

// routes/posts.ts
export const postRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", listPosts);
  fastify.get("/:id", getPost);
  fastify.post("/", createPost);
};
```

**Why it matters:** Modular plugins enable encapsulation, easier testing, and maintainable code organization.

---

### Express Patterns in Fastify

```typescript
// WRONG: Express-style patterns
server.get("/users", (req, res, next) => {
  // res.send() doesn't exist
  // next() doesn't exist
  res.json({ users: [] });
});

server.use((req, res, next) => {
  // .use() works differently in Fastify
  next();
});
```

```typescript
// CORRECT: Fastify-native patterns
server.get("/users", async (request, reply) => {
  return { users: [] }; // Auto-serialized to JSON
  // OR: reply.send({ users: [] });
});

server.addHook("onRequest", async (request, reply) => {
  // Hooks replace middleware
  // Return value or reply.send() short-circuits
});
```

**Why it matters:** Fastify uses different patterns - hooks instead of middleware, reply instead of res, return values for responses.

---

### Mixing Async and Callback Patterns

```typescript
// WRONG: Mixing patterns causes confusion
server.addHook("preHandler", async (request, reply, done) => {
  await someAsyncOperation();
  done(); // DON'T mix async with done callback
});
```

```typescript
// CORRECT: Use async consistently
server.addHook("preHandler", async (request, reply) => {
  await someAsyncOperation();
  // No done() needed - async function completion signals done
});

// OR use callback consistently (rare)
server.addHook("preHandler", (request, reply, done) => {
  someCallbackOperation((error) => {
    done(error);
  });
});
```

**Why it matters:** Mixing async/await with done callback can cause double-completion or hanging requests.

</anti_patterns>

---

## Quick Reference Tables

### HTTP Status Constants

```typescript
// Define once, use everywhere
const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_NO_CONTENT = 204;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const HTTP_UNPROCESSABLE_ENTITY = 422;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_INTERNAL_ERROR = 500;
const HTTP_SERVICE_UNAVAILABLE = 503;
```

### Hook Execution Order

| Hook             | When                     | Can Send Response     | Common Use                       |
| ---------------- | ------------------------ | --------------------- | -------------------------------- |
| onRequest        | First, before parsing    | Yes                   | Logging, request ID              |
| preParsing       | Before body parse        | Yes                   | Stream transformation            |
| preValidation    | Before schema validation | Yes                   | Modify body before validation    |
| preHandler       | After validation         | Yes                   | Auth, authorization              |
| handler          | Route handler            | Yes                   | Business logic                   |
| preSerialization | Before JSON stringify    | No                    | Transform response object        |
| onSend           | Before sending           | Yes (replace payload) | Compression, final modifications |
| onResponse       | After sent               | No                    | Metrics, cleanup                 |
| onError          | On error                 | No                    | Error logging                    |

### Type Provider Comparison

| Provider                                 | Source          | Best For              |
| ---------------------------------------- | --------------- | --------------------- |
| @fastify/type-provider-typebox           | TypeBox schemas | New projects, best DX |
| @fastify/type-provider-json-schema-to-ts | JSON Schema     | Existing JSON schemas |
| fastify-type-provider-zod                | Zod schemas     | Already using Zod     |

---

## Production Checklist

### Before Deploying

- [ ] Type provider configured with `withTypeProvider<>()`
- [ ] All routes have schema definitions (querystring, params, body, response)
- [ ] Response schemas defined for all endpoints
- [ ] Named constants for HTTP status codes (no magic numbers)
- [ ] Shared plugins wrapped with fastify-plugin
- [ ] Plugin dependencies declared in options
- [ ] Error handler configured with `setErrorHandler()`
- [ ] Request ID generation and propagation
- [ ] Proper logging configuration (production level)
- [ ] onClose hooks for cleanup (database, connections)
- [ ] No sensitive data in error responses
- [ ] No PII in logs

### Testing Checklist

- [ ] Server factory function for test isolation
- [ ] Using `server.inject()` (no network overhead)
- [ ] `beforeEach`: build server, `await server.ready()`
- [ ] `afterEach`: `await server.close()`
- [ ] Testing validation errors (400 responses)
- [ ] Testing success paths
- [ ] Testing error handling
- [ ] Mocking decorators when needed
