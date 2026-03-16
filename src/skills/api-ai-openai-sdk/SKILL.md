---
name: api-ai-openai-sdk
description: Official OpenAI SDK patterns for TypeScript/Node.js — client setup, Chat Completions, Responses API, streaming, structured outputs, function calling, embeddings, vision, audio, and production best practices
---

# OpenAI SDK Patterns

> **Quick Guide:** Use the official `openai` npm package (v6+) to interact with OpenAI's API directly. Use `client.responses.create()` (Responses API) for new projects with built-in tools and server-side state, or `client.chat.completions.create()` (Chat Completions) for stateless chat flows. Use `zodResponseFormat` and `client.chat.completions.parse()` for structured outputs. Use `.stream()` or `stream: true` for streaming. Supports GPT-5, GPT-4o, o3, embeddings, vision, audio, batch processing, and assistants.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use the Responses API (`client.responses.create()`) for new projects -- it provides better performance, built-in tools, and server-side conversation state)**

**(You MUST use `zodResponseFormat()` from `openai/helpers/zod` for structured outputs -- do NOT manually construct JSON schemas)**

**(You MUST handle errors using `OpenAI.APIError` and its subclasses -- never use bare catch blocks without error type checking)**

**(You MUST configure appropriate retries and timeouts for production use -- the SDK retries 2 times by default on 429/5xx errors)**

**(You MUST never hardcode API keys -- always use environment variables via `process.env.OPENAI_API_KEY`)**

</critical_requirements>

---

**Auto-detection:** OpenAI, openai, client.chat.completions, client.responses.create, client.embeddings, client.audio, zodResponseFormat, zodFunction, runTools, GPT-4o, GPT-5, o3, text-embedding-3, whisper, tts, OPENAI_API_KEY, toFile

**When to use:**

- Building applications that call OpenAI models directly (GPT-5, GPT-4o, o3, etc.)
- Implementing chat completions with streaming responses
- Using the Responses API for agentic workflows with built-in tools (web search, file search, code interpreter)
- Extracting structured data from LLM responses with Zod schema validation
- Implementing function calling / tool use with the Chat Completions or Responses API
- Creating embeddings for RAG pipelines or semantic search
- Processing images with vision models or audio with Whisper/TTS
- Running batch jobs for high-volume, cost-efficient processing

**Key patterns covered:**

- Client initialization and configuration (retries, timeouts, proxies)
- Chat Completions API (messages, streaming, function calling)
- Responses API (input, instructions, built-in tools, server-side state)
- Structured outputs with `zodResponseFormat` and `client.chat.completions.parse()`
- Streaming with `for await...of`, `.stream()` helper, and event handling
- Embeddings API (`text-embedding-3-small`, `text-embedding-3-large`)
- Vision (image URLs, base64), Audio (Whisper transcription, TTS), Batch API
- Error handling, retries, timeouts, and production best practices

**When NOT to use:**

- Multi-provider applications where you want to switch between OpenAI, Anthropic, Google, etc. -- use Vercel AI SDK instead
- React chat UI hooks (`useChat`, `useCompletion`) -- use Vercel AI SDK which provides these
- When you need a unified abstraction over multiple LLM providers

**Detailed Resources:**

- For practical code examples, see [examples/openai-sdk.md](examples/openai-sdk.md)
- For quick API reference tables, see [reference.md](reference.md)

---

<philosophy>

## Philosophy

The official OpenAI SDK provides **direct, low-level access** to OpenAI's full API surface. It is the thinnest possible wrapper over the REST API, auto-generated from OpenAI's OpenAPI specification using Stainless.

**Core principles:**

1. **Direct API access** -- No abstractions or provider layers. You get the exact API that OpenAI documents, with full TypeScript types. Every API feature is available immediately when OpenAI releases it.
2. **Two API paradigms** -- The **Responses API** (`client.responses.create()`) is the newer, recommended API with built-in tools and server-side state. The **Chat Completions API** (`client.chat.completions.create()`) remains fully supported for stateless chat flows.
3. **Built-in resilience** -- The SDK handles retries (2 by default on 429/5xx), timeouts (10 min default), and auto-pagination out of the box.
4. **Streaming as a first-class pattern** -- Use `stream: true` for SSE-based streaming, `.stream()` helper for event-based consumption, or `for await...of` for simple iteration.
5. **Type-safe structured outputs** -- `zodResponseFormat()` and `client.chat.completions.parse()` convert Zod schemas to JSON Schema and parse responses, giving you validated, typed objects.

