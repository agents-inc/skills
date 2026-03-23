# LlamaIndex.TS -- Ingestion & Text Splitting Examples

> Text splitters, node parsers, custom readers, and ingestion patterns. See [core.md](core.md) for basic setup.

**Prerequisites:** Understand Settings configuration and VectorStoreIndex from [core.md](core.md).

**Related examples:**

- [core.md](core.md) -- Setup, indexing, query engines
- [agents.md](agents.md) -- Agent creation, tools
- [chat-streaming.md](chat-streaming.md) -- Chat engines, streaming

---

## SentenceSplitter Configuration

```typescript
import { SentenceSplitter, Settings } from "llamaindex";

const CHUNK_SIZE = 512;
const CHUNK_OVERLAP = 50;

// Set globally -- affects all indexing operations
Settings.nodeParser = new SentenceSplitter({
  chunkSize: CHUNK_SIZE,
  chunkOverlap: CHUNK_OVERLAP,
});
```

**Why good:** Named constants, sentence-aware splitting preserves meaning, overlap ensures context continuity at boundaries

```typescript
// BAD: Magic numbers, no overlap
Settings.nodeParser = new SentenceSplitter({ chunkSize: 100 });
```

**Why bad:** Tiny chunks lose context, no overlap means important sentences get split across chunks, magic number

---

## Standalone Text Splitting

```typescript
import { SentenceSplitter } from "llamaindex";

const CHUNK_SIZE = 256;

const splitter = new SentenceSplitter({ chunkSize: CHUNK_SIZE });

// Split a single text
const chunks = splitter.splitText(
  "LlamaIndex is a data framework for building LLM applications. " +
    "It provides tools for document loading, text splitting, indexing, " +
    "and querying. The framework supports multiple LLM providers.",
);

console.log(`Split into ${chunks.length} chunks`);
chunks.forEach((chunk, i) => console.log(`Chunk ${i}: ${chunk}`));
```

**Why good:** Useful for testing chunk sizes before indexing, named constant, standalone usage without Settings

---

## MarkdownNodeParser for Structured Documents

```typescript
import { MarkdownNodeParser } from "llamaindex";
import { MarkdownReader } from "@llamaindex/readers/markdown";

const reader = new MarkdownReader();
const documents = await reader.loadData("./docs/api-reference.md");

const parser = new MarkdownNodeParser();
const nodes = parser(documents);

// Nodes preserve markdown structure in metadata
for (const node of nodes) {
  console.log("Headers:", node.metadata);
  // e.g. { 'Header 1': 'API Reference', 'Header 2': 'Authentication' }
  console.log("Text:", node.getText().slice(0, 100));
}
```

**Why good:** Structure-aware parsing, header hierarchy preserved in metadata, enables hierarchical retrieval

---

## CodeSplitter for Source Code

```typescript
import { CodeSplitter } from "@llamaindex/node-parser/code";
import Parser from "tree-sitter";
import TS from "tree-sitter-typescript";

const MAX_CHARS = 1500;

const parser = new Parser();
parser.setLanguage(TS.typescript);

const codeSplitter = new CodeSplitter({
  getParser: () => parser,
  maxChars: MAX_CHARS,
});

// Splits code at function/class boundaries, not arbitrary character positions
const chunks = codeSplitter.splitText(`
export function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}
`);
```

**Why good:** AST-aware splitting preserves function boundaries, named constant for max chars, language-specific parsing

---

## Custom Reader for API Data

```typescript
import { Document } from "llamaindex";
import type { BaseReader } from "llamaindex";

class ApiDocumentReader implements BaseReader {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async loadData(): Promise<Document[]> {
    const response = await fetch(`${this.baseUrl}/documents`);
    const items = (await response.json()) as Array<{
      id: string;
      title: string;
      content: string;
    }>;

    return items.map(
      (item) =>
        new Document({
          text: item.content,
          metadata: {
            source: this.baseUrl,
            title: item.title,
            id: item.id,
          },
        }),
    );
  }
}

// Usage
const reader = new ApiDocumentReader("https://api.example.com");
const documents = await reader.loadData();
```

**Why good:** Implements BaseReader interface, metadata for source tracking, typed API response

---

## SimpleDirectoryReader with Custom File Handlers

```typescript
import { SimpleDirectoryReader } from "llamaindex";
import { PDFReader } from "@llamaindex/readers/pdf";

const NUM_WORKERS = 4;

const reader = new SimpleDirectoryReader();
const documents = await reader.loadData({
  directoryPath: "./data/mixed-files",
  numWorkers: NUM_WORKERS,
  fileExtToReader: {
    // Override default PDF reader with a specific one
    ".pdf": new PDFReader(),
  },
  defaultReader: undefined, // Skip unsupported file types instead of using TextFileReader
});

console.log(`Loaded ${documents.length} documents`);
```

**Why good:** Parallel loading with workers, custom reader mapping, explicit skip for unsupported types

---

## Chunk Size Selection Guide

```typescript
import { SentenceSplitter, Settings } from "llamaindex";

// Short Q&A pairs, FAQs
const FAQ_CHUNK_SIZE = 256;
const FAQ_CHUNK_OVERLAP = 25;

// Technical documentation
const DOCS_CHUNK_SIZE = 512;
const DOCS_CHUNK_OVERLAP = 50;

// Long narratives, reports
const REPORT_CHUNK_SIZE = 1024;
const REPORT_CHUNK_OVERLAP = 100;

// Choose based on your document type
Settings.nodeParser = new SentenceSplitter({
  chunkSize: DOCS_CHUNK_SIZE,
  chunkOverlap: DOCS_CHUNK_OVERLAP,
});
```

**Why good:** Named constants with descriptive names, chunk overlap proportional to chunk size (~10%)

---

## Document Metadata for Filtering

```typescript
import { Document, VectorStoreIndex, MetadataFilter } from "llamaindex";

const documents = [
  new Document({
    text: "Product A costs $99 per month...",
    metadata: { category: "pricing", product: "A" },
  }),
  new Document({
    text: "Product B includes enterprise features...",
    metadata: { category: "features", product: "B" },
  }),
];

const index = await VectorStoreIndex.fromDocuments(documents);

// Query with metadata filtering (when using compatible vector stores)
const queryEngine = index.asQueryEngine({
  preFilters: {
    filters: [{ key: "category", value: "pricing", operator: "==" }],
  },
});
```

**Why good:** Metadata enables filtered retrieval, reduces noise in results, category-based routing

---

_For core patterns, see [core.md](core.md). For agent patterns, see [agents.md](agents.md). For API reference, see [reference.md](../reference.md)._
