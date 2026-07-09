# Core Patterns

> Server setup, schema definition, type-safe context, cross-runtime deployment, file uploads. Referenced from [SKILL.md](../SKILL.md).

---

## Pattern 1: Basic Server Setup (Node.js)

```typescript
import { createYoga, createSchema } from "graphql-yoga";
import { createServer } from "node:http";

const PORT = 4000;

const schema = createSchema({
  typeDefs: /* GraphQL */ `
    type Query {
      greeting(name: String!): String!
      health: Boolean!
    }
  `,
  resolvers: {
    Query: {
      greeting: (_, { name }: { name: string }) => `Hello, ${name}!`,
      health: () => true,
    },
  },
});

const yoga = createYoga({ schema });
const server = createServer(yoga);

server.listen(PORT, () => {
  console.info(`Server running on http://localhost:${PORT}/graphql`);
});

export { yoga };
```

**Why good:** `createSchema` wraps `makeExecutableSchema`, yoga is exported for testing, schema uses SDL with typed resolver args

```typescript
// Bad: passing typeDefs/resolvers directly (not supported in v5)
const yoga = createYoga({
  typeDefs: `type Query { hello: String }`,
  resolvers: { Query: { hello: () => "world" } },
});
```

**Why bad:** v5 requires `createSchema` -- raw `typeDefs`/`resolvers` on `createYoga` config is not supported

---

## Pattern 2: Type-Safe Context

Use the generic parameter on `createYoga` for server-specific context. The `context` factory receives `YogaInitialContext` and merges your return value into the resolver context.

```typescript
import {
  createYoga,
  createSchema,
  type YogaInitialContext,
} from "graphql-yoga";
import { createServer } from "node:http";

interface AppContext {
  user: { id: string; role: string } | null;
}

const yoga = createYoga<Record<string, never>>({
  schema: createSchema({
    typeDefs: /* GraphQL */ `
      type Query {
        me: String
      }
    `,
    resolvers: {
      Query: {
        me: (_, __, context: YogaInitialContext & AppContext) => {
          if (!context.user) return null;
          return context.user.id;
        },
      },
    },
  }),
  context: async ({ request }: YogaInitialContext): Promise<AppContext> => {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return { user: null };
    // Verify token with your auth solution
    const user = await verifyToken(token);
    return { user };
  },
});

const server = createServer(yoga);
```

**Why good:** generic flows to resolver context, uses standard Fetch `Request` API (not Node.js-specific `req`), context factory is async for DB/auth calls

```typescript
// Bad: using Node.js req/res instead of Fetch API Request
context: ({ req }) => {
  const token = req.headers.authorization; // Wrong: Node.js API
};
```

**Why bad:** `YogaInitialContext` provides `request` (Fetch API `Request`), not `req` (Node.js `IncomingMessage`) -- using `req` breaks on non-Node runtimes

---

## Pattern 3: Cross-Runtime Deployment

Yoga's Fetch API core means the same schema code works on any runtime. Only the server bootstrap differs.

#### Node.js

```typescript
import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";

const yoga = createYoga({ schema });
const server = createServer(yoga);
server.listen(4000);
```

#### Bun

```typescript
import { createYoga } from "graphql-yoga";

const yoga = createYoga({ schema });
Bun.serve({ fetch: yoga });
```

#### Deno

```typescript
import { createYoga } from "graphql-yoga";

const yoga = createYoga({ schema });
Deno.serve(yoga);
```

#### Cloudflare Workers

```typescript
import { createYoga } from "graphql-yoga";

const yoga = createYoga({ schema });

export default {
  fetch: yoga.fetch,
};
```

**Why good:** schema + resolvers + plugins are identical across runtimes, only the HTTP adapter changes

---

## Pattern 4: File Uploads

Yoga supports the GraphQL Multipart Request spec. Use the `File` scalar to receive WHATWG `File` objects.

```typescript
import { createYoga, createSchema } from "graphql-yoga";

const MAX_FILE_NAME_LENGTH = 255;

const schema = createSchema({
  typeDefs: /* GraphQL */ `
    scalar File

    type FileInfo {
      name: String!
      size: Int!
      type: String!
    }

    type Mutation {
      uploadFile(file: File!): FileInfo!
    }

    type Query {
      _empty: Boolean
    }
  `,
  resolvers: {
    Mutation: {
      uploadFile: async (_, { file }: { file: File }) => {
        const buffer = await file.arrayBuffer();
        // Save buffer to storage
        return {
          name: file.name.slice(0, MAX_FILE_NAME_LENGTH),
          size: buffer.byteLength,
          type: file.type,
        };
      },
    },
  },
});

const yoga = createYoga({ schema });
```

**Why good:** uses standard WHATWG `File` API (same methods as browser: `.text()`, `.arrayBuffer()`, `.stream()`), no extra packages

```typescript
// Bad: expecting Node.js stream/buffer
uploadFile: async (_, { file }) => {
  const chunks = [];
  for await (const chunk of file) {
    chunks.push(chunk); // Wrong: File is not a Node.js stream
  }
};
```

**Why bad:** WHATWG `File` is not a Node.js readable stream -- use `.arrayBuffer()` or `.stream()` (web ReadableStream)

#### Disabling Uploads

```typescript
const yoga = createYoga({
  schema,
  multipart: false, // Reject all multipart requests
});
```