**When to use the OpenAI SDK directly:**

- You only use OpenAI models and want the simplest, most direct integration
- You need access to OpenAI-specific features (Responses API, Assistants, Batch, Realtime)
- You want minimal dependencies and zero abstraction overhead
- You need the latest API features on day one

**When NOT to use:**

- You need to switch between providers (OpenAI, Anthropic, Google) -- use Vercel AI SDK
- You want React chat UI hooks -- use `@ai-sdk/react`
- You want a higher-level agent framework -- consider OpenAI Agents SDK (`@openai/agents`)

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Client Setup

Initialize the OpenAI client with configuration. The client auto-reads `OPENAI_API_KEY` from the environment.

```typescript
// lib/openai.ts
import OpenAI from "openai";

// Basic setup -- reads OPENAI_API_KEY from env automatically
const client = new OpenAI();

export { client };
```

**Why good:** Minimal setup, env var auto-detected, named export

```typescript
// BAD: Hardcoded API key
const client = new OpenAI({
  apiKey: "sk-proj-abc123def456", // NEVER hardcode API keys
});
```

**Why bad:** API key exposed in source code, will leak to version control

#### Production Configuration

```typescript
// lib/openai.ts
import OpenAI from "openai";

const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: TIMEOUT_MS,
  maxRetries: MAX_RETRIES,
});

export { client };
```

#### Azure OpenAI

```typescript
// lib/azure-openai.ts
import { AzureOpenAI } from "openai";

const azureClient = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  apiVersion: "2024-10-21",
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
});

export { azureClient };
```

---

### Pattern 2: Chat Completions API

The established API for stateless text generation. Use for simple chat flows where you manage conversation history yourself.

```typescript
// lib/chat.ts
import OpenAI from "openai";

const client = new OpenAI();

const completion = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [
    { role: "developer", content: "You are a helpful coding assistant." },
    { role: "user", content: "Explain TypeScript generics with an example." },
  ],
});

console.log(completion.choices[0].message.content);
console.log(`Tokens used: ${completion.usage?.total_tokens}`);
```

**Why good:** Clear message roles, developer message for system instructions, usage tracking

```typescript
// BAD: No system/developer message, no error handling
const res = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "do something" }],
});
console.log(res.choices[0].message.content);
```

**Why bad:** No system instruction means unpredictable behavior, no error handling, vague prompt

#### Multi-Turn Conversations

```typescript
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const client = new OpenAI();

const messages: ChatCompletionMessageParam[] = [
  { role: "developer", content: "You are a TypeScript expert." },
  { role: "user", content: "What is a union type?" },
];

const completion = await client.chat.completions.create({
  model: "gpt-4o",
  messages,
});

// Append assistant response for next turn
const assistantMessage = completion.choices[0].message;
messages.push(assistantMessage);
messages.push({ role: "user", content: "Give me a real-world example." });

const followUp = await client.chat.completions.create({
  model: "gpt-4o",
  messages,
});
```

---

### Pattern 3: Responses API (Recommended for New Projects)

The newer API primitive with built-in tools, server-side conversation state, and better performance with reasoning models. Recommended for all new projects.

```typescript
// lib/responses.ts
import OpenAI from "openai";

const client = new OpenAI();

const response = await client.responses.create({
  model: "gpt-4o",
  instructions: "You are a coding assistant that explains concepts clearly.",
  input: "What are TypeScript generics?",
});

console.log(response.output_text);
```

**Why good:** Clean separation of instructions and input, `output_text` helper for direct text access, simpler than messages array

```typescript
// BAD: Using Chat Completions pattern with Responses API
const response = await client.responses.create({
  model: "gpt-4o",
  // BAD: 'messages' is not a valid Responses API parameter
  messages: [{ role: "user", content: "Hello" }],
});
```

**Why bad:** Responses API uses `input` and `instructions`, not `messages`

#### Server-Side Conversation State

```typescript
// Multi-turn with automatic state management
const firstResponse = await client.responses.create({
  model: "gpt-4o",
  instructions: "You are a helpful assistant.",
  input: "What is the capital of France?",
  store: true, // Required for server-side state
});

// Chain conversations using previous_response_id
const followUp = await client.responses.create({
  model: "gpt-4o",
  input: "What is its population?",
  previous_response_id: firstResponse.id,
  store: true,
});

console.log(followUp.output_text);
// No need to send full message history -- server manages state
```

#### Built-in Web Search

```typescript
const response = await client.responses.create({
  model: "gpt-4o",
  tools: [{ type: "web_search_preview" }],
  input: "What are the latest TypeScript 5.8 features?",
});

console.log(response.output_text);
```

