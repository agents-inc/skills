---
name: ai-provider-google-gemini-sdk
description: Official TypeScript SDK for Google Gemini — client setup, text generation, multimodal input, function calling, structured output, streaming, embeddings, context caching, and chat sessions
---

# Google Gemini SDK Patterns

> **Quick Guide:** Use the `@google/genai` package (the unified SDK, NOT the deprecated `@google/generative-ai`) for all Gemini API interactions. All operations flow through a central `GoogleGenAI` client with service accessors: `ai.models` for generation, `ai.chats` for multi-turn, `ai.files` for uploads, `ai.caches` for context caching. Use `responseMimeType: "application/json"` with `responseJsonSchema` for structured output. Access response text via `response.text` (property, not method). Streaming uses `generateContentStream` returning an async iterable -- iterate with `for await`.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use `@google/genai` (the new unified SDK) -- NOT the deprecated `@google/generative-ai` package)**

**(You MUST access response text via `response.text` (a property) -- NOT `response.text()` (the old SDK used a method call))**

**(You MUST pass `model` as a string parameter in every API call -- there is no `getGenerativeModel()` step)**

**(You MUST use `config` for all generation parameters (temperature, safetySettings, tools, systemInstruction) -- NOT top-level properties)**

**(You MUST never hardcode API keys -- use environment variables via `process.env.GEMINI_API_KEY` or `GOOGLE_API_KEY`)**

</critical_requirements>

---

**Auto-detection:** Gemini, gemini, GoogleGenAI, @google/genai, ai.models.generateContent, generateContentStream, ai.chats, ai.files, ai.caches, gemini-2.5-flash, gemini-2.5-pro, gemini-2.0-flash, gemini-3-flash, gemini-embedding, GEMINI_API_KEY, GOOGLE_API_KEY, FunctionCallingConfigMode, createUserContent, createPartFromUri, responseMimeType, responseJsonSchema

**When to use:**

- Building applications that call Google Gemini models directly (Gemini 2.x, 2.5, 3.x)
- Processing multimodal input: images, video, audio, PDFs
- Implementing function calling / tool use with custom functions or built-in tools (Google Search, code execution)
- Extracting structured JSON data from LLM responses using response schemas
- Streaming text generation for user-facing output
- Creating embeddings for RAG pipelines or semantic search (text and multimodal)
- Caching large context (documents, code) to reduce cost and latency across multiple requests
- Multi-turn chat sessions with automatic history management

**Key patterns covered:**

- Client initialization and environment-based configuration
- Text generation with `ai.models.generateContent()`
- Streaming with `ai.models.generateContentStream()` and `for await`
- Multimodal input (inline base64, file upload, URIs)
- Function calling with `FunctionDeclaration` and manual tool loops
- Structured output with `responseMimeType` + `responseJsonSchema` + Zod
- Chat sessions with `ai.chats.create()` and `sendMessage()`
- Embeddings with `ai.models.embedContent()` (text and multimodal)
- Context caching with `ai.caches.create()`
- Safety settings per-request via `config.safetySettings`

**When NOT to use:**

- Multi-provider applications (OpenAI + Anthropic + Google) -- use a unified provider SDK
- React-specific chat UI hooks (`useChat`) -- use a framework-integrated AI SDK
- When you need OpenAI-specific features (Responses API, Batch API) -- use the OpenAI SDK

---

## Examples Index

- [Core: Setup & Configuration](examples/core.md) -- Client init, text generation, system instructions, error handling
- [Multimodal Input](examples/multimodal.md) -- Inline images, file upload, video, audio, PDF, `createPartFromUri`
- [Streaming](examples/streaming.md) -- `generateContentStream`, `sendMessageStream`, abort patterns
- [Function Calling / Tools](examples/tools.md) -- `FunctionDeclaration`, `FunctionCallingConfigMode`, manual tool loop, built-in tools
- [Structured Output](examples/structured-output.md) -- JSON mode, Zod schemas, `responseJsonSchema`, enum extraction
- [Chat Sessions](examples/chat.md) -- `ai.chats.create()`, multi-turn, streaming chat, history
- [Advanced: Embeddings, Caching & Safety](examples/advanced.md) -- Embeddings, context caching, safety settings, token counting
- [Quick API Reference](reference.md) -- Model IDs, method signatures, config parameters, safety enums

---

<philosophy>

## Philosophy

The `@google/genai` SDK is Google's **unified client** for the Gemini API and Vertex AI. It replaces the deprecated `@google/generative-ai` package with a cleaner, centralized architecture.

**Core principles:**

