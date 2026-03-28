# Mistral SDK -- Embeddings & Vision Examples

> Embeddings for semantic search and vision/image inputs with vision-capable models. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Client setup, error handling
- [chat.md](chat.md) -- Chat completions and streaming
- [structured-output.md](structured-output.md) -- Structured outputs with Zod
- [function-calling.md](function-calling.md) -- Tool/function calling
- [codestral.md](codestral.md) -- Codestral FIM code completion

---

## Embeddings and Semantic Search

```typescript
// embeddings.ts
import { Mistral } from "@mistralai/mistralai";

const client = new Mistral({ apiKey: process.env["MISTRAL_API_KEY"] ?? "" });

const EMBEDDING_MODEL = "mistral-embed";
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

// Index documents -- batch multiple inputs in one call
const documents = [
  "TypeScript provides static type checking for JavaScript.",
  "React is a library for building user interfaces.",
  "Node.js is a JavaScript runtime built on V8.",
  "PostgreSQL is a powerful relational database.",
  "Docker containers package applications with dependencies.",
];

const docEmbeddings = await client.embeddings.create({
  model: EMBEDDING_MODEL,
  inputs: documents, // NOTE: 'inputs' (plural), not 'input'
});

const indexedDocs = documents.map((text, i) => ({
  text,
  embedding: docEmbeddings.data?.[i]?.embedding ?? [],
}));

// Search
async function search(
  query: string,
): Promise<Array<{ text: string; score: number }>> {
  const queryEmbedding = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    inputs: [query],
  });

  const queryVector = queryEmbedding.data?.[0]?.embedding ?? [];

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

**Why good:** Uses `inputs` (plural, Mistral-specific), batches documents in one call, named constants

---

## Embedding Gotchas

```typescript
// GOOD: Mistral uses 'inputs' (plural)
const result = await client.embeddings.create({
  model: "mistral-embed",
  inputs: ["text to embed"],
});
// Returns 1024-dimensional vectors

// BAD: OpenAI uses 'input' (singular), dimensions differ
const result = await client.embeddings.create({
  model: "mistral-embed",
  input: ["text to embed"], // WRONG: use 'inputs'
});
// OpenAI returns 1536 dimensions, Mistral returns 1024
```

**Why bad:** Wrong parameter name, wrong dimension expectations when migrating from OpenAI

---

## Vision -- Image from URL

```typescript
// vision.ts
import { Mistral } from "@mistralai/mistralai";

const client = new Mistral({ apiKey: process.env["MISTRAL_API_KEY"] ?? "" });

async function analyzeImageUrl(
  imageUrl: string,
  question: string,
): Promise<string> {
  const result = await client.chat.complete({
    model: "mistral-small-latest", // Vision-capable model
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: question },
          {
            type: "image_url",
            imageUrl: imageUrl, // NOTE: flat string, not { url: "..." }
          },
        ],
      },
    ],
  });

  const content = result?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : (content?.join("") ?? "");
}

const description = await analyzeImageUrl(
  "https://example.com/photo.jpg",
  "Describe what you see in this image.",
);
console.log(description);
```

**Why good:** Uses `imageUrl` (camelCase, flat string) -- NOT OpenAI's `image_url: { url: "..." }` nested object

---

## Vision -- Local Image (Base64)

```typescript
import { Mistral } from "@mistralai/mistralai";
import { readFileSync } from "node:fs";

const client = new Mistral({ apiKey: process.env["MISTRAL_API_KEY"] ?? "" });

async function analyzeLocalImage(
  imagePath: string,
  question: string,
): Promise<string> {
  const imageBuffer = readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");
  const mimeType = imagePath.endsWith(".png") ? "image/png" : "image/jpeg";

  const result = await client.chat.complete({
    model: "mistral-small-latest",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: question },
          {
            type: "image_url",
            imageUrl: `data:${mimeType};base64,${base64Image}`,
          },
        ],
      },
    ],
  });

  const content = result?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : (content?.join("") ?? "");
}
```

---

## Vision -- Multiple Images

```typescript
const result = await client.chat.complete({
  model: "mistral-small-latest",
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "Compare these two images." },
        {
          type: "image_url",
          imageUrl: "https://example.com/image1.jpg",
        },
        {
          type: "image_url",
          imageUrl: "https://example.com/image2.jpg",
        },
      ],
    },
  ],
});
```

---

## Vision Model Selection

```
Vision-capable models (as of 2026):
- mistral-small-latest (Mistral Small 4)
- mistral-medium-latest (Mistral Medium 3.1)
- mistral-large-latest (Mistral Large 3)
- ministral-14b-latest, ministral-8b-latest, ministral-3b-latest (Ministral 3)
```

Most current Mistral models support vision. Use `mistral-small-latest` for cost-efficient image analysis.

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