#### Built-in File Search

```typescript
const response = await client.responses.create({
  model: "gpt-4o",
  tools: [
    {
      type: "file_search",
      vector_store_ids: ["vs_abc123"],
    },
  ],
  input: "What does our refund policy say about digital products?",
});

console.log(response.output_text);
```

#### Built-in Code Interpreter

```typescript
const response = await client.responses.create({
  model: "gpt-4o",
  tools: [{ type: "code_interpreter" }],
  input:
    "Calculate the standard deviation of [10, 20, 30, 40, 50] and plot a histogram.",
});

console.log(response.output_text);
```

---

### Pattern 4: Streaming

Use streaming for user-facing responses. The SDK supports `stream: true` for SSE iteration and the `.stream()` helper for event-based consumption.

#### Basic Streaming with `for await`

```typescript
import OpenAI from "openai";

const client = new OpenAI();

// Chat Completions streaming
const stream = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [
    { role: "developer", content: "You are a helpful assistant." },
    { role: "user", content: "Explain async/await in TypeScript." },
  ],
  stream: true,
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) {
    process.stdout.write(content);
  }
}
```

**Why good:** `stream: true` returns async iterable, progressive output, handles chunks correctly

#### Responses API Streaming

```typescript
const stream = await client.responses.create({
  model: "gpt-4o",
  input: "Write a haiku about TypeScript.",
  stream: true,
});

for await (const event of stream) {
  if (event.type === "response.output_text.delta") {
    process.stdout.write(event.delta);
  }
}
```

#### Event-Based Streaming with `.stream()` Helper

```typescript
const stream = client.chat.completions.stream({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Tell me a story." }],
});

stream.on("content", (delta, snapshot) => {
  process.stdout.write(delta);
});

stream.on("error", (error) => {
  console.error("Stream error:", error);
});

const finalContent = await stream.finalContent();
console.log("\n\nFinal:", finalContent);
```

**Why good:** Event-based API for granular control, `finalContent()` promise for complete text, error event handling

```typescript
// BAD: Not consuming the stream
const stream = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello" }],
  stream: true,
});
// Stream is never consumed -- tokens are lost
console.log("Done!"); // Prints immediately, no output
```

**Why bad:** Stream must be consumed via iteration or event handlers, otherwise tokens are lost

---

### Pattern 5: Structured Outputs with Zod

Use `zodResponseFormat()` and `client.chat.completions.parse()` for type-safe structured responses. The SDK converts Zod schemas to JSON Schema and parses the model output automatically.

```typescript
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const client = new OpenAI();

const CalendarEvent = z.object({
  name: z.string(),
  date: z.string(),
  participants: z.array(z.string()),
});

const completion = await client.chat.completions.parse({
  model: "gpt-4o",
  messages: [
    { role: "developer", content: "Extract event details from the text." },
    {
      role: "user",
      content: "Alice and Bob are meeting for lunch next Tuesday.",
    },
  ],
  response_format: zodResponseFormat(CalendarEvent, "calendar_event"),
});

// Fully typed and validated
const event = completion.choices[0].message.parsed;
if (event) {
  console.log(event.name); // string
  console.log(event.participants); // string[]
}
```

**Why good:** `zodResponseFormat` auto-converts schema, `.parse()` validates output, result is fully typed, handles refusals

```typescript
// BAD: Manually constructing JSON schema
const completion = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Extract data" }],
  response_format: {
    type: "json_schema",
    json_schema: {
      name: "event",
      strict: true,
      schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          date: { type: "string" },
        },
        required: ["name", "date"],
        additionalProperties: false,
      },
    },
  },
});
// Then manually JSON.parse the content -- error-prone
const data = JSON.parse(completion.choices[0].message.content ?? "{}");
```

**Why bad:** Manual JSON schema is verbose and error-prone, no type safety, manual parsing can fail

#### Handling Refusals

```typescript
const completion = await client.chat.completions.parse({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Generate harmful content" }],
  response_format: zodResponseFormat(SomeSchema, "output"),
});

const message = completion.choices[0].message;

if (message.refusal) {
  console.log("Model refused:", message.refusal);
} else if (message.parsed) {
  console.log("Parsed output:", message.parsed);
}
```

#### Structured Outputs with Responses API

