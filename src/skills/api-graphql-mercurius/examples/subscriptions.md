# Mercurius - Subscriptions

> Real-time data with WebSocket subscriptions, pubsub patterns, and event filtering. See [SKILL.md](../SKILL.md) for decision guidance, [core.md](core.md) for fundamentals.

**Prerequisites**: Core Mercurius registration and resolver patterns.

---

## Pattern 1: Basic Subscription Setup

### Good Example - Enable and Define Subscriptions

```typescript
import Fastify from "fastify";
import mercurius from "mercurius";
import type { MercuriusContext } from "mercurius";

const JIT_THRESHOLD = 1;
const MESSAGE_TOPIC = "NEW_MESSAGE";

const schema = `
  type Query {
    messages: [Message!]!
  }

  type Mutation {
    sendMessage(text: String!, channelId: ID!): Message!
  }

  type Subscription {
    messageSent(channelId: ID!): Message!
  }

  type Message {
    id: ID!
    text: String!
    channelId: ID!
    createdAt: String!
  }
`;

const resolvers = {
  Mutation: {
    sendMessage: async (
      _parent: unknown,
      args: { text: string; channelId: string },
      ctx: MercuriusContext,
    ) => {
      const message = {
        id: generateId(),
        text: args.text,
        channelId: args.channelId,
        createdAt: new Date().toISOString(),
      };

      // Publish to subscription topic
      await ctx.pubsub.publish({
        topic: MESSAGE_TOPIC,
        payload: { messageSent: message },
      });

      return message;
    },
  },
  Subscription: {
    messageSent: {
      subscribe: async (
        _parent: unknown,
        _args: unknown,
        ctx: MercuriusContext,
      ) => {
        return ctx.pubsub.subscribe(MESSAGE_TOPIC);
      },
    },
  },
};

const app = Fastify({ logger: true });

app.register(mercurius, {
  schema,
  resolvers,
  subscription: true, // REQUIRED - subscriptions are disabled by default
  jit: JIT_THRESHOLD,
});
```

**Why good:** `subscription: true` explicitly enables WebSocket support, topic as named constant, payload key matches subscription field name (`messageSent`), pubsub accessed from context

### Bad Example - Wrong Payload Shape

```typescript
const resolvers = {
  Mutation: {
    sendMessage: async (
      _: unknown,
      args: { text: string },
      ctx: MercuriusContext,
    ) => {
      const message = { id: "1", text: args.text };

      await ctx.pubsub.publish({
        topic: "NEW_MESSAGE",
        payload: { message }, // WRONG: key must match subscription field name
      });

      return message;
    },
  },
  Subscription: {
    messageSent: {
      subscribe: async (_: unknown, _args: unknown, ctx: MercuriusContext) => {
        return ctx.pubsub.subscribe("NEW_MESSAGE");
      },
    },
  },
};
```

**Why bad:** Payload key is `message` but subscription field is `messageSent` — subscribers receive `null`. The payload object key must exactly match the subscription field name.

---

## Pattern 2: Filtering with withFilter

### Good Example - Channel-Specific Subscriptions

```typescript
import mercurius from "mercurius";
import type { MercuriusContext } from "mercurius";

const { withFilter } = mercurius;

const MESSAGE_TOPIC = "NEW_MESSAGE";

const resolvers = {
  Subscription: {
    messageSent: {
      subscribe: withFilter(
        // Iterator factory
        (_parent: unknown, _args: unknown, ctx: MercuriusContext) => {
          return ctx.pubsub.subscribe(MESSAGE_TOPIC);
        },
        // Filter function: return true to deliver, false to skip
        (
          payload: { messageSent: { channelId: string } },
          args: { channelId: string },
        ) => {
          return payload.messageSent.channelId === args.channelId;
        },
      ),
    },
  },
};
```

**Why good:** `withFilter` prevents delivering events to unrelated subscribers, filter receives both the published payload and the subscription args, only matching events reach the client

**When to use:** Whenever subscribers should only receive a subset of events (by ID, by type, by permission level).

---

## Pattern 3: Subscription Context (Authentication)

### Good Example - Custom Subscription Context

```typescript
import mercurius from "mercurius";

app.register(mercurius, {
  schema,
  resolvers,
  subscription: {
    context: async (_connection, request) => {
      // connection_init payload is copied to request.headers
      const token = request.headers.authorization;

      if (!token) {
        throw new Error("Missing authorization");
      }

      const user = await verifyToken(token);
      return { user };
    },
    // Optional: called when client sends connection_init
    onConnect: (data) => {
      // data.payload contains connection_init payload from client
      return true; // return false to reject the connection
    },
    onDisconnect: (context) => {
      // Cleanup when client disconnects
    },
  },
});
```

**Why good:** Subscription context is separate from query context (WebSocket vs HTTP), `connection_init` payload is available via `request.headers`, connection can be rejected in `onConnect`

**Gotcha:** The subscription `context` function receives the WebSocket connection info, not a standard HTTP request. Properties from the client's `connection_init` payload are automatically copied into `request.headers`.

---

## Pattern 4: Redis PubSub for Distributed Systems

### Good Example - Redis Emitter for Multi-Instance Deployments

```typescript
import Fastify from "fastify";
import mercurius from "mercurius";
import mqRedis from "mqemitter-redis";

const REDIS_PORT = 6379;
const REDIS_HOST = "127.0.0.1";

const emitter = mqRedis({
  port: REDIS_PORT,
  host: REDIS_HOST,
});

const app = Fastify({ logger: true });

app.register(mercurius, {
  schema,
  resolvers,
  subscription: {
    emitter, // Replace default in-memory emitter with Redis
  },
});
```

**Why good:** Default in-memory emitter only works on a single process. Redis emitter enables subscriptions across multiple server instances.

**When to use:** Any deployment with more than one server instance (horizontal scaling, Kubernetes pods, load-balanced servers). Without a shared emitter, events published on one instance do not reach subscribers on another.

---

## Pattern 5: Multiple Topic Subscriptions

### Subscribing to Multiple Topics

```typescript
const COMMENT_ADDED = "COMMENT_ADDED";
const COMMENT_DELETED = "COMMENT_DELETED";

const resolvers = {
  Subscription: {
    commentActivity: {
      subscribe: async (
        _parent: unknown,
        _args: unknown,
        ctx: MercuriusContext,
      ) => {
        return ctx.pubsub.subscribe([COMMENT_ADDED, COMMENT_DELETED]);
      },
    },
  },
};
```

**Why good:** Single subscription receives events from multiple topics, topics as named constants, useful for activity feeds and notification streams.
