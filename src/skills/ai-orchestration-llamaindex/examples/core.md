# LlamaIndex.TS -- Setup, Indexing & Querying Examples

> Core patterns for Settings configuration, document loading, VectorStoreIndex, query engines, and persistence. See [SKILL.md](../SKILL.md) for concepts and decisions.

**Related examples:**

- [agents.md](agents.md) -- Agent creation, tools, multi-agent workflows
- [chat-streaming.md](chat-streaming.md) -- Chat engines, streaming responses
- [ingestion.md](ingestion.md) -- Text splitters, node parsers, custom readers

---

## Settings Configuration -- OpenAI

```typescript
// lib/settings.ts
import "dotenv/config";
import { Settings } from "llamaindex";
import { openai, OpenAIEmbedding } from "@llamaindex/openai";

Settings.llm = openai({ model: "gpt-4o" });
Settings.embedModel = new OpenAIEmbedding({ model: "text-embedding-3-small" });

export { Settings };
```

**Why good:** Centralized config in a single module, import triggers setup, explicit provider

---

## Settings Configuration -- Ollama (Local)

```typescript
// lib/settings.ts
import { Settings, SentenceSplitter } from "llamaindex";
import { ollama } from "@llamaindex/ollama";
import { HuggingFaceEmbedding } from "@llamaindex/huggingface";

const CHUNK_SIZE = 512;
const CHUNK_OVERLAP = 50;

// Local LLM -- no API key needed
Settings.llm = ollama({ model: "mixtral:8x7b" });

// Local embeddings -- no API key needed
Settings.embedModel = new HuggingFaceEmbedding({
  modelType: "BAAI/bge-small-en-v1.5",
});

Settings.nodeParser = new SentenceSplitter({
  chunkSize: CHUNK_SIZE,
  chunkOverlap: CHUNK_OVERLAP,
});
```

**Why good:** Fully local setup, no API keys, named constants for chunk params, explicit embedding model

---

## Basic RAG Pipeline

```typescript
// rag.ts
import "dotenv/config";
import { Settings, SimpleDirectoryReader, VectorStoreIndex } from "llamaindex";
import { openai, OpenAIEmbedding } from "@llamaindex/openai";

Settings.llm = openai({ model: "gpt-4o" });
Settings.embedModel = new OpenAIEmbedding({ model: "text-embedding-3-small" });

async function main() {
  // Step 1: Load documents
  const documents = await new SimpleDirectoryReader().loadData({
    directoryPath: "./data",
  });

  // Step 2: Create vector index (embeds all chunks)
  const index = await VectorStoreIndex.fromDocuments(documents);

  // Step 3: Create query engine
  const queryEngine = index.asQueryEngine();

  // Step 4: Query
  const response = await queryEngine.query({
    query: "What are the main topics in these documents?",
  });

  console.log("Answer:", response.message.content);

  // Step 5: Inspect source nodes for debugging/citations
  for (const node of response.sourceNodes ?? []) {
    console.log(
      `Score: ${node.score}, Text: ${node.node.getText().slice(0, 100)}...`,
    );
  }
}

main().catch(console.error);
```

**Why good:** Complete pipeline, error handling via catch, source node inspection for debugging

---

## Persisted Index -- Load or Create Pattern

```typescript
// index-manager.ts
import {
  VectorStoreIndex,
  storageContextFromDefaults,
  SimpleDirectoryReader,
} from "llamaindex";
import { existsSync } from "node:fs";

const PERSIST_DIR = "./storage";
const DATA_DIR = "./data";

async function getOrCreateIndex(): Promise<VectorStoreIndex> {
  const storageContext = await storageContextFromDefaults({
    persistDir: PERSIST_DIR,
  });

  if (existsSync(PERSIST_DIR)) {
    // Load existing index
    console.log("Loading index from storage...");
    return await VectorStoreIndex.init({ storageContext });
  }

  // Create new index
  console.log("Creating new index...");
  const documents = await new SimpleDirectoryReader().loadData({
    directoryPath: DATA_DIR,
  });

  return await VectorStoreIndex.fromDocuments(documents, { storageContext });
}

const index = await getOrCreateIndex();
const queryEngine = index.asQueryEngine();
```

**Why good:** Checks for existing index first, avoids re-embedding, named constants for paths

---

## Custom Retriever Configuration

```typescript
const SIMILARITY_TOP_K = 5;

// Configure retriever with custom top-k
const retriever = index.asRetriever({
  similarityTopK: SIMILARITY_TOP_K,
});

// Use retriever directly for retrieval without synthesis
const nodes = await retriever.retrieve({ query: "TypeScript generics" });
for (const node of nodes) {
  console.log(
    `[${node.score?.toFixed(3)}] ${node.node.getText().slice(0, 200)}`,
  );
}

// Or use with query engine
const queryEngine = index.asQueryEngine({
  similarityTopK: SIMILARITY_TOP_K,
});
```

**Why good:** Named constant for top-k, direct retriever access for debugging, score inspection

---

## Multiple Indexes for Different Data Sources

```typescript
import {
  VectorStoreIndex,
  SimpleDirectoryReader,
  QueryEngineTool,
} from "llamaindex";

// Separate indexes for different document types
const techDocs = await new SimpleDirectoryReader().loadData({
  directoryPath: "./data/technical",
});
const techIndex = await VectorStoreIndex.fromDocuments(techDocs);

const hrDocs = await new SimpleDirectoryReader().loadData({
  directoryPath: "./data/hr-policies",
});
const hrIndex = await VectorStoreIndex.fromDocuments(hrDocs);

// Wrap as tools for agent use
const techTool = new QueryEngineTool({
  queryEngine: techIndex.asQueryEngine(),
  metadata: {
    name: "technical_docs",
    description: "Search technical documentation for API references and guides",
  },
});

const hrTool = new QueryEngineTool({
  queryEngine: hrIndex.asQueryEngine(),
  metadata: {
    name: "hr_policies",
    description: "Search HR policies for leave, benefits, and company rules",
  },
});
```

**Why good:** Separate indexes for domain separation, descriptive tool metadata guides the LLM

---

## Response with Source Citations

```typescript
const response = await queryEngine.query({
  query: "What is the refund policy?",
});

console.log("Answer:", response.message.content);
console.log("\nSources:");

for (const node of response.sourceNodes ?? []) {
  const metadata = node.node.metadata;
  const score = node.score?.toFixed(3) ?? "N/A";
  const preview = node.node.getText().slice(0, 150);

  console.log(
    `  - [${score}] ${metadata.file_path ?? "unknown"}: ${preview}...`,
  );
}
```

**Why good:** Extracts file path from metadata, shows relevance score, truncates preview text

---

_For agent patterns, see [agents.md](agents.md). For chat and streaming, see [chat-streaming.md](chat-streaming.md). For API reference, see [reference.md](../reference.md)._
