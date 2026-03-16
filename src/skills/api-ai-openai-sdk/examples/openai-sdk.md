# OpenAI SDK Practical Examples

> Complete, runnable code examples for common OpenAI SDK patterns. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for API reference.

---

## Example 1: Basic Chat Completion

```typescript
// basic-chat.ts
import OpenAI from "openai";

const client = new OpenAI();

async function chat(userMessage: string): Promise<string> {
  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "developer",
        content: "You are a helpful assistant. Be concise.",
      },
      { role: "user", content: userMessage },
    ],
  });

  const content = completion.choices[0].message.content;
  if (!content) {
    throw new Error("No content in response");
  }

  console.log(`Tokens: ${completion.usage?.total_tokens}`);
  return content;
}

const answer = await chat("What is TypeScript in one sentence?");
console.log(answer);
```

---

## Example 2: Streaming Chat Response

```typescript
// streaming-chat.ts
import OpenAI from "openai";

const client = new OpenAI();

// Approach 1: Simple for-await streaming
async function streamSimple(prompt: string): Promise<void> {
  const stream = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "developer", content: "You are a helpful assistant." },
      { role: "user", content: prompt },
    ],
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      process.stdout.write(content);
    }
  }
  console.log(); // newline
}

// Approach 2: Event-based streaming with .stream() helper
async function streamWithEvents(prompt: string): Promise<string> {
  const stream = client.chat.completions.stream({
    model: "gpt-4o",
    messages: [
      { role: "developer", content: "You are a helpful assistant." },
      { role: "user", content: prompt },
    ],
  });

  stream.on("content", (delta) => {
    process.stdout.write(delta);
  });

  stream.on("error", (error) => {
    console.error("Stream error:", error);
  });

  const content = await stream.finalContent();
  console.log(); // newline
  return content ?? "";
}

await streamSimple("Explain closures in JavaScript.");
const result = await streamWithEvents("Explain promises in JavaScript.");
console.log("Final result length:", result.length);
```

---

## Example 3: Structured Output with Zod

```typescript
// structured-output.ts
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const client = new OpenAI();

// Define the schema for extracted data
const ArticleSummary = z.object({
  title: z.string(),
  summary: z.string(),
  keyPoints: z.array(z.string()),
  sentiment: z.enum(["positive", "negative", "neutral"]),
  wordCount: z.number(),
});

type ArticleSummary = z.infer<typeof ArticleSummary>;

async function extractArticleSummary(
  articleText: string,
): Promise<ArticleSummary | null> {
  const completion = await client.chat.completions.parse({
    model: "gpt-4o",
    messages: [
      {
        role: "developer",
        content: "Extract a structured summary from the provided article text.",
      },
      { role: "user", content: articleText },
    ],
    response_format: zodResponseFormat(ArticleSummary, "article_summary"),
  });

  const message = completion.choices[0].message;

  // Handle safety refusals
  if (message.refusal) {
    console.warn("Model refused:", message.refusal);
    return null;
  }

  return message.parsed;
}

const article = `
TypeScript 5.8 brings exciting new features including improved type inference,
better error messages, and performance optimizations. The release focuses on
developer experience improvements that make everyday coding more productive.
`;

const summary = await extractArticleSummary(article);
if (summary) {
  console.log(`Title: ${summary.title}`);
  console.log(`Sentiment: ${summary.sentiment}`);
  console.log("Key Points:");
  summary.keyPoints.forEach((point) => console.log(`  - ${point}`));
}
```

---

## Example 4: Function Calling with zodFunction

