# Mistral SDK Quick Reference

> Client configuration, model IDs, API methods, error types, and SDK conventions. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Package Installation

```bash
# Core package (ESM-only)
npm install @mistralai/mistralai

# For structured outputs (recommended)
npm install zod
```

---

## Client Configuration

```typescript
import { Mistral } from "@mistralai/mistralai";

const client = new Mistral({
  apiKey: process.env["MISTRAL_API_KEY"] ?? "", // string or async () => Promise<string>
  timeoutMs: 30_000, // Request timeout in ms (default: -1 = no timeout)
  server: "eu", // Named server selection (default: "eu")
  serverURL: "https://custom-api.example.com", // Custom endpoint override
  retryConfig: {
    // Default: { strategy: "none" } -- NO RETRIES
    strategy: "backoff",
    backoff: {
      initialInterval: 1_000,
      maxInterval: 30_000,
      exponent: 1.5,
      maxElapsedTime: 120_000,
    },
    retryConnectionErrors: true,
  },
  debugLogger: console, // Enable debug logging (or set MISTRAL_DEBUG=true)
});
```

### Environment Variables

| Variable          | Purpose                       |
| ----------------- | ----------------------------- |
| `MISTRAL_API_KEY` | API key (required)            |
| `MISTRAL_DEBUG`   | Enable debug logging (`true`) |

### Configuration Priority

```
Request-level options (highest)
  -> Client initialization options
    -> Environment variables
      -> SDK defaults (lowest)
```

---

## Model IDs

### Language Models (Chat / Text Generation)

| Model ID                   | Alias                   | Use Case                       | Context |
| -------------------------- | ----------------------- | ------------------------------ | ------- |
| `mistral-large-3-25-12`    | `mistral-large-latest`  | Most capable, general purpose  | 256K    |
| `mistral-medium-3-1-25-08` | `mistral-medium-latest` | Balanced cost/performance      | 256K    |
| `mistral-small-4-0-26-03`  | `mistral-small-latest`  | Cost-efficient, vision-capable | 256K    |
| `ministral-3-14b-25-12`    | `ministral-14b-latest`  | Compact, multimodal            | 128K    |
| `ministral-3-8b-25-12`     | `ministral-8b-latest`   | Compact, multimodal            | 128K    |
| `ministral-3-3b-25-12`     | `ministral-3b-latest`   | Edge / minimal                 | 128K    |

### Reasoning Models

| Model ID                     | Alias                     | Use Case          |
| ---------------------------- | ------------------------- | ----------------- |
| `magistral-medium-1-2-25-09` | `magistral-medium-latest` | Complex reasoning |
| `magistral-small-1-2-25-09`  | `magistral-small-latest`  | Fast reasoning    |

### Code Models

| Model ID           | Alias              | Use Case                      |
| ------------------ | ------------------ | ----------------------------- |
| `codestral-25-08`  | `codestral-latest` | Code generation + FIM         |
| `devstral-2-25-12` | `devstral-latest`  | Code agents, codebase explore |

### Embedding Models

| Model ID                | Alias                    | Dimensions | Max Input   |
| ----------------------- | ------------------------ | ---------- | ----------- |
| `mistral-embed-23-12`   | `mistral-embed`          | 1024       | 8192 tokens |
| `codestral-embed-25-05` | `codestral-embed-latest` | 1024       | 8192 tokens |

### Specialist Models

| Model ID                        | Use Case            |
| ------------------------------- | ------------------- |
| `mistral-ocr-3-25-12`           | Document OCR        |
| `mistral-moderation-26-03`      | Content moderation  |
| `voxtral-mini-transcribe-26-02` | Audio transcription |

---

## API Methods Reference

### Chat Completions

```typescript
// Standard completion
const result = await client.chat.complete({
  model: "mistral-large-latest", // Required
  messages: [], // Required: ChatCompletionRequestMessage[]
  temperature: 0.7, // 0.0-1.5 (default: 0.7)
  maxTokens: 1000, // Max output tokens
  topP: 1, // Nucleus sampling (default: 1)
  frequencyPenalty: 0, // Penalize frequent tokens
  presencePenalty: 0, // Penalize present tokens
  tools: [], // Tool definitions
  toolChoice: "auto", // "auto" | "any" | "none" | "required"
  parallelToolCalls: true, // Allow parallel tool calls
  responseFormat: { type: "text" }, // "text" | "json_object"
  safePrompt: false, // Inject safety prompt
  stop: undefined, // string | string[] -- stop sequences
});

// Structured output parsing with Zod
const result = await client.chat.parse({
  model: "mistral-large-latest",
  messages: [],
  responseFormat: zodSchema, // Pass Zod schema directly
  maxTokens: 256,
  temperature: 0,
});

// Streaming
const result = await client.chat.stream({
  model: "mistral-large-latest",
  messages: [],
});

for await (const event of result) {
  // event.data.choices[0]?.delta?.content
}
```

### FIM (Fill-in-Middle)

