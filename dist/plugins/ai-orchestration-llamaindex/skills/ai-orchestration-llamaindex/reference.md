# LlamaIndex.TS Quick Reference

> Package map, method signatures, response modes, and model providers. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Package Installation

```bash
# Core framework (always required)
npm install llamaindex

# LLM providers (install one or more)
npm install @llamaindex/openai       # OpenAI (GPT-4o, GPT-5, embeddings)
npm install @llamaindex/anthropic    # Anthropic (Claude)
npm install @llamaindex/ollama       # Local models via Ollama
npm install @llamaindex/groq         # Groq
npm install @llamaindex/gemini       # Google Gemini

# Agent workflows
npm install @llamaindex/workflow     # agent(), multiAgent(), agentStreamEvent

# Readers (optional -- SimpleDirectoryReader is in core)
npm install @llamaindex/readers      # Additional file readers

# Embedding providers
npm install @llamaindex/huggingface  # Local embeddings (BAAI/bge-small-en-v1.5)

# Tools
npm install @llamaindex/tools        # Built-in tools (wiki, MCP)

# Validation
npm install zod                      # For tool parameter schemas
```

---

## Import Map

| Import                       | Package                | Purpose                                          |
| ---------------------------- | ---------------------- | ------------------------------------------------ |
| `Settings`                   | `llamaindex`           | Global singleton for LLM, embedding, node parser |
| `VectorStoreIndex`           | `llamaindex`           | Vector-based document index                      |
| `SummaryIndex`               | `llamaindex`           | Full-document summary index                      |
| `SimpleDirectoryReader`      | `llamaindex`           | Load files from a directory                      |
| `SentenceSplitter`           | `llamaindex`           | Sentence-aware text chunking                     |
| `ContextChatEngine`          | `llamaindex`           | Chat engine with retrieval context               |
| `storageContextFromDefaults` | `llamaindex`           | Storage context for persistence                  |
| `tool`                       | `llamaindex`           | Define tools with Zod schemas                    |
| `FunctionTool`               | `llamaindex`           | Wrap functions as agent tools                    |
| `QueryEngineTool`            | `llamaindex`           | Wrap query engines as agent tools                |
| `getResponseSynthesizer`     | `llamaindex`           | Factory for response synthesis modes             |
| `MarkdownNodeParser`         | `llamaindex`           | Structure-aware markdown splitting               |
| `openai` / `OpenAIEmbedding` | `@llamaindex/openai`   | OpenAI LLM and embedding provider                |
| `ollama`                     | `@llamaindex/ollama`   | Ollama local model provider                      |
| `agent` / `multiAgent`       | `@llamaindex/workflow` | Agent and multi-agent creation                   |
| `agentStreamEvent`           | `@llamaindex/workflow` | Typed event filter for streaming                 |

---

## Settings Singleton

```typescript
import { Settings, SentenceSplitter } from "llamaindex";
import { openai, OpenAIEmbedding } from "@llamaindex/openai";

Settings.llm = openai({ model: "gpt-4o" });
Settings.embedModel = new OpenAIEmbedding({ model: "text-embedding-3-small" });
Settings.nodeParser = new SentenceSplitter({ chunkSize: 512 });
Settings.chunkSize = 512; // Shortcut for node parser chunk size
Settings.chunkOverlap = 50; // Shortcut for node parser overlap
```

### Settings Properties

| Property          | Type              | Default               | Purpose                           |
| ----------------- | ----------------- | --------------------- | --------------------------------- |
| `llm`             | `LLM`             | OpenAI (lazy)         | Language model for generation     |
| `embedModel`      | `BaseEmbedding`   | OpenAI ada-002 (lazy) | Embedding model for vector index  |
| `nodeParser`      | `NodeParser`      | SentenceSplitter      | Document chunking strategy        |
| `chunkSize`       | `number`          | 1024                  | Token count per chunk             |
| `chunkOverlap`    | `number`          | 20                    | Token overlap between chunks      |
| `callbackManager` | `CallbackManager` | empty                 | Event callbacks for observability |

---

## VectorStoreIndex Methods

```typescript
// Create from documents (embeds all chunks)
const index = await VectorStoreIndex.fromDocuments(documents, {
  storageContext?,    // StorageContext for persistence
  serviceContext?,    // Deprecated -- use Settings instead
});

// Load from persisted storage
const index = await VectorStoreIndex.init({
  storageContext,     // Required: StorageContext with persistDir
});

// Get query engine
const queryEngine = index.asQueryEngine({
  similarityTopK?: number,     // Number of results to retrieve (default: 2)
  responseSynthesizer?: ResponseSynthesizer,
});

// Get retriever
const retriever = index.asRetriever({
  similarityTopK?: number,     // Number of results to retrieve
});

// Get chat engine
const chatEngine = index.asChatEngine();
```

---

## Query Engine Interface

```typescript
// Basic query
const response = await queryEngine.query({ query: "Your question" });
response.message.content; // string -- the answer
response.sourceNodes; // NodeWithScore[] -- retrieved chunks with relevance scores

// Streaming query
const stream = await queryEngine.query({
  query: "Your question",
  stream: true,
});
for await (const chunk of stream) {
  process.stdout.write(chunk.message.content);
}
```