```typescript
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const PersonSchema = z.object({
  name: z.string(),
  age: z.number(),
});

const response = await client.responses.parse({
  model: "gpt-4o",
  input: "Jane is 54 years old.",
  text: {
    format: zodTextFormat(PersonSchema, "person"),
  },
});

console.log(response.output_parsed);
// { name: 'Jane', age: 54 }
```

---

### Pattern 6: Function Calling / Tool Use

Define functions the model can call. Use `zodFunction()` for type-safe tool definitions and `runTools()` for automated execution loops.

#### Chat Completions with Tools

```typescript
import OpenAI from "openai";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

const client = new OpenAI();

const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get the current weather for a location",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "City name" },
          unit: { type: "string", enum: ["celsius", "fahrenheit"] },
        },
        required: ["location"],
        additionalProperties: false,
      },
      strict: true,
    },
  },
];

const completion = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "What is the weather in Tokyo?" }],
  tools,
});

const toolCall = completion.choices[0].message.tool_calls?.[0];
if (toolCall) {
  const args = JSON.parse(toolCall.function.arguments);
  console.log(`Call ${toolCall.function.name} with:`, args);
}
```

#### Zod-Based Tools with zodFunction

```typescript
import { zodFunction } from "openai/helpers/zod";
import { z } from "zod";

const GetWeatherParams = z.object({
  location: z.string().describe("City name"),
  unit: z.enum(["celsius", "fahrenheit"]).default("celsius"),
});

const completion = await client.chat.completions.parse({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Weather in Paris?" }],
  tools: [zodFunction({ name: "get_weather", parameters: GetWeatherParams })],
});

const toolCall = completion.choices[0].message.tool_calls?.[0];
if (toolCall?.type === "function") {
  // toolCall.function.parsed_arguments is typed from Zod schema
  console.log(toolCall.function.parsed_arguments);
}
```

**Why good:** `zodFunction` provides type-safe argument parsing, `.describe()` guides the model, strict mode by default

#### Automated Tool Execution with runTools

```typescript
import OpenAI from "openai";

const client = new OpenAI();

async function getWeather(args: { location: string }): Promise<string> {
  return `Weather in ${args.location}: 22C, sunny`;
}

async function getTime(args: { timezone: string }): Promise<string> {
  return `Current time in ${args.timezone}: 14:30`;
}

const MAX_TOOL_COMPLETIONS = 5;

const runner = client.chat.completions.runTools({
  model: "gpt-4o",
  messages: [
    { role: "user", content: "What is the weather and time in London?" },
  ],
  tools: [
    {
      type: "function",
      function: {
        function: getWeather,
        parse: JSON.parse,
        parameters: {
          type: "object",
          properties: { location: { type: "string" } },
          required: ["location"],
        },
      },
    },
    {
      type: "function",
      function: {
        function: getTime,
        parse: JSON.parse,
        parameters: {
          type: "object",
          properties: { timezone: { type: "string" } },
          required: ["timezone"],
        },
      },
    },
  ],
  maxChatCompletions: MAX_TOOL_COMPLETIONS,
});

runner.on("message", (message) => console.log("Message:", message.role));

const finalContent = await runner.finalContent();
console.log("Final:", finalContent);
```

**Why good:** `runTools` handles the tool call loop automatically, `maxChatCompletions` prevents infinite loops, event-based monitoring

#### Responses API Function Calling

```typescript
const response = await client.responses.create({
  model: "gpt-4o",
  input: "What is the weather in San Francisco?",
  tools: [
    {
      type: "function",
      name: "get_weather",
      description: "Get weather for a location",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string" },
        },
        required: ["location"],
        additionalProperties: false,
      },
    },
  ],
});

// Check output items for function calls
for (const item of response.output) {
  if (item.type === "function_call") {
    console.log(`Function: ${item.name}, Args: ${item.arguments}`);
  }
}
```

---

### Pattern 7: Embeddings

Generate vector embeddings for semantic search, RAG pipelines, and clustering.

```typescript
import OpenAI from "openai";

const client = new OpenAI();

// Single embedding
const embeddingResponse = await client.embeddings.create({
  model: "text-embedding-3-small",
  input: "TypeScript is a typed superset of JavaScript.",
});

const embedding = embeddingResponse.data[0].embedding;
console.log(`Dimensions: ${embedding.length}`); // 1536

// Batch embeddings
const batchResponse = await client.embeddings.create({
  model: "text-embedding-3-small",
  input: [
    "First document about TypeScript.",
    "Second document about JavaScript.",
    "Third document about Python.",
  ],
});

const embeddings = batchResponse.data.map((d) => d.embedding);
console.log(`Generated ${embeddings.length} embeddings`);
```

