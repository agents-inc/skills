# Anthropic SDK -- Setup & Configuration Examples

> Client initialization, production config, error handling, multi-turn conversations, token counting, and structured outputs. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [streaming.md](streaming.md) -- Streaming responses
- [tool-use.md](tool-use.md) -- Tool/function calling
- [vision-documents.md](vision-documents.md) -- Images and PDFs
- [extended-thinking.md](extended-thinking.md) -- Extended thinking

---

## Basic Client Setup

```typescript
// lib/anthropic.ts
import Anthropic from "@anthropic-ai/sdk";

// Reads ANTHROPIC_API_KEY from env automatically
const client = new Anthropic();

export { client };
```

---

## Production Configuration

```typescript
// lib/anthropic.ts
import Anthropic from "@anthropic-ai/sdk";

const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: TIMEOUT_MS,
  maxRetries: MAX_RETRIES,
});

export { client };
```

---

## Per-Request Overrides

```typescript
const LONG_TIMEOUT_MS = 120_000;
const EXTRA_RETRIES = 5;

// Override retries, timeout, and abort for a single request
await client.messages.create(
  {
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: "Hello" }],
  },
  {
    maxRetries: EXTRA_RETRIES,
    timeout: LONG_TIMEOUT_MS,
    signal: abortController.signal,
    headers: { "X-Custom-Header": "value" },
  },
);
```

---

## Basic Messages API

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const MAX_TOKENS = 1024;

const message = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  messages: [{ role: "user", content: "Hello, Claude!" }],
});

// Always iterate content blocks -- never assume a single text block
for (const block of message.content) {
  if (block.type === "text") {
    console.log(block.text);
  }
}
```

---

## System Prompts

```typescript
const MAX_TOKENS = 1024;

// String system prompt
const message = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  system: "You are a helpful coding assistant. Respond concisely.",
  messages: [{ role: "user", content: "What is a closure in JavaScript?" }],
});

// Array system prompt (for caching or multi-part instructions)
const messageWithCache = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  system: [
    { type: "text", text: "You are a legal document analyst." },
    {
      type: "text",
      text: largeLegalDocument,
      cache_control: { type: "ephemeral" },
    },
  ],
  messages: [{ role: "user", content: "Summarize the key liability clauses." }],
});
```

---

## Multi-Turn Conversations

```typescript
import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

const client = new Anthropic();
const MAX_TOKENS = 1024;

// Build conversation history explicitly
const messages: MessageParam[] = [
  { role: "user", content: "My name is Alex. I work on machine learning." },
  {
    role: "assistant",
    content: "Nice to meet you, Alex! How can I help with your ML work today?",
  },
  { role: "user", content: "What did I say I work on?" },
];

const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  messages,
});

// To continue, include the FULL assistant response in history
// The assistant content is an array of content blocks -- include all of them
messages.push({ role: "assistant", content: response.content });
messages.push({ role: "user", content: "Tell me more about that." });
```

**Why this matters:** Multi-turn conversations require you to include the complete assistant response (all content blocks, not just text) in conversation history. Omitting `tool_use` or `thinking` blocks breaks continuity.

---

## Token Counting (Pre-Request Estimation)

```typescript
const MAX_TOKENS = 4096;

const tokenCount = await client.messages.countTokens({
  model: "claude-sonnet-4-6",
  messages: [
    { role: "user", content: "Analyze this document: " + documentText },
  ],
  system: "You are a document analyst.",
});

console.log("Input tokens:", tokenCount.input_tokens);

// Use for cost estimation before committing to a request
const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  messages: [
    { role: "user", content: "Analyze this document: " + documentText },
  ],
  system: "You are a document analyst.",
});

// Track actual usage after response
console.log("Actual input:", response.usage.input_tokens);
console.log("Actual output:", response.usage.output_tokens);
```

---

## Structured Outputs with Zod

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const client = new Anthropic();
const MAX_TOKENS = 1024;

const CalendarEvent = z.object({
  name: z.string(),
  date: z.string(),
  participants: z.array(z.string()),
  location: z.string().optional(),
});

const response = await client.messages.parse({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  messages: [
    {
      role: "user",
      content:
        "Extract event details: Team standup with Alice and Bob next Tuesday at 10am in Room 3.",
    },
  ],
  output_config: { format: zodOutputFormat(CalendarEvent) },
});

// Fully typed: { name, date, participants, location? }
const event = response.parsed_output;
if (event) {
  console.log(`Event: ${event.name} on ${event.date}`);
  console.log(`Participants: ${event.participants.join(", ")}`);
}
```

