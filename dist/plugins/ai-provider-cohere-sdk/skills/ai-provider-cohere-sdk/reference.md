# Cohere SDK Quick Reference

> Client configuration, model IDs, API methods, error types, and streaming events. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Package Installation

```bash
npm install cohere-ai
```

---

## Client Configuration

```typescript
import { CohereClientV2 } from "cohere-ai";

const client = new CohereClientV2({
  token: process.env.CO_API_KEY, // Required: API key
  timeout: 30_000, // Request timeout in ms (default: 120_000)
  clientName: "my-app", // Optional: for logging/analytics
});
```

### Constructor Parameters

| Parameter    | Type     | Default                      | Purpose                         |
| ------------ | -------- | ---------------------------- | ------------------------------- |
| `token`      | `string` | (required)                   | API key for authentication      |
| `timeout`    | `number` | `120_000` (2 min)            | Request timeout in ms           |
| `clientName` | `string` | `undefined`                  | Client identifier for logging   |
| `baseUrl`    | `string` | `"https://api.cohere.ai/v1"` | Override for custom deployments |

---

## Model IDs

### Command Models (Chat / Text Generation)

| Model                         | Context | Max Output | Use Case                                 |
| ----------------------------- | ------- | ---------- | ---------------------------------------- |
| `command-a-03-2025`           | 256K    | 8K         | General purpose, strongest Command model |
| `command-a-reasoning-08-2025` | 256K    | 32K        | Multi-step reasoning tasks               |
| `command-a-vision-07-2025`    | 128K    | 8K         | Image/chart/document analysis            |
| `command-a-translate-08-2025` | 8K      | --         | Translation (23 languages)               |
| `command-r7b-12-2024`         | 128K    | 4K         | Lightweight, fast, RAG-optimized         |
| `command-r-08-2024`           | 128K    | 4K         | General purpose (legacy)                 |
| `command-r-plus-08-2024`      | 128K    | 4K         | Enhanced quality (legacy)                |

### Embed Models

| Model                           | Context | Dimensions      | Notes                         |
| ------------------------------- | ------- | --------------- | ----------------------------- |
| `embed-v4.0`                    | 128K    | 256-1536 (flex) | Multimodal (text/images/PDFs) |
| `embed-english-v3.0`            | 512     | 1024            | English-focused               |
| `embed-english-light-v3.0`      | 512     | 384             | Lightweight English           |
| `embed-multilingual-v3.0`       | 512     | 1024            | 23-language support           |
| `embed-multilingual-light-v3.0` | 512     | 384             | Lightweight multilingual      |

### Rerank Models

| Model                      | Context | Notes                         |
| -------------------------- | ------- | ----------------------------- |
| `rerank-v4.0-pro`          | 32K     | Quality-focused, multilingual |
| `rerank-v4.0-fast`         | 32K     | Latency-optimized             |
| `rerank-v3.5`              | 4K      | English, JSON support         |
| `rerank-english-v3.0`      | 4K      | English-only                  |
| `rerank-multilingual-v3.0` | 4K      | Non-English documents         |

---

## API Methods Reference

### Chat (V2)

```typescript
const response = await client.chat({
  model: "command-a-03-2025", // Required
  messages: [], // Required: { role, content }[]
  temperature: 0.3, // 0-1 (default: 0.3)
  maxTokens: 4096, // Max output tokens
  tools: [], // Tool definitions
  documents: [], // Documents for RAG grounding
  citationOptions: { mode: "fast" }, // Citation generation mode
  safetyMode: "CONTEXTUAL", // "CONTEXTUAL" | "STRICT" | "NONE"
  stopSequences: [], // Stop generation at these strings
});

// Response access
response.message.content[0].text; // Generated text
response.message.citations; // Citation objects (if documents provided)
response.message.toolCalls; // Tool calls (if tools provided)
response.message.toolPlan; // Tool reasoning (if tools provided)
response.finishReason; // "COMPLETE" | "MAX_TOKENS"
response.usage; // { billedUnits, tokens }
```

### Chat Stream (V2)

```typescript
const stream = await client.chatStream({
  model: "command-a-03-2025", // Required
  messages: [], // Required
  // Same optional params as chat()
});

for await (const event of stream) {
  // Handle events by type
}
```