**Why good:** Batch multiple inputs in a single call, model selection is clear, dimension info accessible

#### Cosine Similarity

```typescript
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

const SIMILARITY_THRESHOLD = 0.8;

const query = await client.embeddings.create({
  model: "text-embedding-3-small",
  input: "How do generics work?",
});

const queryEmbedding = query.data[0].embedding;

// Compare against stored embeddings
const similarities = storedEmbeddings.map((stored, index) => ({
  index,
  score: cosineSimilarity(queryEmbedding, stored),
}));

const relevant = similarities
  .filter((s) => s.score > SIMILARITY_THRESHOLD)
  .sort((a, b) => b.score - a.score);
```

#### Reduced Dimensions

```typescript
// Use fewer dimensions for cost/speed tradeoff
const response = await client.embeddings.create({
  model: "text-embedding-3-large",
  input: "Some text to embed.",
  dimensions: 256, // Reduce from default 3072
});
```

---

### Pattern 8: Vision (Image Inputs)

Send images to vision-capable models via URLs or base64 encoding.

```typescript
import OpenAI from "openai";

const client = new OpenAI();

// Image from URL
const response = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "What is in this image?" },
        {
          type: "image_url",
          image_url: { url: "https://example.com/photo.jpg" },
        },
      ],
    },
  ],
});

console.log(response.choices[0].message.content);
```

**Why good:** Multi-part content array supports mixed text and images, URL-based is simplest

#### Base64 Image Input

```typescript
import { readFileSync } from "node:fs";

const imageBuffer = readFileSync("/path/to/image.png");
const base64Image = imageBuffer.toString("base64");

const response = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "Describe this diagram." },
        {
          type: "image_url",
          image_url: {
            url: `data:image/png;base64,${base64Image}`,
            detail: "high", // 'low' | 'high' | 'auto'
          },
        },
      ],
    },
  ],
});
```

#### Multiple Images

```typescript
const response = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "Compare these two images." },
        {
          type: "image_url",
          image_url: { url: "https://example.com/image1.jpg" },
        },
        {
          type: "image_url",
          image_url: { url: "https://example.com/image2.jpg" },
        },
      ],
    },
  ],
});
```

---

### Pattern 9: Audio (Transcription and TTS)

Use Whisper models for speech-to-text and TTS models for text-to-speech.

#### Transcription (Speech-to-Text)

```typescript
import OpenAI from "openai";
import { createReadStream } from "node:fs";

const client = new OpenAI();

const transcription = await client.audio.transcriptions.create({
  model: "whisper-1",
  file: createReadStream("/path/to/audio.mp3"),
  language: "en",
});

console.log(transcription.text);
```

**Why good:** Simple file stream input, language hint improves accuracy, returns plain text

#### Advanced Transcription with Timestamps

```typescript
const transcription = await client.audio.transcriptions.create({
  model: "whisper-1",
  file: createReadStream("/path/to/audio.mp3"),
  response_format: "verbose_json",
  timestamp_granularities: ["word", "segment"],
});

// Access word-level timestamps
if (transcription.words) {
  for (const word of transcription.words) {
    console.log(`${word.word} [${word.start}s - ${word.end}s]`);
  }
}
```

#### Text-to-Speech (TTS)

```typescript
import OpenAI from "openai";
import { writeFileSync } from "node:fs";

const client = new OpenAI();

const speech = await client.audio.speech.create({
  model: "tts-1",
  voice: "alloy", // alloy, ash, ballad, coral, echo, fable, nova, onyx, sage, shimmer
  input: "Hello! Welcome to our application.",
});

const buffer = Buffer.from(await speech.arrayBuffer());
writeFileSync("/path/to/output.mp3", buffer);
```

#### High-Quality TTS with Voice Control

```typescript
const speech = await client.audio.speech.create({
  model: "gpt-4o-mini-tts", // Supports voice instructions
  voice: "coral",
  input: "This is exciting news about our product launch!",
  instructions: "Speak with enthusiasm and energy.",
  response_format: "opus", // mp3, opus, aac, flac, wav, pcm
  speed: 1.0, // 0.25 to 4.0
});
```

---

### Pattern 10: File Uploads

Upload files for fine-tuning, batch processing, or Assistants API usage.