```typescript
const result = await client.fim.complete({
  model: "codestral-latest", // Required
  prompt: "", // Code before cursor (required)
  suffix: "", // Code after cursor (optional)
  temperature: 0, // Sampling temperature
  maxTokens: 1000, // Max output tokens
  stop: undefined, // Stop sequences
});
```

### Embeddings

```typescript
const result = await client.embeddings.create({
  model: "mistral-embed", // Required
  inputs: [], // string[] (NOTE: plural 'inputs', not 'input')
});
```

### Agents

```typescript
const result = await client.agents.complete({
  agentId: "<id>", // Required: pre-configured agent ID
  messages: [], // Required
  responseFormat: { type: "text" },
});

// Streaming
const result = await client.agents.stream({
  agentId: "<id>",
  messages: [],
});
```

### Files

```typescript
import { openAsBlob } from "node:fs";

// Upload
const result = await client.files.upload({
  file: await openAsBlob("data.jsonl"),
});

// List, retrieve, delete
const files = await client.files.list();
const file = await client.files.retrieve({ fileId: "file-abc123" });
await client.files.delete({ fileId: "file-abc123" });
```

### Models

```typescript
const models = await client.models.list();
const model = await client.models.retrieve({ modelId: "mistral-large-latest" });
```

---

## Error Types

| Error Class           | Description                                |
| --------------------- | ------------------------------------------ |
| `SDKError`            | General API errors (4XX, 5XX status codes) |
| `SDKValidationError`  | Client-side input validation failure       |
| `HTTPValidationError` | Server-side validation (422)               |
| `ConnectionError`     | Network connectivity issues                |
| `RequestTimeoutError` | Request timeout exceeded                   |
| `RequestAbortedError` | Client-cancelled request                   |

```typescript
import {
  SDKError,
  SDKValidationError,
  HTTPValidationError,
} from "@mistralai/mistralai/models/errors";
```

---

## Retry Configuration

```typescript
// Global retry (at client init)
retryConfig: {
  strategy: "backoff", // "none" | "backoff"
  backoff: {
    initialInterval: 1_000,  // ms between first retry
    maxInterval: 30_000,     // ms max between retries
    exponent: 1.5,           // backoff multiplier
    maxElapsedTime: 120_000, // ms total retry window
  },
  retryConnectionErrors: true,
}

// Per-request retry override
await client.chat.complete(
  { model: "mistral-large-latest", messages: [...] },
  {
    retries: {
      strategy: "backoff",
      backoff: { initialInterval: 500, maxInterval: 5_000, exponent: 2, maxElapsedTime: 30_000 },
    },
  },
);
```

---

## Custom HTTP Client

```typescript
import { HTTPClient } from "@mistralai/mistralai/lib/http";

const httpClient = new HTTPClient({
  fetcher: (request) => fetch(request),
});

httpClient.addHook("beforeRequest", (request) => {
  const nextRequest = new Request(request, {
    signal: request.signal || AbortSignal.timeout(5_000),
  });
  nextRequest.headers.set("x-custom-header", "value");
  return nextRequest;
});

httpClient.addHook("requestError", (error, request) => {
  console.error(`Request failed: ${request.method} ${request.url}`, error);
});

const client = new Mistral({
  httpClient,
  apiKey: process.env["MISTRAL_API_KEY"] ?? "",
});
```

---

## SDK vs REST API Property Names

The SDK uses camelCase. The REST API uses snake_case. This table maps the most common properties:

| SDK (camelCase)     | REST API (snake_case) |
| ------------------- | --------------------- |
| `responseFormat`    | `response_format`     |
| `maxTokens`         | `max_tokens`          |
| `topP`              | `top_p`               |
| `toolChoice`        | `tool_choice`         |
| `toolCalls`         | `tool_calls`          |
| `parallelToolCalls` | `parallel_tool_calls` |
| `frequencyPenalty`  | `frequency_penalty`   |
| `presencePenalty`   | `presence_penalty`    |
| `safePrompt`        | `safe_prompt`         |
| `imageUrl`          | `image_url`           |
| `agentId`           | `agent_id`            |

---

## Standalone Functions (Tree-Shaking)

For browser/edge runtimes, import standalone functions to reduce bundle size:

```typescript
import { chatComplete } from "@mistralai/mistralai/funcs/chatComplete.js";
import { chatStream } from "@mistralai/mistralai/funcs/chatStream.js";
import { embeddingsCreate } from "@mistralai/mistralai/funcs/embeddingsCreate.js";

const res = await chatComplete(client, {
  model: "mistral-small-latest",
  messages: [{ role: "user", content: "Hello" }],
});

if (res.ok) {
  console.log(res.value);
}
```

---

## Message Roles

| Role        | Description                                            |
| ----------- | ------------------------------------------------------ |
| `system`    | System instruction (behavior guidance)                 |
| `user`      | User input                                             |
| `assistant` | Model response                                         |
| `tool`      | Tool result (requires `name`, `content`, `toolCallId`) |