1. **Centralized client** -- A single `GoogleGenAI` instance provides all API services via `ai.models`, `ai.chats`, `ai.files`, `ai.caches`. No scattered manager classes.
2. **Model-per-call** -- Pass the model ID string in every API call rather than binding to a model instance. This simplifies multi-model usage.
3. **Config object pattern** -- All generation parameters (`temperature`, `systemInstruction`, `tools`, `safetySettings`) go inside a `config` object, keeping the top-level call clean.
4. **Native multimodal** -- Images, video, audio, and PDFs are first-class inputs via inline data or file upload. Gemini models handle all modalities natively.
5. **Response as property** -- Access `response.text` as a property (not a method). Access `response.functionCalls` for tool calls.

**When to use the Gemini SDK directly:**

- You primarily use Google Gemini models
- You need multimodal input (images, video, audio, PDF) as a core feature
- You want built-in tools like Google Search and code execution
- You need context caching for large documents
- You want the simplest path to Gemini API features

**When NOT to use:**

- You need to switch between providers (OpenAI, Anthropic, Google) -- use a unified SDK
- You want React-specific chat hooks -- use a framework-integrated AI SDK
- You need features unique to other providers (OpenAI Batch API, Anthropic Extended Thinking)

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Client Setup

Initialize the `GoogleGenAI` client. It can auto-read `GOOGLE_API_KEY` from the environment.

```typescript
// lib/gemini.ts
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export { ai };
```

```typescript
// Auto-reads GOOGLE_API_KEY from environment
const ai = new GoogleGenAI({});
```

**Why good:** Minimal setup, env var auto-detected, named export

```typescript
// BAD: Using the old deprecated SDK
import { GoogleGenerativeAI } from "@google/generative-ai";
const genAI = new GoogleGenerativeAI("hardcoded-key"); // WRONG
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
```

**Why bad:** Old deprecated package, hardcoded API key, model binding step no longer needed

**See:** [examples/core.md](examples/core.md) for Vertex AI setup, environment variables, error handling

---

### Pattern 2: Text Generation

Pass model and contents directly -- no `getGenerativeModel()` step.

```typescript
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: "Explain TypeScript generics briefly.",
  config: {
    systemInstruction: "You are a concise coding tutor.",
    temperature: 0.3,
  },
});
console.log(response.text);
```

**Why good:** Model specified per-call, system instruction in config, `response.text` as property

```typescript
// BAD: Old SDK patterns that don't work
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
const result = await model.generateContent("Hello");
console.log(result.response.text()); // text() was a method in old SDK
```

**Why bad:** `getGenerativeModel()` doesn't exist in new SDK, `text()` is a property not a method

**See:** [examples/core.md](examples/core.md) for system instructions, temperature, thinking config

---

### Pattern 3: Streaming

Use `generateContentStream` and iterate with `for await`.

```typescript
const response = await ai.models.generateContentStream({
  model: "gemini-2.5-flash",
  contents: "Write a short story about a robot.",
});

for await (const chunk of response) {
  process.stdout.write(chunk.text ?? "");
}
```

**Why good:** Async iteration, progressive output for better UX, null-safe text access

```typescript
// BAD: Not consuming the stream
const stream = await ai.models.generateContentStream({
  model: "gemini-2.5-flash",
  contents: "Hello",
});
// Stream object returned but never iterated -- response lost
```

**Why bad:** Stream must be consumed via `for await`, otherwise response is silently lost

**See:** [examples/streaming.md](examples/streaming.md) for chat streaming, abort patterns

---

### Pattern 4: Multimodal Input

Gemini natively handles images, video, audio, and PDFs. Use inline base64 or file upload.

```typescript
import * as fs from "node:fs";

const imageBase64 = fs.readFileSync("photo.jpg", { encoding: "base64" });

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: [
    { text: "Describe this image in detail." },
    { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
  ],
});
console.log(response.text);
```

**Why good:** Inline base64 for small files, explicit MIME type, mixed text + media content

For larger files (over ~20 MB), use `ai.files.upload()` and reference via URI:

```typescript
import { createUserContent, createPartFromUri } from "@google/genai";

const uploadedFile = await ai.files.upload({
  file: "large-video.mp4",
  config: { mimeType: "video/mp4" },
});

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: createUserContent([
    "Summarize this video.",
    createPartFromUri(uploadedFile.uri, uploadedFile.mimeType),
  ]),
});
```

**See:** [examples/multimodal.md](examples/multimodal.md) for audio, PDF, video timestamps, file lifecycle

---

### Pattern 5: Function Calling / Tool Use

Define function declarations with `parametersJsonSchema`, then handle tool calls in a loop.

