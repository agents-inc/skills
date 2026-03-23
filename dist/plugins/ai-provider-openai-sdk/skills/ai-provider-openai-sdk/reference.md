# OpenAI SDK Quick Reference

> Client configuration, model IDs, API methods, error types, and helper functions. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Package Installation

```bash
# Core package (always required)
npm install openai

# For structured outputs (optional but recommended)
npm install zod
```

---

## Client Configuration

```typescript
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Auto-reads from env if not set
  timeout: 30_000, // Request timeout in ms (default: 600_000 = 10 min)
  maxRetries: 3, // Retry count on 429/5xx (default: 2)
  baseURL: "https://api.openai.com/v1", // Override for proxies
  dangerouslyAllowBrowser: false, // Must be true for browser usage
});
```

### Environment Variables

| Variable          | Purpose                    |
| ----------------- | -------------------------- |
| `OPENAI_API_KEY`  | API key (auto-detected)    |
| `OPENAI_ORG_ID`   | Organization ID (optional) |
| `OPENAI_BASE_URL` | Custom base URL (optional) |

---

## Model IDs

### Language Models (Chat / Text Generation)

| Model         | Use Case                                  | Context Window | Notes                                  |
| ------------- | ----------------------------------------- | -------------- | -------------------------------------- |
| `gpt-5.4`     | Most capable, general purpose + reasoning | 1M             | Recommended for new projects           |
| `gpt-5-mini`  | Cost-optimized, balanced speed/quality    | 1M             | Replaces gpt-4o-mini for most uses     |
| `gpt-5-nano`  | High-throughput, straightforward tasks    | 1M             | Cheapest GPT-5 variant                 |
| `gpt-4o`      | General purpose, proven                   | 128K           | Still available, lower cost than GPT-5 |
| `gpt-4o-mini` | Fast, cheap, simple tasks                 | 128K           | Still available, migrate to gpt-5-mini |
| `o4-mini`     | Fast reasoning                            | 200K           | Use `max_completion_tokens`            |

### Embedding Models

| Model                    | Dimensions (default) | Max Input   |
| ------------------------ | -------------------- | ----------- |
| `text-embedding-3-small` | 1536                 | 8191 tokens |
| `text-embedding-3-large` | 3072                 | 8191 tokens |

### Audio Models

| Model                    | Type          | Use Case                    |
| ------------------------ | ------------- | --------------------------- |
| `whisper-1`              | Transcription | General speech-to-text      |
| `gpt-4o-mini-transcribe` | Transcription | Fewer hallucinations        |
| `gpt-4o-transcribe`      | Transcription | Higher accuracy             |
| `tts-1`                  | TTS           | Fast text-to-speech         |
| `tts-1-hd`               | TTS           | High-quality text-to-speech |
| `gpt-4o-mini-tts`        | TTS           | Voice instruction support   |

### TTS Voices

`alloy`, `ash`, `ballad`, `coral`, `echo`, `fable`, `nova`, `onyx`, `sage`, `shimmer`

---

## API Methods Reference

### Chat Completions API

```typescript
// Standard completion
const completion = await client.chat.completions.create({
  model: "gpt-4o", // Required
  messages: [], // Required: ChatCompletionMessageParam[]
  temperature: 0.7, // 0-2 (default: 1)
  max_tokens: 1000, // Max output tokens (use max_completion_tokens for reasoning models)
  top_p: 1, // Nucleus sampling
  frequency_penalty: 0, // -2 to 2
  presence_penalty: 0, // -2 to 2
  tools: [], // ChatCompletionTool[]
  tool_choice: "auto", // 'auto' | 'required' | 'none' | { type: 'function', function: { name: string } }
  response_format: undefined, // zodResponseFormat() or { type: 'json_object' }
  stream: false, // Enable streaming
  stop: undefined, // string | string[] -- stop sequences
  seed: undefined, // number -- for reproducibility
  logprobs: false, // Include log probabilities
  user: undefined, // End-user ID for abuse monitoring
});

// Structured output parsing
const parsed = await client.chat.completions.parse({
  model: "gpt-4o",
  messages: [],
  response_format: zodResponseFormat(schema, "name"),
});

// Event-based streaming
const stream = client.chat.completions.stream({
  model: "gpt-4o",
  messages: [],
});

// Automated tool execution
const runner = client.chat.completions.runTools({
  model: "gpt-4o",
  messages: [],
  tools: [],
  maxChatCompletions: 10, // Max tool call loops (default: 10)
});
```

### Responses API

```typescript
const response = await client.responses.create({
  model: "gpt-4o", // Required
  input: "", // Required: string or InputItem[]
  instructions: "", // System instruction (replaces 'developer' role)
  tools: [], // Built-in or function tools
  previous_response_id: "", // Chain conversations
  store: true, // Enable server-side state
  stream: false, // Enable streaming
  text: {
    // Structured output config
    format: zodTextFormat(schema, "name"),
  },
});

// Access helpers
response.output_text; // Direct text access
response.output; // Array of typed output Items
response.id; // Response ID for chaining
```

### Embeddings

```typescript
const response = await client.embeddings.create({
  model: "text-embedding-3-small", // Required
  input: "", // string or string[]
  dimensions: undefined, // Reduce dimensions (optional)
  encoding_format: "float", // 'float' | 'base64'
});
```

### Audio

