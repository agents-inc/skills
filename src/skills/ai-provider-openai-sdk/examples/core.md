# OpenAI SDK -- Setup & Configuration Examples

> Client initialization, environment config, production settings, Azure OpenAI, error handling, and abort patterns. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [chat.md](chat.md) -- Chat Completions API
- [streaming.md](streaming.md) -- Streaming responses
- [tools.md](tools.md) -- Tool/function calling
- [structured-output.md](structured-output.md) -- Structured outputs with Zod
- [embeddings-vision-audio.md](embeddings-vision-audio.md) -- Embeddings, vision, audio

---

## Basic Client Setup

```typescript
// lib/openai.ts
import OpenAI from "openai";

// Reads OPENAI_API_KEY from env automatically
const client = new OpenAI();

export { client };
```

---

## Production Configuration

```typescript
// lib/openai.ts
import OpenAI from "openai";

const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: TIMEOUT_MS,
  maxRetries: MAX_RETRIES,
});

export { client };
```

---

## Azure OpenAI

```typescript
// lib/azure-openai.ts
import { AzureOpenAI } from "openai";

const azureClient = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  apiVersion: "2024-10-21",
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
});

export { azureClient };
```

---

## Production Error Handling

```typescript
// error-handling.ts
import OpenAI from "openai";

const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

const client = new OpenAI({
  timeout: TIMEOUT_MS,
  maxRetries: MAX_RETRIES,
});

async function safeCompletion(prompt: string): Promise<string | null> {
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "developer", content: "You are a helpful assistant." },
        { role: "user", content: prompt },
      ],
    });

    // Check for truncation
    if (completion.choices[0].finish_reason === "length") {
      console.warn("Response was truncated");
    }

    return completion.choices[0].message.content;
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      console.error(`OpenAI API Error [${error.status}]: ${error.message}`);
      console.error(`Request ID: ${error.request_id}`);

      if (error instanceof OpenAI.RateLimitError) {
        console.error("Rate limited. SDK will auto-retry.");
        // If we get here, all retries were exhausted
        return null;
      }

      if (error instanceof OpenAI.AuthenticationError) {
        throw new Error(
          "Invalid API key. Check OPENAI_API_KEY environment variable.",
        );
      }

      if (error instanceof OpenAI.BadRequestError) {
        console.error("Invalid request parameters:", error.message);
        return null;
      }

      // Server errors (5xx) -- SDK auto-retries, if we're here all retries failed
      if (error instanceof OpenAI.InternalServerError) {
        console.error("OpenAI server error after all retries");
        return null;
      }
    }

    // Network/connection errors
    if (error instanceof OpenAI.APIConnectionError) {
      console.error("Network error:", error.message);
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

## Stream Error Handling

```typescript
const stream = client.chat.completions.stream({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello" }],
});

stream.on("error", (error) => {
  if (error instanceof OpenAI.APIError) {
    console.error(`Stream API error: ${error.status}`);
  } else {
    console.error("Stream connection error:", error);
  }
});

stream.on("content", (delta) => {
  process.stdout.write(delta);
});

await stream.finalContent();
```

---

## Request Cancellation with AbortController

```typescript
const controller = new AbortController();
const ABORT_TIMEOUT_MS = 5_000;

// Cancel after timeout
setTimeout(() => controller.abort(), ABORT_TIMEOUT_MS);

try {
  const completion = await client.chat.completions.create(
    { model: "gpt-4o", messages: [{ role: "user", content: "Hello" }] },
    { signal: controller.signal },
  );
} catch (error) {
  if (error instanceof Error && error.name === "AbortError") {
    console.log("Request was cancelled");
  }
}
```

---

_For core concepts, see [SKILL.md](../SKILL.md). For per-request overrides, request ID tracking, and error type tables, see [reference.md](../reference.md)._
