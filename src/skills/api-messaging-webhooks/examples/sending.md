# Webhooks - Sending Patterns

> Patterns for sending webhooks with signing, retry, and delivery tracking. See [SKILL.md](../SKILL.md) for decision frameworks and [core.md](core.md) for receiving patterns.

---

## Pattern 1: Signing Outbound Webhooks

Sign every outbound webhook with HMAC-SHA256. Include a unique ID and timestamp in the headers so the consumer can verify authenticity and prevent replays.

### Good Example - Signing with Standard Webhooks headers

```typescript
import { createHmac, randomUUID } from "node:crypto";

const SIGNATURE_ALGORITHM = "sha256";
const SIGNATURE_ENCODING = "hex";
const MS_PER_SECOND = 1000;

interface SignedWebhook {
  headers: Record<string, string>;
  body: string;
}

function signWebhookPayload(payload: object, secret: string): SignedWebhook {
  const body = JSON.stringify(payload);
  const webhookId = randomUUID();
  const timestamp = Math.floor(Date.now() / MS_PER_SECOND).toString();

  // Sign "timestamp.body" -- consumer verifies the same way
  const signedContent = `${timestamp}.${body}`;
  const signature = createHmac(SIGNATURE_ALGORITHM, secret)
    .update(signedContent)
    .digest(SIGNATURE_ENCODING);

  return {
    headers: {
      "webhook-id": webhookId,
      "webhook-timestamp": timestamp,
      "webhook-signature": signature,
      "content-type": "application/json",
    },
    body,
  };
}

export { signWebhookPayload };
export type { SignedWebhook };
```

**Why good:** follows Standard Webhooks header convention (`webhook-id`, `webhook-timestamp`, `webhook-signature`), signs `timestamp.body` for replay protection, unique ID enables idempotency on the consumer side, JSON serialized once (same bytes for signing and sending)

### Bad Example - No signing, no metadata headers

```typescript
// BAD: No authentication -- consumer cannot verify the request came from you
async function sendWebhook(url: string, payload: object): Promise<void> {
  await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}
```

**Why bad:** no signature means the consumer cannot verify authenticity, no webhook-id means the consumer cannot deduplicate, no timestamp means no replay protection

---

## Pattern 2: Exponential Backoff with Jitter

Retry failed deliveries with increasing delays. Jitter prevents all retries from hitting the server at the same instant.

### Good Example - Configurable retry with backoff

```typescript
const DEFAULT_MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 3_600_000; // 1 hour cap

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: DEFAULT_MAX_RETRIES,
  baseDelayMs: BASE_DELAY_MS,
  maxDelayMs: MAX_DELAY_MS,
};

/**
 * Calculate delay for a given attempt number.
 * Formula: min(baseDelay * 2^attempt, maxDelay) + random jitter
 */
function calculateRetryDelay(attempt: number, config: RetryConfig): number {
  const exponential = config.baseDelayMs * Math.pow(2, attempt);
  const capped = Math.min(exponential, config.maxDelayMs);
  const jitter = Math.random() * config.baseDelayMs;
  return capped + jitter;
}

export { calculateRetryDelay, DEFAULT_RETRY_CONFIG };
export type { RetryConfig };
```

**Why good:** exponential growth gives failing endpoints recovery time, cap prevents delays growing to days, jitter spreads retries across time (prevents thundering herd), configurable per-subscriber

### Retry Schedule Example

With default config (`baseDelayMs: 1000`):

| Attempt | Base Delay | + Jitter (0-1s) | Total Range |
| ------- | ---------- | --------------- | ----------- |
| 0       | 1s         | 0-1s            | 1-2s        |
| 1       | 2s         | 0-1s            | 2-3s        |
| 2       | 4s         | 0-1s            | 4-5s        |
| 3       | 8s         | 0-1s            | 8-9s        |
| 4       | 16s        | 0-1s            | 16-17s      |

---

## Pattern 3: Status Code Classification

Not all failures should be retried. Classify HTTP responses to decide the correct action.

### Good Example - Retriable vs permanent failure

```typescript
type DeliveryAction = "success" | "retry" | "dead-letter" | "disable-endpoint";

const HTTP_OK_MIN = 200;
const HTTP_OK_MAX = 299;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const HTTP_GONE = 410;
const HTTP_UNPROCESSABLE = 422;
const HTTP_RATE_LIMITED = 429;

function classifyDeliveryResult(statusCode: number): DeliveryAction {
  // 2xx -- success
  if (statusCode >= HTTP_OK_MIN && statusCode <= HTTP_OK_MAX) {
    return "success";
  }

  // Permanent client errors -- don't retry, move to DLQ
  const permanentFailures = [
    HTTP_BAD_REQUEST,
    HTTP_UNAUTHORIZED,
    HTTP_NOT_FOUND,
    HTTP_UNPROCESSABLE,
  ];
  if (permanentFailures.includes(statusCode)) {
    return "dead-letter";
  }

  // 410 Gone -- the endpoint is permanently removed
  if (statusCode === HTTP_GONE) {
    return "disable-endpoint";
  }

  // Everything else (429, 5xx, timeouts) -- retry with backoff
  return "retry";
}

export { classifyDeliveryResult };
export type { DeliveryAction };
```