```typescript
// Transcription
const transcription = await client.audio.transcriptions.create({
  model: "whisper-1", // Required
  file: readStream, // Required: ReadStream or File
  language: "en", // ISO 639-1 code
  response_format: "json", // 'json' | 'text' | 'srt' | 'vtt' | 'verbose_json'
  temperature: 0, // 0-1
  timestamp_granularities: [], // ['word', 'segment'] (verbose_json only)
});

// Text-to-Speech
const speech = await client.audio.speech.create({
  model: "tts-1", // Required
  voice: "alloy", // Required
  input: "", // Required: text to speak
  response_format: "mp3", // mp3, opus, aac, flac, wav, pcm
  speed: 1.0, // 0.25-4.0
  instructions: "", // Voice style (gpt-4o-mini-tts only)
});

// Translation (to English)
const translation = await client.audio.translations.create({
  model: "whisper-1",
  file: readStream,
});
```

### Files

```typescript
// Upload
const file = await client.files.create({
  file: readStream, // ReadStream | File | Response | toFile()
  purpose: "fine-tune", // 'fine-tune' | 'batch'
});

// List
const files = await client.files.list();

// Retrieve
const fileInfo = await client.files.retrieve("file-abc123");

// Download content
const content = await client.files.content("file-abc123");

// Delete
await client.files.del("file-abc123");
```

### Batch API

```typescript
// Create batch
const batch = await client.batches.create({
  input_file_id: "file-abc123",
  endpoint: "/v1/chat/completions", // or '/v1/embeddings'
  completion_window: "24h",
  metadata: {},
});

// Retrieve status
const status = await client.batches.retrieve("batch-abc123");

// List batches
const batches = await client.batches.list();

// Cancel batch
await client.batches.cancel("batch-abc123");
```

---

## Helper Functions

```typescript
// Structured output with Zod
import { zodResponseFormat } from "openai/helpers/zod";
import { zodTextFormat } from "openai/helpers/zod";
import { zodFunction } from "openai/helpers/zod";

// Chat Completions structured output
zodResponseFormat(zodSchema, "schema_name");

// Responses API structured output
zodTextFormat(zodSchema, "schema_name");

// Function tool from Zod schema
zodFunction({ name: "tool_name", parameters: zodSchema });

// File conversion helper
import { toFile } from "openai";
await toFile(buffer, "filename.ext");
```

---

## Error Types

| Error Class                 | HTTP Status | Auto-Retried? |
| --------------------------- | ----------- | ------------- |
| `BadRequestError`           | 400         | No            |
| `AuthenticationError`       | 401         | No            |
| `PermissionDeniedError`     | 403         | No            |
| `NotFoundError`             | 404         | No            |
| `UnprocessableEntityError`  | 422         | No            |
| `RateLimitError`            | 429         | Yes           |
| `InternalServerError`       | >= 500      | Yes           |
| `APIConnectionError`        | N/A         | Yes           |
| `APIConnectionTimeoutError` | N/A         | Yes           |

All errors extend `OpenAI.APIError` with properties:

- `.status` -- HTTP status code
- `.message` -- Error message
- `.request_id` -- Request ID for debugging
- `.headers` -- Response headers

---

## Streaming Events (.stream() Helper)

| Event                                 | Arguments               | Description                      |
| ------------------------------------- | ----------------------- | -------------------------------- |
| `connect`                             | `()`                    | Connection established           |
| `chunk`                               | `(chunk, snapshot)`     | Raw API chunk received           |
| `content`                             | `(delta, snapshot)`     | Text content delta               |
| `content.delta`                       | `({ delta, snapshot })` | Content chunk with full snapshot |
| `content.done`                        | `({ content })`         | Content generation complete      |
| `tool_calls.function.arguments.delta` | `({ name, arguments })` | Tool argument streaming          |
| `tool_calls.function.arguments.done`  | `({ name, arguments })` | Tool arguments complete          |
| `error`                               | `(error)`               | Stream error                     |
| `end`                                 | `()`                    | Stream finished                  |

### Stream Methods

```typescript
await stream.finalContent(); // Promise<string> -- last assistant content
await stream.finalMessage(); // Promise<ChatCompletionMessage>
await stream.allChatCompletions(); // Promise<ChatCompletion[]>
stream.abort(); // Cancel stream and network request
stream.controller; // Underlying AbortController
```

---

## Responses API Event Types (Streaming)

| Event Type                               | Description                 |
| ---------------------------------------- | --------------------------- |
| `response.created`                       | Response object created     |
| `response.output_text.delta`             | Text content delta          |
| `response.output_text.done`              | Text generation complete    |
| `response.function_call_arguments.delta` | Function argument streaming |
| `response.function_call_arguments.done`  | Function arguments complete |
| `response.completed`                     | Full response complete      |
| `error`                                  | Error occurred              |

---

## Message Roles

| Role        | API              | Description                                            |
| ----------- | ---------------- | ------------------------------------------------------ |
| `developer` | Chat Completions | System instruction (replaces `system` in newer models) |
| `system`    | Chat Completions | Legacy system instruction                              |
| `user`      | Both             | User input                                             |
| `assistant` | Chat Completions | Model response                                         |
| `tool`      | Chat Completions | Tool result                                            |

---

## Per-Request Overrides

```typescript
// Override retries and timeout for a single request
await client.chat.completions.create(
  { model: 'gpt-4o', messages: [...] },
  {
    maxRetries: 5,
    timeout: 60_000,
    signal: abortController.signal,
    headers: { 'X-Custom-Header': 'value' },
  },
);
```

---

## Request ID Tracking

```typescript
// From response object
completion._request_id;

// From raw response headers
const { data, response } = await client.chat.completions
  .create({ model: 'gpt-4o', messages: [...] })
  .withResponse();

response.headers.get('x-request-id');
```
