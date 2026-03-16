# Vercel AI SDK RAG & Embeddings Examples

> Embeddings (embed, embedMany), vector similarity, and retrieval augmented generation patterns. See [SKILL.md](../SKILL.md) for core concepts.

**Core patterns:** See [core.md](core.md). **Structured output:** See [structured-output.md](structured-output.md).

---

## Pattern 1: Single Embedding

### Good Example -- Embed a Query

```typescript
// lib/embeddings.ts
import { embed } from 'ai';

export async function embedQuery(text: string): Promise<number[]> {
  const { embedding, usage } = await embed({
    model: 'openai/text-embedding-3-small',
    value: text,
  });

  console.log(`Embedding tokens: ${usage.tokens}`);
  return embedding; // number[] -- vector of floats
}
```

**Why good:** Simple API, usage tracking, typed return value

### Good Example -- With Provider Options (Custom Dimensions)

```typescript
import { embed } from 'ai';

const EMBEDDING_DIMENSIONS = 512;

const { embedding } = await embed({
  model: 'openai/text-embedding-3-small',
  value: 'sunny day at the beach',
  providerOptions: {
    openai: {
      dimensions: EMBEDDING_DIMENSIONS, // Reduce dimensions for smaller storage
    },
  },
});

console.log(`Vector length: ${embedding.length}`); // 512
```

**Why good:** Named constant for dimensions, provider-specific options for optimization, reduced storage cost

---

## Pattern 2: Batch Embeddings

### Good Example -- Embed Multiple Documents

```typescript
// lib/batch-embed.ts
import { embedMany } from 'ai';

const MAX_PARALLEL_CALLS = 3;

export async function embedDocuments(documents: string[]): Promise<number[][]> {
  const { embeddings, usage } = await embedMany({
    model: 'openai/text-embedding-3-small',
    values: documents,
    maxParallelCalls: MAX_PARALLEL_CALLS,
  });

  console.log(`Embedded ${documents.length} documents, tokens: ${usage.tokens}`);
  return embeddings; // number[][] -- array of vectors
}

// Usage
const docs = [
  'TypeScript is a typed superset of JavaScript.',
  'React is a library for building user interfaces.',
  'Node.js is a JavaScript runtime built on V8.',
];

const vectors = await embedDocuments(docs);
console.log(`Generated ${vectors.length} embeddings`);
```

**Why good:** Named constant for parallelism, batch processing with `embedMany`, usage tracking, typed output

### Bad Example -- Embedding One at a Time

```typescript
// BAD: Embedding documents one by one
const embeddings: number[][] = [];

for (const doc of documents) {
  const { embedding } = await embed({
    model: 'openai/text-embedding-3-small',
    value: doc,
  });
  embeddings.push(embedding);
}
```

**Why bad:** Sequential API calls are slow and inefficient, use `embedMany` for batch processing which handles parallelism automatically

---

## Pattern 3: Cosine Similarity

### Good Example -- Finding Similar Documents

```typescript
// lib/similarity.ts
import { cosineSimilarity, embed, embedMany } from 'ai';

interface ScoredDocument {
  text: string;
  score: number;
}

const DEFAULT_TOP_N = 3;

export async function findSimilar(
  query: string,
  documents: string[],
  topN: number = DEFAULT_TOP_N,
): Promise<ScoredDocument[]> {
  // Embed query and documents
  const [queryResult, docsResult] = await Promise.all([
    embed({ model: 'openai/text-embedding-3-small', value: query }),
    embedMany({ model: 'openai/text-embedding-3-small', values: documents }),
  ]);

  // Calculate similarity scores
  const scored: ScoredDocument[] = documents.map((text, index) => ({
    text,
    score: cosineSimilarity(queryResult.embedding, docsResult.embeddings[index]),
  }));

  // Sort by similarity (highest first) and take top N
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

// Usage
const results = await findSimilar(
  'How does TypeScript help with large codebases?',
  [
    'TypeScript provides static type checking for JavaScript.',
    'React hooks simplify state management in components.',
    'TypeScript interfaces help define contracts between modules.',
    'CSS-in-JS libraries allow styling React components.',
    'TypeScript enables better IDE support and refactoring tools.',
  ],
);

results.forEach((r) => {
  console.log(`[${r.score.toFixed(3)}] ${r.text}`);
});
```

