# Subscriptions

> SSE (default), WebSocket via graphql-ws, built-in PubSub, filtering. Referenced from [SKILL.md](../SKILL.md).

---

## Pattern 1: SSE Subscriptions (Default)

Yoga uses Server-Sent Events (SSE) by default -- no WebSocket infrastructure needed. Use `AsyncGenerator` syntax in subscription resolvers.

```typescript
import { createYoga, createSchema } from "graphql-yoga";

const TICK_INTERVAL_MS = 1_000;

const schema = createSchema({
  typeDefs: /* GraphQL */ `
    type Query {
      _empty: Boolean
    }
    type Subscription {
      countdown(from: Int!): Int!
    }
  `,
  resolvers: {
    Subscription: {
      countdown: {
        subscribe: async function* (_, { from }: { from: number }) {
          for (let i = from; i >= 0; i--) {
            await new Promise((resolve) =>
              setTimeout(resolve, TICK_INTERVAL_MS),
            );
            yield { countdown: i };
          }
        },
      },
    },
  },
});

const yoga = createYoga({ schema });
```

**Why good:** zero setup, works through HTTP proxies and load balancers, standard `text/event-stream` format

---

## Pattern 2: Built-in PubSub

Use `createPubSub` for type-safe publish/subscribe between mutations and subscriptions. Ideal for single-instance servers.

```typescript
import { createYoga, createSchema, createPubSub } from "graphql-yoga";

// Type-safe topic definitions
const pubSub = createPubSub<{
  newMessage: [payload: { id: string; text: string; author: string }];
  userJoined: [payload: { userId: string; name: string }];
}>();

const schema = createSchema({
  typeDefs: /* GraphQL */ `
    type Message {
      id: ID!
      text: String!
      author: String!
    }

    type Subscription {
      newMessage: Message!
    }

    type Mutation {
      sendMessage(text: String!, author: String!): Message!
    }

    type Query {
      _empty: Boolean
    }
  `,
  resolvers: {
    Subscription: {
      newMessage: {
        subscribe: () => pubSub.subscribe("newMessage"),
        resolve: (payload: { id: string; text: string; author: string }) =>
          payload,
      },
    },
    Mutation: {
      sendMessage: (_, { text, author }: { text: string; author: string }) => {
        const message = { id: crypto.randomUUID(), text, author };
        pubSub.publish("newMessage", message);
        return message;
      },
    },
  },
});
```

**Why good:** type-safe topics prevent publishing wrong payload shape, zero external dependencies for single-instance

---

## Pattern 3: PubSub with Filtering

Use `pipe`, `filter`, and `map` from `graphql-yoga` to transform and filter subscription events.

```typescript
import { createPubSub, createSchema, pipe, filter, map } from "graphql-yoga";

const pubSub = createPubSub<{
  notification: [
    payload: { userId: string; message: string; priority: string },
  ];
}>();

const schema = createSchema({
  typeDefs: /* GraphQL */ `
    type Notification {
      message: String!
      priority: String!
    }

    type Subscription {
      notifications(userId: ID!, minPriority: String): Notification!
    }

    type Query {
      _empty: Boolean
    }
  `,
  resolvers: {
    Subscription: {
      notifications: {
        subscribe: (
          _,
          { userId, minPriority }: { userId: string; minPriority?: string },
        ) =>
          pipe(
            pubSub.subscribe("notification"),
            // Only deliver notifications for this user
            filter((event) => event.userId === userId),
            // Optionally filter by priority
            filter((event) =>
              minPriority ? event.priority >= minPriority : true,
            ),
            // Transform to subscription payload shape
            map((event) => ({
              notifications: {
                message: event.message,
                priority: event.priority,
              },
            })),
          ),
      },
    },
  },
});
```

**Why good:** `pipe`/`filter`/`map` compose declaratively, server-side filtering prevents sending unnecessary events to clients

---

## Pattern 4: WebSocket Subscriptions (graphql-ws)

For bidirectional communication, use `graphql-ws` with the `ws` package. Required when clients need WebSocket transport.

```typescript
import { createYoga, createSchema } from "graphql-yoga";
import { createServer } from "node:http";
import { useServer } from "graphql-ws/use/ws";
import { WebSocketServer } from "ws";

const PORT = 4000;

const yoga = createYoga({
  schema,
  graphiql: {
    subscriptionsProtocol: "WS", // Tell GraphiQL to use WebSocket
  },
});

const httpServer = createServer(yoga);

const wsServer = new WebSocketServer({
  server: httpServer,
  path: yoga.graphqlEndpoint,
});

useServer(
  {
    execute: (args: any) => args.rootValue.execute(args),
    subscribe: (args: any) => args.rootValue.subscribe(args),
    onSubscribe: async (ctx, _id, params) => {
      const { schema, execute, subscribe, contextFactory, parse, validate } =
        yoga.getEnveloped({
          ...ctx,
          req: ctx.extra.request,
          socket: ctx.extra.socket,
          params,
        });

      const args = {
        schema,
        operationName: params.operationName,
        document: parse(params.query),
        variableValues: params.variables,
        contextValue: await contextFactory(),
        rootValue: { execute, subscribe },
      };

      const errors = validate(args.schema, args.document);
      if (errors.length) return errors;
      return args;
    },
  },
  wsServer,
);

httpServer.listen(PORT, () => {
  console.info(`Server running on http://localhost:${PORT}/graphql`);
  console.info(`WebSocket subscriptions on ws://localhost:${PORT}/graphql`);
});
```

**Why good:** `yoga.getEnveloped()` ensures all Envelop plugins (auth, logging) run for WebSocket subscriptions too, GraphiQL configured to use WS

---

## Pattern 5: Distributed PubSub with Redis

For multi-instance deployments, use Redis-backed event targets so events propagate across all server instances.

```typescript
import { createPubSub } from "graphql-yoga";
import { Redis } from "ioredis";
import { createRedisEventTarget } from "@graphql-yoga/redis-event-target";

const publishClient = new Redis(process.env.REDIS_URL);
const subscribeClient = new Redis(process.env.REDIS_URL);

const eventTarget = createRedisEventTarget({
  publishClient,
  subscribeClient,
});

const pubSub = createPubSub({ eventTarget });

// Use pubSub exactly like in-memory version
// pubSub.publish("newMessage", message)
// pubSub.subscribe("newMessage")
```

**Why good:** drop-in replacement for in-memory PubSub, same API, events propagate across instances

**When to use:** Any deployment with 2+ server instances (load-balanced, horizontal scaling). In-memory PubSub only delivers events to the instance that published them.
