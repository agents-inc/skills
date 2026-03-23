# Together AI SDK Quick Reference

> Client configuration, model IDs, API methods, error types, and image parameters. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Package Installation

```bash
# Core package (always required)
npm install together-ai

# For structured outputs (optional but recommended)
npm install zod
```

---

## Client Configuration

```typescript
import Together from "together-ai";

const client = new Together({
  apiKey: process.env.TOGETHER_API_KEY, // Auto-reads from env if not set
  timeout: 30_000, // Request timeout in ms (default: 60_000 = 1 min)
  maxRetries: 3, // Retry count on 429/5xx (default: 2)
  baseURL: "https://api.together.xyz/v1", // Override for proxies
  logLevel: "off", // 'debug' | 'info' | 'warn' | 'error' | 'off'
});
```

### Environment Variables

| Variable           | Purpose                 |
| ------------------ | ----------------------- |
| `TOGETHER_API_KEY` | API key (auto-detected) |

---

## Model IDs

### Chat / Language Models

| Model ID                                            | Use Case                    | Notes                         |
| --------------------------------------------------- | --------------------------- | ----------------------------- |
| `meta-llama/Llama-3.3-70B-Instruct-Turbo`           | General purpose, fast       | Best balance of speed/quality |
| `meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8` | Latest Llama 4              | MoE architecture              |
| `Qwen/Qwen3.5-9B`                                   | JSON mode, function calling | Excellent structured output   |
| `Qwen/Qwen3.5-397B-A17B`                            | Most capable Qwen           | MoE, hybrid reasoning         |
| `deepseek-ai/DeepSeek-V3.1`                         | Most capable open-source    | Strong reasoning              |
| `deepseek-ai/DeepSeek-R1`                           | Complex reasoning           | Chain-of-thought reasoning    |
| `mistralai/Mistral-Small-24B-Instruct-2501`         | Fast, function calling      | Good tool use support         |
| `google/gemma-3n-E4B-it`                            | Ultra-lightweight           | Cheapest option               |

### Vision / Multimodal Models

| Model ID                                         | Use Case            |
| ------------------------------------------------ | ------------------- |
| `Qwen/Qwen3-VL-8B-Instruct`                      | Image understanding |
| `meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo` | Vision + chat       |

### Embedding Models

| Model ID                                    | Use Case               |
| ------------------------------------------- | ---------------------- |
| `BAAI/bge-large-en-v1.5`                    | General English        |
| `WhereIsAI/UAE-Large-V1`                    | High quality           |
| `intfloat/multilingual-e5-large-instruct`   | Multilingual           |
| `togethercomputer/m2-bert-80M-8k-retrieval` | Long context retrieval |

### Image Generation Models

| Model ID                               | Use Case               | Size Control       |
| -------------------------------------- | ---------------------- | ------------------ |
| `black-forest-labs/FLUX.1-schnell`     | Fast generation        | `aspect_ratio`     |
| `black-forest-labs/FLUX.1.1-pro`       | High quality           | `width` / `height` |
| `black-forest-labs/FLUX.2-pro`         | Latest, reference imgs | `width` / `height` |
| `black-forest-labs/FLUX.1-kontext-pro` | Image editing          | `aspect_ratio`     |

---

## API Methods Reference

### Chat Completions

```typescript
const completion = await client.chat.completions.create({
  model: "meta-llama/Llama-3.3-70B-Instruct-Turbo", // Required
  messages: [], // Required: ChatCompletionMessageParam[]
  temperature: 0.7, // 0-2 (default: 1)
  max_tokens: 1000, // Max output tokens
  top_p: 1, // Nucleus sampling
  tools: [], // Function calling tools
  tool_choice: "auto", // 'auto' | 'required' | 'none' | { type: 'function', function: { name } }
  response_format: undefined, // { type: 'json_schema', json_schema: { name, schema } }
  stream: false, // Enable streaming
  stop: undefined, // string | string[] -- stop sequences
});
```

### Images

```typescript
const response = await client.images.generate({
  model: "black-forest-labs/FLUX.1-schnell", // Required
  prompt: "", // Required (except Kling)
  width: 1024, // For FLUX Pro/1.1 Pro/Dev
  height: 1024, // For FLUX Pro/1.1 Pro/Dev
  aspect_ratio: undefined, // For FLUX schnell/Kontext: "1:1", "16:9", etc.
  steps: 4, // 1-50
  n: 1, // 1-4 variations
  seed: undefined, // Reproducibility
  negative_prompt: "", // Unwanted elements
  response_format: undefined, // "base64" for inline data
  reference_images: [], // FLUX.2, Google models
  image_url: undefined, // Kontext single reference
  disable_safety_checker: false, // NSFW filter toggle
});
```

### Embeddings

```typescript
const response = await client.embeddings.create({
  model: "BAAI/bge-large-en-v1.5", // Required
  input: "", // string or string[]
});
```

### Fine-Tuning

```typescript
// Upload training data
const file = await client.files.upload({
  file: readStream, // ReadStream or File
  purpose: "fine-tune",
});

// Create fine-tuning job
const job = await client.fineTuning.create({
  training_file: file.id, // Required
  model: "meta-llama/Meta-Llama-3-8B-Instruct", // Required
  n_epochs: 3,
});

// Monitor job
const status = await client.fineTuning.retrieve(job.id);
const events = await client.fineTuning.listEvents(job.id);

// List, cancel, delete
const jobs = await client.fineTuning.list();
await client.fineTuning.cancel(job.id);
await client.fineTuning.delete(job.id);
```

### Files

```typescript
// Upload
const file = await client.files.upload({
  file: readStream, // ReadStream or File
  purpose: "fine-tune", // 'fine-tune'
});

// List / Retrieve / Delete
const files = await client.files.list();
const fileInfo = await client.files.retrieve("file-abc123");
await client.files.delete("file-abc123");
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

All errors extend `Together.APIError` with properties:

- `.status` -- HTTP status code
- `.message` -- Error message

---

## OpenAI Compatibility

```typescript
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.TOGETHER_API_KEY,
  baseURL: "https://api.together.xyz/v1",
});

// Use exactly like OpenAI SDK, with Together AI model IDs
const completion = await client.chat.completions.create({
  model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  messages: [{ role: "user", content: "Hello" }],
});
```

**Compatible endpoints:** chat completions, embeddings, images, vision, function calling, structured output

**NOT compatible:** fine-tuning management, model listing, Together-specific endpoints

---

## Message Roles

| Role        | Description        | Notes                         |
| ----------- | ------------------ | ----------------------------- |
| `system`    | System instruction | Use `system`, NOT `developer` |
| `user`      | User input         |                               |
| `assistant` | Model response     |                               |
| `tool`      | Tool result        | Used in multi-step tool flows |

---

## Response Format Options

| Type          | Shape                                                    | Use Case               |
| ------------- | -------------------------------------------------------- | ---------------------- | ------------ | ----------------------- |
| `json_schema` | `{ type: "json_schema", json_schema: { name, schema } }` | Structured JSON output |
| `json_object` | `{ type: "json_object" }`                                | Freeform JSON          |
| `regex`       | `{ type: "regex", pattern: "(positive                    | negative               | neutral)" }` | Constrained text output |