---

## Chat Engine Interface

```typescript
// Basic chat (maintains conversation history)
const response = await chatEngine.chat({ message: "Hello" });
response.message.content; // string -- the reply

// Streaming chat
const stream = await chatEngine.chat({ message: "Hello", stream: true });
for await (const chunk of stream) {
  process.stdout.write(chunk.message.content);
}

// Reset conversation
chatEngine.reset();
```

---

## Response Synthesizer Modes

| Mode                | Behavior                                     | Best For            |
| ------------------- | -------------------------------------------- | ------------------- |
| `compact` (default) | Stuffs chunks into prompt, refines if needed | General purpose     |
| `refine`            | Sequential refinement through each chunk     | Detailed answers    |
| `tree_summarize`    | Recursive tree summarization                 | Summarization tasks |
| `multi_modal`       | Handles text + images/audio                  | Multi-modal queries |

```typescript
import { getResponseSynthesizer, responseModeSchema } from "llamaindex";

const synthesizer = getResponseSynthesizer(responseModeSchema.Enum.compact);
```

---

## Agent API

```typescript
import { agent, multiAgent, agentStreamEvent } from "@llamaindex/workflow";
import { tool } from "llamaindex";
import { z } from "zod";

// Define a tool
const myTool = tool({
  name: "toolName",
  description: "What this tool does (max 125 chars)",
  parameters: z.object({ /* Zod schema */ }),
  execute: async (input) => { /* implementation */ },
});

// Single agent
const myAgent = agent({
  tools: [myTool],
  llm?: LLM,                    // Override Settings.llm
  systemPrompt?: string,
});

// Run
const result = await myAgent.run("prompt");
result.data;                     // Response data

// Stream
for await (const event of myAgent.runStream("prompt")) {
  if (agentStreamEvent.include(event)) {
    process.stdout.write(event.data.delta);
  }
}

// Multi-agent
const agents = multiAgent({
  agents: [agentA, agentB],
  rootAgent: agentA,
});
```

---

## SimpleDirectoryReader Options

```typescript
const reader = new SimpleDirectoryReader();
const documents = await reader.loadData({
  directoryPath: "./data",             // Required: path to directory
  numWorkers?: number,                 // Concurrent workers (default: 1, max: 9)
  overrideReader?: BaseReader,         // Use one reader for all files
  fileExtToReader?: Record<string, BaseReader>,  // Map extensions to readers
  defaultReader?: BaseReader,          // Fallback reader (default: TextFileReader)
});
```

### Supported File Types (Default)

| Extension        | Reader         |
| ---------------- | -------------- |
| `.txt`           | TextFileReader |
| `.pdf`           | PDFReader      |
| `.csv`           | CSVReader      |
| `.md`            | MarkdownReader |
| `.docx`          | DocxReader     |
| `.html` / `.htm` | HTMLReader     |
| `.jpg` / `.png`  | ImageReader    |

---

## Node Parsers

| Parser               | Import                         | Use Case                                   |
| -------------------- | ------------------------------ | ------------------------------------------ |
| `SentenceSplitter`   | `llamaindex`                   | General text (default)                     |
| `MarkdownNodeParser` | `llamaindex`                   | Markdown with header hierarchy             |
| `CodeSplitter`       | `@llamaindex/node-parser/code` | Source code (AST-aware, needs tree-sitter) |

---

## LLM Provider Configuration

### OpenAI

```typescript
import { openai, OpenAIEmbedding } from "@llamaindex/openai";
Settings.llm = openai({ model: "gpt-4o", apiKey: process.env.OPENAI_API_KEY });
Settings.embedModel = new OpenAIEmbedding({ model: "text-embedding-3-small" });
```

### Ollama (Local)

```typescript
import { ollama } from "@llamaindex/ollama";
Settings.llm = ollama({ model: "mixtral:8x7b" });
```

### Anthropic

```typescript
import { anthropic } from "@llamaindex/anthropic";
Settings.llm = anthropic({ model: "claude-sonnet-4-20250514" });
```

---

## TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true,
    "lib": ["ES2022", "DOM.AsyncIterable"]
  }
}
```

**Required settings:**

- `"moduleResolution": "bundler"` or `"nodenext"` -- classic `"node"` will fail
- `"DOM.AsyncIterable"` in `lib` -- needed for Web Stream API types
- Node.js >= 20

---

## Environment Variables

| Variable            | Provider  | Purpose                                                      |
| ------------------- | --------- | ------------------------------------------------------------ |
| `OPENAI_API_KEY`    | OpenAI    | API key (auto-detected by `@llamaindex/openai`)              |
| `ANTHROPIC_API_KEY` | Anthropic | API key                                                      |
| `OLLAMA_HOST`       | Ollama    | Custom Ollama server URL (default: `http://localhost:11434`) |

---

## Storage Context

```typescript
import { storageContextFromDefaults } from "llamaindex";

// Create with persistence
const ctx = await storageContextFromDefaults({ persistDir: "./storage" });

// Files created in persistDir:
// - docstore.json        (document metadata)
// - index_store.json     (index structure)
// - vector_store.json    (embeddings)
// - graph_store.json     (graph relationships)
```