```typescript
// function-calling.ts
import OpenAI from "openai";
import { zodFunction } from "openai/helpers/zod";
import { z } from "zod";

const client = new OpenAI();

// Define tool schemas with Zod
const GetWeatherParams = z.object({
  location: z.string().describe('City name, e.g. "San Francisco"'),
  unit: z.enum(["celsius", "fahrenheit"]).default("celsius"),
});

const SearchDatabaseParams = z.object({
  query: z.string().describe("Search query string"),
  limit: z.number().default(10).describe("Max results to return"),
});

// Tool implementations
async function getWeather(
  args: z.infer<typeof GetWeatherParams>,
): Promise<string> {
  // In production, call a real weather API
  return JSON.stringify({
    location: args.location,
    temperature: 22,
    unit: args.unit,
    condition: "sunny",
  });
}

async function searchDatabase(
  args: z.infer<typeof SearchDatabaseParams>,
): Promise<string> {
  // In production, query your database
  return JSON.stringify({
    results: [{ id: 1, title: `Result for: ${args.query}` }],
    total: 1,
  });
}

// Map tool names to implementations
const toolImplementations: Record<string, (args: unknown) => Promise<string>> =
  {
    get_weather: getWeather as (args: unknown) => Promise<string>,
    search_database: searchDatabase as (args: unknown) => Promise<string>,
  };

// Create completion with tools
const completion = await client.chat.completions.parse({
  model: "gpt-4o",
  messages: [
    {
      role: "developer",
      content: "You help users by calling available tools.",
    },
    { role: "user", content: "What is the weather in Tokyo?" },
  ],
  tools: [
    zodFunction({ name: "get_weather", parameters: GetWeatherParams }),
    zodFunction({ name: "search_database", parameters: SearchDatabaseParams }),
  ],
});

// Process tool calls
const message = completion.choices[0].message;
if (message.tool_calls && message.tool_calls.length > 0) {
  for (const toolCall of message.tool_calls) {
    const fnName = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments);
    console.log(`Calling ${fnName} with:`, args);

    const impl = toolImplementations[fnName];
    if (impl) {
      const result = await impl(args);
      console.log(`Result: ${result}`);
    }
  }
}
```

---

## Example 5: Automated Tool Loop with runTools

```typescript
// run-tools.ts
import OpenAI from "openai";

const client = new OpenAI();

const MAX_TOOL_CALLS = 5;

async function getWeather(args: { location: string }): Promise<string> {
  return `Weather in ${args.location}: 22C, sunny`;
}

async function getTime(args: { timezone: string }): Promise<string> {
  return `Time in ${args.timezone}: ${new Date().toLocaleTimeString()}`;
}

const runner = client.chat.completions.runTools({
  model: "gpt-4o",
  messages: [
    { role: "developer", content: "Help users with weather and time queries." },
    {
      role: "user",
      content: "What is the weather and current time in London?",
    },
  ],
  tools: [
    {
      type: "function",
      function: {
        function: getWeather,
        parse: JSON.parse,
        description: "Get current weather for a location",
        parameters: {
          type: "object",
          properties: {
            location: { type: "string", description: "City name" },
          },
          required: ["location"],
        },
      },
    },
    {
      type: "function",
      function: {
        function: getTime,
        parse: JSON.parse,
        description: "Get current time in a timezone",
        parameters: {
          type: "object",
          properties: {
            timezone: {
              type: "string",
              description: "Timezone, e.g. Europe/London",
            },
          },
          required: ["timezone"],
        },
      },
    },
  ],
  maxChatCompletions: MAX_TOOL_CALLS,
});

// Monitor the tool execution loop
runner.on("message", (msg) => {
  if (msg.role === "assistant" && msg.tool_calls) {
    console.log(`[Tool calls: ${msg.tool_calls.length}]`);
  }
  if (msg.role === "tool") {
    console.log(`[Tool result received]`);
  }
});

const finalContent = await runner.finalContent();
console.log("\nFinal answer:", finalContent);
```

---

## Example 6: Responses API with Built-in Tools

```typescript
// responses-api.ts
import OpenAI from "openai";

const client = new OpenAI();

// Simple text generation
const simple = await client.responses.create({
  model: "gpt-4o",
  instructions: "You are a concise technical writer.",
  input: "Explain TypeScript generics in 3 sentences.",
});
console.log("Simple:", simple.output_text);

// With web search
const withSearch = await client.responses.create({
  model: "gpt-4o",
  tools: [{ type: "web_search_preview" }],
  input: "What are the latest features in Node.js 22?",
});
console.log("Web search:", withSearch.output_text);

// Multi-turn conversation
const turn1 = await client.responses.create({
  model: "gpt-4o",
  instructions: "You are a geography expert.",
  input: "What is the capital of France?",
  store: true,
});
console.log("Turn 1:", turn1.output_text);

const turn2 = await client.responses.create({
  model: "gpt-4o",
  input: "What is its population?",
  previous_response_id: turn1.id,
  store: true,
});
console.log("Turn 2:", turn2.output_text);

// Streaming with Responses API
const streamResponse = await client.responses.create({
  model: "gpt-4o",
  input: "Write a haiku about coding.",
  stream: true,
});

for await (const event of streamResponse) {
  if (event.type === "response.output_text.delta") {
    process.stdout.write(event.delta);
  }
}
console.log();
```

---

## Example 7: Embeddings and Semantic Search