### Embed (V2)

```typescript
const response = await client.embed({
  model: "embed-v4.0", // Required
  inputType: "search_document", // Required for v3+
  texts: [], // Up to 96 strings
  embeddingTypes: ["float"], // "float" | "int8" | "uint8" | "binary" | "ubinary"
  outputDimension: 1024, // embed-v4+ only: 256 | 512 | 1024 | 1536
  truncate: "END", // "NONE" | "START" | "END"
});

// Response access
response.embeddings.float; // number[][] (one per input text)
```

### Rerank (V2)

```typescript
const response = await client.rerank({
  model: "rerank-v4.0-pro", // Required
  query: "search query", // Required
  documents: ["doc1", "doc2"], // Required: string[] (max 1000)
  topN: 3, // Limit results
  maxTokensPerDoc: 4096, // Truncate long documents
});

// Response access
response.results; // { index, relevanceScore }[]
```

---

## Message Roles (V2)

| Role        | Purpose                                          |
| ----------- | ------------------------------------------------ |
| `system`    | Instructions the model prioritizes               |
| `user`      | User input                                       |
| `assistant` | Model response (including tool_calls, tool_plan) |
| `tool`      | Tool execution results (with tool_call_id)       |

---

## Streaming Event Types

| Event Type        | Key Fields                                    | Description              |
| ----------------- | --------------------------------------------- | ------------------------ |
| `message-start`   | `id`, `delta.message.role`                    | Stream begins            |
| `content-start`   | `index`                                       | Content block begins     |
| `content-delta`   | `delta.message.content.text`                  | Text token received      |
| `content-end`     | `index`                                       | Content block ends       |
| `tool-plan-delta` | `delta.message.tool_plan`                     | Tool reasoning token     |
| `tool-call-start` | `delta.message.tool_calls`                    | Tool call begins         |
| `tool-call-delta` | `delta.message.tool_calls.function.arguments` | Tool arguments streaming |
| `tool-call-end`   | `index`                                       | Tool call complete       |
| `citation-start`  | `delta.message.citations`                     | Citation generated       |
| `citation-end`    | `index`                                       | Citation complete        |
| `message-end`     | `delta.finish_reason`, `delta.usage`          | Stream complete          |

---

## Error Types

| Error Class          | When Thrown                             |
| -------------------- | --------------------------------------- |
| `CohereError`        | API errors (4xx, 5xx) with `statusCode` |
| `CohereTimeoutError` | Request exceeds configured timeout      |

```typescript
import { CohereError, CohereTimeoutError } from "cohere-ai";

// CohereError properties
error.statusCode; // HTTP status code
error.message; // Error message
error.body; // Full error response body
```

---

## Input Type Reference (Embeddings)

| Value             | Use Case                                        |
| ----------------- | ----------------------------------------------- |
| `search_document` | Embeddings for documents stored in vector DB    |
| `search_query`    | Embeddings for search queries against vector DB |
| `classification`  | Embeddings for text classification inputs       |
| `clustering`      | Embeddings for clustering algorithms            |
| `image`           | Embeddings for image inputs (embed-v4+ only)    |

**Critical:** Always pair `search_document` (indexing) with `search_query` (querying). Using the same type for both silently degrades similarity scores.

---

## Embedding Types

| Type      | Format     | Models | Storage Size   |
| --------- | ---------- | ------ | -------------- |
| `float`   | `number[]` | All    | Full precision |
| `int8`    | `number[]` | v3.0+  | 4x compressed  |
| `uint8`   | `number[]` | v3.0+  | 4x compressed  |
| `binary`  | `number[]` | v3.0+  | 32x compressed |
| `ubinary` | `number[]` | v3.0+  | 32x compressed |
| `base64`  | `string`   | v3.0+  | Base64-encoded |

---

## Citation Structure

```typescript
interface Citation {
  start: number; // Start position in response text
  end: number; // End position in response text
  text: string; // Cited text span
  sources: Source[]; // Source references
}

// In RAG mode, sources reference document indices
// In tool use mode, sources reference tool_call_id values
```
