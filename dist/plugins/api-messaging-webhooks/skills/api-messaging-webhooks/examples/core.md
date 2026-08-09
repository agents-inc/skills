# Webhooks - Core Receiving Patterns

> Essential patterns for receiving webhooks securely. See [SKILL.md](../SKILL.md) for decision frameworks and [reference.md](../reference.md) for quick reference.

**Additional Examples:**

- [sending.md](sending.md) - Outbound delivery, retry logic, dead letter queues

---

## Pattern 1: HMAC-SHA256 Signature Verification

### Good Example - Timing-safe verification on raw body

```typescript
import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_ALGORITHM = "sha256";
const SIGNATURE_ENCODING = "hex";

/**
 * Verify an HMAC-SHA256 signature against the raw request body.
 * Uses timing-safe comparison to prevent timing attacks.
 */
function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): boolean {
  // Strip common prefixes (e.g., "sha256=" from GitHub, "v1=" from Stripe)
  const receivedSignature = signatureHeader.replace(/^(sha256=|v1=)/, "");

  const expected = createHmac(SIGNATURE_ALGORITHM, secret)
    .update(rawBody)
    .digest(SIGNATURE_ENCODING);

  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(receivedSignature, "utf8");

  // timingSafeEqual throws if lengths differ -- check first
  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

export { verifyWebhookSignature };
```

**Why good:** operates on raw bytes (not parsed JSON), uses `timingSafeEqual` to prevent timing attacks, handles common signature prefixes, length check prevents `timingSafeEqual` from throwing

### Bad Example - Naive string comparison on parsed body

```typescript
import { createHmac } from "node:crypto";

function verifySignature(
  parsedBody: object,
  signature: string,
  secret: string,
): boolean {
  // BAD: Re-serializing parsed JSON -- key order and whitespace may differ from original
  const body = JSON.stringify(parsedBody);
  const expected = createHmac("sha256", secret).update(body).digest("hex");

  // BAD: String equality leaks timing information
  return expected === signature;
}
```

**Why bad:** `JSON.stringify` does not guarantee the same byte sequence as the original payload (key order, whitespace, encoding), `===` comparison leaks timing information allowing attackers to guess signatures incrementally

---

## Pattern 2: Timestamp-Inclusive Signature Verification

Many providers (Stripe, Standard Webhooks) include a timestamp in the signed content to prevent replay attacks. The signature covers `timestamp.payload`.

### Good Example - Signing timestamp + payload

```typescript
import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_ALGORITHM = "sha256";
const SIGNATURE_ENCODING = "hex";
const MAX_TIMESTAMP_AGE_SECONDS = 300; // 5 minutes
const MS_PER_SECOND = 1000;

interface VerificationResult {
  valid: boolean;
  reason?: string;
}

function verifyWebhookWithTimestamp(
  rawBody: string,
  signatureHeader: string,
  timestampHeader: string,
  secret: string,
): VerificationResult {
  // 1. Validate timestamp is recent
  const timestamp = parseInt(timestampHeader, 10);
  if (Number.isNaN(timestamp)) {
    return { valid: false, reason: "Invalid timestamp" };
  }

  const currentTime = Math.floor(Date.now() / MS_PER_SECOND);
  if (Math.abs(currentTime - timestamp) > MAX_TIMESTAMP_AGE_SECONDS) {
    return { valid: false, reason: "Timestamp outside tolerance window" };
  }

  // 2. Verify signature over "timestamp.body" (standard convention)
  const signedContent = `${timestampHeader}.${rawBody}`;
  const expected = createHmac(SIGNATURE_ALGORITHM, secret)
    .update(signedContent)
    .digest(SIGNATURE_ENCODING);

  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(signatureHeader, "utf8");

  if (expectedBuffer.length !== receivedBuffer.length) {
    return { valid: false, reason: "Signature mismatch" };
  }

  if (!timingSafeEqual(expectedBuffer, receivedBuffer)) {
    return { valid: false, reason: "Signature mismatch" };
  }

  return { valid: true };
}

export { verifyWebhookWithTimestamp };
export type { VerificationResult };
```

**Why good:** timestamp validation prevents replay attacks, signature covers the timestamp so an attacker cannot swap timestamps on old payloads, `Math.abs` handles clock skew in both directions, returns structured result with reason for logging

