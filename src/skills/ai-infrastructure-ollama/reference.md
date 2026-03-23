# Ollama Quick Reference

> Client configuration, method signatures, response types, model options, and OpenAI compatibility. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Package Installation

```bash
# Core package (always required)
npm install ollama

# For structured outputs (recommended)
npm install zod zod-to-json-schema
```

---

## Client Configuration

```typescript
import { Ollama } from "ollama";

const ollama = new Ollama({
  host: "http://127.0.0.1:11434", // Default -- override for remote servers
  fetch: customFetch, // Custom fetch implementation (optional)
  headers: {
    // Custom headers for every request (optional)
    Authorization: "Bearer <api-key>",
  },
});
```

### Default Client

```typescript
import ollama from "ollama"; // Pre-configured singleton at localhost:11434
```

### Browser Client

```typescript
import ollama from "ollama/browser"; // Uses browser-compatible fetch
```

### Environment Variables

| Variable      | Purpose                                  |
| ------------- | ---------------------------------------- |
| `OLLAMA_HOST` | Override default host (used by CLI only) |

---

## API Methods Reference

### Chat (`ollama.chat`)

```typescript
const response = await ollama.chat({
  model: "llama3.1", // Required: model name
  messages: [], // Required: Message[] with role, content, images?, tool_name?
  stream: false, // Returns AsyncGenerator<ChatResponse> when true
  format: undefined, // 'json' | JsonSchema object (plain object)
  tools: [], // Tool[] for function calling
  think: false, // boolean | 'high' | 'medium' | 'low'
  logprobs: false, // Return token log probabilities
  top_logprobs: undefined, // number -- top N logprobs per token (requires logprobs: true)
  keep_alive: "5m", // string ('5m', '1h') | number (seconds) | -1
  options: {}, // Runtime model parameters (see Options below)
});

// Response shape
response.model; // string
response.message.role; // 'assistant'
response.message.content; // string
response.message.tool_calls; // ToolCall[] | undefined
response.message.thinking; // string | undefined (when think: true)
response.total_duration; // number (nanoseconds)
response.eval_count; // number (tokens generated)
response.eval_duration; // number (nanoseconds)
response.logprobs; // Logprob[] | undefined (when logprobs: true)
```

### Generate (`ollama.generate`)

```typescript
const response = await ollama.generate({
  model: "llama3.1", // Required
  prompt: "", // Required: input text
  system: "", // System prompt override
  template: "", // Prompt template override
  suffix: "", // Text after generated content
  images: [], // Uint8Array[] | string[] (base64)
  raw: false, // Bypass template processing
  format: undefined, // 'json' | JsonSchema object (plain object)
  stream: false, // Returns AsyncGenerator<GenerateResponse> when true
  think: false, // boolean | 'high' | 'medium' | 'low'
  logprobs: false, // Return token log probabilities
  top_logprobs: undefined, // number -- top N logprobs per token (requires logprobs: true)
  keep_alive: "5m", // Duration or seconds
  options: {}, // Runtime model parameters
});

// Response shape
response.model; // string
response.response; // string (generated text)
response.thinking; // string | undefined
response.total_duration; // number (nanoseconds)
response.eval_count; // number
response.eval_duration; // number
response.logprobs; // Logprob[] | undefined
```

### Embed (`ollama.embed`)

```typescript
const response = await ollama.embed({
  model: "nomic-embed-text", // Required: embedding model
  input: "", // string | string[] (batch)
  truncate: true, // Truncate to max context length
  dimensions: undefined, // number -- reduce embedding dimensions (model-dependent)
  keep_alive: "5m", // Duration or seconds
  options: {}, // Runtime model parameters
});

// Response shape
response.model; // string
response.embeddings; // number[][] (one vector per input)
```

### Model Management

```typescript
// Pull model
const response = await ollama.pull({
  model: "llama3.1", // Required
  insecure: false, // Allow unverified servers
  stream: false, // Returns AsyncGenerator<ProgressResponse> when true
});

// List models
const list = await ollama.list();
list.models; // Array<{ name, model, size, digest, details, modified_at }>

// Show model info
const info = await ollama.show({
  model: "llama3.1", // Required
});
info.details; // { format, family, parameter_size, quantization_level, ... }
info.modelfile; // string
info.template; // string
info.system; // string
info.capabilities; // string[] (e.g. ['completion', 'tools', 'vision'])

// Delete model
await ollama.delete({ model: "old-model" });

// Copy model
await ollama.copy({ source: "llama3.1", destination: "my-llama" });

// List running models
const running = await ollama.ps();
running.models; // Array<{ name, model, size, digest, expires_at, ... }>

// Create custom model
await ollama.create({
  model: "my-model", // Required
  from: "llama3.1", // Base model
  system: "You are a pirate.", // System prompt
  quantize: "q4_K_M", // Quantization level
  stream: false, // Progress streaming
});

// Get server version
const version = await ollama.version();

// Abort all active streams
ollama.abort(); // Throws AbortError on listening threads

// Web search (requires API key / cloud access)
const searchResults = await ollama.webSearch({
  query: "search terms", // Required
  maxResults: 5, // number (default 5, max 10)
});
searchResults.results; // Array<{ title, url, content }>

// Web fetch (requires API key / cloud access)
const fetched = await ollama.webFetch({
  url: "https://example.com", // Required
});
fetched.title; // string
fetched.content; // string
fetched.links; // string[]
```

