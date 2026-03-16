# OpenAI SDK -- Embeddings, Vision & Audio Examples

> Embeddings for semantic search, vision/image inputs, audio transcription and TTS, file uploads, and batch processing. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [setup.md](setup.md) -- Client setup, error handling
- [chat.md](chat.md) -- Chat Completions API
- [streaming.md](streaming.md) -- Streaming responses
- [tools.md](tools.md) -- Tool/function calling
- [structured-output.md](structured-output.md) -- Structured outputs with Zod

---

## Embeddings and Semantic Search

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

## Reduced Embedding Dimensions

```typescript
// Use fewer dimensions for cost/speed tradeoff
const response = await client.embeddings.create({
  model: "text-embedding-3-large",
  input: "Some text to embed.",
  dimensions: 256, // Reduce from default 3072
});
```

---

## Vision -- Image from URL

```typescript
// vision.ts
import OpenAI from "openai";

const client = new OpenAI();

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
```

---

## Vision -- Local Image (Base64)

```typescript
import OpenAI from "openai";
import { readFileSync } from "node:fs";

const client = new OpenAI();

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
              detail: "high", // 'low' | 'high' | 'auto'
            },
          },
        ],
      },
    ],
  });

  return response.choices[0].message.content ?? "";
}
```

---

## Vision -- Multiple Images

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

## Audio Transcription (Speech-to-Text)

```typescript
// audio.ts
import OpenAI from "openai";
import { createReadStream } from "node:fs";

const client = new OpenAI();

// Basic transcription
async function transcribe(audioPath: string): Promise<string> {
  const transcription = await client.audio.transcriptions.create({
    model: "whisper-1",
    file: createReadStream(audioPath),
    language: "en",
  });

  return transcription.text;
}

// With word-level timestamps
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

const transcript = await transcribe("./recording.mp3");
console.log("Transcript:", transcript);
```

---

## Text-to-Speech (TTS)

```typescript
import OpenAI from "openai";
import { writeFileSync } from "node:fs";

const client = new OpenAI();

// Basic TTS
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

// With voice instructions (gpt-4o-mini-tts only)
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

await textToSpeech("Hello, welcome to the demo!", "./output.mp3", "nova");
await textToSpeechWithStyle(
  "Breaking news from the tech world!",
  "./news.mp3",
  "Speak like an excited news anchor",
);
```

---

## File Uploads

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

---

## Batch Processing

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

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
