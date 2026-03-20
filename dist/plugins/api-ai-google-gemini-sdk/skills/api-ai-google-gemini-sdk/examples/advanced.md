# Google Gemini SDK -- Embeddings, Context Caching & Safety Settings

> Text and multimodal embeddings, context caching for cost reduction, safety settings, and token counting. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Client setup, error handling
- [multimodal.md](multimodal.md) -- Multimodal input
- [streaming.md](streaming.md) -- Streaming responses
- [tools.md](tools.md) -- Function calling
- [structured-output.md](structured-output.md) -- Structured JSON output
- [chat.md](chat.md) -- Multi-turn chat

---

## Text Embeddings

```typescript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const response = await ai.models.embedContent({
  model: "gemini-embedding-001",
  contents: "What is the meaning of life?",
});

const embedding = response.embeddings[0].values;
console.log(`Dimensions: ${embedding.length}`); // 3072 by default
```

---

## Batch Embeddings (Multiple Inputs)

```typescript
const response = await ai.models.embedContent({
  model: "gemini-embedding-001",
  contents: [
    "How do I learn TypeScript?",
    "Best practices for React components",
    "How to bake chocolate chip cookies",
  ],
});

// One embedding per input
for (let i = 0; i < response.embeddings.length; i++) {
  console.log(`Input ${i}: ${response.embeddings[i].values.length} dimensions`);
}
```

---

## Embeddings with Task Type

```typescript
// For document storage (indexing)
const docResponse = await ai.models.embedContent({
  model: "gemini-embedding-001",
  contents: "TypeScript is a strongly typed programming language...",
  config: { taskType: "RETRIEVAL_DOCUMENT" },
});

// For search queries
const queryResponse = await ai.models.embedContent({
  model: "gemini-embedding-001",
  contents: "What is TypeScript?",
  config: { taskType: "RETRIEVAL_QUERY" },
});
```

**Available task types:** `SEMANTIC_SIMILARITY`, `CLASSIFICATION`, `CLUSTERING`, `RETRIEVAL_DOCUMENT`, `RETRIEVAL_QUERY`, `CODE_RETRIEVAL_QUERY`, `QUESTION_ANSWERING`, `FACT_VERIFICATION`

---

## Reduced Dimensions

```typescript
const EMBEDDING_DIMENSIONS = 768;

const response = await ai.models.embedContent({
  model: "gemini-embedding-001",
  contents: "Reduce embedding size for faster similarity search.",
  config: { outputDimensionality: EMBEDDING_DIMENSIONS },
});

console.log(`Dimensions: ${response.embeddings[0].values.length}`); // 768
```

**Recommended values:** 768, 1536, or 3072 (default)

---

## Multimodal Embeddings

Use `gemini-embedding-2-preview` for images, video, audio, and PDF:

```typescript
import * as fs from "node:fs";

const imageBase64 = fs.readFileSync("product.png", { encoding: "base64" });

const response = await ai.models.embedContent({
  model: "gemini-embedding-2-preview",
  contents: [
    {
      inlineData: { mimeType: "image/png", data: imageBase64 },
    },
  ],
});

console.log(
  `Image embedding: ${response.embeddings[0].values.length} dimensions`,
);
```

Combined text + image embedding:

```typescript
const response = await ai.models.embedContent({
  model: "gemini-embedding-2-preview",
  contents: {
    parts: [
      { text: "A photo of a golden retriever" },
      { inlineData: { mimeType: "image/png", data: imageBase64 } },
    ],
  },
});
// Returns one aggregated embedding for the combined input
```

---

## Cosine Similarity

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

const response = await ai.models.embedContent({
  model: "gemini-embedding-001",
  contents: [
    "I love programming in TypeScript",
    "TypeScript is my favorite language",
    "How to make pasta carbonara",
  ],
  config: { taskType: "SEMANTIC_SIMILARITY" },
});

const embeddings = response.embeddings.map((e) => e.values);
const sim01 = cosineSimilarity(embeddings[0], embeddings[1]);
const sim02 = cosineSimilarity(embeddings[0], embeddings[2]);

console.log(`Similar topics: ${sim01.toFixed(4)}`); // High similarity
console.log(`Different topics: ${sim02.toFixed(4)}`); // Low similarity
```

---

## Context Caching

Cache large documents to reduce cost when asking multiple questions:

```typescript
import {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
} from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Step 1: Upload the large document
const document = await ai.files.upload({
  file: "large-codebase-analysis.txt",
  config: { mimeType: "text/plain" },
});

// Step 2: Create a cache with the document
const CACHE_TTL = "3600s"; // 1 hour
const cache = await ai.caches.create({
  model: "gemini-2.5-flash",
  config: {
    contents: createUserContent([
      createPartFromUri(document.uri, document.mimeType),
    ]),
    systemInstruction:
      "You are an expert code reviewer analyzing this codebase.",
    displayName: "codebase-review-cache",
    ttl: CACHE_TTL,
  },
});

console.log(`Cache created: ${cache.name}`);

// Step 3: Ask multiple questions using the cache (cheaper than re-sending the document)
const q1 = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: "What are the main architectural patterns used?",
  config: { cachedContent: cache.name },
});
console.log("Q1:", q1.text);

const q2 = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: "Are there any security vulnerabilities?",
  config: { cachedContent: cache.name },
});
console.log("Q2:", q2.text);
```

**Minimum token requirements for caching:**

| Model Family | Minimum Tokens |
| ------------ | -------------- |
| Flash models | 1,024          |
| Pro models   | 4,096          |

---

## Cache Management

```typescript
// Update TTL
const EXTENDED_TTL = "86400s"; // 24 hours
await ai.caches.update({
  name: cache.name,
  config: { ttl: EXTENDED_TTL },
});

// List caches
const PAGE_SIZE = 10;
const pager = await ai.caches.list({ config: { pageSize: PAGE_SIZE } });

// Delete cache
await ai.caches.delete({ name: cache.name });
```

---

## Safety Settings

Configure per-request safety thresholds:

```typescript
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: userInput,
  config: {
    safetySettings: [
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_MEDIUM_AND_ABOVE",
      },
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_ONLY_HIGH",
      },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE",
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_ONLY_HIGH",
      },
    ],
  },
});

// Check if content was blocked
const candidate = response.candidates?.[0];
if (candidate?.finishReason === "SAFETY") {
  console.warn("Content blocked. Safety ratings:");
  for (const rating of candidate.safetyRatings ?? []) {
    console.warn(`  ${rating.category}: ${rating.probability}`);
  }
}
```

**Important:** Gemini 2.5+ and 3.x models default safety filters to `OFF`. Set explicit thresholds if you need content filtering.

---

## Safety Settings -- Disable Filters (Backend Processing)

For backend data processing where content is not user-facing:

```typescript
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: contentToAnalyze,
  config: {
    safetySettings: [
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ],
  },
});
```

**Caution:** Only disable safety filters for backend processing. Always apply appropriate filters for user-facing content.

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
