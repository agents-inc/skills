# Google Gemini SDK Quick Reference

> Client configuration, model IDs, API methods, config parameters, safety enums, and helper functions. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Package Installation

```bash
# Core package (always required)
npm install @google/genai

# For structured outputs (optional but recommended)
npm install zod zod-to-json-schema
```

---

## Client Configuration

```typescript
import { GoogleGenAI } from "@google/genai";

// Gemini Developer API
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY, // Or auto-reads GOOGLE_API_KEY
});

// Vertex AI
const aiVertex = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1",
});
```

### Environment Variables

| Variable                    | Purpose                                     |
| --------------------------- | ------------------------------------------- |
| `GEMINI_API_KEY`            | API key (explicit)                          |
| `GOOGLE_API_KEY`            | API key (auto-detected when no args passed) |
| `GOOGLE_GENAI_USE_VERTEXAI` | Set `true` for Vertex AI (auto-config)      |
| `GOOGLE_CLOUD_PROJECT`      | Vertex AI project ID                        |
| `GOOGLE_CLOUD_LOCATION`     | Vertex AI region (e.g., `us-central1`)      |

---

## Model IDs

### Language Models (Text Generation)

| Model                    | Use Case                            | Context Window | Notes                             |
| ------------------------ | ----------------------------------- | -------------- | --------------------------------- |
| `gemini-2.5-flash`       | Best price/performance, low-latency | 1M             | Recommended default               |
| `gemini-2.5-flash-lite`  | Budget, high-volume, fastest        | 1M             | Cheapest option                   |
| `gemini-2.5-pro`         | Complex reasoning, deep thinking    | 1M             | Most capable stable model         |
| `gemini-3-flash-preview` | Frontier, agentic, strong coding    | 1M             | Preview -- may change             |
| `gemini-3.1-pro-preview` | Latest reasoning, complex agentic   | 1M             | Preview -- latest frontier        |
| `gemini-2.0-flash`       | Legacy stable, proven               | 1M             | **Deprecated** -- migrate to 2.5+ |

### Embedding Models

| Model                        | Input Types                    | Default Dimensions | Max Tokens |
| ---------------------------- | ------------------------------ | ------------------ | ---------- |
| `gemini-embedding-001`       | Text only                      | 3,072              | 2,048      |
| `gemini-embedding-2-preview` | Text, image, video, audio, PDF | 3,072              | 8,192      |

---

## API Methods Reference

### ai.models -- Generation & Embeddings

```typescript
// Text generation
const response = await ai.models.generateContent({
  model: string,       // Required: model ID
  contents: string | Part[] | Content[],  // Required: input
  config: {
    systemInstruction: string,           // System prompt
    temperature: number,                 // 0-2 (default: 1)
    topP: number,                        // Nucleus sampling
    topK: number,                        // Top-k sampling
    maxOutputTokens: number,             // Max output tokens
    stopSequences: string[],             // Stop sequences
    responseMimeType: string,            // "application/json" for structured
    responseJsonSchema: object,          // JSON Schema for structured output
    tools: Tool[],                       // Function declarations or built-in tools
    toolConfig: ToolConfig,              // Function calling mode
    safetySettings: SafetySetting[],     // Safety filter configuration
    cachedContent: string,               // Cache name for context caching
    thinkingConfig: ThinkingConfig,      // Thinking/reasoning config
  },
});

// Streaming generation
const stream = await ai.models.generateContentStream({
  model: string,
  contents: string | Part[] | Content[],
  config: { /* same as above */ },
});

// Embeddings
const embResponse = await ai.models.embedContent({
  model: string,       // Required: embedding model ID
  contents: string | string[] | Part[],  // Required: input(s)
  config: {
    taskType: string,              // SEMANTIC_SIMILARITY, RETRIEVAL_DOCUMENT, etc.
    outputDimensionality: number,  // Reduce dimensions (default: 3072)
  },
});

// Token counting
const tokenResponse = await ai.models.countTokens({
  model: string,
  contents: string | Part[] | Content[],
});
```

### ai.chats -- Multi-Turn Chat

```typescript
// Create chat session
const chat = ai.chats.create({
  model: string,           // Required: model ID
  history: Content[],      // Optional: pre-loaded history
  config: {
    systemInstruction: string,
    tools: Tool[],
    // ... same config options as generateContent
  },
});

// Send message
const response = await chat.sendMessage({ message: string });

// Send with streaming
const stream = await chat.sendMessageStream({ message: string });

// Get conversation history
const history = chat.getHistory();
```

### ai.files -- File Upload & Management

```typescript
// Upload file
const file = await ai.files.upload({
  file: string, // File path
  config: {
    mimeType: string, // Required: MIME type
    displayName: string, // Optional: display name
  },
});
// Returns: { uri, mimeType, name, displayName, sizeBytes, ... }
// Files expire after 48 hours

// List files
const files = await ai.files.list();

// Get file info
const info = await ai.files.get({ name: string });

// Delete file
await ai.files.delete({ name: string });
```

### ai.caches -- Context Caching

```typescript
// Create cache
const cache = await ai.caches.create({
  model: string,
  config: {
    contents: Content[],          // Content to cache
    systemInstruction: string,    // Cached system instruction
    displayName: string,          // Optional
    ttl: string,                  // e.g., "86400s" (24 hours)
  },
});

// Use cache in generation
const response = await ai.models.generateContent({
  model: string,  // Must match cache model
  contents: "Your question about the cached content",
  config: { cachedContent: cache.name },
});

// Update cache TTL
await ai.caches.update({ name: cache.name, config: { ttl: "3600s" } });

// Delete cache
await ai.caches.delete({ name: cache.name });

// List caches
const pager = await ai.caches.list({ config: { pageSize: 10 } });
```