```typescript
// embeddings.ts
import OpenAI from "openai";

const client = new OpenAI();
const EMBEDDING_MODEL = "text-embedding-3-small";
const SIMILARITY_THRESHOLD = 0.7;
const TOP_K = 3;

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Index documents
const documents = [
  "TypeScript provides static type checking for JavaScript.",
  "React is a library for building user interfaces.",
  "Node.js is a JavaScript runtime built on V8.",
  "PostgreSQL is a powerful relational database.",
  "Docker containers package applications with dependencies.",
];

const docEmbeddings = await client.embeddings.create({
  model: EMBEDDING_MODEL,
  input: documents,
});

const indexedDocs = documents.map((text, i) => ({
  text,
  embedding: Array.from(docEmbeddings.data[i].embedding),
}));

// Search
async function search(
  query: string,
): Promise<Array<{ text: string; score: number }>> {
  const queryEmbedding = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: query,
  });

  const queryVector = Array.from(queryEmbedding.data[0].embedding);

  return indexedDocs
    .map((doc) => ({
      text: doc.text,
      score: cosineSimilarity(queryVector, doc.embedding),
    }))
    .filter((r) => r.score > SIMILARITY_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K);
}

const results = await search("What is TypeScript?");
results.forEach((r) => {
  console.log(`[${r.score.toFixed(3)}] ${r.text}`);
});
```

---

## Example 8: Vision (Image Analysis)

```typescript
// vision.ts
import OpenAI from "openai";
import { readFileSync } from "node:fs";

const client = new OpenAI();

// Analyze image from URL
async function analyzeImageUrl(
  imageUrl: string,
  question: string,
): Promise<string> {
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: question },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
  });

  return response.choices[0].message.content ?? "";
}

// Analyze local image (base64)
async function analyzeLocalImage(
  imagePath: string,
  question: string,
): Promise<string> {
  const imageBuffer = readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");
  const mimeType = imagePath.endsWith(".png") ? "image/png" : "image/jpeg";

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: question },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
              detail: "high",
            },
          },
        ],
      },
    ],
  });

  return response.choices[0].message.content ?? "";
}

// Compare two images
async function compareImages(url1: string, url2: string): Promise<string> {
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Compare these two images. What are the key differences?",
          },
          { type: "image_url", image_url: { url: url1 } },
          { type: "image_url", image_url: { url: url2 } },
        ],
      },
    ],
  });

  return response.choices[0].message.content ?? "";
}
```

---

## Example 9: Audio (Transcription and TTS)

```typescript
// audio.ts
import OpenAI from "openai";
import { createReadStream, writeFileSync } from "node:fs";

const client = new OpenAI();

// Transcribe audio file
async function transcribe(audioPath: string): Promise<string> {
  const transcription = await client.audio.transcriptions.create({
    model: "whisper-1",
    file: createReadStream(audioPath),
    language: "en",
  });

  return transcription.text;
}

// Transcribe with word-level timestamps
async function transcribeWithTimestamps(audioPath: string) {
  const transcription = await client.audio.transcriptions.create({
    model: "whisper-1",
    file: createReadStream(audioPath),
    response_format: "verbose_json",
    timestamp_granularities: ["word"],
  });

  return transcription.words?.map((w) => ({
    word: w.word,
    start: w.start,
    end: w.end,
  }));
}

// Generate speech from text
async function textToSpeech(
  text: string,
  outputPath: string,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy",
): Promise<void> {
  const speech = await client.audio.speech.create({
    model: "tts-1",
    voice,
    input: text,
  });

  const buffer = Buffer.from(await speech.arrayBuffer());
  writeFileSync(outputPath, buffer);
  console.log(`Speech saved to ${outputPath}`);
}

// Generate speech with voice instructions (gpt-4o-mini-tts only)
async function textToSpeechWithStyle(
  text: string,
  outputPath: string,
  style: string,
): Promise<void> {
  const speech = await client.audio.speech.create({
    model: "gpt-4o-mini-tts",
    voice: "coral",
    input: text,
    instructions: style,
  });

  const buffer = Buffer.from(await speech.arrayBuffer());
  writeFileSync(outputPath, buffer);
}

const transcript = await transcribe("./recording.mp3");
console.log("Transcript:", transcript);

await textToSpeech("Hello, welcome to the demo!", "./output.mp3", "nova");
await textToSpeechWithStyle(
  "Breaking news from the tech world!",
  "./news.mp3",
  "Speak like an excited news anchor",
);
```

---

## Example 10: Production Error Handling