**Why good:** Parallel embedding with `Promise.all`, `cosineSimilarity` helper, typed return, named constant for default top N, sorted by relevance

---

## Pattern 4: RAG Pipeline (Retrieval Augmented Generation)

### Good Example -- Complete RAG Implementation

```typescript
// lib/rag.ts
import { embed, embedMany, cosineSimilarity, generateText } from 'ai';

// --- Step 1: Document Processing ---

interface DocumentChunk {
  text: string;
  embedding: number[];
  source: string;
}

const CHUNK_MAX_LENGTH = 500;
const CHUNK_OVERLAP = 50;

export function chunkDocument(text: string, source: string): string[] {
  // Simple sentence-based chunking
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > CHUNK_MAX_LENGTH && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      // Keep last part for overlap
      const words = currentChunk.split(' ');
      const overlapWords = words.slice(-Math.ceil(CHUNK_OVERLAP / 5));
      currentChunk = overlapWords.join(' ') + ' ' + sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// --- Step 2: Embedding Storage ---

const MAX_PARALLEL_EMBEDS = 3;

export async function buildIndex(
  documents: Array<{ text: string; source: string }>,
): Promise<DocumentChunk[]> {
  const allChunks: Array<{ text: string; source: string }> = [];

  // Chunk all documents
  for (const doc of documents) {
    const chunks = chunkDocument(doc.text, doc.source);
    for (const chunk of chunks) {
      allChunks.push({ text: chunk, source: doc.source });
    }
  }

  // Batch embed all chunks
  const { embeddings } = await embedMany({
    model: 'openai/text-embedding-3-small',
    values: allChunks.map((c) => c.text),
    maxParallelCalls: MAX_PARALLEL_EMBEDS,
  });

  // Combine chunks with embeddings
  return allChunks.map((chunk, index) => ({
    text: chunk.text,
    embedding: embeddings[index],
    source: chunk.source,
  }));
}

// --- Step 3: Retrieval ---

const DEFAULT_RETRIEVAL_COUNT = 3;
const MIN_SIMILARITY_THRESHOLD = 0.3;

export async function retrieve(
  query: string,
  index: DocumentChunk[],
  topK: number = DEFAULT_RETRIEVAL_COUNT,
): Promise<DocumentChunk[]> {
  const { embedding: queryEmbedding } = await embed({
    model: 'openai/text-embedding-3-small',
    value: query,
  });

  // Score all chunks
  const scored = index
    .map((chunk) => ({
      ...chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .filter((chunk) => chunk.score >= MIN_SIMILARITY_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}

// --- Step 4: Generation ---

export async function ragQuery(
  question: string,
  index: DocumentChunk[],
): Promise<string> {
  // Retrieve relevant chunks
  const relevantChunks = await retrieve(question, index);

  if (relevantChunks.length === 0) {
    return 'I could not find relevant information to answer your question.';
  }

  // Build context from retrieved chunks
  const context = relevantChunks
    .map((chunk, i) => `[Source ${i + 1}: ${chunk.source}]\n${chunk.text}`)
    .join('\n\n');

  // Generate answer using context
  const { text } = await generateText({
    model: 'openai/gpt-4o',
    system: `You are a helpful assistant that answers questions based on the provided context.
Only use information from the context to answer. If the context doesn't contain enough information, say so.
Cite sources using [Source N] notation.`,
    prompt: `Context:\n${context}\n\nQuestion: ${question}`,
  });

  return text;
}
```

**Why good:** Complete pipeline (chunk -> embed -> retrieve -> generate), named constants for all thresholds, similarity filtering, source tracking, system prompt enforces context-only answers, citation support

### Usage Example

```typescript
// app.ts
import { buildIndex, ragQuery } from './lib/rag.js';

// Build the index from your documents
const index = await buildIndex([
  {
    text: 'TypeScript 5.0 introduced decorators...',
    source: 'typescript-5.0-release.md',
  },
  {
    text: 'React Server Components allow rendering...',
    source: 'react-server-components.md',
  },
  // ... more documents
]);

// Query the index
const answer = await ragQuery(
  'What new features were introduced in TypeScript 5.0?',
  index,
);

console.log(answer);
```