---

## Runtime Options

Passed via the `options` field to `chat`, `generate`, or `embed`:

| Option           | Type     | Default | Description                             |
| ---------------- | -------- | ------- | --------------------------------------- |
| `temperature`    | number   | 0.8     | Creativity (0 = deterministic, 2 = max) |
| `top_p`          | number   | 0.9     | Nucleus sampling                        |
| `top_k`          | number   | 40      | Top-k sampling                          |
| `num_predict`    | number   | -1      | Max tokens to generate (-1 = unlimited) |
| `num_ctx`        | number   | 2048    | Context window size                     |
| `seed`           | number   | 0       | Random seed (0 = random)                |
| `stop`           | string[] | []      | Stop sequences                          |
| `repeat_penalty` | number   | 1.1     | Repetition penalty                      |
| `num_gpu`        | number   | -1      | GPU layers (-1 = auto)                  |
| `num_thread`     | number   | 0       | CPU threads (0 = auto)                  |
| `mirostat`       | number   | 0       | Mirostat sampling (0 = disabled, 1, 2)  |
| `mirostat_tau`   | number   | 5.0     | Mirostat target entropy                 |
| `mirostat_eta`   | number   | 0.1     | Mirostat learning rate                  |

---

## Tool Schema Format

```typescript
const tool = {
  type: "function" as const,
  function: {
    name: "tool_name", // Function name
    description: "What this tool does", // Guides model usage
    parameters: {
      type: "object",
      required: ["param1"],
      properties: {
        param1: { type: "string", description: "Parameter description" },
        param2: { type: "number", description: "Optional parameter" },
      },
    },
  },
};
```

**Key difference from OpenAI:** Tool call arguments are returned as parsed objects, not JSON strings.

---

## Message Roles

| Role        | Description                             |
| ----------- | --------------------------------------- |
| `system`    | System instruction (behavior control)   |
| `user`      | User input                              |
| `assistant` | Model response                          |
| `tool`      | Tool result (with optional `tool_name`) |

---

## keep_alive Values

| Value   | Behavior                            |
| ------- | ----------------------------------- |
| `'5m'`  | Keep loaded for 5 minutes (default) |
| `'1h'`  | Keep loaded for 1 hour              |
| `'30m'` | Keep loaded for 30 minutes          |
| `0`     | Unload immediately after request    |
| `-1`    | Keep loaded indefinitely            |

---

## Performance Metrics (Response Fields)

| Field                  | Type   | Description                   |
| ---------------------- | ------ | ----------------------------- |
| `total_duration`       | number | Total time (nanoseconds)      |
| `load_duration`        | number | Model load time (nanoseconds) |
| `prompt_eval_count`    | number | Prompt tokens processed       |
| `prompt_eval_duration` | number | Prompt processing time (ns)   |
| `eval_count`           | number | Tokens generated              |
| `eval_duration`        | number | Generation time (nanoseconds) |

**Tokens per second:** `eval_count / eval_duration * 1e9`

---

## Popular Model Names

| Model               | Size | Use Case                         |
| ------------------- | ---- | -------------------------------- |
| `llama3.1`          | 8B   | General purpose, tool calling    |
| `llama3.1:70b`      | 70B  | High quality, requires 40GB+ RAM |
| `llama3.2-vision`   | 11B  | Vision / multimodal              |
| `mistral`           | 7B   | Fast, general purpose            |
| `qwen3`             | 8B   | Reasoning, tool calling          |
| `qwen2.5-coder`     | 7B   | Code generation                  |
| `gemma3`            | 4B   | Small, fast, vision              |
| `phi4-mini`         | 3.8B | Very small, fast                 |
| `deepseek-r1`       | 7B   | Reasoning, thinking              |
| `deepseek-coder-v2` | 16B  | Code generation                  |
| `nomic-embed-text`  | 137M | Text embeddings                  |
| `all-minilm`        | 23M  | Small text embeddings            |

---

## OpenAI Compatibility

### Supported Features

| Feature                | Status               |
| ---------------------- | -------------------- |
| Chat completions       | Supported            |
| Streaming              | Supported            |
| Tool/function calling  | Supported            |
| JSON mode              | Supported            |
| Vision (base64 only)   | Supported            |
| Embeddings             | Supported            |
| Model listing          | Supported            |
| Seed (reproducibility) | Supported            |
| Responses API          | Supported (v0.13.3+) |

### NOT Supported

| Feature             | Status                      |
| ------------------- | --------------------------- |
| Logprobs            | Not supported               |
| Tool choice         | Not supported               |
| Logit bias          | Not supported               |
| Image URLs (vision) | Not supported (base64 only) |
| Stateful responses  | Not supported               |

### Client Setup

```typescript
import OpenAI from "openai";

const OLLAMA_BASE_URL = "http://localhost:11434/v1";

const client = new OpenAI({
  baseURL: OLLAMA_BASE_URL,
  apiKey: "ollama", // Required by SDK, ignored by Ollama
});
```
