# Upstash -- QStash Examples

> Background jobs, scheduling, message publishing, and receiver verification. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [core.md](core.md) -- Redis client setup, commands, pipeline
- [rate-limiting.md](rate-limiting.md) -- @upstash/ratelimit algorithms

---

## QStash Client Setup

```typescript
import { Client } from "@upstash/qstash";

const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
});

export { qstash };
```

**Environment variable:** `QSTASH_TOKEN` from Upstash Console.

---

## Publishing a Background Job

Fire-and-forget job that QStash delivers to your API endpoint via HTTP POST.

```typescript
import { Client } from "@upstash/qstash";

const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
});

const MAX_RETRIES = 3;

async function enqueueOrderProcessing(orderId: string) {
  const response = await qstash.publishJSON({
    url: "https://your-app.com/api/process-order",
    body: { orderId, action: "fulfill" },
    retries: MAX_RETRIES,
  });

  return response.messageId; // Track the message
}

export { enqueueOrderProcessing };
```

**Why good:** Named constant for retries, `publishJSON` auto-serializes the body, returns `messageId` for tracking, QStash handles retries on failure

**How it works:** QStash stores your message durably and POSTs it to the destination URL. If the endpoint returns a non-2xx status, QStash retries with exponential backoff up to `retries` times. This provides at-least-once delivery guarantee.

---

## Delayed Message

```typescript
const DELAY_SECONDS = "30s";

await qstash.publishJSON({
  url: "https://your-app.com/api/send-reminder",
  body: { userId: "user-123", type: "cart-abandonment" },
  delay: DELAY_SECONDS,
});
```

**When to use:** Delayed notifications, cart abandonment reminders, scheduled cleanups. The message is delivered after the specified delay.

---

## Scheduled (Cron) Messages

```typescript
// Send a weekly report every Monday at 9am UTC
await qstash.publishJSON({
  url: "https://your-app.com/api/weekly-report",
  body: { reportType: "usage-summary" },
  cron: "0 9 * * 1", // Standard cron syntax
});
```

**When to use:** Recurring jobs (reports, cleanups, syncs) without maintaining a cron server or long-running process.

---

## Publishing to URL Groups (Fan-Out)

Deliver the same message to multiple endpoints simultaneously.

```typescript
// First, create a URL group via QStash API or Console
// Then publish to the group by name:
await qstash.publishJSON({
  urlGroup: "my-topic",
  body: { event: "user.created", userId: "user-456" },
});
```

**When to use:** Event fan-out to multiple services (notifications, analytics, audit logs).

---

## Receiver Verification

Verify that incoming webhooks are actually from QStash (prevents spoofing).

```typescript
import { Receiver } from "@upstash/qstash";

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

async function verifyQStashWebhook(request: Request): Promise<boolean> {
  const signature = request.headers.get("upstash-signature");
  if (!signature) return false;

  const body = await request.text();

  try {
    await receiver.verify({
      signature,
      body,
    });
    return true;
  } catch {
    return false;
  }
}

export { verifyQStashWebhook };
```

**Why good:** Verifies webhook signature to prevent spoofing, uses both current and next signing keys for key rotation, returns boolean for clean control flow

**Environment variables:** `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY` from QStash dashboard.

---

## Complete Handler Example

```typescript
import { verifyQStashWebhook } from "../lib/qstash-verify";

async function processOrderHandler(request: Request): Promise<Response> {
  // Step 1: Verify the webhook is from QStash
  const isValid = await verifyQStashWebhook(request);
  if (!isValid) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Step 2: Parse and process the job
  const body = (await request.json()) as { orderId: string; action: string };

  try {
    await fulfillOrder(body.orderId);
    // Return 2xx to acknowledge -- QStash will not retry
    return new Response("OK", { status: 200 });
  } catch (error) {
    // Return 5xx to trigger QStash retry
    return new Response("Processing failed", { status: 500 });
  }
}

async function fulfillOrder(orderId: string): Promise<void> {
  // Your order processing logic
}

export { processOrderHandler };
```

**Key pattern:** Return 2xx to acknowledge successful processing. Return 5xx to trigger QStash's automatic retry mechanism. QStash provides at-least-once delivery -- design your handlers to be idempotent.

---

## QStash vs Direct Redis Queues

```
When should I use QStash vs Redis lists/streams for queuing?
|-- Serverless (no long-running consumers)?
|   --> QStash -- push-based, no consumer process needed
|-- Need ordering guarantees (FIFO)?
|   --> QStash FIFO queues or Redis Streams
|-- Need scheduled/delayed delivery?
|   --> QStash -- built-in delay and cron support
|-- Need sub-second latency?
|   --> Redis Streams with persistent consumer (not serverless-compatible)
|-- Need fan-out to multiple endpoints?
    --> QStash URL Groups -- built-in fan-out
```

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
