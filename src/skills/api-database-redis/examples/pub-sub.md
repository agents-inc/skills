# Redis -- Pub/Sub Examples

> Publish/subscribe messaging, event broadcasting, and pattern subscriptions. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [core.md](core.md) -- Connection setup (separate connections required for pub/sub)
- [queues.md](queues.md) -- BullMQ and Redis Streams for persistent messaging

---

## Basic Pub/Sub with Separate Connections

```typescript
// ✅ Good Example - Separate connections for pub/sub
import Redis from "ioredis";

const NOTIFICATION_CHANNEL = "notifications";

function createPubSubClients() {
  const url = process.env.REDIS_URL!;

  // Publisher can be your regular Redis client
  const publisher = new Redis(url);
  publisher.on("error", (err) => {
    console.error("Publisher error:", err.message);
  });

  // Subscriber MUST be a separate connection
  const subscriber = new Redis(url);
  subscriber.on("error", (err) => {
    console.error("Subscriber error:", err.message);
  });

  return { publisher, subscriber };
}

// Subscribe to channels
async function setupSubscriber(subscriber: Redis): Promise<void> {
  await subscriber.subscribe(NOTIFICATION_CHANNEL);

  subscriber.on("message", (channel, message) => {
    const data = JSON.parse(message);
    console.log(`Received on ${channel}:`, data);
    handleNotification(data);
  });
}

// Publish messages
async function publishNotification(
  publisher: Redis,
  notification: { userId: string; type: string; message: string },
): Promise<number> {
  // Returns number of subscribers that received the message
  return publisher.publish(NOTIFICATION_CHANNEL, JSON.stringify(notification));
}

export { createPubSubClients, setupSubscriber, publishNotification };
```

**Why good:** Separate connections for pub and sub (required by Redis protocol), error handlers on both, typed notification payload, publish returns subscriber count for observability

```typescript
// ❌ Bad Example - Using same connection for pub and sub
const redis = new Redis();
await redis.subscribe("channel");
await redis.set("key", "value"); // ERROR: connection is in subscriber mode
```

**Why bad:** A subscribed connection enters a special mode and cannot execute non-pub/sub commands -- `set` will throw an error

---

## Pattern Subscriptions

```typescript
// Subscribe to all channels matching a pattern
await subscriber.psubscribe("notifications:*");

subscriber.on("pmessage", (pattern, channel, message) => {
  // pattern: "notifications:*"
  // channel: "notifications:user:123" (actual channel)
  // message: the published data
  console.log(`Pattern ${pattern} matched channel ${channel}`);
});
```

---

## Event Broadcasting System

```typescript
import Redis from "ioredis";

// Event types
interface UserEvent {
  type: "user:created" | "user:updated" | "user:deleted";
  userId: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

const EVENT_CHANNEL_PREFIX = "events:";

function createEventBus() {
  const publisher = new Redis(process.env.REDIS_URL!);
  const subscriber = new Redis(process.env.REDIS_URL!);

  publisher.on("error", (err) =>
    console.error("Event publisher error:", err.message),
  );
  subscriber.on("error", (err) =>
    console.error("Event subscriber error:", err.message),
  );

  type EventHandler = (event: UserEvent) => void | Promise<void>;
  const handlers = new Map<string, EventHandler[]>();

  // Subscribe to event patterns
  async function subscribe(
    pattern: string,
    handler: EventHandler,
  ): Promise<void> {
    const channel = `${EVENT_CHANNEL_PREFIX}${pattern}`;

    if (!handlers.has(channel)) {
      handlers.set(channel, []);
      await subscriber.psubscribe(channel);
    }

    handlers.get(channel)!.push(handler);
  }

  // Handle incoming messages
  subscriber.on("pmessage", async (_pattern, channel, message) => {
    const event = JSON.parse(message) as UserEvent;

    // Find all matching handlers
    for (const [handlerPattern, handlerList] of handlers) {
      if (channelMatchesPattern(channel, handlerPattern)) {
        for (const handler of handlerList) {
          try {
            await handler(event);
          } catch (err) {
            console.error(`Event handler error on ${channel}:`, err);
          }
        }
      }
    }
  });

  // Publish events
  async function publish(event: UserEvent): Promise<number> {
    const channel = `${EVENT_CHANNEL_PREFIX}${event.type}`;
    return publisher.publish(channel, JSON.stringify(event));
  }

  // Cleanup
  async function close(): Promise<void> {
    await subscriber.punsubscribe();
    await publisher.quit();
    await subscriber.quit();
  }

  return { subscribe, publish, close };
}

function channelMatchesPattern(channel: string, pattern: string): boolean {
  const regex = new RegExp(
    "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
  );
  return regex.test(channel);
}

export { createEventBus };
export type { UserEvent };
```

#### Usage

```typescript
const eventBus = createEventBus();

// Subscribe to all user events
await eventBus.subscribe("user:*", async (event) => {
  console.log(`User event: ${event.type} for ${event.userId}`);
});

// Subscribe to specific event
await eventBus.subscribe("user:created", async (event) => {
  await sendWelcomeEmail(event.userId);
});

// Publish an event
await eventBus.publish({
  type: "user:created",
  userId: "user-123",
  timestamp: Date.now(),
  data: { name: "Alice" },
});
```

**Why good:** Typed event payloads, pattern-based subscriptions, error isolation per handler, proper cleanup with `close()`, separate pub/sub connections

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
