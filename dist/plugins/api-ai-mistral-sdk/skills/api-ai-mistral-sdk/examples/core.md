# Mistral SDK -- Setup & Configuration Examples

> Client initialization, environment config, production settings, error handling, custom HTTP client, and retry configuration. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [chat.md](chat.md) -- Chat completions and streaming
- [structured-output.md](structured-output.md) -- Structured outputs with Zod
- [function-calling.md](function-calling.md) -- Tool/function calling
- [embeddings-vision.md](embeddings-vision.md) -- Embeddings and vision
- [codestral.md](codestral.md) -- Codestral FIM code completion

---

## Basic Client Setup

```typescript
// lib/mistral.ts
import { Mistral } from "@mistralai/mistralai";

// Reads MISTRAL_API_KEY from env
const client = new Mistral({
  apiKey: process.env["MISTRAL_API_KEY"] ?? "",
});

export { client };
```

---

## Production Configuration

```typescript
// lib/mistral.ts
import { Mistral } from "@mistralai/mistralai";

const TIMEOUT_MS = 30_000;
const INITIAL_RETRY_INTERVAL_MS = 1_000;
const MAX_RETRY_INTERVAL_MS = 30_000;
const RETRY_EXPONENT = 1.5;
const MAX_ELAPSED_TIME_MS = 120_000;

const client = new Mistral({
  apiKey: process.env["MISTRAL_API_KEY"] ?? "",
  timeoutMs: TIMEOUT_MS,
  retryConfig: {
    strategy: "backoff",
    backoff: {
      initialInterval: INITIAL_RETRY_INTERVAL_MS,
      maxInterval: MAX_RETRY_INTERVAL_MS,
      exponent: RETRY_EXPONENT,
      maxElapsedTime: MAX_ELAPSED_TIME_MS,
    },
    retryConnectionErrors: true,
  },
});

export { client };
```

**Why good:** Explicit retry config (SDK defaults to zero retries), named constants, sensible backoff curve

---

## Async API Key Provider

```typescript
// lib/mistral.ts -- dynamic key rotation
import { Mistral } from "@mistralai/mistralai";

const client = new Mistral({
  apiKey: async () => {
    // Fetch from secrets manager, vault, or key rotation service
    return await getSecureApiKey();
  },
  timeoutMs: 30_000,
});

export { client };
```

**Why good:** Supports key rotation without restarting the process -- the SDK calls the function before each request

---

## Custom HTTP Client with Hooks

```typescript
// lib/mistral.ts -- custom HTTP client
import { Mistral } from "@mistralai/mistralai";
import { HTTPClient } from "@mistralai/mistralai/lib/http";

const REQUEST_TIMEOUT_MS = 10_000;

const httpClient = new HTTPClient({
  fetcher: (request) => fetch(request),
});

// Add timeout to every request
httpClient.addHook("beforeRequest", (request) => {
  const nextRequest = new Request(request, {
    signal: request.signal || AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  nextRequest.headers.set("x-custom-header", "custom-value");
  return nextRequest;
});

// Log errors
httpClient.addHook("requestError", (error, request) => {
  console.error(
    `Mistral request failed: ${request.method} ${request.url}`,
    error,
  );
});

const client = new Mistral({
  httpClient,
  apiKey: process.env["MISTRAL_API_KEY"] ?? "",
});

export { client };
```

---

## Production Error Handling

```typescript
// error-handling.ts
import { Mistral } from "@mistralai/mistralai";
import {
  SDKError,
  SDKValidationError,
  HTTPValidationError,
} from "@mistralai/mistralai/models/errors";

const TIMEOUT_MS = 30_000;

const client = new Mistral({
  apiKey: process.env["MISTRAL_API_KEY"] ?? "",
  timeoutMs: TIMEOUT_MS,
  retryConfig: {
    strategy: "backoff",
    backoff: {
      initialInterval: 1_000,
      maxInterval: 30_000,
      exponent: 1.5,
      maxElapsedTime: 60_000,
    },
    retryConnectionErrors: true,
  },
});

async function safeCompletion(prompt: string): Promise<string | null> {
  try {
    const result = await client.chat.complete({
      model: "mistral-large-latest",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: prompt },
      ],
    });

    const content = result?.choices?.[0]?.message?.content;
    if (!content) {
      console.warn("No content in response");
      return null;
    }

    // Log token usage for cost tracking
    if (result.usage) {
      console.log(
        `Tokens: prompt=${result.usage.promptTokens}, completion=${result.usage.completionTokens}, total=${result.usage.totalTokens}`,
      );
    }

    return typeof content === "string" ? content : content.join("");
  } catch (error) {
    if (error instanceof HTTPValidationError) {
      // 422 -- invalid request shape
      console.error("Validation error:", error.message);
      return null;
    }

    if (error instanceof SDKValidationError) {
      // Client-side input validation failure
      console.error("Input validation error:", error.message);
      return null;
    }

    if (error instanceof SDKError) {
      // General API error (4xx, 5xx)
      console.error(`API error [${error.statusCode}]: ${error.message}`);

      if (error.statusCode === 401) {
        throw new Error(
          "Invalid API key. Check MISTRAL_API_KEY environment variable.",
        );
      }

      if (error.statusCode === 429) {
        console.error("Rate limited. Retries exhausted.");
        return null;
      }

      return null;
    }

    // Unknown errors should be re-thrown
    throw error;
  }
}

const result = await safeCompletion("Hello!");
if (result) {
  console.log(result);
} else {
  console.error("Failed to get completion");
}
```

---

## Per-Request Override

```typescript
// Override retries and timeout for a single request
const result = await client.chat.complete(
  {
    model: "mistral-large-latest",
    messages: [{ role: "user", content: "Quick question" }],
  },
  {
    retries: {
      strategy: "backoff",
      backoff: {
        initialInterval: 500,
        maxInterval: 5_000,
        exponent: 2,
        maxElapsedTime: 15_000,
      },
    },
    fetchOptions: {
      signal: AbortSignal.timeout(10_000),
    },
  },
);
```

---

## Debug Logging

```typescript
// Enable via environment variable
// MISTRAL_DEBUG=true node app.js

// Or via constructor
const client = new Mistral({
  apiKey: process.env["MISTRAL_API_KEY"] ?? "",
  debugLogger: console,
});

// Or with a custom logger
const client = new Mistral({
  apiKey: process.env["MISTRAL_API_KEY"] ?? "",
  debugLogger: {
    log: (msg: string) => logger.info(msg),
    error: (msg: string) => logger.error(msg),
    warn: (msg: string) => logger.warn(msg),
    debug: (msg: string) => logger.debug(msg),
  },
});
```

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