```typescript
import { GoogleGenAI, FunctionCallingConfigMode } from "@google/genai";

const getWeatherDeclaration = {
  name: "get_weather",
  description: "Get current weather for a city",
  parametersJsonSchema: {
    type: "object",
    properties: {
      location: { type: "string", description: "City name" },
    },
    required: ["location"],
  },
};

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: "What is the weather in Tokyo?",
  config: {
    tools: [{ functionDeclarations: [getWeatherDeclaration] }],
    toolConfig: {
      functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO },
    },
  },
});

if (response.functionCalls && response.functionCalls.length > 0) {
  const call = response.functionCalls[0];
  console.log(`Call: ${call.name}`, call.args);
}
```

**Why good:** Typed declarations, explicit mode, args directly accessible

**See:** [examples/tools.md](examples/tools.md) for multi-turn tool loop, parallel calls, built-in Google Search

---

### Pattern 6: Structured Output with Zod

Use `responseMimeType: "application/json"` with `responseJsonSchema` for guaranteed JSON output.

```typescript
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const EventSchema = z.object({
  name: z.string(),
  date: z.string(),
  participants: z.array(z.string()),
});

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: "Alice and Bob meet next Tuesday for lunch.",
  config: {
    responseMimeType: "application/json",
    responseJsonSchema: zodToJsonSchema(EventSchema),
  },
});

const event = EventSchema.parse(JSON.parse(response.text ?? "{}"));
```

**Why good:** Zod schema for type safety, `zodToJsonSchema` converts automatically, parse validates response

**See:** [examples/structured-output.md](examples/structured-output.md) for enum output, complex schemas, raw JSON schema

---

### Pattern 7: Chat Sessions

Use `ai.chats.create()` for multi-turn with automatic history management.

```typescript
const chat = ai.chats.create({
  model: "gemini-2.5-flash",
  config: {
    systemInstruction: "You are a helpful coding assistant.",
  },
});

const r1 = await chat.sendMessage({ message: "What is TypeScript?" });
console.log(r1.text);

const r2 = await chat.sendMessage({ message: "How do generics work?" });
console.log(r2.text);
// Chat automatically maintains conversation history
```

**Why good:** Automatic history tracking, system instruction in config, simple `sendMessage` API

**See:** [examples/chat.md](examples/chat.md) for pre-loaded history, streaming chat, function calling in chat

---

### Pattern 8: Error Handling

Check `response.text` for null and inspect `finishReason` for safety blocks.

```typescript
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: userPrompt,
});

// Check if content was blocked by safety filters
const candidate = response.candidates?.[0];
if (!candidate || candidate.finishReason === "SAFETY") {
  console.warn("Response blocked by safety filters");
  console.warn("Safety ratings:", candidate?.safetyRatings);
  return null;
}

// Check for truncation
if (candidate.finishReason === "MAX_TOKENS") {
  console.warn("Response was truncated -- consider increasing maxOutputTokens");
}

console.log(response.text);
```

**Why good:** Checks safety filter blocks, handles truncation, inspects finish reason

**See:** [examples/core.md](examples/core.md) for try/catch error handling, HTTP error codes

</patterns>

---

<performance>

## Performance Optimization

### Model Selection for Cost/Speed

```
General purpose             -> gemini-2.5-flash (best price/performance balance)
Complex reasoning           -> gemini-2.5-pro (deep reasoning, 1M context)
Budget / high-volume        -> gemini-2.5-flash-lite (cheapest, fastest)
Latest frontier             -> gemini-3-flash-preview (most capable, preview)
Embeddings (text)           -> gemini-embedding-001 (text only, stable)
Embeddings (multimodal)     -> gemini-embedding-2-preview (text, image, video, audio, PDF)
```

### Key Optimization Patterns

- **Use context caching** for repeated queries on the same large document -- reduces cost by up to 75%
- **Batch embeddings** by passing an array to `ai.models.embedContent()` -- one API call for multiple inputs
- **Set `temperature: 0`** for deterministic output (enables server-side caching)
- **Use `gemini-2.5-flash-lite`** for high-volume, latency-sensitive workloads
- **Reduce embedding dimensions** via `config.outputDimensionality` for faster similarity search
- **Use streaming** for user-facing responses to improve perceived latency

</performance>

---

<decision_framework>

## Decision Framework

### Which Model to Choose

```
What is your task?
+-- General text generation -> gemini-2.5-flash (best balance)
+-- Complex reasoning / code -> gemini-2.5-pro (deep thinking, 1M context)
+-- High-volume / budget -> gemini-2.5-flash-lite (cheapest)
+-- Cutting-edge / experimental -> gemini-3-flash-preview
+-- Text embeddings -> gemini-embedding-001
+-- Multimodal embeddings -> gemini-embedding-2-preview
```

### File Input Method

