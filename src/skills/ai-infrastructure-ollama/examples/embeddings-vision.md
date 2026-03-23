# Ollama -- Embeddings & Vision Examples

> Text embeddings for semantic search, vision/multimodal image analysis. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Client setup, chat, streaming
- [tools.md](tools.md) -- Tool/function calling
- [structured-output.md](structured-output.md) -- Structured output with Zod
- [model-management.md](model-management.md) -- Model lifecycle

---

## Embeddings and Semantic Search

```typescript
import ollama from "ollama";

const EMBEDDING_MODEL = "nomic-embed-text";
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

// Index documents (batch embedding)
const documents = [
  "TypeScript provides static type checking for JavaScript.",
  "React is a library for building user interfaces.",
  "Node.js is a JavaScript runtime built on V8.",
  "PostgreSQL is a powerful relational database.",
  "Docker containers package applications with dependencies.",
];

const docEmbeddings = await ollama.embed({
  model: EMBEDDING_MODEL,
  input: documents,
});

const indexedDocs = documents.map((text, i) => ({
  text,
  embedding: docEmbeddings.embeddings[i],
}));

// Search
async function search(
  query: string,
): Promise<Array<{ text: string; score: number }>> {
  const queryEmbedding = await ollama.embed({
    model: EMBEDDING_MODEL,
    input: query,
  });

  const queryVector = queryEmbedding.embeddings[0];

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

## Single Text Embedding

```typescript
import ollama from "ollama";

const EMBEDDING_MODEL = "nomic-embed-text";

const response = await ollama.embed({
  model: EMBEDDING_MODEL,
  input: "TypeScript is a typed superset of JavaScript.",
});

const vector = response.embeddings[0];
console.log(`Dimensions: ${vector.length}`);
console.log(`First 5 values: ${vector.slice(0, 5).join(", ")}`);
```

---

## Vision -- Image Analysis with Chat

```typescript
import ollama from "ollama";
import { readFileSync } from "node:fs";

async function analyzeImage(
  imagePath: string,
  question: string,
): Promise<string> {
  const imageBuffer = readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");

  const response = await ollama.chat({
    model: "llama3.2-vision",
    messages: [
      {
        role: "user",
        content: question,
        images: [base64Image],
      },
    ],
  });

  return response.message.content;
}

const description = await analyzeImage(
  "./photo.jpg",
  "What do you see in this image?",
);
console.log(description);
```

---

## Vision -- Multiple Images

```typescript
import ollama from "ollama";
import { readFileSync } from "node:fs";

async function compareImages(
  imagePath1: string,
  imagePath2: string,
): Promise<string> {
  const image1 = readFileSync(imagePath1).toString("base64");
  const image2 = readFileSync(imagePath2).toString("base64");

  const response = await ollama.chat({
    model: "llama3.2-vision",
    messages: [
      {
        role: "user",
        content: "Compare these two images. What are the differences?",
        images: [image1, image2],
      },
    ],
  });

  return response.message.content;
}

const comparison = await compareImages("./before.jpg", "./after.jpg");
console.log(comparison);
```

---

## Vision with Generate API

```typescript
import ollama from "ollama";
import { readFileSync } from "node:fs";

const imageBuffer = readFileSync("./screenshot.png");
const base64Image = imageBuffer.toString("base64");

const response = await ollama.generate({
  model: "llama3.2-vision",
  prompt: "Describe the UI elements in this screenshot.",
  images: [base64Image],
});

console.log(response.response);
```

---

## Vision with Uint8Array

```typescript
import ollama from "ollama";
import { readFileSync } from "node:fs";

// Images can be Uint8Array instead of base64 strings
const imageBuffer = readFileSync("./photo.jpg");
const imageBytes = new Uint8Array(imageBuffer);

const response = await ollama.chat({
  model: "llama3.2-vision",
  messages: [
    {
      role: "user",
      content: "What is in this image?",
      images: [imageBytes],
    },
  ],
});

console.log(response.message.content);
```

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
