# Anthropic SDK Quick Reference

> Client configuration, model IDs, API methods, error types, streaming events, and content block types. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Package Installation

```bash
# Core package (always required)
npm install @anthropic-ai/sdk

# For structured outputs (optional but recommended)
npm install zod
```

Requires **Node.js 18+**.

---

## Client Configuration

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY, // Auto-reads from env if not set
  timeout: 30_000, // Request timeout in ms (default: 600_000 = 10 min)
  maxRetries: 3, // Retry count on 429/529/5xx (default: 2)
  baseURL: "https://api.anthropic.com", // Override for proxies
});
```

### Environment Variables

| Variable            | Purpose                 |
| ------------------- | ----------------------- |
| `ANTHROPIC_API_KEY` | API key (auto-detected) |

---

## Model IDs

### Language Models

| Model               | Use Case                        | Context Window | Max Output |
| ------------------- | ------------------------------- | -------------- | ---------- |
| `claude-opus-4-6`   | Most capable, complex reasoning | 1M             | 128K       |
| `claude-sonnet-4-6` | General purpose, best value     | 1M             | 64K        |
| `claude-haiku-4-5`  | Fast, cheap, high throughput    | 200K           | 64K        |
| `claude-opus-4-5`   | Previous gen most capable       | 200K           | 64K        |
| `claude-sonnet-4-5` | Previous gen general purpose    | 200K           | 64K        |

### Dated Model Variants

Use dated variants for reproducibility (e.g., `claude-sonnet-4-5-20250929`, `claude-opus-4-5-20251101`). Check the [Models API](https://docs.anthropic.com/en/docs/about-claude/models) for current dated variant IDs.

---

## API Methods Reference

### Messages API

```typescript
// Standard completion
const message = await client.messages.create({
  model: "claude-sonnet-4-6", // Required
  max_tokens: 1024, // Required (no default)
  messages: [], // Required: MessageParam[]
  system: "", // System prompt (string or ContentBlock[])
  temperature: 1.0, // 0-1 (default: 1)
  top_p: undefined, // Nucleus sampling (alternative to temperature)
  top_k: undefined, // Top-k sampling
  tools: [], // Tool[] for function calling
  tool_choice: { type: "auto" }, // 'auto' | 'any' | 'none' | { type: 'tool', name: string }
  thinking: undefined, // { type: 'adaptive' } (4.6) or { type: 'enabled', budget_tokens: N } (older)
  stop_sequences: [], // string[] -- custom stop sequences
  metadata: { user_id: "..." }, // End-user tracking
  output_config: undefined, // { format: zodOutputFormat(schema) } for structured outputs
});

// Structured output parsing
const parsed = await client.messages.parse({
  model: "claude-sonnet-4-6",
  max_tokens: 1024,
  messages: [],
  output_config: { format: zodOutputFormat(schema) },
});

// Event-based streaming
const stream = client.messages.stream({
  model: "claude-sonnet-4-6",
  max_tokens: 1024,
  messages: [],
});

// Token counting (no generation)
const count = await client.messages.countTokens({
  model: "claude-sonnet-4-6",
  messages: [],
  system: "",
  tools: [],
});
// count.input_tokens -> number
```

### Message Batches

```typescript
// Create batch
const batch = await client.messages.batches.create({
  requests: [
    {
      custom_id: "request-1",
      params: {
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [{ role: "user", content: "Hello" }],
      },
    },
  ],
});

// Retrieve status
const status = await client.messages.batches.retrieve(batchId);

// List batches
const batches = await client.messages.batches.list({ limit: 10 });

// Get results
const results = await client.messages.batches.results(batchId);

// Cancel batch
await client.messages.batches.cancel(batchId);

// Delete batch
await client.messages.batches.delete(batchId);
```

### Models

```typescript
// List available models
const models = await client.models.list();

// Get specific model info
const model = await client.models.retrieve("claude-sonnet-4-6");
```

---

## Helper Functions

```typescript
// Structured output with Zod
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

// Creates output format config from Zod schema
zodOutputFormat(zodSchema);

