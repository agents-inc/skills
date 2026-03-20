# Chroma -- Embedding Function Examples

> Default, OpenAI, and custom embedding function configuration. See [core.md](core.md) for basic operations and [reference.md](../reference.md) for the full provider list.

**Related examples:**

- [core.md](core.md) -- Client setup, add, query
- [metadata-filtering.md](metadata-filtering.md) -- Filter operators

---

## Default Embedding Function

The default embedding function uses `all-MiniLM-L6-v2` (Sentence Transformers), running locally. Requires a separate package since v3.

```bash
npm install chromadb @chroma-core/default-embed
```

```typescript
import { ChromaClient } from "chromadb";

const COLLECTION_NAME = "articles";

async function createWithDefaultEmbedding(client: ChromaClient) {
  // No embeddingFunction parameter needed -- uses default automatically
  const collection = await client.createCollection({
    name: COLLECTION_NAME,
    configuration: { hnsw: { space: "cosine" } },
  });

  // Documents are embedded automatically using all-MiniLM-L6-v2
  await collection.add({
    ids: ["doc-1", "doc-2"],
    documents: [
      "Introduction to machine learning",
      "Advanced neural network architectures",
    ],
  });

  return collection;
}

export { createWithDefaultEmbedding };
```

**Why good:** Simplest setup -- just pass documents, embedding happens automatically. No API keys needed, runs locally.

**Note:** `@chroma-core/default-embed` must be installed even though it's not explicitly imported. Chroma resolves it at runtime.

---

## OpenAI Embedding Function

Use OpenAI's `text-embedding-3-small` for higher-quality embeddings.

```bash
npm install @chroma-core/openai
```

```typescript
import { ChromaClient } from "chromadb";
import { OpenAIEmbeddingFunction } from "@chroma-core/openai";

const COLLECTION_NAME = "knowledge-base";

async function createWithOpenAI(client: ChromaClient) {
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }

  const embeddingFunction = new OpenAIEmbeddingFunction({
    modelName: "text-embedding-3-small",
  });

  const collection = await client.createCollection({
    name: COLLECTION_NAME,
    embeddingFunction,
    configuration: { hnsw: { space: "cosine" } },
  });

  return collection;
}

export { createWithOpenAI };
```

**Why good:** API key from environment (reads `OPENAI_API_KEY` automatically), explicit model name, cosine metric matches OpenAI's normalized embeddings

**Note:** When retrieving an existing collection with `getCollection`, you must pass the same `embeddingFunction` so that queries are embedded correctly:

```typescript
const collection = await client.getCollection({
  name: COLLECTION_NAME,
  embeddingFunction: new OpenAIEmbeddingFunction({
    modelName: "text-embedding-3-small",
  }),
});
```

---

## Custom Embedding Function

Implement the `EmbeddingFunction` interface for custom models.

```typescript
import type { EmbeddingFunction } from "chromadb";

class CustomEmbeddingFunction implements EmbeddingFunction {
  public readonly name = "custom-embedder";
  private readonly model: string;

  constructor(args: { model: string }) {
    this.model = args.model;
  }

  async generate(texts: string[]): Promise<number[][]> {
    // Replace with your embedding logic
    // Must return one embedding vector per input text
    const embeddings = await Promise.all(
      texts.map(async (text) => {
        // Call your embedding API or model
        return new Array(384).fill(0).map(() => Math.random());
      }),
    );
    return embeddings;
  }

  getConfig(): Record<string, unknown> {
    return { model: this.model };
  }

  validateConfigUpdate(config: Record<string, unknown>): void {
    if ("model" in config) {
      throw new Error("Model cannot be updated after creation");
    }
  }

  static buildFromConfig(
    config: Record<string, unknown>,
  ): CustomEmbeddingFunction {
    return new CustomEmbeddingFunction({ model: config.model as string });
  }
}

export { CustomEmbeddingFunction };
```

**Why good:** Implements required interface methods, immutable model config, `generate()` returns one vector per input

---

## Using Embedding Functions Directly

You can invoke embedding functions independently for debugging or pre-computation.

```typescript
import { DefaultEmbeddingFunction } from "@chroma-core/default-embed";

async function debugEmbeddings(): Promise<void> {
  const embeddingFn = new DefaultEmbeddingFunction();

  // Generate embeddings outside of a collection
  const embeddings = await embeddingFn.generate([
    "test document one",
    "test document two",
  ]);

  console.log("Dimension:", embeddings[0].length);
  console.log("First embedding (first 5 values):", embeddings[0].slice(0, 5));
}

export { debugEmbeddings };
```

**Why good:** Useful for verifying embedding dimensions, debugging embedding quality, or pre-computing embeddings for external use

---

## Collection with Ollama Embeddings

Use locally-hosted models via Ollama.

```bash
npm install @chroma-core/ollama
```

```typescript
import { ChromaClient } from "chromadb";
import { OllamaEmbeddingFunction } from "@chroma-core/ollama";

const COLLECTION_NAME = "local-knowledge";

async function createWithOllama(client: ChromaClient) {
  const embeddingFunction = new OllamaEmbeddingFunction({
    url: process.env.OLLAMA_URL ?? "http://localhost:11434",
    model: "nomic-embed-text",
  });

  const collection = await client.createCollection({
    name: COLLECTION_NAME,
    embeddingFunction,
    configuration: { hnsw: { space: "cosine" } },
  });

  return collection;
}

export { createWithOllama };
```

**Why good:** Fully local embedding pipeline (no API keys), configurable Ollama URL, explicit model name

---

## Embedding Function Gotchas

**Dimension mismatch:** If you change embedding functions on an existing collection (e.g., switch from default 384-dim to OpenAI 1536-dim), queries will fail with dimension mismatch errors. Delete and recreate the collection with the new function.

**Consistency requirement:** Always pass the same embedding function to `getCollection()` / `getOrCreateCollection()` as was used at creation. If you omit it, Chroma uses the default, which may produce different-dimension embeddings.

**Query vs add:** The same embedding function is used for both `add()` (document embedding) and `query()` (query embedding). Do not mix different embedding models between add and query operations on the same collection.

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