---

## Pattern 5: RAG with Streaming

### Good Example -- Streaming RAG Response

```typescript
// lib/stream-rag.ts
import { embed, cosineSimilarity, streamText, smoothStream } from 'ai';
import type { DocumentChunk } from './rag.js';

const DEFAULT_RETRIEVAL_COUNT = 3;

export async function streamRagQuery(
  question: string,
  index: DocumentChunk[],
) {
  // Retrieve relevant chunks
  const { embedding: queryEmbedding } = await embed({
    model: 'openai/text-embedding-3-small',
    value: question,
  });

  const relevantChunks = index
    .map((chunk) => ({
      ...chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, DEFAULT_RETRIEVAL_COUNT);

  const context = relevantChunks
    .map((c, i) => `[Source ${i + 1}]: ${c.text}`)
    .join('\n\n');

  // Stream the answer
  const result = streamText({
    model: 'openai/gpt-4o',
    system: 'Answer based only on the provided context. Cite sources.',
    prompt: `Context:\n${context}\n\nQuestion: ${question}`,
    experimental_transform: smoothStream(),
    onError({ error }) {
      console.error('RAG stream error:', error);
    },
  });

  return result;
}

// Usage in a route handler
export async function POST(request: Request) {
  const { question } = await request.json();
  const result = await streamRagQuery(question, globalIndex);
  return result.toTextStreamResponse();
}
```

**Why good:** Retrieval then streaming generation, `smoothStream()` for natural output, error handling, route handler integration

---

## Pattern 6: Embedding with Abort Signal

### Good Example -- Cancellable Embedding

```typescript
import { embed, embedMany } from 'ai';

const EMBED_TIMEOUT_MS = 10_000;

export async function embedWithTimeout(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: 'openai/text-embedding-3-small',
    value: text,
    abortSignal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
  });

  return embedding;
}

export async function embedManyWithTimeout(texts: string[]): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: 'openai/text-embedding-3-small',
    values: texts,
    abortSignal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
  });

  return embeddings;
}
```

**Why good:** Named constant for timeout, `AbortSignal.timeout()` for automatic cancellation, prevents hanging on slow API calls

---

## Pattern 7: Vector Store Integration Pattern

### Good Example -- Abstract Vector Store

```typescript
// lib/vector-store.ts
import { embed, embedMany, cosineSimilarity } from 'ai';

interface VectorRecord {
  id: string;
  text: string;
  embedding: number[];
  metadata: Record<string, string>;
}

const MAX_PARALLEL_EMBEDS = 3;

// In-memory store (replace with Pinecone, Weaviate, pgvector, etc.)
export class InMemoryVectorStore {
  private records: VectorRecord[] = [];

  async add(items: Array<{ id: string; text: string; metadata?: Record<string, string> }>) {
    const { embeddings } = await embedMany({
      model: 'openai/text-embedding-3-small',
      values: items.map((item) => item.text),
      maxParallelCalls: MAX_PARALLEL_EMBEDS,
    });

    for (let i = 0; i < items.length; i++) {
      this.records.push({
        id: items[i].id,
        text: items[i].text,
        embedding: embeddings[i],
        metadata: items[i].metadata ?? {},
      });
    }
  }

  async search(query: string, topK: number): Promise<Array<VectorRecord & { score: number }>> {
    const { embedding } = await embed({
      model: 'openai/text-embedding-3-small',
      value: query,
    });

    return this.records
      .map((record) => ({
        ...record,
        score: cosineSimilarity(embedding, record.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  get size(): number {
    return this.records.length;
  }
}

// Usage
const store = new InMemoryVectorStore();

await store.add([
  { id: '1', text: 'TypeScript provides static typing.', metadata: { source: 'docs' } },
  { id: '2', text: 'React uses a virtual DOM.', metadata: { source: 'docs' } },
]);

const results = await store.search('What is TypeScript?', 3);
results.forEach((r) => console.log(`[${r.score.toFixed(3)}] ${r.text}`));
```

**Why good:** Abstracted vector store interface (easily swappable), metadata support, batch embedding, named constant for parallelism, clean search API

---

_For core patterns, see [core.md](core.md). For structured output, see [structured-output.md](structured-output.md)._
