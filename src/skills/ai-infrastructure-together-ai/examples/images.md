# Together AI SDK -- Images & Embeddings Examples

> Image generation with FLUX/Stable Diffusion and embeddings for semantic search. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Client setup, error handling
- [chat.md](chat.md) -- Chat Completions API
- [streaming.md](streaming.md) -- Streaming responses
- [tools.md](tools.md) -- Tool/function calling
- [structured-output.md](structured-output.md) -- Structured outputs with Zod

---

## Basic Image Generation (FLUX schnell)

```typescript
// image-generation.ts
import Together from "together-ai";

const client = new Together();

const response = await client.images.generate({
  model: "black-forest-labs/FLUX.1-schnell",
  prompt: "A serene mountain landscape at sunset with a lake reflection",
  steps: 4,
});

console.log(response.data[0].url);
```

---

## High Quality Image (FLUX Pro)

```typescript
import Together from "together-ai";

const client = new Together();

const IMAGE_WIDTH = 1024;
const IMAGE_HEIGHT = 768;
const IMAGE_STEPS = 25;

const response = await client.images.generate({
  model: "black-forest-labs/FLUX.1.1-pro",
  prompt: "A photorealistic portrait of a robot in a garden",
  width: IMAGE_WIDTH,
  height: IMAGE_HEIGHT,
  steps: IMAGE_STEPS,
});

console.log(response.data[0].url);
```

---

## Multiple Image Variations

```typescript
import Together from "together-ai";

const client = new Together();

const NUM_VARIATIONS = 4;

const response = await client.images.generate({
  model: "black-forest-labs/FLUX.1-schnell",
  prompt: "A cute robot assistant helping in a modern office",
  n: NUM_VARIATIONS,
  steps: 4,
});

response.data.forEach((image, index) => {
  console.log(`Variation ${index + 1}: ${image.url}`);
});
```

---

## Base64 Response Format

```typescript
import Together from "together-ai";

const client = new Together();

const response = await client.images.generate({
  model: "black-forest-labs/FLUX.1-schnell",
  prompt: "A cat in outer space",
  response_format: "base64",
});

const base64Data = response.data[0].b64_json;
// Use directly in <img src="data:image/png;base64,${base64Data}" />
```

---

## Image Editing with Reference Images (FLUX.2)

```typescript
import Together from "together-ai";

const client = new Together();

const response = await client.images.generate({
  model: "black-forest-labs/FLUX.2-pro",
  prompt: "Replace the color of the car to blue",
  width: 1024,
  height: 768,
  reference_images: ["https://example.com/original-car.jpg"],
});

console.log(response.data[0].url);
```

---

## Kontext Image Editing

```typescript
import Together from "together-ai";

const client = new Together();

const response = await client.images.generate({
  model: "black-forest-labs/FLUX.1-kontext-pro",
  prompt: "Add a party hat to the dog",
  image_url: "https://example.com/dog.jpg",
});

console.log(response.data[0].url);
```

---

## Image Model Selection Guide

```
Fast generation (4 steps)      -> FLUX.1 schnell (aspect_ratio param)
High quality                   -> FLUX.1.1 pro (width/height params)
Latest + reference images      -> FLUX.2 pro (width/height + reference_images)
Image editing (single ref)     -> FLUX.1 Kontext pro (aspect_ratio + image_url)
Negative prompts               -> Stable Diffusion models (negative_prompt param)
```

---

## Basic Embeddings

```typescript
// embeddings.ts
import Together from "together-ai";

const client = new Together();
const EMBEDDING_MODEL = "BAAI/bge-large-en-v1.5";

const response = await client.embeddings.create({
  model: EMBEDDING_MODEL,
  input: "TypeScript provides static type checking for JavaScript.",
});

console.log("Embedding dimensions:", response.data[0].embedding.length);
console.log("First 5 values:", response.data[0].embedding.slice(0, 5));
```

---

## Batch Embeddings

```typescript
import Together from "together-ai";

const client = new Together();
const EMBEDDING_MODEL = "BAAI/bge-large-en-v1.5";

const documents = [
  "TypeScript provides static type checking.",
  "React is a library for building user interfaces.",
  "Node.js is a JavaScript runtime built on V8.",
  "PostgreSQL is a powerful relational database.",
];

// Batch all inputs in one call for efficiency
const response = await client.embeddings.create({
  model: EMBEDDING_MODEL,
  input: documents,
});

const embeddings = response.data.map((item) => ({
  index: item.index,
  embedding: item.embedding,
}));

console.log(`Generated ${embeddings.length} embeddings`);
```

---

## Semantic Search with Cosine Similarity

```typescript
import Together from "together-ai";

const client = new Together();
const EMBEDDING_MODEL = "BAAI/bge-large-en-v1.5";
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
  "PostgreSQL is a powerful relational database.",
  "Docker containers package applications with dependencies.",
];

const docEmbeddings = await client.embeddings.create({
  model: EMBEDDING_MODEL,
  input: documents,
});

const indexedDocs = documents.map((text, i) => ({
  text,
  embedding: docEmbeddings.data[i].embedding,
}));

// Search
async function search(
  query: string,
): Promise<Array<{ text: string; score: number }>> {
  const queryEmbedding = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: query,
  });

  const queryVector = queryEmbedding.data[0].embedding;

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

## Fine-Tuning (File Upload + Job Creation)

```typescript
import Together from "together-ai";
import { createReadStream } from "node:fs";

const client = new Together();
const EPOCHS = 3;

// Upload training data (JSONL format)
const file = await client.files.upload({
  file: createReadStream("training-data.jsonl"),
  purpose: "fine-tune",
});
console.log(`Uploaded file: ${file.id}`);

// Create fine-tuning job
const job = await client.fineTuning.create({
  training_file: file.id,
  model: "meta-llama/Meta-Llama-3-8B-Instruct",
  n_epochs: EPOCHS,
});
console.log(`Fine-tuning job: ${job.id}`);

// Monitor job status
const status = await client.fineTuning.retrieve(job.id);
console.log(`Status: ${status.status}`);

// List events
const events = await client.fineTuning.listEvents(job.id);
console.log("Events:", events);
```

### Training Data Format (JSONL)

Each line is a JSON object with a `messages` array:

```jsonl
{"messages": [{"role": "system", "content": "You are helpful."}, {"role": "user", "content": "Hi"}, {"role": "assistant", "content": "Hello!"}]}
{"messages": [{"role": "user", "content": "What is TypeScript?"}, {"role": "assistant", "content": "TypeScript is a typed superset of JavaScript."}]}
```

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