```typescript
// error-handling.ts
import OpenAI from "openai";

const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

const client = new OpenAI({
  timeout: TIMEOUT_MS,
  maxRetries: MAX_RETRIES,
});

async function safeCompletion(prompt: string): Promise<string | null> {
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "developer", content: "You are a helpful assistant." },
        { role: "user", content: prompt },
      ],
    });

    // Check for truncation
    if (completion.choices[0].finish_reason === "length") {
      console.warn("Response was truncated");
    }

    return completion.choices[0].message.content;
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      console.error(`OpenAI API Error [${error.status}]: ${error.message}`);
      console.error(`Request ID: ${error.request_id}`);

      if (error instanceof OpenAI.RateLimitError) {
        console.error("Rate limited. SDK will auto-retry.");
        // If we get here, all retries were exhausted
        return null;
      }

      if (error instanceof OpenAI.AuthenticationError) {
        throw new Error(
          "Invalid API key. Check OPENAI_API_KEY environment variable.",
        );
      }

      if (error instanceof OpenAI.BadRequestError) {
        console.error("Invalid request parameters:", error.message);
        return null;
      }

      // Server errors (5xx) -- SDK auto-retries, if we're here all retries failed
      if (error instanceof OpenAI.InternalServerError) {
        console.error("OpenAI server error after all retries");
        return null;
      }
    }

    // Network/connection errors
    if (error instanceof OpenAI.APIConnectionError) {
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

## Example 11: Batch Processing

```typescript
// batch-processing.ts
import OpenAI, { toFile } from "openai";

const client = new OpenAI();
const POLL_INTERVAL_MS = 30_000;

interface BatchRequest {
  custom_id: string;
  method: "POST";
  url: string;
  body: {
    model: string;
    messages: Array<{ role: string; content: string }>;
  };
}

// Create batch input
function createBatchInput(prompts: string[]): string {
  const requests: BatchRequest[] = prompts.map((prompt, index) => ({
    custom_id: `req-${index}`,
    method: "POST",
    url: "/v1/chat/completions",
    body: {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "developer",
          content: "Classify the sentiment as positive, negative, or neutral.",
        },
        { role: "user", content: prompt },
      ],
    },
  }));

  return requests.map((r) => JSON.stringify(r)).join("\n");
}

async function runBatch(prompts: string[]): Promise<string> {
  // Upload input file
  const jsonl = createBatchInput(prompts);
  const inputFile = await client.files.create({
    file: await toFile(Buffer.from(jsonl), "batch-input.jsonl"),
    purpose: "batch",
  });

  // Create batch
  const batch = await client.batches.create({
    input_file_id: inputFile.id,
    endpoint: "/v1/chat/completions",
    completion_window: "24h",
  });

  console.log(`Batch ${batch.id} created. Polling...`);

  // Poll for completion
  let status = batch;
  while (
    !["completed", "failed", "cancelled", "expired"].includes(status.status)
  ) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    status = await client.batches.retrieve(batch.id);
    console.log(
      `Status: ${status.status} (${status.request_counts?.completed ?? 0}/${status.request_counts?.total ?? 0})`,
    );
  }

  if (status.status !== "completed" || !status.output_file_id) {
    throw new Error(`Batch ${status.status}: ${JSON.stringify(status.errors)}`);
  }

  // Download results
  const outputFile = await client.files.content(status.output_file_id);
  return outputFile.text();
}

const prompts = [
  "I love this product! It exceeded my expectations.",
  "The service was terrible and the food was cold.",
  "The meeting was rescheduled to next Tuesday.",
];

const results = await runBatch(prompts);
console.log("Batch results:", results);
```

---

## Example 12: Responses API with Function Calling

```typescript
// responses-function-calling.ts
import OpenAI from "openai";

const client = new OpenAI();

// Define the function tool for Responses API
const response = await client.responses.create({
  model: "gpt-4o",
  instructions: "You are a helpful assistant with access to weather data.",
  input: "What is the weather like in San Francisco and New York?",
  tools: [
    {
      type: "function",
      name: "get_weather",
      description: "Get current weather for a city",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "City name" },
        },
        required: ["location"],
        additionalProperties: false,
      },
    },
  ],
});

// Process function call outputs
const functionCalls = response.output.filter(
  (item) => item.type === "function_call",
);

for (const call of functionCalls) {
  console.log(`Function: ${call.name}`);
  console.log(`Arguments: ${call.arguments}`);
  console.log(`Call ID: ${call.call_id}`);
}

// Submit function results back to continue the conversation
if (functionCalls.length > 0) {
  const toolOutputs = functionCalls.map((call) => ({
    type: "function_call_output" as const,
    call_id: call.call_id,
    output: JSON.stringify({ temperature: 22, condition: "sunny" }),
  }));

  const followUp = await client.responses.create({
    model: "gpt-4o",
    input: toolOutputs,
    previous_response_id: response.id,
    store: true,
  });

  console.log("Final answer:", followUp.output_text);
}
```

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