---

## Structured Outputs with Raw JSON Schema

```typescript
const MAX_TOKENS = 1024;

const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  messages: [
    {
      role: "user",
      content: "Extract: John Smith, john@example.com, wants Enterprise plan",
    },
  ],
  output_config: {
    format: {
      type: "json_schema",
      schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          email: { type: "string" },
          plan: { type: "string" },
        },
        required: ["name", "email", "plan"],
        additionalProperties: false,
      },
    },
  },
});

const textBlock = response.content.find((block) => block.type === "text");
if (textBlock && textBlock.type === "text") {
  const parsed = JSON.parse(textBlock.text);
  console.log(parsed);
}
```

---

## Production Error Handling

```typescript
import Anthropic from "@anthropic-ai/sdk";

const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const MAX_TOKENS = 1024;

const client = new Anthropic({
  timeout: TIMEOUT_MS,
  maxRetries: MAX_RETRIES,
});

async function safeCompletion(prompt: string): Promise<string | null> {
  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
    });

    // Check for truncation
    if (message.stop_reason === "max_tokens") {
      console.warn("Response was truncated -- increase max_tokens");
    }

    const textBlock = message.content.find((b) => b.type === "text");
    return textBlock?.type === "text" ? textBlock.text : null;
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(`Anthropic API Error [${error.status}]: ${error.message}`);

      if (error instanceof Anthropic.RateLimitError) {
        // If we reach here, all 2 default retries were exhausted
        console.error("Rate limited after all retries");
        return null;
      }

      if (error instanceof Anthropic.AuthenticationError) {
        throw new Error(
          "Invalid API key. Check ANTHROPIC_API_KEY environment variable.",
        );
      }

      if (error instanceof Anthropic.BadRequestError) {
        console.error("Invalid request parameters:", error.message);
        return null;
      }

      // Server errors (5xx) / overloaded (529)
      if (error instanceof Anthropic.InternalServerError) {
        console.error("Server error after all retries");
        return null;
      }
    }

    // Network/connection errors
    if (error instanceof Anthropic.APIConnectionError) {
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
// Anthropic.APIError (base)
//   +-- Anthropic.BadRequestError           (400)
//   +-- Anthropic.AuthenticationError       (401)
//   +-- Anthropic.PermissionDeniedError     (403)
//   +-- Anthropic.NotFoundError             (404)
//   +-- Anthropic.ConflictError             (409) -- auto-retried
//   +-- Anthropic.UnprocessableEntityError  (422)
//   +-- Anthropic.RateLimitError            (429) -- auto-retried
//   +-- Anthropic.InternalServerError       (>=500) -- auto-retried
//   +-- Anthropic.APIConnectionError        (network) -- auto-retried
//       +-- Anthropic.APIConnectionTimeoutError (timeout) -- auto-retried
//
// Additional:
//   +-- OverloadedError                     (529) -- auto-retried
//   +-- GatewayTimeoutError
```

---

## Request Cancellation with AbortController

```typescript
const controller = new AbortController();
const ABORT_TIMEOUT_MS = 10_000;

// Cancel after timeout
setTimeout(() => controller.abort(), ABORT_TIMEOUT_MS);

try {
  const message = await client.messages.create(
    {
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: "Write a long essay." }],
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

## Batch API

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const MAX_TOKENS = 1024;

// Create a batch of requests (50% cost discount, 24h completion window)
const batch = await client.messages.batches.create({
  requests: [
    {
      custom_id: "summary-1",
      params: {
        model: "claude-sonnet-4-6",
        max_tokens: MAX_TOKENS,
        messages: [{ role: "user", content: "Summarize: " + article1 }],
      },
    },
    {
      custom_id: "summary-2",
      params: {
        model: "claude-sonnet-4-6",
        max_tokens: MAX_TOKENS,
        messages: [{ role: "user", content: "Summarize: " + article2 }],
      },
    },
  ],
});

console.log("Batch ID:", batch.id);
console.log("Status:", batch.processing_status);

// Poll for completion
const status = await client.messages.batches.retrieve(batch.id);
if (status.processing_status === "ended") {
  const results = await client.messages.batches.results(batch.id);
  for await (const result of results) {
    console.log(`${result.custom_id}:`, result.result);
  }
}
```

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
