# Email - Retry Logic Examples

> Retry patterns for handling transient email failures. See [SKILL.md](../SKILL.md) for core concepts and [core.md](core.md) for basic send pattern.

---

## Pattern 1: Retry Constants

Define retry configuration as named constants.

```typescript
// lib/email/constants.ts
export const MAX_RETRY_ATTEMPTS = 3;
export const INITIAL_RETRY_DELAY_MS = 1000;
export const RETRY_BACKOFF_MULTIPLIER = 2;
```

---

## Pattern 2: Send with Exponential Backoff

Implement retry logic for temporary API failures.

```typescript
// lib/email/send-with-retry.ts
import { render } from "@react-email/components";

import {
  getResendClient,
  DEFAULT_FROM_ADDRESS,
  DEFAULT_FROM_NAME,
} from "@repo/emails";

import {
  MAX_RETRY_ATTEMPTS,
  INITIAL_RETRY_DELAY_MS,
  RETRY_BACKOFF_MULTIPLIER,
} from "./constants";

// Errors that are safe to retry
const RETRYABLE_ERRORS = [
  "rate_limit_exceeded",
  "internal_server_error",
  "service_unavailable",
];

interface SendWithRetryOptions {
  to: string | string[];
  subject: string;
  react: React.ReactElement;
  maxRetries?: number;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendEmailWithRetry(
  options: SendWithRetryOptions,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const resend = getResendClient();
  const maxRetries = options.maxRetries ?? MAX_RETRY_ATTEMPTS;

  let lastError: string | undefined;
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;

    try {
      const html = await render(options.react);

      const { data, error } = await resend.emails.send({
        from: `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_ADDRESS}>`,
        to: options.to,
        subject: options.subject,
        html,
      });

      if (error) {
        lastError = error.message;

        // Check if error is retryable
        const isRetryable = RETRYABLE_ERRORS.some((e) =>
          error.name?.toLowerCase().includes(e),
        );

        if (isRetryable && attempt < maxRetries) {
          const delay =
            INITIAL_RETRY_DELAY_MS *
            Math.pow(RETRY_BACKOFF_MULTIPLIER, attempt - 1);
          console.log(
            `[Email] Retry ${attempt}/${maxRetries} after ${delay}ms`,
          );
          await sleep(delay);
          continue;
        }

        return { success: false, error: error.message };
      }

      return { success: true, id: data?.id };
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Unknown error";

      if (attempt < maxRetries) {
        const delay =
          INITIAL_RETRY_DELAY_MS *
          Math.pow(RETRY_BACKOFF_MULTIPLIER, attempt - 1);
        console.log(`[Email] Retry ${attempt}/${maxRetries} after ${delay}ms`);
        await sleep(delay);
        continue;
      }
    }
  }

  return { success: false, error: lastError ?? "Max retries exceeded" };
}

// Named export
export { sendEmailWithRetry };
```

**Why good:** Exponential backoff prevents overwhelming the API, only retries transient errors, configurable retry count, logs retry attempts

---

## Retry Strategy Decision Tree

```
Is the error retryable?
+-- Rate limit --> Retry with exponential backoff
+-- Server error (5xx) --> Retry with backoff
+-- Invalid email --> Don't retry, log error
+-- Authentication error --> Don't retry, check API key
+-- Quota exceeded --> Don't retry, upgrade plan
```
