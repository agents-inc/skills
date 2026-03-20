# Together AI SDK -- Setup & Configuration Examples

> Client initialization, environment config, production settings, error handling, and OpenAI compatibility. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [chat.md](chat.md) -- Chat Completions API
- [streaming.md](streaming.md) -- Streaming responses
- [tools.md](tools.md) -- Tool/function calling
- [structured-output.md](structured-output.md) -- Structured outputs with Zod
- [images.md](images.md) -- Image generation, embeddings

---

## Basic Client Setup

```typescript
// lib/together.ts
import Together from "together-ai";

// Reads TOGETHER_API_KEY from env automatically
const client = new Together();

export { client };
```

---

## Production Configuration

```typescript
// lib/together.ts
import Together from "together-ai";

const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

const client = new Together({
  apiKey: process.env.TOGETHER_API_KEY,
  timeout: TIMEOUT_MS,
  maxRetries: MAX_RETRIES,
});

export { client };
```

---

## Production Error Handling

```typescript
// error-handling.ts
import Together from "together-ai";

const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

const client = new Together({
  timeout: TIMEOUT_MS,
  maxRetries: MAX_RETRIES,
});

async function safeCompletion(prompt: string): Promise<string | null> {
  try {
    const completion = await client.chat.completions.create({
      model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: prompt },
      ],
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error("No content in response");
    }

    return content;
  } catch (error) {
    if (error instanceof Together.APIError) {
      console.error(`Together API Error [${error.status}]: ${error.message}`);

      if (error instanceof Together.RateLimitError) {
        console.error("Rate limited. SDK will auto-retry.");
        // If we get here, all retries were exhausted
        return null;
      }

      if (error instanceof Together.AuthenticationError) {
        throw new Error(
          "Invalid API key. Check TOGETHER_API_KEY environment variable.",
        );
      }

      if (error instanceof Together.BadRequestError) {
        console.error("Invalid request parameters:", error.message);
        return null;
      }

      if (error instanceof Together.InternalServerError) {
        console.error("Together server error after all retries");
        return null;
      }
    }

    // Network/connection errors
    if (error instanceof Together.APIConnectionError) {
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

## Error Type Hierarchy

```typescript
// Error class hierarchy:
// Together.APIError (base)
//   +-- Together.BadRequestError          (400)
//   +-- Together.AuthenticationError      (401)
//   +-- Together.PermissionDeniedError    (403)
//   +-- Together.NotFoundError            (404)
//   +-- Together.UnprocessableEntityError (422)
//   +-- Together.RateLimitError           (429)
//   +-- Together.InternalServerError      (>=500)
//   +-- Together.APIConnectionError       (network)
```

---

## OpenAI SDK Compatibility

Use the OpenAI SDK with Together AI by swapping the base URL.

```typescript
// lib/together-openai.ts
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.TOGETHER_API_KEY,
  baseURL: "https://api.together.xyz/v1",
});

// Use exactly like OpenAI SDK, but with Together model IDs
const completion = await client.chat.completions.create({
  model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Hello!" },
  ],
});

console.log(completion.choices[0].message.content);
export { client };
```

---

## Per-Request Overrides

```typescript
// Override retries and timeout for a single request
await client.chat.completions.create(
  {
    model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    messages: [{ role: "user", content: "Hello" }],
  },
  {
    maxRetries: 5,
    timeout: 60_000,
    signal: abortController.signal,
    headers: { "X-Custom-Header": "value" },
  },
);
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
    {
      model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      messages: [{ role: "user", content: "Hello" }],
    },
    { signal: controller.signal },
  );
} catch (error) {
  if (error instanceof Error && error.name === "AbortError") {
    console.log("Request was cancelled");
  }
}
```

---

## Raw Response Access

```typescript
// Get underlying Response object
const response = await client.chat.completions
  .create({
    model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    messages: [{ role: "user", content: "Hello" }],
  })
  .asResponse();

console.log(response.status);
console.log(response.headers.get("x-request-id"));

// Or get both data and response
const { data, response: raw } = await client.chat.completions
  .create({
    model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    messages: [{ role: "user", content: "Hello" }],
  })
  .withResponse();
```

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