**Why good:** separates retriable from permanent failures, 410 triggers endpoint disabling (not just DLQ), avoids wasting retries on requests that will never succeed

---

## Pattern 4: Complete Webhook Delivery Pipeline

Combining signing, delivery, retry, and dead letter queue into a delivery function.

### Good Example - Full delivery pipeline

```typescript
import type { RetryConfig } from "./retry.js";
import type { DeliveryAction } from "./status.js";

const DELIVERY_TIMEOUT_MS = 30_000; // 30 seconds

interface DeliveryResult {
  webhookId: string;
  delivered: boolean;
  attempts: number;
  lastStatusCode?: number;
  lastError?: string;
}

interface DeadLetterEntry {
  webhookId: string;
  targetUrl: string;
  payload: string;
  signature: string;
  lastAttempt: Date;
  totalAttempts: number;
  lastStatusCode?: number;
  lastError: string;
}

// Storage interfaces -- implement with your chosen data store
interface DeliveryStore {
  recordDelivery(result: DeliveryResult): Promise<void>;
}

interface DeadLetterStore {
  enqueue(entry: DeadLetterEntry): Promise<void>;
}

async function deliverWebhook(
  targetUrl: string,
  payload: object,
  secret: string,
  config: RetryConfig,
  deliveryStore: DeliveryStore,
  deadLetterStore: DeadLetterStore,
): Promise<DeliveryResult> {
  const signed = signWebhookPayload(payload, secret);
  const webhookId = signed.headers["webhook-id"];

  let lastStatusCode: number | undefined;
  let lastError: string | undefined;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    // Wait before retry (not on first attempt)
    if (attempt > 0) {
      const delay = calculateRetryDelay(attempt - 1, config);
      await sleep(delay);
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

      const response = await fetch(targetUrl, {
        method: "POST",
        headers: signed.headers,
        body: signed.body,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      lastStatusCode = response.status;

      const action = classifyDeliveryResult(response.status);

      if (action === "success") {
        const result: DeliveryResult = {
          webhookId,
          delivered: true,
          attempts: attempt + 1,
          lastStatusCode,
        };
        await deliveryStore.recordDelivery(result);
        return result;
      }

      if (action === "dead-letter" || action === "disable-endpoint") {
        // Permanent failure -- stop retrying
        break;
      }

      // action === "retry" -- continue loop
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown error";
    }
  }

  // All retries exhausted or permanent failure -- dead letter queue
  await deadLetterStore.enqueue({
    webhookId,
    targetUrl,
    payload: signed.body,
    signature: signed.headers["webhook-signature"],
    lastAttempt: new Date(),
    totalAttempts: config.maxRetries + 1,
    lastStatusCode,
    lastError: lastError ?? `HTTP ${lastStatusCode}`,
  });

  const result: DeliveryResult = {
    webhookId,
    delivered: false,
    attempts: config.maxRetries + 1,
    lastStatusCode,
    lastError,
  };

  await deliveryStore.recordDelivery(result);
  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { deliverWebhook };
export type { DeliveryResult, DeadLetterEntry, DeliveryStore, DeadLetterStore };
```

**Why good:** complete pipeline with signing, timeout, retry classification, exponential backoff, dead letter queue, and delivery tracking. Storage abstracted behind interfaces. Permanent failures break out of the retry loop immediately.

---

## Pattern 5: Handling Rate Limits (429)

When the consumer sends `Retry-After`, respect that value instead of using your own backoff.

### Good Example - Respecting Retry-After header

```typescript
const FALLBACK_RETRY_AFTER_SECONDS = 60;
const MS_PER_SECOND = 1000;

/**
 * Extract retry delay from a 429 response.
 * Supports both "seconds" and "HTTP-date" formats per RFC 7231.
 */
function getRetryAfterMs(response: Response): number {
  const retryAfter = response.headers.get("retry-after");

  if (!retryAfter) {
    return FALLBACK_RETRY_AFTER_SECONDS * MS_PER_SECOND;
  }

  // Try as integer (seconds)
  const seconds = parseInt(retryAfter, 10);
  if (!Number.isNaN(seconds)) {
    return seconds * MS_PER_SECOND;
  }

  // Try as HTTP-date
  const date = new Date(retryAfter);
  if (!Number.isNaN(date.getTime())) {
    const delayMs = date.getTime() - Date.now();
    return Math.max(0, delayMs);
  }

  return FALLBACK_RETRY_AFTER_SECONDS * MS_PER_SECOND;
}

export { getRetryAfterMs };
```

**Why good:** handles both RFC 7231 formats (seconds and HTTP-date), provides a sensible fallback when header is missing, `Math.max(0, ...)` prevents negative delays if the date is in the past