---

## Helper Functions

```typescript
// Content creation helpers
import { createUserContent, createPartFromUri } from "@google/genai";

// Create user content from mixed parts (text + file reference)
createUserContent(["Describe this image", createPartFromUri(file.uri, file.mimeType)]);

// Create part from file URI
createPartFromUri(uri: string, mimeType: string);
```

---

## Config Parameters

### GenerateContentConfig

| Parameter            | Type              | Description                                |
| -------------------- | ----------------- | ------------------------------------------ |
| `systemInstruction`  | `string`          | System prompt / persona                    |
| `temperature`        | `number`          | Randomness (0-2, default: 1)               |
| `topP`               | `number`          | Nucleus sampling threshold                 |
| `topK`               | `number`          | Top-k token selection                      |
| `maxOutputTokens`    | `number`          | Maximum tokens in response                 |
| `stopSequences`      | `string[]`        | Stop generation on these strings           |
| `responseMimeType`   | `string`          | `"application/json"` for structured output |
| `responseJsonSchema` | `object`          | JSON Schema defining output shape          |
| `tools`              | `Tool[]`          | Function declarations or built-in tools    |
| `toolConfig`         | `ToolConfig`      | Function calling mode configuration        |
| `safetySettings`     | `SafetySetting[]` | Per-category safety thresholds             |
| `cachedContent`      | `string`          | Cache name for context caching             |
| `thinkingConfig`     | `ThinkingConfig`  | Thinking level configuration               |

---

## Safety Settings

### HarmCategory Values

| Category                          | Description                             |
| --------------------------------- | --------------------------------------- |
| `HARM_CATEGORY_HATE_SPEECH`       | Hateful content targeting identity      |
| `HARM_CATEGORY_HARASSMENT`        | Rude, disrespectful, or profane content |
| `HARM_CATEGORY_SEXUALLY_EXPLICIT` | Sexual content references               |
| `HARM_CATEGORY_DANGEROUS_CONTENT` | Promotes harmful acts                   |
| `HARM_CATEGORY_CIVIC_INTEGRITY`   | Election/civic misinformation           |

### HarmBlockThreshold Values

| Threshold                | Description                           |
| ------------------------ | ------------------------------------- |
| `OFF`                    | Filter disabled (Gemini 2.5+ default) |
| `BLOCK_NONE`             | Allow all content                     |
| `BLOCK_ONLY_HIGH`        | Block high probability only           |
| `BLOCK_MEDIUM_AND_ABOVE` | Block medium+ probability             |
| `BLOCK_LOW_AND_ABOVE`    | Block low+ probability (strictest)    |

---

## FunctionCallingConfigMode Values

| Mode   | Description                                        |
| ------ | -------------------------------------------------- |
| `AUTO` | Model decides whether to call a function (default) |
| `ANY`  | Model always calls a function from the list        |
| `NONE` | Model never calls functions (text-only response)   |

---

## Embedding Task Types

| Task Type              | Description                       |
| ---------------------- | --------------------------------- |
| `SEMANTIC_SIMILARITY`  | Measuring text similarity         |
| `CLASSIFICATION`       | Text classification               |
| `CLUSTERING`           | Grouping similar content          |
| `RETRIEVAL_DOCUMENT`   | Embedding documents for retrieval |
| `RETRIEVAL_QUERY`      | Embedding queries for retrieval   |
| `CODE_RETRIEVAL_QUERY` | Code search queries               |
| `QUESTION_ANSWERING`   | QA systems                        |
| `FACT_VERIFICATION`    | Fact-checking                     |

---

## Response Shape

```typescript
// GenerateContentResponse
response.text; // string | null -- generated text content
response.functionCalls; // FunctionCall[] | undefined -- tool calls
response.candidates; // Candidate[] -- raw candidate list
response.usageMetadata; // { promptTokenCount, candidatesTokenCount, totalTokenCount }

// Candidate
candidate.content; // Content -- parts with text/function calls
candidate.finishReason; // "STOP" | "MAX_TOKENS" | "SAFETY" | "RECITATION" | ...
candidate.safetyRatings; // SafetyRating[] -- per-category safety scores

// EmbedContentResponse
embResponse.embeddings; // Embedding[] -- array of embedding objects
embedding.values; // number[] -- the embedding vector

// FunctionCall
functionCall.name; // string -- function name
functionCall.args; // object -- parsed arguments
functionCall.id; // string -- call ID (for multi-turn response)
```

---

## File Size Limits

| Method               | Limit                               |
| -------------------- | ----------------------------------- |
| Inline data (base64) | 100 MB per request (50 MB for PDFs) |
| `ai.files.upload()`  | 2 GB per file, 20 GB per project    |
| File retention       | 48 hours (auto-deleted)             |

---

## Thinking Configuration

```typescript
import { ThinkingLevel } from "@google/genai";

config: {
  thinkingConfig: {
    thinkingLevel: ThinkingLevel.LOW,  // MINIMAL, LOW, MEDIUM, HIGH
    includeThoughts: true,             // Include thinking in response
  },
}
```

---

## Content Types for Multimodal Input

```typescript
// Text part
{ text: "Your text here" }

// Inline data (base64)
{ inlineData: { mimeType: "image/jpeg", data: base64String } }

// File reference (from ai.files.upload)
// Use createPartFromUri helper:
import { createPartFromUri } from "@google/genai";
createPartFromUri(file.uri, file.mimeType)

// Function call (in model response)
{ functionCall: { name: string, args: object, id: string } }

// Function response (user sends back)
{ functionResponse: { name: string, response: object, id: string } }
```