```typescript
import OpenAI, { toFile } from "openai";
import { createReadStream } from "node:fs";

const client = new OpenAI();

// From file path (Node.js ReadStream)
const fileFromPath = await client.files.create({
  file: createReadStream("training-data.jsonl"),
  purpose: "fine-tune",
});

// From Buffer using toFile helper
const fileFromBuffer = await client.files.create({
  file: await toFile(Buffer.from('{"prompt": "Hi"}'), "data.jsonl"),
  purpose: "fine-tune",
});

// From fetch Response
const fileFromFetch = await client.files.create({
  file: await fetch("https://example.com/data.jsonl"),
  purpose: "fine-tune",
});

console.log(`Uploaded: ${fileFromPath.id}`);
```

**Why good:** Multiple input methods (stream, buffer, fetch), `toFile` helper for non-file sources, clear purpose parameter

---

### Pattern 11: Batch API

Process large volumes of requests asynchronously at 50% lower cost. Ideal for evaluations, classifications, and embeddings at scale.

```typescript
import OpenAI from "openai";
import { createReadStream, writeFileSync } from "node:fs";

const client = new OpenAI();

// Step 1: Create JSONL input file
const requests = [
  {
    custom_id: "req-1",
    method: "POST",
    url: "/v1/chat/completions",
    body: {
      model: "gpt-4o",
      messages: [{ role: "user", content: "Summarize: TypeScript is great." }],
    },
  },
  {
    custom_id: "req-2",
    method: "POST",
    url: "/v1/chat/completions",
    body: {
      model: "gpt-4o",
      messages: [
        { role: "user", content: "Summarize: JavaScript is flexible." },
      ],
    },
  },
];

const jsonl = requests.map((r) => JSON.stringify(r)).join("\n");
writeFileSync("batch-input.jsonl", jsonl);

// Step 2: Upload the input file
const inputFile = await client.files.create({
  file: createReadStream("batch-input.jsonl"),
  purpose: "batch",
});

// Step 3: Create the batch
const batch = await client.batches.create({
  input_file_id: inputFile.id,
  endpoint: "/v1/chat/completions",
  completion_window: "24h",
});

console.log(`Batch ID: ${batch.id}, Status: ${batch.status}`);

// Step 4: Poll for completion
const POLL_INTERVAL_MS = 60_000;
let batchStatus = batch;
while (batchStatus.status !== "completed" && batchStatus.status !== "failed") {
  await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  batchStatus = await client.batches.retrieve(batch.id);
  console.log(`Status: ${batchStatus.status}`);
}

// Step 5: Retrieve results
if (batchStatus.output_file_id) {
  const outputFile = await client.files.content(batchStatus.output_file_id);
  const results = await outputFile.text();
  console.log("Results:", results);
}
```

**Why good:** 50% cost reduction, named constants, proper polling pattern, error status handling

---

### Pattern 12: Error Handling

The SDK provides typed error classes for each HTTP status code. Always catch specific error types.

```typescript
import OpenAI from "openai";

const client = new OpenAI();

try {
  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: "Hello" }],
  });
  console.log(completion.choices[0].message.content);
} catch (error) {
  if (error instanceof OpenAI.APIError) {
    console.error(`API Error: ${error.status} ${error.message}`);
    console.error(`Request ID: ${error.request_id}`);

    if (error instanceof OpenAI.RateLimitError) {
      console.error("Rate limited -- back off and retry");
    } else if (error instanceof OpenAI.AuthenticationError) {
      console.error("Invalid API key -- check OPENAI_API_KEY");
    } else if (error instanceof OpenAI.BadRequestError) {
      console.error("Bad request -- check parameters");
    } else if (error instanceof OpenAI.InternalServerError) {
      console.error("Server error -- will be auto-retried");
    }
  } else {
    throw error; // Re-throw non-API errors
  }
}
```

**Why good:** Specific error types with status codes, request ID for debugging, re-throws unexpected errors

```typescript
// BAD: Swallowing all errors
try {
  const completion = await client.chat.completions.create({
    /* ... */
  });
} catch {
  // Silently ignoring errors -- bugs will be invisible
}
```

**Why bad:** Silent catch blocks hide bugs, no error type checking, no logging

#### Error Type Reference

```typescript
// Error class hierarchy:
// OpenAI.APIError (base)
//   ├── OpenAI.BadRequestError          (400)
//   ├── OpenAI.AuthenticationError      (401)
//   ├── OpenAI.PermissionDeniedError    (403)
//   ├── OpenAI.NotFoundError            (404)
//   ├── OpenAI.UnprocessableEntityError (422)
//   ├── OpenAI.RateLimitError           (429)
//   ├── OpenAI.InternalServerError      (>=500)
//   └── OpenAI.APIConnectionError       (network)
//       └── OpenAI.APIConnectionTimeoutError (timeout)
```