```
How large is your file?
+-- Under 20 MB -> Inline base64 (inlineData)
+-- 20 MB - 2 GB -> ai.files.upload() + createPartFromUri()
+-- Need to reuse across requests -> ai.files.upload() (persists 48 hours)
+-- External URL (Gemini 3+) -> createPartFromUri() with HTTP URL
```

### Structured Output vs Free Text

```
Do you need a specific output shape?
+-- YES -> Set responseMimeType: "application/json"
|   +-- Have a Zod schema? -> zodToJsonSchema() into responseJsonSchema
|   +-- Raw JSON Schema? -> Pass directly to responseJsonSchema
+-- NO -> Default text output (no config needed)
```

### Chat vs Single-Turn

```
Is this a multi-turn conversation?
+-- YES -> ai.chats.create() with sendMessage()
|   +-- Need streaming? -> chat.sendMessageStream()
|   +-- Need function calling? -> Pass tools in chat config
+-- NO -> ai.models.generateContent() (single call)
```

### When to Use Context Caching

```
Are you sending the same large prefix repeatedly?
+-- YES -> Is it 1,024+ tokens (Flash) or 4,096+ (Pro)?
|   +-- YES -> Use ai.caches.create() to cache the prefix
|   +-- NO -> Too small to cache, just send inline
+-- NO -> Standard generateContent() calls
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Using `@google/generative-ai` (the deprecated package) -- migrate to `@google/genai`
- Calling `response.text()` as a method -- it is a property (`response.text`) in the new SDK
- Using `getGenerativeModel()` -- the new SDK passes model as a string in each API call
- Hardcoding API keys instead of using environment variables
- Not checking `finishReason` for `"SAFETY"` or `"MAX_TOKENS"` -- safety blocks silently return no content

**Medium Priority Issues:**

- Putting `temperature`, `tools`, or `systemInstruction` at the top level instead of inside `config`
- Not setting `config.mimeType` when uploading files -- the API may reject or misinterpret the file
- Using `model.startChat()` (old SDK) -- use `ai.chats.create()` in the new SDK
- Not consuming `generateContentStream()` output -- the async iterable must be iterated
- Ignoring uploaded file lifecycle -- files expire after 48 hours

**Common Mistakes:**

- Confusing `responseMimeType` (for structured output) with `mimeType` (for file upload config)
- Using `responseSchema` (old SDK parameter name) instead of `responseJsonSchema` (new SDK)
- Mixing old SDK patterns (`model.generateContent(prompt)`) with new SDK (`ai.models.generateContent({ model, contents })`)
- Passing plain Zod schemas to `responseJsonSchema` -- you must convert with `zodToJsonSchema()` first
- Using `content` (singular) instead of `contents` (plural) in `generateContent()`

**Gotchas & Edge Cases:**

- `response.text` returns `null` (not empty string) when content is blocked by safety filters -- always null-check
- Uploaded files via `ai.files.upload()` expire after 48 hours -- there is no way to extend this, re-upload if needed
- Context caching has minimum token requirements: 1,024 tokens for Flash models, 4,096 for Pro models -- smaller content cannot be cached
- Inline data has a 100 MB payload limit (50 MB for PDFs) -- use file upload for larger content
- `ai.files.upload()` supports up to 2 GB per file, 20 GB per project
- Embedding dimensions default to 3,072 -- use `config.outputDimensionality` to reduce for cost/speed
- Gemini embedding models are NOT compatible with each other -- switching models requires re-embedding all data
- `FunctionCallingConfigMode.ANY` forces the model to always call a function -- use `AUTO` to let the model decide
- Chat history uses `role: "model"` (not `"assistant"`) for Gemini responses -- differs from OpenAI convention
- Safety filter defaults changed: Gemini 2.5+ and 3.x models default to `OFF` (no blocking) unlike earlier models
- The `sendMessage()` method takes `{ message: string }` (object with `message` key), not a plain string
- When function calling returns multiple calls, process ALL of them before sending results back -- partial responses cause errors
- `zodToJsonSchema()` comes from the `zod-to-json-schema` package (separate from `zod`) -- requires `npm install zod-to-json-schema`

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use `@google/genai` (the new unified SDK) -- NOT the deprecated `@google/generative-ai` package)**

**(You MUST access response text via `response.text` (a property) -- NOT `response.text()` (the old SDK used a method call))**

**(You MUST pass `model` as a string parameter in every API call -- there is no `getGenerativeModel()` step)**

**(You MUST use `config` for all generation parameters (temperature, safetySettings, tools, systemInstruction) -- NOT top-level properties)**

**(You MUST never hardcode API keys -- use environment variables via `process.env.GEMINI_API_KEY` or `GOOGLE_API_KEY`)**

**Failure to follow these rules will produce broken integrations due to old SDK patterns or silent safety filter blocks.**

</critical_reminders>