// Raw JSON schema format
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
jsonSchemaOutputFormat(jsonSchema);
```

---

## Content Block Types

### Response Content Blocks

| Type       | TypeScript Type | Fields                                     |
| ---------- | --------------- | ------------------------------------------ |
| `text`     | `TextBlock`     | `.text` (string)                           |
| `tool_use` | `ToolUseBlock`  | `.id`, `.name`, `.input` (parsed JSON)     |
| `thinking` | `ThinkingBlock` | `.thinking` (string), `.signature` (token) |

### Input Content Blocks (User Messages)

| Type          | Description                |
| ------------- | -------------------------- |
| `text`        | Plain text                 |
| `image`       | Base64 or URL image        |
| `document`    | PDF or other document      |
| `tool_result` | Result from tool execution |

### Image Source Types

```typescript
// Base64
{ type: "base64", media_type: "image/jpeg", data: "..." }

// URL
{ type: "url", url: "https://example.com/image.jpg" }
```

Supported media types: `image/jpeg`, `image/png`, `image/gif`, `image/webp`

---

## Message Roles

| Role        | Description                                      |
| ----------- | ------------------------------------------------ |
| `user`      | User input (text, images, tool results)          |
| `assistant` | Model response (must include all content blocks) |

**Note:** There is no `system` role. System instructions use the top-level `system` parameter.

---

## Stop Reasons

| Value           | Meaning                    | Action Required                       |
| --------------- | -------------------------- | ------------------------------------- |
| `end_turn`      | Model finished naturally   | None -- response is complete          |
| `max_tokens`    | Hit `max_tokens` limit     | Response may be truncated             |
| `tool_use`      | Model wants to call a tool | Execute tool, send `tool_result` back |
| `stop_sequence` | Hit a custom stop sequence | Response ended at that point          |

---

## Error Types

| Error Class                 | HTTP Status | Auto-Retried? |
| --------------------------- | ----------- | ------------- |
| `BadRequestError`           | 400         | No            |
| `AuthenticationError`       | 401         | No            |
| `PermissionDeniedError`     | 403         | No            |
| `NotFoundError`             | 404         | No            |
| `ConflictError`             | 409         | Yes           |
| `UnprocessableEntityError`  | 422         | No            |
| `RateLimitError`            | 429         | Yes           |
| `InternalServerError`       | >= 500      | Yes           |
| `APIConnectionError`        | N/A         | Yes           |
| `APIConnectionTimeoutError` | N/A         | Yes           |

Also: `OverloadedError` (529, auto-retried), `GatewayTimeoutError`.

All errors extend `Anthropic.APIError` with properties: `.status`, `.message`, `.headers`.

---

## Streaming Events (`.stream()` Helper)

| Event          | Arguments                                        | Description                     |
| -------------- | ------------------------------------------------ | ------------------------------- |
| `connect`      | `()`                                             | Connection established          |
| `streamEvent`  | `(event: MessageStreamEvent, snapshot: Message)` | Raw SSE event with snapshot     |
| `text`         | `(textDelta: string, textSnapshot: string)`      | Text content delta              |
| `inputJson`    | `(partialJson: string, jsonSnapshot: unknown)`   | Tool input JSON delta           |
| `contentBlock` | `(content: ContentBlock)`                        | Content block done streaming    |
| `message`      | `(message: Message)`                             | Message done streaming          |
| `finalMessage` | `(message: Message)`                             | Final message (after `message`) |
| `error`        | `(error: AnthropicError)`                        | Stream error                    |
| `abort`        | `(error: APIUserAbortError)`                     | Stream aborted                  |
| `end`          | `()`                                             | Stream finished                 |

### Stream Methods

```typescript
await stream.finalMessage(); // Promise<Message> -- complete message
await stream.finalText(); // Promise<string> -- final text content
await stream.done(); // Promise<void> -- resolves when stream completes
stream.abort(); // Cancel stream and network request
stream.controller; // Underlying AbortController
stream.currentMessage; // Current accumulated message state
```

---

## Raw SSE Event Types (`stream: true`)

| Event Type            | Description                                       |
| --------------------- | ------------------------------------------------- |
| `message_start`       | Initial message metadata and `usage`              |
| `content_block_start` | Start of content block (text, tool_use, thinking) |
| `content_block_delta` | Content updates (see delta types below)           |
| `content_block_stop`  | End of content block                              |
| `message_delta`       | Final message updates (`stop_reason`, `usage`)    |
| `message_stop`        | Stream complete                                   |
| `ping`                | Keep-alive (no data)                              |

### Delta Types (within `content_block_delta`)

| Delta Type         | Field           | Description              |
| ------------------ | --------------- | ------------------------ |
| `text_delta`       | `.text`         | Text content chunk       |
| `input_json_delta` | `.partial_json` | Tool input JSON chunk    |
| `thinking_delta`   | `.thinking`     | Thinking text chunk      |
| `signature_delta`  | `.signature`    | Thinking signature chunk |

---

## Prompt Caching

### Cache Control Structure

```typescript
// 5-minute cache (default)
cache_control: { type: "ephemeral" }