---

## Pattern 3: Raw Body Extraction

Webhook signature verification requires the exact bytes sent by the producer. JSON parsing middleware destroys this by re-serializing with potentially different formatting.

### Good Example - Framework-agnostic raw body from Request

```typescript
/**
 * Extract raw body from a standard Web API Request.
 * Works with any framework that uses the Request/Response standard
 * (most modern frameworks do).
 */
async function extractRawBody(request: Request): Promise<string> {
  return await request.text();
}
```

**Why good:** `request.text()` returns the body as the exact UTF-8 string received, no parsing or transformation

### Good Example - Preserving raw body alongside parsed JSON

When you need both the raw body (for verification) and parsed JSON (for processing):

```typescript
async function handleWebhook(request: Request): Promise<Response> {
  // Read raw body FIRST -- before any JSON parsing
  const rawBody = await request.text();

  // Verify signature against raw body
  const signature = request.headers.get("webhook-signature") ?? "";
  const timestamp = request.headers.get("webhook-timestamp") ?? "";
  const secret = getWebhookSecret();

  const result = verifyWebhookWithTimestamp(
    rawBody,
    signature,
    timestamp,
    secret,
  );
  if (!result.valid) {
    return new Response(JSON.stringify({ error: result.reason }), {
      status: 401,
    });
  }

  // Parse JSON only AFTER verification succeeds
  const event = JSON.parse(rawBody) as WebhookEvent;

  // Return 200 immediately, process asynchronously
  queueForProcessing(event);

  return new Response(null, { status: 200 });
}
```

**Why good:** raw body read before any parsing, verification before JSON parse (avoids wasted work on invalid payloads), immediate 200 response with async processing

---

## Pattern 4: Idempotent Webhook Processing

Producers retry failed deliveries, so the same event arrives multiple times. Use the webhook ID as an idempotency key.

### Good Example - Idempotency with storage abstraction

```typescript
const IDEMPOTENCY_TTL_DAYS = 7;
const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;
const IDEMPOTENCY_TTL_MS =
  IDEMPOTENCY_TTL_DAYS *
  HOURS_PER_DAY *
  MINUTES_PER_HOUR *
  SECONDS_PER_MINUTE *
  MS_PER_SECOND;

// Storage interface -- implement with your chosen data store
interface IdempotencyStore {
  has(key: string): Promise<boolean>;
  set(key: string, ttlMs: number): Promise<void>;
}

async function processWebhookIdempotently(
  webhookId: string,
  store: IdempotencyStore,
  handler: () => Promise<void>,
): Promise<{ status: "processed" | "duplicate" }> {
  // Check BEFORE processing
  const alreadyProcessed = await store.has(webhookId);
  if (alreadyProcessed) {
    return { status: "duplicate" };
  }

  await handler();

  // Mark AFTER successful processing
  await store.set(webhookId, IDEMPOTENCY_TTL_MS);

  return { status: "processed" };
}

export { processWebhookIdempotently };
export type { IdempotencyStore };
```

**Why good:** storage abstracted behind an interface (works with any data store), TTL prevents unbounded growth, checks before processing, marks after success, returns status for monitoring

### Bad Example - No idempotency, in-memory store in multi-instance deployment

```typescript
const processed = new Set<string>();

async function handleWebhook(event: WebhookEvent): Promise<void> {
  // BAD: In-memory set is lost on restart and not shared across instances
  if (processed.has(event.id)) return;

  await processEvent(event);
  processed.add(event.id);
  // BAD: No TTL -- set grows unbounded forever
}
```

**Why bad:** in-memory set is not shared across instances (each instance processes the same event), no TTL means unbounded memory growth, lost on restart

---

## Pattern 5: Type-Safe Event Routing

Route events to typed handlers using a handler map. Adding a new event type to the union causes a compile error until a handler is added.

### Good Example - Discriminated union with handler map