#### Stream Error Handling

```typescript
const stream = client.chat.completions.stream({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello" }],
});

stream.on("error", (error) => {
  if (error instanceof OpenAI.APIError) {
    console.error(`Stream API error: ${error.status}`);
  } else {
    console.error("Stream connection error:", error);
  }
});

stream.on("content", (delta) => {
  process.stdout.write(delta);
});

await stream.finalContent();
```

</patterns>

---

<performance>

## Performance Optimization

### Token Usage Tracking

```typescript
const completion = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello" }],
});

const usage = completion.usage;
if (usage) {
  console.log(`Prompt tokens: ${usage.prompt_tokens}`);
  console.log(`Completion tokens: ${usage.completion_tokens}`);
  console.log(`Total tokens: ${usage.total_tokens}`);

  // Cached tokens (prompt caching)
  if (usage.prompt_tokens_details?.cached_tokens) {
    console.log(`Cached: ${usage.prompt_tokens_details.cached_tokens}`);
  }
}
```

### Controlling Output Length

```typescript
const MAX_TOKENS = 500;

const completion = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Summarize this article." }],
  max_tokens: MAX_TOKENS,
  temperature: 0, // Deterministic output for caching
});

if (completion.choices[0].finish_reason === "length") {
  console.warn("Output was truncated -- increase max_tokens");
}
```

### Request Cancellation with AbortController

```typescript
const controller = new AbortController();
const ABORT_TIMEOUT_MS = 5_000;

// Cancel after timeout
setTimeout(() => controller.abort(), ABORT_TIMEOUT_MS);

try {
  const completion = await client.chat.completions.create(
    { model: "gpt-4o", messages: [{ role: "user", content: "Hello" }] },
    { signal: controller.signal },
  );
} catch (error) {
  if (error instanceof Error && error.name === "AbortError") {
    console.log("Request was cancelled");
  }
}
```

### Model Selection for Cost/Speed

```
Cost-sensitive batch jobs → gpt-4o-mini (cheapest)
General purpose            → gpt-4o (good balance)
Complex reasoning          → o3 or o3-mini
Embeddings                 → text-embedding-3-small (cheapest) or text-embedding-3-large (highest quality)
Transcription              → whisper-1 or gpt-4o-mini-transcribe (fewer hallucinations)
TTS                        → tts-1 (fast) or tts-1-hd (quality) or gpt-4o-mini-tts (voice control)
```

</performance>

---

<decision_framework>

## Decision Framework

### Which API to Use

```
Building a new application?
├─ YES -> Need built-in tools (web search, file search, code interpreter)?
│   ├─ YES -> Use Responses API (client.responses.create())
│   └─ NO -> Need server-side conversation state?
│       ├─ YES -> Use Responses API with store: true
│       └─ NO -> Either API works, prefer Responses for new code
└─ Existing Chat Completions code?
    ├─ Working fine? -> Keep using Chat Completions (fully supported)
    └─ Need new features? -> Consider migrating to Responses API
```

### Which Model to Choose

```
What is your task?
├─ General text generation -> gpt-4o (best overall)
├─ Fast + cheap simple tasks -> gpt-4o-mini
├─ Complex reasoning / math -> o3 or o3-mini
├─ Structured output -> gpt-4o (best schema adherence)
├─ Vision (images) -> gpt-4o or gpt-4o-mini
├─ Embeddings -> text-embedding-3-small (default) or text-embedding-3-large (higher quality)
├─ Transcription -> whisper-1 or gpt-4o-mini-transcribe
├─ Text-to-speech -> tts-1 (fast) or gpt-4o-mini-tts (voice instructions)
└─ Batch processing -> gpt-4o-mini (cheapest at 50% batch discount)
```

### Streaming vs Non-Streaming

```
Is the response user-facing?
├─ YES -> Use streaming (stream: true or .stream())
│   ├─ Need event-level control? -> .stream() with event handlers
│   └─ Simple text output? -> stream: true with for await
└─ NO -> Use non-streaming
    ├─ Background processing -> client.chat.completions.create()
    ├─ Structured output -> client.chat.completions.parse()
    └─ High volume -> Batch API
```

### OpenAI SDK vs Vercel AI SDK