// 1-hour cache (2x write cost, same 0.1x read cost)
cache_control: { type: "ephemeral", ttl: "1h" }
```

### Automatic Caching

```typescript
// Top-level cache_control auto-places breakpoint on last cacheable block
const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 1024,
  cache_control: { type: "ephemeral" },
  system: "...",
  messages: [...],
});
```

### Cache Pricing

| Operation           | Cost Multiplier                    |
| ------------------- | ---------------------------------- |
| Cache write (5 min) | 1.25x base                         |
| Cache write (1 hr)  | 2x base                            |
| Cache read          | 0.1x base                          |
| Minimum cacheable   | 1024-4096 tokens (model-dependent) |

### Cache Usage Tracking

```typescript
response.usage.cache_creation_input_tokens; // Tokens written to cache
response.usage.cache_read_input_tokens; // Tokens read from cache
response.usage.input_tokens; // Non-cached input tokens
response.usage.output_tokens; // Output tokens
```

---

## Per-Request Overrides

```typescript
// Override retries, timeout, and signal for a single request
await client.messages.create(
  { model: "claude-sonnet-4-6", max_tokens: 1024, messages: [...] },
  {
    maxRetries: 5,
    timeout: 60_000,
    signal: abortController.signal,
    headers: { "X-Custom-Header": "value" },
  },
);
```

---

## Extended Thinking Configuration

```typescript
// Adaptive thinking (recommended for Opus 4.6 and Sonnet 4.6)
thinking: {
  type: "adaptive",
  display: "summarized", // "summarized" (default) | "omitted"
}

// With effort parameter (controls thinking depth)
thinking: { type: "adaptive" },
output_config: { effort: "high" }, // "max" (Opus only) | "high" (default) | "medium" | "low"

// Manual thinking (deprecated on 4.6 models, required on older models)
thinking: {
  type: "enabled",
  budget_tokens: 10_000, // Must be < max_tokens
  display: "summarized", // "summarized" (default) | "omitted"
}

// Disable thinking explicitly
thinking: { type: "disabled" }
```

**Note:** TypeScript SDK does not yet include `adaptive` in its type definitions. Use a type assertion:
`{ thinking: { type: "adaptive" } } as unknown as Anthropic.MessageCreateParamsNonStreaming`

### Constraints

- `budget_tokens` must be less than `max_tokens` (except with interleaved thinking)
- Only `tool_choice: "auto"` and `"none"` work with thinking enabled
- Cannot toggle thinking mid-turn during tool use loops
- Must pass `thinking` blocks unmodified in multi-turn history
- Adaptive mode automatically enables interleaved thinking (thinking between tool calls)
- Manual mode on Sonnet 4.6 supports interleaved thinking via the `interleaved-thinking-2025-05-14` beta header

---

## Token Usage Object

```typescript
message.usage.input_tokens; // Input tokens consumed
message.usage.output_tokens; // Output tokens generated
message.usage.cache_creation_input_tokens; // Cache write tokens (if caching)
message.usage.cache_read_input_tokens; // Cache read tokens (if caching)
```