```typescript
import { z } from "zod";

// Define event schemas
const OrderCreatedSchema = z.object({
  type: z.literal("order.created"),
  data: z.object({ orderId: z.string(), total: z.number() }),
});

const OrderCancelledSchema = z.object({
  type: z.literal("order.cancelled"),
  data: z.object({ orderId: z.string(), reason: z.string() }),
});

const PaymentCompletedSchema = z.object({
  type: z.literal("payment.completed"),
  data: z.object({ paymentId: z.string(), amount: z.number() }),
});

const WebhookEventSchema = z.discriminatedUnion("type", [
  OrderCreatedSchema,
  OrderCancelledSchema,
  PaymentCompletedSchema,
]);

type WebhookEvent = z.infer<typeof WebhookEventSchema>;

// Handler map -- compile error if a case is missing
type EventHandlerMap = {
  [E in WebhookEvent as E["type"]]: (data: E["data"]) => Promise<void>;
};

const handlers: EventHandlerMap = {
  "order.created": async (data) => {
    // data is typed as { orderId: string; total: number }
  },
  "order.cancelled": async (data) => {
    // data is typed as { orderId: string; reason: string }
  },
  "payment.completed": async (data) => {
    // data is typed as { paymentId: string; amount: number }
  },
};

async function routeWebhookEvent(rawPayload: string): Promise<void> {
  const parsed = WebhookEventSchema.safeParse(JSON.parse(rawPayload));

  if (!parsed.success) {
    // Unknown or malformed event -- log and skip (don't throw)
    console.warn("Unknown webhook event type, skipping:", parsed.error.message);
    return;
  }

  const event = parsed.data;
  const handler = handlers[event.type] as (
    data: WebhookEvent["data"],
  ) => Promise<void>;
  await handler(event.data);
}

export { routeWebhookEvent, WebhookEventSchema };
```

**Why good:** Zod validates the raw payload before routing, discriminated union ensures exhaustive handler coverage, each handler receives correctly typed `data`, unknown events are logged and skipped (not thrown)

### Bad Example - Switch statement without exhaustiveness

```typescript
// BAD: No type safety, easy to forget a case
async function routeEvent(event: {
  type: string;
  data: unknown;
}): Promise<void> {
  switch (event.type) {
    case "order.created":
      await handleOrderCreated(event.data);
      break;
    case "order.cancelled":
      await handleOrderCancelled(event.data);
      break;
    // BAD: "payment.completed" handler forgotten -- silently dropped
    default:
      break;
  }
}
```

**Why bad:** no compile-time enforcement of exhaustive handling, `data` is `unknown` requiring manual casting in every handler, adding a new event type does not cause a compile error

---

## Pattern 6: Complete Webhook Receiving Handler

Combining all patterns into a single cohesive handler.

### Good Example - Full receiving pipeline

```typescript
import type { IdempotencyStore } from "./idempotency.js";

const WEBHOOK_SECRET_ENV = "WEBHOOK_SECRET";

async function handleIncomingWebhook(
  request: Request,
  idempotencyStore: IdempotencyStore,
): Promise<Response> {
  // 1. Extract raw body before any parsing
  const rawBody = await request.text();

  // 2. Extract headers
  const webhookId = request.headers.get("webhook-id");
  const signature = request.headers.get("webhook-signature");
  const timestamp = request.headers.get("webhook-timestamp");

  if (!webhookId || !signature || !timestamp) {
    return new Response(
      JSON.stringify({ error: "Missing required webhook headers" }),
      { status: 400 },
    );
  }

  // 3. Verify signature (includes timestamp validation)
  const secret = process.env[WEBHOOK_SECRET_ENV];
  if (!secret)
    throw new Error(`Missing ${WEBHOOK_SECRET_ENV} environment variable`);

  const verification = verifyWebhookWithTimestamp(
    rawBody,
    signature,
    timestamp,
    secret,
  );
  if (!verification.valid) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
    });
  }

  // 4. Idempotency check
  const result = await processWebhookIdempotently(
    webhookId,
    idempotencyStore,
    async () => {
      // 5. Route to typed handler
      await routeWebhookEvent(rawBody);
    },
  );

  if (result.status === "duplicate") {
    // Return 200 for duplicates -- the producer should stop retrying
    return new Response(null, { status: 200 });
  }

  return new Response(null, { status: 200 });
}

export { handleIncomingWebhook };
```

**Why good:** follows the correct order (raw body -> headers -> verify -> idempotency -> route), returns 200 for duplicates (so the producer stops retrying), returns 400/401 for invalid requests, 200 for success