```
Do you need multiple providers (OpenAI + Anthropic + Google)?
├─ YES -> Use Vercel AI SDK (unified provider API)
└─ NO -> Do you need React hooks (useChat, useCompletion)?
    ├─ YES -> Use Vercel AI SDK + @ai-sdk/react
    └─ NO -> Do you need OpenAI-specific features?
        ├─ YES -> Use OpenAI SDK directly
        │   Examples: Responses API, Assistants, Batch API,
        │   Realtime API, built-in web search/file search
        └─ NO -> Either works, OpenAI SDK is simpler for OpenAI-only
```

</decision_framework>

---

<integration>

## Integration Guide

**Works with:**

- **Zod**: Schema validation for structured outputs via `zodResponseFormat()` and `zodFunction()`
- **Next.js**: Route handlers for streaming, edge runtime compatible
- **Express/Fastify/Hono**: Any Node.js server framework for API routes
- **Vercel AI SDK**: Can use alongside AI SDK -- AI SDK wraps OpenAI SDK via `@ai-sdk/openai`
- **Vector databases**: Embeddings integrate with Pinecone, Weaviate, Qdrant, pgvector, etc.
- **OpenAI Agents SDK**: `@openai/agents` provides higher-level agent primitives built on the OpenAI SDK

**Package ecosystem:**

- `openai` -- Core SDK (always required)
- `@openai/agents` -- Agents SDK for multi-agent workflows
- `zod` -- Schema definitions for structured outputs and tool parameters

**Replaces / Conflicts with:**

- Using `fetch` directly against OpenAI REST API -- SDK provides retries, types, streaming helpers
- `langchain` for simple OpenAI-only use cases -- SDK is lighter weight

</integration>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Hardcoding API keys instead of using environment variables (security breach risk)
- Using bare `catch` blocks without checking `OpenAI.APIError` (hides API errors)
- Not consuming streams returned by `stream: true` (tokens are silently lost)
- Using `JSON.parse()` on completion content without `zodResponseFormat` (fragile, no validation)
- Sending full conversation history every request when Responses API's `previous_response_id` could manage state

**Medium Priority Issues:**

- Not setting `maxRetries` / `timeout` for production deployments (10 min default timeout may be too long)
- Missing `developer` role message (no system instruction = unpredictable output style)
- Using deprecated `system` role instead of `developer` role in Chat Completions
- Not checking `finish_reason` for `'length'` truncation
- Ignoring `usage` data (no cost visibility)

**Common Mistakes:**

- Confusing Responses API (`client.responses.create()`) with Chat Completions (`client.chat.completions.create()`) parameters -- they use different shapes
- Using `messages` parameter with Responses API (it uses `input` and `instructions`)
- Using `response_format` with models that don't support structured outputs (need gpt-4o or later)
- Not handling the case where `completion.choices[0].message.tool_calls` is undefined
- Forgetting that `runTools()` defaults to max 10 completions -- set `maxChatCompletions` explicitly

**Gotchas & Edge Cases:**

- The SDK auto-retries on 429 (rate limit) and 5xx errors -- 2 retries by default. Disable with `maxRetries: 0` if you handle retries yourself.
- `stream: true` returns raw SSE chunks. Use `.stream()` helper for a nicer event-based API.
- `client.chat.completions.parse()` throws `LengthFinishReasonError` if `finish_reason` is `'length'` and `ContentFilterFinishReasonError` if `'content_filter'`.
- Embedding responses return `Float64Array` typed arrays -- convert to regular arrays with `Array.from()` if needed.
- File uploads support `ReadStream`, `File`, `fetch()` Response, and `toFile()` helper -- use whichever matches your data source.
- The Responses API's `store: true` enables server-side state but also means OpenAI stores your conversations. Set `store: false` for sensitive data.
- `developer` role replaces `system` role in newer models (gpt-4o and later).
- Batch API has a 24h completion window and 50,000 request limit per batch.
- Audio transcription has a 25 MB file size limit.
- Zod schemas with `zodResponseFormat` must use `additionalProperties: false` -- the SDK handles this automatically.

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use the Responses API (`client.responses.create()`) for new projects -- it provides better performance, built-in tools, and server-side conversation state)**

**(You MUST use `zodResponseFormat()` from `openai/helpers/zod` for structured outputs -- do NOT manually construct JSON schemas)**

**(You MUST handle errors using `OpenAI.APIError` and its subclasses -- never use bare catch blocks without error type checking)**

**(You MUST configure appropriate retries and timeouts for production use -- the SDK retries 2 times by default on 429/5xx errors)**

**(You MUST never hardcode API keys -- always use environment variables via `process.env.OPENAI_API_KEY`)**

**Failure to follow these rules will produce insecure, unreliable, or poorly-typed AI integrations.**

</critical_reminders>
